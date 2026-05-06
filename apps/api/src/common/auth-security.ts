import { ForbiddenException } from "@nestjs/common";
import type { AuthRequest } from "./auth.types.js";

type CookieSameSite = "lax" | "strict" | "none";

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

export function getSessionTtlMs() {
  const hours = Number.parseInt(process.env.AUTH_SESSION_TTL_HOURS ?? "12", 10);
  return Math.max(1, hours) * 60 * 60 * 1000;
}

export function getMaxActiveSessions() {
  const sessions = Number.parseInt(process.env.AUTH_MAX_ACTIVE_SESSIONS ?? "5", 10);
  return Math.max(1, sessions);
}

export function getSessionCookieOptions(expiresAt: Date) {
  const sameSite = ((process.env.AUTH_COOKIE_SAME_SITE ?? "lax").toLowerCase() as CookieSameSite);
  const secure = parseBoolean(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === "production");

  return {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    expires: expiresAt
  };
}

export function assertTrustedOrigin(request: AuthRequest) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const method = (request.method ?? "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return;
  }

  const origin = request.headers.origin;
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  const forwardedProto = request.headers["x-forwarded-proto"];
  const secureCookies = parseBoolean(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === "production");
  const inferredProto = forwardedProto ?? (secureCookies ? "https" : "http");
  const allowMissingOrigin = parseBoolean(
    process.env.AUTH_ALLOW_MISSING_ORIGIN,
    process.env.NODE_ENV !== "production"
  );

  if (!origin) {
    if (allowMissingOrigin) {
      return;
    }

    throw new ForbiddenException("Missing Origin header");
  }

  const allowedOrigins = (process.env.AUTH_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const devFallbackOrigins = process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"];
  const effectiveAllowedOrigins = new Set([...allowedOrigins, ...devFallbackOrigins]);

  try {
    const originUrl = new URL(origin);
    const sameOrigin = host ? originUrl.host === host && originUrl.protocol === `${inferredProto}:` : false;
    const isLocalDevOrigin =
      process.env.NODE_ENV !== "production" &&
      (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") &&
      (originUrl.protocol === "http:" || originUrl.protocol === "https:");

    if (sameOrigin || effectiveAllowedOrigins.has(originUrl.origin) || isLocalDevOrigin) {
      return;
    }
  } catch {
    throw new ForbiddenException("Invalid Origin header");
  }

  throw new ForbiddenException("Origin is not allowed");
}
