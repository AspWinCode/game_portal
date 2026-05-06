import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { CreateBucketCommand, DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

type UploadableFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type StoredMediaObject = {
  key: string;
  url: string;
};

@Injectable()
export class MediaStorageService {
  private readonly provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
  private readonly localUploadsDir = process.env.LOCAL_UPLOADS_DIR
    ? join(process.cwd(), process.env.LOCAL_UPLOADS_DIR)
    : join(process.cwd(), "uploads");
  private readonly localPublicPrefix = process.env.LOCAL_UPLOADS_PUBLIC_PREFIX ?? "/uploads";
  private readonly s3Bucket = process.env.S3_BUCKET ?? "";
  private readonly s3Endpoint = process.env.S3_ENDPOINT;
  private readonly s3Region = process.env.S3_REGION ?? "us-east-1";
  private readonly s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  private readonly s3ForcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false";
  private readonly s3AutoCreateBucket = (process.env.S3_CREATE_BUCKET_IF_MISSING ?? "false").toLowerCase() === "true";
  private readonly s3Client =
    this.provider === "s3"
      ? new S3Client({
          region: this.s3Region,
          endpoint: this.s3Endpoint,
          forcePathStyle: this.s3ForcePathStyle,
          credentials:
            process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
              ? {
                  accessKeyId: process.env.S3_ACCESS_KEY_ID,
                  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
                }
              : undefined
        })
      : null;

  async storeFile(file: UploadableFile): Promise<StoredMediaObject> {
    const key = this.buildObjectKey(file);

    if (this.provider === "s3") {
      return await this.storeFileInS3(file, key);
    }

    return await this.storeFileLocally(file, key);
  }

  async deleteFileByUrl(url: string): Promise<void> {
    const key = this.extractObjectKey(url);
    if (!key) {
      return;
    }

    if (this.provider === "s3") {
      await this.deleteFileInS3(key);
      return;
    }

    await this.deleteFileLocally(key);
  }

  buildManualUrl(filename: string): string {
    const safeFilename = encodeURIComponent(this.sanitizeFilename(filename));

    if (this.provider === "s3") {
      return this.buildS3PublicUrl(`manual/${safeFilename}`);
    }

    return `${this.localPublicPrefix}/manual/${safeFilename}`;
  }

  private async storeFileLocally(file: UploadableFile, key: string): Promise<StoredMediaObject> {
    await mkdir(this.localUploadsDir, { recursive: true });
    await writeFile(join(this.localUploadsDir, key), file.buffer);

    return {
      key,
      url: `${this.localPublicPrefix}/${encodeURIComponent(key)}`
    };
  }

  private async storeFileInS3(file: UploadableFile, key: string): Promise<StoredMediaObject> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new InternalServerErrorException("S3 storage is enabled but S3_BUCKET or client config is missing");
    }

    if (this.s3AutoCreateBucket) {
      await this.ensureBucketExists();
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );

    return {
      key,
      url: this.buildS3PublicUrl(key)
    };
  }

  private async deleteFileLocally(key: string): Promise<void> {
    try {
      await unlink(join(this.localUploadsDir, key));
    } catch {
      // Missing local file should not block asset cleanup in the database.
    }
  }

  private async deleteFileInS3(key: string): Promise<void> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new InternalServerErrorException("S3 storage is enabled but S3_BUCKET or client config is missing");
    }

    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.s3Bucket,
        Key: key
      })
    );
  }

  private async ensureBucketExists() {
    if (!this.s3Client || !this.s3Bucket) {
      return;
    }

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.s3Bucket }));
    } catch {
      await this.s3Client.send(new CreateBucketCommand({ Bucket: this.s3Bucket }));
    }
  }

  private buildObjectKey(file: UploadableFile): string {
    const safeBaseName = this.sanitizeFilename(file.originalname)
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "asset";
    const extension = extname(file.originalname) || this.extensionFromMime(file.mimetype);

    return `${Date.now()}-${safeBaseName}${extension}`;
  }

  sanitizeFilename(filename: string) {
    return filename
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "asset";
  }

  private extractObjectKey(url: string): string | null {
    if (this.provider === "s3") {
      const base = this.s3PublicBaseUrl
        ? this.s3PublicBaseUrl.replace(/\/$/, "")
        : this.s3Endpoint && this.s3Bucket
          ? `${this.s3Endpoint.replace(/\/$/, "")}/${this.s3Bucket}`
          : null;

      if (!base || !url.startsWith(base)) {
        return null;
      }

      return decodeURIComponent(url.slice(base.length).replace(/^\/+/, ""));
    }

    const prefix = this.localPublicPrefix.replace(/\/$/, "");
    if (!url.startsWith(prefix)) {
      return null;
    }

    return decodeURIComponent(url.slice(prefix.length).replace(/^\/+/, ""));
  }

  private buildS3PublicUrl(key: string): string {
    if (this.s3PublicBaseUrl) {
      return `${this.s3PublicBaseUrl.replace(/\/$/, "")}/${key}`;
    }

    if (!this.s3Endpoint || !this.s3Bucket) {
      throw new InternalServerErrorException("Cannot build S3 public URL without S3 endpoint and bucket");
    }

    const endpoint = this.s3Endpoint.replace(/\/$/, "");
    return `${endpoint}/${this.s3Bucket}/${key}`;
  }

  private extensionFromMime(mimeType: string): string {
    if (mimeType === "image/png") {
      return ".png";
    }
    if (mimeType === "image/jpeg") {
      return ".jpg";
    }
    if (mimeType === "image/webp") {
      return ".webp";
    }
    if (mimeType === "video/mp4") {
      return ".mp4";
    }
    if (mimeType === "application/pdf") {
      return ".pdf";
    }
    if (mimeType === "text/plain") {
      return ".txt";
    }
    return "";
  }
}
