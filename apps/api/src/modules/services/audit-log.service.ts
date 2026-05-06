import { Injectable } from "@nestjs/common";
import type { AdminReportingPayload, AuditLog, OpsSummaryPayload, Role } from "@game-game/shared";
import type { Prisma } from "@prisma/client";
import type { AuthRequest } from "../../common/auth.types.js";
import { writeOperationalLog } from "../../common/operational-log.js";
import { PrismaService } from "../../prisma/prisma.service.js";

type AuditActorType = "user" | "participant" | "anonymous" | "system";
type AuditStatus = "success" | "failure";

interface AuditLogInput {
  action: string;
  status?: AuditStatus;
  actorType?: AuditActorType;
  actorId?: string;
  actorEmail?: string;
  actorRole?: Role;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    const record = await this.prisma.auditLog.create({
      data: {
        action: input.action,
        status: input.status ?? "success",
        actorType: input.actorType ?? "system",
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        actorRole: input.actorRole,
        targetType: input.targetType,
        targetId: input.targetId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });

    writeOperationalLog("log", {
        type: "audit_log",
        action: record.action,
        status: record.status,
        actorType: record.actorType,
        actorId: record.actorId,
        targetType: record.targetType,
        targetId: record.targetId,
        createdAt: record.createdAt.toISOString()
      });

    return this.toAuditLog(record);
  }

