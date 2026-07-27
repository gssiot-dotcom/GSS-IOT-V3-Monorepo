import { extname } from "node:path";

import { BadRequestException } from "@nestjs/common";

export const BUILDING_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const BUILDING_IMAGE_MAX_PER_KIND = 4;

export interface UploadedBuildingImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ValidatedBuildingImage {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

export function validateBuildingImageFile(file?: UploadedBuildingImage): ValidatedBuildingImage {
  if (!file?.buffer?.length || file.size <= 0) {
    throw new BadRequestException("A non-empty building image file is required.");
  }
  if (file.buffer.length > BUILDING_IMAGE_MAX_BYTES || file.size > BUILDING_IMAGE_MAX_BYTES) {
    throw new BadRequestException("Building image files must be 8 MiB or smaller.");
  }

  const extension = extname(file.originalname).toLowerCase();
  const detected = detectImage(file.buffer);
  const extensionMatches =
    (detected.extension === "jpg" && (extension === ".jpg" || extension === ".jpeg")) ||
    extension === `.${detected.extension}`;
  if (file.mimetype !== detected.contentType || !extensionMatches) {
    throw new BadRequestException("The image MIME type, extension and file content must match.");
  }
  return { body: file.buffer, ...detected };
}

function detectImage(body: Buffer): Omit<ValidatedBuildingImage, "body"> {
  if (hasPrefix(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (hasPrefix(body, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    body.length >= 12 &&
    body.subarray(0, 4).toString("ascii") === "RIFF" &&
    body.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  throw new BadRequestException("Only valid PNG, JPEG or WebP building images are supported.");
}

function hasPrefix(body: Buffer, bytes: number[]): boolean {
  return body.length >= bytes.length && bytes.every((byte, index) => body[index] === byte);
}
