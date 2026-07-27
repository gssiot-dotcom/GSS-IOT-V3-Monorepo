import {
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Param,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CompanyEndpoint } from "../../common/decorators/company-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CompanyBrandingService } from "./company-branding.service";
import {
  COMPANY_LOGO_MAX_BYTES,
  type UploadedCompanyLogo,
  validateCompanyLogoFile,
} from "./company-logo-file";

interface LogoResponse {
  setHeader(name: string, value: number | string): void;
  status(code: number): LogoResponse;
}

const logoUploadInterceptor = FileInterceptor("logo", {
  limits: { fileSize: COMPANY_LOGO_MAX_BYTES, files: 1 },
});

@CompanyEndpoint()
@Controller("company")
export class CompanyBrandingCompanyController {
  constructor(@Inject(CompanyBrandingService) private readonly branding: CompanyBrandingService) {}

  @Get("branding/logo")
  async getLogo(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: LogoResponse,
  ) {
    const companyId = await this.branding.getCompanyIdForUser(auth!.principal.sub);
    return streamLogo(this.branding, companyId, ifNoneMatch, response);
  }

  @RequirePermissions("settings.company.manage")
  @Put("settings/logo")
  @UseInterceptors(logoUploadInterceptor)
  async replaceLogo(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @UploadedFile() file?: UploadedCompanyLogo,
  ) {
    const companyId = await this.branding.getCompanyIdForUser(auth!.principal.sub);
    return this.branding.replaceLogo(auth!.principal, companyId, validateCompanyLogoFile(file));
  }

  @RequirePermissions("settings.company.manage")
  @Delete("settings/logo")
  async removeLogo(@CurrentPrincipal() auth: AuthenticatedRequest["auth"]) {
    const companyId = await this.branding.getCompanyIdForUser(auth!.principal.sub);
    return this.branding.removeLogo(auth!.principal, companyId);
  }
}

@AdminEndpoint()
@Controller("admin/companies")
export class CompanyBrandingAdminController {
  constructor(@Inject(CompanyBrandingService) private readonly branding: CompanyBrandingService) {}

  @RequirePermissions("companies.view")
  @Get(":companyId/logo")
  getLogo(
    @Param("companyId") companyId: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: LogoResponse,
  ) {
    return streamLogo(this.branding, companyId, ifNoneMatch, response);
  }

  @RequirePermissions("companies.update")
  @Put(":companyId/logo")
  @UseInterceptors(logoUploadInterceptor)
  replaceLogo(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
    @UploadedFile() file?: UploadedCompanyLogo,
  ) {
    return this.branding.replaceLogo(auth!.principal, companyId, validateCompanyLogoFile(file));
  }

  @RequirePermissions("companies.update")
  @Delete(":companyId/logo")
  removeLogo(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("companyId") companyId: string,
  ) {
    return this.branding.removeLogo(auth!.principal, companyId);
  }
}

async function streamLogo(
  branding: CompanyBrandingService,
  companyId: string,
  ifNoneMatch: string | undefined,
  response: LogoResponse,
): Promise<StreamableFile | undefined> {
  const logo = await branding.getLogo(companyId);
  response.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
  response.setHeader("ETag", logo.etag);
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (ifNoneMatch === logo.etag) {
    response.status(304);
    return undefined;
  }
  return new StreamableFile(logo.body, {
    length: logo.body.length,
    type: logo.contentType,
  });
}