  async listRecent(limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: safeLimit
      }),
      this.prisma.auditLog.count()
    ]);

    return {
      items: items.map((item: (typeof items)[number]) => this.toAuditLog(item)),
      total
    };
  }

  async getOpsSummary(windowHours = 24): Promise<OpsSummaryPayload> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const [
      failedLogins24h,
      uploads24h,
      publishedVersions24h,
      joins24h,
      helpRequests24h,
      completedSteps24h,
      activeAuthSessions,
      activeTrainerJams,
      pendingHelp,
      awaitingReview
    ] = await this.prisma.$transaction([
      this.prisma.auditLog.count({
        where: {
          action: "auth.login",
          status: "failure",
          createdAt: { gte: since }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: "admin.media.upload_file",
          status: "success",
          createdAt: { gte: since }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: "admin.game.publish",
          status: "success",
          createdAt: { gte: since }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: "public.jam.join",
          status: "success",
          createdAt: { gte: since }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: "public.step.need_help",
          status: "success",
          createdAt: { gte: since }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          action: "public.step.complete",
          status: "success",
          createdAt: { gte: since }
        }
      }),
      this.prisma.userSession.count({
        where: {
          revokedAt: null,
          expiresAt: { gt: new Date() }
        }
      }),
      this.prisma.jam.count({
        where: {
          status: "active"
        }
      }),
      this.prisma.participant.count({
        where: {
          status: "needs_help"
        }
      }),
      this.prisma.participantProgress.count({
        where: {
          isCompleted: true,
          reviewedAt: null
        }
      })
    ]);

    const alerts: OpsSummaryPayload["alerts"] = [];

    if (failedLogins24h >= 10) {
      alerts.push({
        level: "warning",
        code: "failed_logins_spike",
        message: `Высокое число неудачных логинов за ${windowHours}ч: ${failedLogins24h}`
      });
    }

    if (pendingHelp >= 3) {
      alerts.push({
        level: "warning",
        code: "pending_help_queue",
        message: `В очереди помощи сейчас ${pendingHelp} участников`
      });
    }

    if (awaitingReview >= 5) {
      alerts.push({
        level: "info",
        code: "awaiting_review_backlog",
        message: `Ожидают разбора ${awaitingReview} завершённых миссий`
      });
    }

    return {
      windowHours,
      generatedAt: new Date().toISOString(),
      auth: {
        activeSessions: activeAuthSessions,
        failedLogins24h
      },
      trainer: {
        activeSessions: activeTrainerJams,
        pendingHelp,
        awaitingReview,
        completedNotReviewed: awaitingReview
      },
      content: {
        publishedVersions24h,
        uploads24h
      },
      publicFlow: {
        joins24h,
        helpRequests24h,
        completedSteps24h
      },
      alerts
    };
  }

  async getAdminReporting(organizationId: string, windowDays = 30): Promise<AdminReportingPayload> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [joinsCount, activeJamsCount, completedJamsCount, progressRows, recentJams, joinedParticipants, trainerAuditRows] =
      await this.prisma.$transaction([
        this.prisma.participant.count({
          where: {
            joinedAt: { gte: since },
            jam: { organizationId }
          }
        }),
        this.prisma.jam.count({
          where: {
            organizationId,
            status: "active"
          }
        }),
        this.prisma.jam.count({
          where: {
            organizationId,
            status: "completed"
          }
        }),
        this.prisma.participantProgress.findMany({
          where: {
            startedAt: { gte: since },
            participant: {
              jam: { organizationId }
            }
          },
          select: {
            id: true,
            gameVersionId: true,
            completedStepsCount: true,
            totalStepsCount: true,
            isCompleted: true,
            startedAt: true,
            completedAt: true,
            reviewedAt: true,
            participant: {
              select: {
                jamId: true
              }
            },
            gameVersion: {
              select: {
                id: true,
                versionNumber: true,
                createdAt: true,
                game: {
                  select: {
                    id: true,
                    title: true,
                    publishedAt: true
                  }
                }
              }
            }
          }
        }),
        this.prisma.jam.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            title: true,
            status: true,
            startedAt: true,
            endedAt: true,
            participants: {
              select: {
                id: true,
                progress: {
                  select: {
                    completedStepsCount: true,
                    totalStepsCount: true,
                    isCompleted: true
                  }
                }
              }
            }
          }
        }),
        this.prisma.participant.findMany({
          where: {
            joinedAt: { gte: since },
            jam: { organizationId }
          },
          select: {
            id: true,
            joinedAt: true
          }
        }),
        this.prisma.auditLog.findMany({
          where: {
            createdAt: { gte: since },
            actorId: { not: null },
            actorRole: { in: ["trainer", "admin"] },
            action: {
              in: [
                "trainer.jam.start",
                "trainer.participant.resolve_help",
                "trainer.participant.mark_reviewed",
                "trainer.participant.note.create"
              ]
            }
          },
          select: {
            actorId: true,
            actorEmail: true,
            action: true,
            createdAt: true
          }
        })
      ]);

    const gameVersionIds = [...new Set(progressRows.map((item) => item.gameVersionId))];
    const gameIds = [...new Set(progressRows.map((item) => item.gameVersion.game.id))];

    const liveSteps = gameIds.length
      ? await this.prisma.gameStep.findMany({
          where: {
            gameId: { in: gameIds }
          },
          select: {
            id: true,
            gameId: true,
            title: true,
            orderIndex: true
          }
        })
      : [];

    const stepRows = gameVersionIds.length
      ? await this.prisma.participantStepProgress.findMany({
          where: {
            gameVersionId: { in: gameVersionIds },
            participant: {
              jam: { organizationId }
            }
          },
          select: {
            stepId: true,
            gameVersionId: true,
            status: true,
            startedAt: true,
            completedAt: true,
            hintsOpenedCount: true,
            needsHelpAt: true
          }
        })
      : [];

    const missionStartsCount = progressRows.length;
    const completedMissionsCount = progressRows.filter((item) => item.isCompleted || item.completedAt).length;
    const reviewedMissionsCount = progressRows.filter((item) => item.reviewedAt).length;
    const hintOpensCount = stepRows.reduce((sum, item) => sum + item.hintsOpenedCount, 0);
    const helpRequestsCount = stepRows.filter((item) => item.needsHelpAt).length;
    const completionRate = missionStartsCount ? Math.round((completedMissionsCount / missionStartsCount) * 100) : 0;
    const reviewRate = completedMissionsCount ? Math.round((reviewedMissionsCount / completedMissionsCount) * 100) : 0;
    const averageHintsPerMission = missionStartsCount ? Number((hintOpensCount / missionStartsCount).toFixed(1)) : 0;
    const averageHelpRequestsPerMission = missionStartsCount
      ? Number((helpRequestsCount / missionStartsCount).toFixed(1))
      : 0;
    const averageCompletionPercent = progressRows.length
      ? Math.round(
          progressRows.reduce(
            (sum, item) => sum + (item.totalStepsCount ? (item.completedStepsCount / item.totalStepsCount) * 100 : 0),
            0
          ) / progressRows.length
        )
      : 0;

    const jamParticipantCounts = recentJams.map((jam) => jam.participants.length);
    const averageJamParticipants = jamParticipantCounts.length
      ? Number(
          (jamParticipantCounts.reduce((sum, value) => sum + value, 0) / jamParticipantCounts.length).toFixed(1)
        )
      : 0;

    const gameMap = new Map<
      string,
      {
        gameId: string;
        gameTitle: string;
        versions: Set<number>;
        participantsCount: number;
        completedCount: number;
        reviewedCount: number;
        progressPercentTotal: number;
        hintsOpenedCount: number;
        helpRequestsCount: number;
        lastPublishedAt?: string;
      }
    >();
    const gameVersionToGameMap = new Map(progressRows.map((item) => [item.gameVersionId, item.gameVersion.game.id]));
    const stepMetaMap = new Map(
      liveSteps.map((step) => [
        step.id,
        {
          gameId: step.gameId,
          stepTitle: step.title,
          stepOrderIndex: step.orderIndex
        }
      ])
    );
    const stepInsightsMap = new Map<
      string,
      {
        gameId: string;
        gameTitle: string;
        stepId: string;
        stepTitle: string;
        stepOrderIndex?: number;
        hintsOpenedCount: number;
        helpRequestsCount: number;
        startedCount: number;
        completedCount: number;
        dropOffCount: number;
        completionRate: number;
      }
    >();

    for (const item of progressRows) {
      const gameId = item.gameVersion.game.id;
      const existing = gameMap.get(gameId) ?? {
        gameId,
        gameTitle: item.gameVersion.game.title,
        versions: new Set<number>(),
        participantsCount: 0,
        completedCount: 0,
        reviewedCount: 0,
        progressPercentTotal: 0,
        hintsOpenedCount: 0,
        helpRequestsCount: 0,
        lastPublishedAt: item.gameVersion.game.publishedAt?.toISOString()
      };

      existing.versions.add(item.gameVersion.versionNumber);
      existing.participantsCount += 1;
      existing.completedCount += item.isCompleted || item.completedAt ? 1 : 0;
      existing.reviewedCount += item.reviewedAt ? 1 : 0;
      existing.progressPercentTotal += item.totalStepsCount
        ? (item.completedStepsCount / item.totalStepsCount) * 100
        : 0;
      if (item.gameVersion.game.publishedAt) {
        existing.lastPublishedAt = item.gameVersion.game.publishedAt.toISOString();
      }

      gameMap.set(gameId, existing);
    }

    for (const item of stepRows) {
      const gameId = gameVersionToGameMap.get(item.gameVersionId);
      if (!gameId) {
        continue;
      }

      const progress = progressRows.find((progressItem) => progressItem.gameVersionId === item.gameVersionId);
      if (!progress) {
        continue;
      }

      const gameEntry = gameMap.get(gameId);
      if (!gameEntry) {
        continue;
      }

      gameEntry.hintsOpenedCount += item.hintsOpenedCount;
      gameEntry.helpRequestsCount += item.needsHelpAt ? 1 : 0;

      const stepMeta = stepMetaMap.get(item.stepId);
      const stepKey = `${gameId}:${item.stepId}`;
      const existingStepInsight = stepInsightsMap.get(stepKey) ?? {
        gameId,
        gameTitle: progress.gameVersion.game.title,
        stepId: item.stepId,
        stepTitle: stepMeta?.stepTitle ?? `Step ${item.stepId}`,
        stepOrderIndex: stepMeta?.stepOrderIndex,
        hintsOpenedCount: 0,
        helpRequestsCount: 0,
        startedCount: 0,
        completedCount: 0,
        dropOffCount: 0,
        completionRate: 0
      };

      existingStepInsight.hintsOpenedCount += item.hintsOpenedCount;
      existingStepInsight.helpRequestsCount += item.needsHelpAt ? 1 : 0;
      const started = Boolean(item.startedAt) || item.status === "active" || item.status === "completed";
      const completed = Boolean(item.completedAt) || item.status === "completed";
      existingStepInsight.startedCount += started ? 1 : 0;
      existingStepInsight.completedCount += completed ? 1 : 0;

      stepInsightsMap.set(stepKey, existingStepInsight);
    }

    const stepInsights = [...stepInsightsMap.values()]
      .map((item) => ({
        ...item,
        dropOffCount: Math.max(item.startedCount - item.completedCount, 0),
        completionRate: item.startedCount ? Math.round((item.completedCount / item.startedCount) * 100) : 0
      }))
      .sort((left, right) =>
        left.stepOrderIndex !== undefined && right.stepOrderIndex !== undefined
          ? left.stepOrderIndex - right.stepOrderIndex
          : left.stepTitle.localeCompare(right.stepTitle)
      );

    const trainerIds = [...new Set(trainerAuditRows.map((row) => row.actorId).filter((value): value is string => Boolean(value)))];
    const trainerUsers = trainerIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: trainerIds } },
          select: {
            id: true,
            displayName: true,
            email: true
          }
        })
      : [];
    const trainerUserMap = new Map(trainerUsers.map((user) => [user.id, user]));
    const trainerMap = new Map<
      string,
      {
        actorId: string;
        actorDisplay: string;
        sessionsStartedCount: number;
        helpResolvedCount: number;
        reviewsCompletedCount: number;
        notesCreatedCount: number;
        totalActionsCount: number;
      }
    >();

    for (const row of trainerAuditRows) {
      if (!row.actorId) {
        continue;
      }

      const actor = trainerUserMap.get(row.actorId);
      const current = trainerMap.get(row.actorId) ?? {
        actorId: row.actorId,
        actorDisplay: actor?.displayName ?? row.actorEmail ?? row.actorId,
        sessionsStartedCount: 0,
        helpResolvedCount: 0,
        reviewsCompletedCount: 0,
        notesCreatedCount: 0,
        totalActionsCount: 0
      };

      current.totalActionsCount += 1;
      if (row.action === "trainer.jam.start") {
        current.sessionsStartedCount += 1;
      }
      if (row.action === "trainer.participant.resolve_help") {
        current.helpResolvedCount += 1;
      }
      if (row.action === "trainer.participant.mark_reviewed") {
        current.reviewsCompletedCount += 1;
      }
      if (row.action === "trainer.participant.note.create") {
        current.notesCreatedCount += 1;
      }

      trainerMap.set(row.actorId, current);
    }

    const cohortsMap = new Map<
      string,
      {
        weekLabel: string;
        joinsCount: number;
        missionStartsCount: number;
        completedMissionsCount: number;
        reviewedMissionsCount: number;
        completionRate: number;
        reviewRate: number;
      }
    >();

    function weekKey(input: Date) {
      const date = new Date(input);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
      return date.toISOString().slice(0, 10);
    }

    for (const participant of joinedParticipants) {
      const key = weekKey(participant.joinedAt);
      const current = cohortsMap.get(key) ?? {
        weekLabel: key,
        joinsCount: 0,
        missionStartsCount: 0,
        completedMissionsCount: 0,
        reviewedMissionsCount: 0,
        completionRate: 0,
        reviewRate: 0
      };
      current.joinsCount += 1;
      cohortsMap.set(key, current);
    }

    for (const item of progressRows) {
      const key = weekKey(item.startedAt);
      const current = cohortsMap.get(key) ?? {
        weekLabel: key,
        joinsCount: 0,
        missionStartsCount: 0,
        completedMissionsCount: 0,
        reviewedMissionsCount: 0,
        completionRate: 0,
        reviewRate: 0
      };
      current.missionStartsCount += 1;
      current.completedMissionsCount += item.isCompleted || item.completedAt ? 1 : 0;
      current.reviewedMissionsCount += item.reviewedAt ? 1 : 0;
      cohortsMap.set(key, current);
    }

    const cohorts = [...cohortsMap.values()]
      .map((item) => ({
        ...item,
        completionRate: item.missionStartsCount ? Math.round((item.completedMissionsCount / item.missionStartsCount) * 100) : 0,
        reviewRate: item.completedMissionsCount ? Math.round((item.reviewedMissionsCount / item.completedMissionsCount) * 100) : 0
      }))
      .sort((left, right) => left.weekLabel.localeCompare(right.weekLabel));

    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      funnel: {
        joinsCount,
        missionStartsCount,
        completedMissionsCount,
        reviewedMissionsCount,
        helpRequestsCount,
        hintOpensCount,
        completionRate,
        reviewRate
      },
      engagement: {
        averageHintsPerMission,
        averageHelpRequestsPerMission,
        averageCompletionPercent,
        averageJamParticipants: averageJamParticipants,
        activeJamsCount: activeJamsCount,
        completedJamsCount: completedJamsCount
      },
      games: [...gameMap.values()]
        .map((item) => ({
          gameId: item.gameId,
          gameTitle: item.gameTitle,
          versionsCount: item.versions.size,
          participantsCount: item.participantsCount,
          completedCount: item.completedCount,
          reviewedCount: item.reviewedCount,
          completionRate: item.participantsCount ? Math.round((item.completedCount / item.participantsCount) * 100) : 0,
          averageProgressPercent: item.participantsCount
            ? Math.round(item.progressPercentTotal / item.participantsCount)
            : 0,
          hintsOpenedCount: item.hintsOpenedCount,
          helpRequestsCount: item.helpRequestsCount,
          lastPublishedAt: item.lastPublishedAt
        }))
        .sort((left, right) => right.participantsCount - left.participantsCount),
      recentJams: recentJams.map((jam) => {
        const flattenedProgress = jam.participants.flatMap((participant) => participant.progress);
        const completedCount = flattenedProgress.filter((item) => item.isCompleted).length;
        const averageProgressPercent = flattenedProgress.length
          ? Math.round(
              flattenedProgress.reduce(
                (sum, item) => sum + (item.totalStepsCount ? (item.completedStepsCount / item.totalStepsCount) * 100 : 0),
                0
              ) / flattenedProgress.length
            )
          : 0;

        return {
          jamId: jam.id,
          title: jam.title,
          status: jam.status,
          participantsCount: jam.participants.length,
          completedCount,
          averageProgressPercent,
          startedAt: jam.startedAt?.toISOString(),
          endedAt: jam.endedAt?.toISOString()
        };
      }),
      stepInsights: {
        topHintHeavySteps: [...stepInsights]
          .sort((left, right) => right.hintsOpenedCount - left.hintsOpenedCount)
          .slice(0, 5),
        topHelpSteps: [...stepInsights]
          .sort((left, right) => right.helpRequestsCount - left.helpRequestsCount)
          .slice(0, 5),
        topDropOffSteps: [...stepInsights]
          .sort((left, right) => right.dropOffCount - left.dropOffCount)
          .slice(0, 5)
      },
      trainers: [...trainerMap.values()].sort((left, right) => right.totalActionsCount - left.totalActionsCount),
      cohorts
    };
  }

  actorFromRequest(request?: AuthRequest): Pick<AuditLogInput, "actorType" | "actorId" | "actorEmail" | "actorRole" | "ipAddress" | "userAgent"> {
    const forwardedFor = request?.headers["x-forwarded-for"];
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || request?.ip;

    if (request?.user) {
      return {
        actorType: "user",
        actorId: request.user.id,
        actorEmail: request.user.email,
        actorRole: request.user.role,
        ipAddress,
        userAgent: request.headers["user-agent"]
      };
    }

    return {
      actorType: "anonymous",
      ipAddress,
      userAgent: request?.headers["user-agent"]
    };
  }

  participantActor(participantId: string, request?: AuthRequest): Pick<AuditLogInput, "actorType" | "actorId" | "ipAddress" | "userAgent"> {
    const forwardedFor = request?.headers["x-forwarded-for"];
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || request?.ip;

    return {
      actorType: "participant",
      actorId: participantId,
      ipAddress,
      userAgent: request?.headers["user-agent"]
    };
  }

  private toAuditLog(item: {
    id: string;
    action: string;
    status: string;
    actorType: string;
    actorId: string | null;
    actorEmail: string | null;
    actorRole: string | null;
    targetType: string | null;
    targetId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: unknown;
    createdAt: Date;
  }): AuditLog {
    return {
      id: item.id,
      action: item.action,
      status: item.status as AuditLog["status"],
      actorType: item.actorType as AuditLog["actorType"],
      actorId: item.actorId ?? undefined,
      actorEmail: item.actorEmail ?? undefined,
      actorRole: item.actorRole as Role | undefined,
      targetType: item.targetType ?? undefined,
      targetId: item.targetId ?? undefined,
      ipAddress: item.ipAddress ?? undefined,
      userAgent: item.userAgent ?? undefined,
      metadata: (item.metadata as Record<string, unknown> | null) ?? undefined,
      createdAt: item.createdAt.toISOString()
    };
  }
}
