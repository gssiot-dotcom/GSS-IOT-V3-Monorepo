import { BadRequestException } from "@nestjs/common";

export const COMPANY_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export interface UploadedCompanyLogo {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface ValidatedCompanyLogo {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

export function validateCompanyLogoFile(file?: UploadedCompanyLogo): ValidatedCompanyLogo {
  if (!file?.buffer?.length || file.size <= 0) {
    throw new BadRequestException("A non-empty company logo file is required.");
  }
  if (file.buffer.length > COMPANY_LOGO_MAX_BYTES || file.size > COMPANY_LOGO_MAX_BYTES) {
    throw new BadRequestException("Company logo files must be 2 MB or smaller.");
  }

  if (hasPrefix(file.buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { body: file.buffer, contentType: "image/png", extension: "png" };
  }
  if (hasPrefix(file.buffer, [0xff, 0xd8, 0xff])) {
    return { body: file.buffer, contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    file.buffer.length >= 12 &&
    file.buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    file.buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { body: file.buffer, contentType: "image/webp", extension: "webp" };
  }

  throw new BadRequestException("Only valid PNG, JPEG or WebP company logos are supported.");
}

function hasPrefix(body: Buffer, bytes: number[]): boolean {
  return body.length >= bytes.length && bytes.every((byte, index) => body[index] === byte);
}
