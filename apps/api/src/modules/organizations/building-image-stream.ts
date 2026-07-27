import { StreamableFile } from "@nestjs/common";

import type { AuthTokenPayload } from "../../common/auth.types";
import type { BuildingImagesService } from "./building-images.service";

export interface BuildingImageResponse {
  setHeader(name: string, value: number | string): void;
  status(code: number): BuildingImageResponse;
}

export async function streamBuildingImage(
  images: BuildingImagesService,
  actor: AuthTokenPayload,
  imageId: string,
  ifNoneMatch: string | undefined,
  response: BuildingImageResponse,
): Promise<StreamableFile | undefined> {
  const image = await images.content(actor, imageId);
  response.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
  response.setHeader("ETag", image.etag);
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (ifNoneMatch === image.etag) {
    response.status(304);
    return undefined;
  }
  return new StreamableFile(image.body, {
    length: image.body.length,
    type: image.contentType,
  });
}
