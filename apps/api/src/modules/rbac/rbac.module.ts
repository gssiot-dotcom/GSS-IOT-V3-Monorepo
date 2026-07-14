import { Module } from "@nestjs/common";

import { SafeAdminPolicyService } from "./safe-admin-policy.service";
import { PermissionResolverService } from "./permission-resolver.service";

@Module({
  providers: [PermissionResolverService, SafeAdminPolicyService],
  exports: [PermissionResolverService, SafeAdminPolicyService],
})
export class RbacModule {}
