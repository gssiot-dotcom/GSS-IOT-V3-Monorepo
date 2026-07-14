import { SetMetadata } from "@nestjs/common";

export const REQUIRED_SCOPE_KEY = "required-scope";

export type ScopeRequirement = {
  accessLevel?: "manage" | "view";
  param: string;
  type: "company" | "area" | "building";
};

function requireScope(
  type: ScopeRequirement["type"],
  param: string,
  accessLevel: ScopeRequirement["accessLevel"] = "view",
) {
  return SetMetadata(REQUIRED_SCOPE_KEY, { accessLevel, param, type } satisfies ScopeRequirement);
}

export const RequireCompanyScope = (param = "companyId") => requireScope("company", param);
export const RequireAreaScope = (param = "areaId") => requireScope("area", param);
export const RequireBuildingScope = (param = "buildingId") => requireScope("building", param);
export const RequireManageAreaScope = (param = "areaId") => requireScope("area", param, "manage");
export const RequireManageBuildingScope = (param = "buildingId") =>
  requireScope("building", param, "manage");
