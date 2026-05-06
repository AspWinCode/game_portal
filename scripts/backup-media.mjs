import { mkdirSync, createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

const outputDir = process.argv[2];

if (!outputDir) {
  console.error("Output directory is required");
  process.exit(1);
}

const bucket = process.env.S3_BUCKET;
const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false";

if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
  console.error("S3 backup requires S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY");
  process.exit(1);
}

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
});

async function main() {
  mkdirSync(outputDir, { recursive: true });
  let continuationToken;
  let copied = 0;

  do {
    const listed = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken
      })
    );

    for (const object of listed.Contents ?? []) {
      if (!object.Key) {
        continue;
      }

      const destination = join(outputDir, ...object.Key.split("/"));
      mkdirSync(dirname(destination), { recursive: true });

      const response = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: object.Key
        })
      );

      if (response.Body) {
        await pipeline(response.Body, createWriteStream(destination));
        copied += 1;
      }
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`S3-compatible media backup completed: ${outputDir} (${copied} objects)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
