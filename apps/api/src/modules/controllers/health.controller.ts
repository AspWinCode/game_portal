import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    let database = "disconnected";
    const storage = process.env.STORAGE_PROVIDER ?? "local";

    if (process.env.DATABASE_URL) {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        database = "connected";
      } catch {
        database = "error";
      }
    }

    return {
      data: {
        ok: true,
        database,
        storage,
        env: process.env.NODE_ENV ?? "development",
        uptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
      }
    };
  }

  @Get("details")
  async details() {
    let database = "disconnected";
    let jams = 0;
    let sessions = 0;
    let participants = 0;
    let authSessions = 0;
    let auditLogs = 0;
    let latestAuditAt: string | undefined;
    const storage = process.env.STORAGE_PROVIDER ?? "local";

    if (process.env.DATABASE_URL) {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        database = "connected";
        jams = await this.prisma.game.count();
        sessions = await this.prisma.jam.count();
        participants = await this.prisma.participant.count();
        authSessions = await this.prisma.userSession.count({
          where: { revokedAt: null }
        });
        auditLogs = await this.prisma.auditLog.count();
        const latestAudit = await this.prisma.auditLog.findFirst({
          orderBy: { createdAt: "desc" }
        });
        latestAuditAt = latestAudit?.createdAt.toISOString();
      } catch {
        database = "error";
      }
    }

    return {
      data: {
        ok: database === "connected",
        database,
        storage,
        env: process.env.NODE_ENV ?? "development",
        uptimeSec: Math.round(process.uptime()),
        counts: {
          jams,
          sessions,
          participants,
          authSessions,
          auditLogs
        },
        latestAuditAt,
        timestamp: new Date().toISOString()
      }
    };
  }
}
