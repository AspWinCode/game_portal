import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { AuthRequest } from "./auth.types.js";
import { writeOperationalLog } from "./operational-log.js";

@Catch()
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = context.getRequest<AuthRequest>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === "string"
        ? exceptionResponse
        : typeof exceptionResponse === "object" && exceptionResponse && "message" in exceptionResponse
          ? (exceptionResponse as { message?: string | string[] }).message
          : exception instanceof Error
            ? exception.message
            : "Internal server error";

    const normalizedMessage = Array.isArray(message) ? message.join(", ") : (message ?? "Internal server error");

    writeOperationalLog("error", {
      type: "http_exception",
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: status,
      message: normalizedMessage,
      userId: request.user?.id,
      role: request.user?.role,
      participantId: request.headers["x-participant-id"],
      ipAddress: request.ip,
      stack: process.env.LOG_ERROR_STACKS === "true" && exception instanceof Error ? exception.stack : undefined
    });

    response.status(status).json({
      error: {
        statusCode: status,
        message: normalizedMessage,
        requestId: request.requestId
      }
    });
  }
}
