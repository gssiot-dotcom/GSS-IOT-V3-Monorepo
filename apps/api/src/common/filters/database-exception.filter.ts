import {
  Catch,
  HttpStatus,
  Logger,
  type ExceptionFilter,
  type ArgumentsHost,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

interface HttpRequest {
  method: string;
  originalUrl?: string;
  url: string;
}

interface HttpResponse {
  status(code: number): { json(body: unknown): void };
}

type DatabaseException =
  | Prisma.PrismaClientInitializationError
  | Prisma.PrismaClientKnownRequestError
  | Prisma.PrismaClientRustPanicError
  | Prisma.PrismaClientUnknownRequestError;

@Catch(
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientRustPanicError,
  Prisma.PrismaClientUnknownRequestError,
)
export class DatabaseExceptionFilter implements ExceptionFilter<DatabaseException> {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: DatabaseException, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response = context.getResponse<HttpResponse>();
    const code =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : exception.name;
    const meta =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception.meta : undefined;
    this.logger.error(
      JSON.stringify({
        code,
        message: exception.message,
        meta,
        method: request.method,
        path: request.originalUrl || request.url,
      }),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: "A database operation failed. Please try again.",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
