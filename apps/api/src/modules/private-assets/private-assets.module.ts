import { Module } from "@nestjs/common";

import { PrivateAssetStorageService } from "./private-asset-storage.service";

@Module({
  exports: [PrivateAssetStorageService],
  providers: [PrivateAssetStorageService],
})
export class PrivateAssetsModule {}
