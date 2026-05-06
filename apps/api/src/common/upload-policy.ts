import { BadRequestException } from "@nestjs/common";

type UploadableFile = {
  originalname: string;
  mimetype: string;
  size: number;
};

function splitCsv(value: string | undefined, fallback: string[]) {
  if (!value?.trim()) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function getUploadMaxBytes() {
  const maxBytes = Number.parseInt(process.env.UPLOAD_MAX_BYTES ?? `${25 * 1024 * 1024}`, 10);
  return Number.isFinite(maxBytes) ? Math.max(1024, maxBytes) : 25 * 1024 * 1024;
}

export function validateUploadFile(file: UploadableFile) {
  const maxBytes = getUploadMaxBytes();
  if (file.size > maxBytes) {
    throw new BadRequestException(`File is too large. Max allowed size is ${maxBytes} bytes`);
  }

  const allowedImageTypes = splitCsv(process.env.UPLOAD_ALLOWED_IMAGE_MIME_TYPES, [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
  ]);
  const allowedVideoTypes = splitCsv(process.env.UPLOAD_ALLOWED_VIDEO_MIME_TYPES, [
    "video/mp4",
    "video/webm"
  ]);
  const allowedFileTypes = splitCsv(process.env.UPLOAD_ALLOWED_FILE_MIME_TYPES, [
    "application/pdf",
    "text/plain"
  ]);

  const allowedTypes = new Set([...allowedImageTypes, ...allowedVideoTypes, ...allowedFileTypes]);
  const mimeType = file.mimetype.toLowerCase();

  if (!allowedTypes.has(mimeType)) {
    throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
  }

  const loweredName = file.originalname.toLowerCase();
  if (loweredName.endsWith(".exe") || loweredName.endsWith(".bat") || loweredName.endsWith(".cmd")) {
    throw new BadRequestException("Executable files are not allowed");
  }
}
