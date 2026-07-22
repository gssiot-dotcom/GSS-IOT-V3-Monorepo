import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditActorType, ReportJobStatus } from "@prisma/client";
import type { ReportFileFormat } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../prisma/prisma.service";
import { ReportStorageService } from "./report-storage.service";

export interface CompleteReportInput {
  content: Buffer;
  contentType: string;
  createdById?: string;
  createdByType?: AuditActorType;
  expiresAt: Date;
  fileName: string;
  format: ReportFileFormat;
}

@Injectable()
export class ReportGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ReportStorageService) private readonly storage: ReportStorageService,
  ) {}

  async markProcessing(jobId: string) {
    const job = await this.claimPending(jobId);
    if (!job) {
      throw new ConflictException("The report job is not pending.");
    }
    return job;
  }

  async claimPending(jobId: string) {
    const result = await this.prisma.reportJob.updateMany({
      data: { progress: 1, status: ReportJobStatus.PROCESSING },
      where: { id: jobId, status: ReportJobStatus.PENDING },
    });
    if (result.count !== 1) return null;
    return this.prisma.reportJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  async complete(jobId: string, input: CompleteReportInput) {
    const job = await this.prisma.reportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException("The report job was not found.");
    if (job.status !== ReportJobStatus.PROCESSING) {
      throw new ConflictException("Only a processing report job can be completed.");
    }
    this.validateInput(input);

    const storageKey = `reports/${randomUUID()}.${input.format.toLowerCase()}`;
    await this.storage.put(storageKey, input.content, input.contentType);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const reportExport = await tx.reportExport.create({
          data: {
            contentType: input.contentType,
            createdById: input.createdById,
            createdByType: input.createdByType ?? AuditActorType.SYSTEM,
            expiresAt: input.expiresAt,
            fileName: input.fileName,
            format: input.format,
            reportJobId: job.id,
            sizeBytes: input.content.byteLength,
            storageKey,
          },
        });
        await tx.reportJob.update({
          data: {
            completedAt: new Date(),
            errorMessage: null,
            progress: 100,
            status: ReportJobStatus.COMPLETED,
          },
          where: { id: job.id },
        });
        return reportExport;
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async fail(jobId: string, errorMessage: string) {
    const message = errorMessage.trim().slice(0, 1000);
    if (!message) throw new BadRequestException("A report failure reason is required.");
    return this.prisma.reportJob.updateMany({
      data: { errorMessage: message, status: ReportJobStatus.FAILED },
      where: { id: jobId, status: { in: [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING] } },
    });
  }

  private validateInput(input: CompleteReportInput): void {
    if (!input.content.length) throw new BadRequestException("A report export cannot be empty.");
    if (input.expiresAt <= new Date()) {
      throw new BadRequestException("A report export must expire in the future.");
    }
    if (!/^[^\\/]+$/.test(input.fileName) || input.fileName.trim() !== input.fileName) {
      throw new BadRequestException("The report file name is invalid.");
    }
  }
}
