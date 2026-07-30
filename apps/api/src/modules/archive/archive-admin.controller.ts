import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  ValidationPipe,
} from "@nestjs/common";
import type { ArchiveEntityType } from "@prisma/client";

import type { AuthenticatedRequest } from "../../common/auth.types";
import { AdminEndpoint } from "../../common/decorators/admin-endpoint.decorator";
import { CurrentPrincipal } from "../../common/decorators/current-principal.decorator";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { ArchiveJobsService } from "./archive-jobs.service";
import { ArchiveQueryService } from "./archive-query.service";
import { ArchiveReconciliationService } from "./archive-reconciliation.service";
import {
  ArchiveGatewayCommandDto,
  CreatePurgePreviewDto,
  EnqueuePurgeDto,
  EnqueueSensorReadingPurgeDto,
  ListArchiveQueryDto,
  RetryDeletionJobDto,
  SensorReadingPurgeFilterDto,
} from "./dto/archive.dto";

@AdminEndpoint()
@Controller("admin/archive")
export class ArchiveAdminController {
  constructor(
    @Inject(ArchiveQueryService) private readonly query: ArchiveQueryService,
    @Inject(ArchiveJobsService) private readonly jobs: ArchiveJobsService,
    @Inject(ArchiveReconciliationService)
    private readonly reconciliation: ArchiveReconciliationService,
  ) {}

  @RequirePermissions("archive.view")
  @Get()
  list(
    @Query(new ValidationPipe({ expectedType: ListArchiveQueryDto, transform: true }))
    query: ListArchiveQueryDto,
  ) {
    return this.query.list(query);
  }

  @RequirePermissions("archive.view")
  @Get("reconciliation/report")
  reconciliationReport() {
    return this.reconciliation.report();
  }

  @RequirePermissions("archive.view")
  @Get(":rootType/:rootId")
  detail(@Param("rootType") rootType: ArchiveEntityType, @Param("rootId") rootId: string) {
    return this.query.detail(rootType, rootId);
  }

  @RequirePermissions("archive.view")
  @Post("purge/preview")
  preview(
    @Body(new ValidationPipe({ expectedType: CreatePurgePreviewDto, transform: true }))
    dto: CreatePurgePreviewDto,
  ) {
    return this.query.preview(dto.rootType, dto.rootId);
  }

  @RequirePermissions("archive.purge")
  @Post("purge/jobs")
  enqueue(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: EnqueuePurgeDto, transform: true }))
    dto: EnqueuePurgeDto,
  ) {
    return this.jobs.enqueue(auth!.principal, dto);
  }

  @RequirePermissions("archive.purge", "sensor-readings.purge")
  @Post("sensor-readings/preview")
  previewSensorReadings(
    @Body(new ValidationPipe({ expectedType: SensorReadingPurgeFilterDto, transform: true }))
    dto: SensorReadingPurgeFilterDto,
  ) {
    return this.query.sensorReadingPreview(dto);
  }

  @RequirePermissions("archive.purge", "sensor-readings.purge")
  @Post("sensor-readings/jobs")
  enqueueSensorReadings(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Body(new ValidationPipe({ expectedType: EnqueueSensorReadingPurgeDto, transform: true }))
    dto: EnqueueSensorReadingPurgeDto,
  ) {
    return this.jobs.enqueueSensorReadings(auth!.principal, dto);
  }

  @RequirePermissions("archive.view")
  @Get("purge/jobs/:jobId")
  status(@CurrentPrincipal() auth: AuthenticatedRequest["auth"], @Param("jobId") jobId: string) {
    return this.jobs.get(auth!.principal, jobId);
  }

  @RequirePermissions("archive.purge")
  @Post("purge/jobs/:jobId/retry")
  retry(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("jobId") jobId: string,
    @Body(new ValidationPipe({ expectedType: RetryDeletionJobDto, transform: true }))
    dto: RetryDeletionJobDto,
  ) {
    void dto;
    return this.jobs.retry(auth!.principal, jobId);
  }

  @RequirePermissions("mqtt-commands.manage")
  @Patch("gateway-commands/:commandId")
  archiveGatewayCommand(
    @CurrentPrincipal() auth: AuthenticatedRequest["auth"],
    @Param("commandId") commandId: string,
    @Body(new ValidationPipe({ expectedType: ArchiveGatewayCommandDto, transform: true }))
    dto: ArchiveGatewayCommandDto,
  ) {
    return this.jobs.archiveGatewayCommand(auth!.principal, commandId, dto.reason);
  }
}
