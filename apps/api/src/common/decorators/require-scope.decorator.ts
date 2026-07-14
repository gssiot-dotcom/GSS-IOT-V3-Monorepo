import { SetMetadata } from "@nestjs/common";

export const REQUIRED_SCOPE_KEY = "required-scope";

export type ScopeRequirement = {
  param: string;
  type: "company" | "area" | "building";
};

function requireScope(type: ScopeRequirement["type"], param: string) {
  return SetMetadata(REQUIRED_SCOPE_KEY, { param, type } satisfies ScopeRequirement);
}

export const RequireCompanyScope = (param = "companyId") => requireScope("company", param);
export const RequireAreaScope = (param = "areaId") => requireScope("area", param);
export const RequireBuildingScope = (param = "buildingId") => requireScope("building", param);
