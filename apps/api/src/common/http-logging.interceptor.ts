import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { AuthRequest } from "./auth.types.js";
import { writeOperationalLog } from "./operational-log.js";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http" || process.env.LOG_HTTP_REQUESTS === "false") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          writeOperationalLog("log", {
            type: "http_request",
            requestId: request.requestId,
            method: request.method,
            path: request.originalUrl,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            userId: request.user?.id,
            role: request.user?.role,
            participantId: request.headers["x-participant-id"],
            ipAddress: request.ip
          });
        },
        error: () => {
          writeOperationalLog("warn", {
            type: "http_request_failed",
            requestId: request.requestId,
            method: request.method,
            path: request.originalUrl,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            userId: request.user?.id,
            role: request.user?.role,
            participantId: request.headers["x-participant-id"],
            ipAddress: request.ip
          });
        }
      })
    );
  }
}
