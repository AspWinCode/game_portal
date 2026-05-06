import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type {
  AcceptInviteDto,
  AuthSessionInfo,
  ChangePasswordDto,
  CommercialHistoryPayload,
  CommercialOverviewPayload,
  CreateInviteDto,
  CreateIncidentDto,
  CreateOrganizationDto,
  CreateSupportCaseCommentDto,
  CreateSupportCaseDto,
  CreateUserDto,
  InvitePreviewPayload,
  Organization,
  OrganizationMembership,
  OrganizationOnboardingPayload,
  OrganizationPlanEvent,
  PublicStatusPayload,
  ResetUserPasswordDto,
  Role,
  ServiceIncident,
  SupportCase,
  SupportCaseComment,
  UpdateOrganizationDto,
  UpdateIncidentDto,
  UpdateSupportCaseDto,
  UpdateUserDto,
  UserInvite,
  UserAccount
} from "@game-game/shared";
import { getMaxActiveSessions, getSessionTtlMs } from "../../common/auth-security.js";
import { hashPassword, verifyPassword } from "../../common/password.js";
import { PrismaService } from "../../prisma/prisma.service.js";

const LOCAL_USERS: Record<Exclude<Role, "child">, { email: string; displayName: string; password: string }> = {
  admin: {
    email: "admin@example.com",
    displayName: "Admin",
    password: "admin123"
  },
  trainer: {
    email: "trainer@example.com",
    displayName: "Trainer",
    password: "trainer123"
  }
};

const DEFAULT_ORGANIZATION = {
  name: "Default School",
  slug: "default-school",
  planKey: "school" as const,
  brandMessage: "STEM mission control for trainers and young creators",
  brandAccentColor: "#8B5CF6"
};

const PLAN_DEFAULTS = {
  starter: {
    maxAdminUsers: 2,
    maxTrainerUsers: 10,
    maxActiveJams: 5,
    maxPublishedGames: 20,
    maxStorageBytes: 5_368_709_120
  },
  growth: {
    maxAdminUsers: 5,
    maxTrainerUsers: 30,
    maxActiveJams: 20,
    maxPublishedGames: 80,
    maxStorageBytes: 21_474_836_480
  },
  school: {
    maxAdminUsers: 10,
    maxTrainerUsers: 100,
    maxActiveJams: 100,
    maxPublishedGames: 300,
    maxStorageBytes: 107_374_182_400
  }
};

type CommercialOrganizationRecord = {
  id: string;
  name: string;
  slug: string;
  planKey: "starter" | "growth" | "school";
  logoUrl: string | null;
  brandMessage: string | null;
  brandAccentColor: string | null;
  maxStorageBytes: bigint;
  maxAdminUsers: number;
  maxTrainerUsers: number;
  maxActiveJams: number;
  maxPublishedGames: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapCurrentOrganization(
  memberships: Array<{
    id?: string;
    role?: string;
    createdAt?: Date;
    updatedAt?: Date;
    organization: { id: string; name: string; slug: string };
    isActive: boolean;
  }>,
  currentOrganizationId?: string | null
) {
  const current =
    memberships.find((membership) => membership.isActive && membership.organization.id === currentOrganizationId)?.organization ??
    memberships.find((membership) => membership.isActive)?.organization;
  return {
    currentOrganizationId: current?.id,
    currentOrganizationName: current?.name,
    currentOrganizationSlug: current?.slug
  };
}

function mapMemberships(
  memberships: Array<{
    id?: string;
    role?: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    organization: { id: string; name: string; slug: string };
  }>
): OrganizationMembership[] {
  return memberships.map((membership) => ({
    id: membership.id ?? `${membership.organization.id}:${membership.role ?? "member"}`,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: (membership.role ?? "trainer") as Exclude<Role, "child">,
    isActive: membership.isActive,
    createdAt: (membership.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (membership.updatedAt ?? new Date(0)).toISOString()
  }));
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(email: string, password: string, meta?: { ipAddress?: string; userAgent?: string }) {
    await this.ensureLocalUsers();
    await this.cleanupExpiredSessions();

    const user = (await this.prisma.user.findUnique({
      where: { email }
      ,
      include: {
        memberships: {
          include: {
            organization: true
          },
          where: { isActive: true, organization: { isActive: true } },
          orderBy: { createdAt: "asc" }
        }
      }
    })) as ({
      id: string; email: string; displayName: string; role: string; passwordHash: string; isActive?: boolean;
      memberships: Array<{ id: string; role: string; isActive: boolean; createdAt: Date; updatedAt: Date; organization: { id: string; name: string; slug: string } }>
    } | null);

    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + getSessionTtlMs());

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        impersonatedById: null,
        currentOrganizationId: user.memberships[0]?.organization.id,
        expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent
      } as never
    });

    await this.trimActiveSessions(user.id);

    return {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role as Role,
        ...mapCurrentOrganization(user.memberships, user.memberships[0]?.organization.id),
        organizations: mapMemberships(user.memberships)
      }
    };
  }

  async getSessionByToken(token: string) {
    await this.cleanupExpiredSessions();
    const session = (await this.prisma.userSession.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                organization: true
              },
              where: { isActive: true, organization: { isActive: true } },
              orderBy: { createdAt: "asc" }
            }
          }
        },
        impersonatedBy: true
      }
    })) as ({
      id: string;
      token: string;
      expiresAt: Date;
      revokedAt: Date | null;
      impersonatedById: string | null;
      currentOrganizationId: string | null;
      user: {
        id: string; email: string; displayName: string; role: string; isActive?: boolean;
        memberships: Array<{ id: string; role: string; isActive: boolean; createdAt: Date; updatedAt: Date; organization: { id: string; name: string; slug: string } }>;
      };
      impersonatedBy: {
        id: string;
        email: string;
        displayName: string;
      } | null;
    } | null);

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    if (!session.user.isActive) {
      return null;
    }

    return {
      id: session.id,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        role: session.user.role as Role,
        ...mapCurrentOrganization(session.user.memberships, session.currentOrganizationId),
        organizations: mapMemberships(session.user.memberships),
        supportMode: session.impersonatedBy
          ? {
              impersonatedById: session.impersonatedBy.id,
              impersonatedByEmail: session.impersonatedBy.email,
              impersonatedByDisplayName: session.impersonatedBy.displayName
            }
          : undefined
      }
    };
  }

  async touchSession(token: string) {
    await this.cleanupExpiredSessions();
    await this.prisma.userSession.updateMany({
      where: { token, revokedAt: null },
      data: { lastSeenAt: new Date() }
    });
  }

  async revokeSession(token: string) {
    await this.prisma.userSession.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async switchOrganization(token: string, userId: string, organizationId: string) {
    const membership = await this.prisma.userOrganizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        isActive: true,
        organization: { isActive: true }
      }
    });

    if (!membership) {
      throw new UnauthorizedException("User does not have access to this organization");
    }

    await this.prisma.userSession.updateMany({
      where: { token, userId, revokedAt: null },
      data: { currentOrganizationId: organizationId } as never
    });

    return await this.requireSession(token);
  }

  async requireSession(token: string) {
    const session = await this.getSessionByToken(token);
    if (!session) {
      throw new UnauthorizedException("Session not found or expired");
    }
    return session;
  }

  async createSupportSession(adminUserId: string, targetUserId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    await this.cleanupExpiredSessions();

    const [adminUser, targetUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: adminUserId }
      }),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          memberships: {
            include: {
              organization: true
            },
            where: { isActive: true, organization: { isActive: true } },
            orderBy: { createdAt: "asc" }
          }
        }
      })
    ]);

    if (!adminUser || adminUser.role !== "admin") {
      throw new UnauthorizedException("Only admins can use support mode");
    }

    if (!targetUser || !targetUser.isActive) {
      throw new BadRequestException("Target user is not active");
    }

    if (targetUser.id === adminUserId) {
      throw new BadRequestException("Support mode cannot target the current admin");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + getSessionTtlMs());
    const session = await this.prisma.userSession.create({
      data: {
        userId: targetUser.id,
        token,
        impersonatedById: adminUserId,
        currentOrganizationId: targetUser.memberships[0]?.organization.id,
        expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent
      } as never
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
        role: targetUser.role as Role,
        ...mapCurrentOrganization(targetUser.memberships, targetUser.memberships[0]?.organization.id),
        organizations: mapMemberships(targetUser.memberships),
        supportMode: {
          impersonatedById: adminUser.id,
          impersonatedByEmail: adminUser.email,
          impersonatedByDisplayName: adminUser.displayName
        }
      }
    };
  }

  async endSupportSession(currentToken: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { token: currentToken },
      include: {
        impersonatedBy: {
          include: {
            memberships: {
              include: {
                organization: true
              },
              where: { isActive: true, organization: { isActive: true } },
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });

    if (!session?.impersonatedBy) {
      throw new BadRequestException("Current session is not running in support mode");
    }

    await this.revokeSession(currentToken);

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + getSessionTtlMs());
    const restored = await this.prisma.userSession.create({
      data: {
        userId: session.impersonatedBy.id,
        token,
        impersonatedById: null,
        currentOrganizationId: session.impersonatedBy.memberships[0]?.organization.id,
        expiresAt,
        ipAddress: session.ipAddress ?? undefined,
        userAgent: session.userAgent ?? undefined
      } as never
    });

    return {
      token: restored.token,
      expiresAt: restored.expiresAt.toISOString(),
      user: {
        id: session.impersonatedBy.id,
        email: session.impersonatedBy.email,
        displayName: session.impersonatedBy.displayName,
        role: session.impersonatedBy.role as Role,
        ...mapCurrentOrganization(session.impersonatedBy.memberships, session.impersonatedBy.memberships[0]?.organization.id),
        organizations: mapMemberships(session.impersonatedBy.memberships)
      }
    };
  }

  async listUsers(organizationId?: string): Promise<UserAccount[]> {
    await this.cleanupExpiredSessions();
    const users = (await this.prisma.user.findMany({
      where: organizationId
        ? {
            memberships: {
              some: {
                organizationId,
                isActive: true
              }
            }
          }
        : undefined,
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: {
          orderBy: { lastSeenAt: "desc" }
        }
      },
      orderBy: [{ createdAt: "asc" }]
    })) as Array<{
      id: string;
      email: string;
      displayName: string;
      role: string;
      isActive?: boolean;
      createdAt: Date;
      updatedAt: Date;
      memberships: Array<{
        id: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        organization: { id: string; name: string; slug: string };
      }>;
      sessions: Array<{
        revokedAt: Date | null;
        expiresAt: Date;
        lastSeenAt: Date;
      }>;
    }>;

    return users
      .map((user) => this.toUserAccount(user))
      .sort((left, right) => Number(right.isActive) - Number(left.isActive));
  }

  async listOrganizationPlanEvents(organizationId?: string): Promise<OrganizationPlanEvent[]> {
    const items = await (this.prisma as PrismaService & { organizationPlanEvent: { findMany: (args: unknown) => Promise<Array<{
      id: string;
      organizationId: string;
      changedById: string | null;
      fromPlanKey: string | null;
      toPlanKey: string;
      reason: string | null;
      snapshotJson: unknown;
      createdAt: Date;
    }>> } }).organizationPlanEvent.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: [{ createdAt: "desc" }]
    });

    return items.map((item: {
      id: string;
      organizationId: string;
      changedById: string | null;
      fromPlanKey: string | null;
      toPlanKey: string;
      reason: string | null;
      snapshotJson: unknown;
      createdAt: Date;
    }) => ({
      id: item.id,
      organizationId: item.organizationId,
      changedById: item.changedById ?? undefined,
      fromPlanKey: (item.fromPlanKey as OrganizationPlanEvent["fromPlanKey"]) ?? undefined,
      toPlanKey: item.toPlanKey as OrganizationPlanEvent["toPlanKey"],
      reason: item.reason ?? undefined,
      snapshotJson: (item.snapshotJson as Record<string, unknown> | null) ?? undefined,
      createdAt: item.createdAt.toISOString()
    }));
  }

  async getCommercialOverview(userId?: string): Promise<CommercialOverviewPayload> {
    const organizations = await this.listOrganizations(userId);
    const organizationIds = organizations.map((organization) => organization.id);
    const planEvents = await this.listOrganizationPlanEvents(organizationIds.length === 1 ? organizationIds[0] : undefined);
    const scopedPlanEvents = organizationIds.length
      ? planEvents.filter((event) => organizationIds.includes(event.organizationId))
      : [];

    const upgradeCandidates = organizations
      .map((organization) => {
        const reasons: string[] = [];
        if (organization.activeAdminUsers / organization.maxAdminUsers >= 0.8) {
          reasons.push("admins");
        }
        if (organization.activeTrainerUsers / organization.maxTrainerUsers >= 0.8) {
          reasons.push("trainers");
        }
        if (organization.activeSessionsCount / organization.maxActiveSessions >= 0.8) {
          reasons.push("active jams");
        }
        if (organization.publishedJamsCount / organization.maxPublishedJams >= 0.8) {
          reasons.push("published games");
        }
        if (organization.storageBytesUsed / organization.maxStorageBytes >= 0.8) {
          reasons.push("storage");
        }
        return reasons.length
          ? {
              organizationId: organization.id,
              organizationName: organization.name,
              reasons
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      generatedAt: new Date().toISOString(),
      organizations,
      planEvents: scopedPlanEvents,
      totals: {
        organizationsCount: organizations.length,
        activeOrganizationsCount: organizations.filter((organization) => organization.isActive).length,
        storageBytesUsed: organizations.reduce((sum, organization) => sum + organization.storageBytesUsed, 0),
        activeSessionsCount: organizations.reduce((sum, organization) => sum + organization.activeSessionsCount, 0),
        publishedJamsCount: organizations.reduce((sum, organization) => sum + organization.publishedJamsCount, 0)
      },
      upgradeCandidates
    };
  }

  async getCommercialHistory(userId?: string, windowDays = 30): Promise<CommercialHistoryPayload> {
    const organizations = await this.listOrganizations(userId);
    const organizationIds = organizations.map((organization) => organization.id);
    const start = new Date();
    start.setDate(start.getDate() - Math.max(windowDays - 1, 0));
    start.setHours(0, 0, 0, 0);

    const dayKeys = Array.from({ length: windowDays }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day.toISOString().slice(0, 10);
    });

    const [createdOrganizations, acceptedInvites, jams, publishedGames, mediaAssets] = await Promise.all([
      this.prisma.organization.findMany({
        where: {
          ...(organizationIds.length ? { id: { in: organizationIds } } : {}),
          createdAt: { gte: start }
        },
        select: { createdAt: true }
      }),
      this.prisma.userInvite.findMany({
        where: {
          ...(organizationIds.length ? { organizationId: { in: organizationIds } } : {}),
          status: "accepted",
          acceptedAt: { gte: start }
        },
        select: { acceptedAt: true }
      }),
      this.prisma.jam.findMany({
        where: {
          ...(organizationIds.length ? { organizationId: { in: organizationIds } } : {}),
          createdAt: { gte: start }
        },
        select: { createdAt: true }
      }),
      this.prisma.gameVersion.findMany({
        where: {
          createdAt: { gte: start },
          game: organizationIds.length ? { organizationId: { in: organizationIds } } : undefined
        },
        select: { createdAt: true }
      }),
      this.prisma.mediaAsset.findMany({
        where: {
          ...(organizationIds.length ? { organizationId: { in: organizationIds } } : {}),
          createdAt: { gte: start }
        },
        select: { createdAt: true }
      })
    ]);

    const points = dayKeys.map((dayKey) => ({
      label: dayKey,
      organizationsCreated: createdOrganizations.filter((item) => item.createdAt.toISOString().slice(0, 10) === dayKey).length,
      invitesAccepted: acceptedInvites.filter((item) => item.acceptedAt?.toISOString().slice(0, 10) === dayKey).length,
      jamsCreated: jams.filter((item) => item.createdAt.toISOString().slice(0, 10) === dayKey).length,
      gamesPublished: publishedGames.filter((item) => item.createdAt.toISOString().slice(0, 10) === dayKey).length,
      mediaUploads: mediaAssets.filter((item) => item.createdAt.toISOString().slice(0, 10) === dayKey).length
    }));

    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      points
    };
  }

  async getOrganizationOnboarding(organizationId: string, userId?: string): Promise<OrganizationOnboardingPayload> {
    const organizations = await this.listOrganizations(userId);
    const organization = organizations.find((item) => item.id === organizationId);

    if (!organization) {
      throw new BadRequestException("Organization not found");
    }

    const [pendingInvitesCount, acceptedInvitesCount, draftGamesCount] = await Promise.all([
      this.prisma.userInvite.count({
        where: { organizationId, status: "pending" }
      }),
      this.prisma.userInvite.count({
        where: { organizationId, status: "accepted" }
      }),
      this.prisma.game.count({
        where: { organizationId, status: "draft" }
      })
    ]);

    const checklist = [
      {
        id: "branding",
        title: "Настроить публичный брендинг",
        description: "Добавить logo URL, бренд-сообщение и accent color для join/status поверхностей.",
        completed: Boolean(organization.logoUrl || organization.brandMessage || organization.brandAccentColor)
      },
      {
        id: "team",
        title: "Пригласить первую команду",
        description: "Создать хотя бы один активный invite или уже принять первый invite в организацию.",
        completed: pendingInvitesCount > 0 || acceptedInvitesCount > 0 || organization.activeAdminUsers + organization.activeTrainerUsers > 1
      },
      {
        id: "content",
        title: "Подготовить контент",
        description: "Опубликовать хотя бы один jam или как минимум собрать первый draft.",
        completed: organization.publishedJamsCount > 0 || draftGamesCount > 0
      },
      {
        id: "jam",
        title: "Запустить первый джем",
        description: "Создать хотя бы один jam и проверить рабочий child/trainer flow.",
        completed: organization.activeSessionsCount > 0
      },
      {
        id: "storage",
        title: "Загрузить медиа",
        description: "Добавить хотя бы один media asset, чтобы проверить upload pipeline организации.",
        completed: organization.storageBytesUsed > 0
      }
    ];

    return {
      organization,
      checklist,
      summary: {
        completedCount: checklist.filter((item) => item.completed).length,
        totalCount: checklist.length
      }
    };
  }

  async getInvitePreview(token: string): Promise<InvitePreviewPayload> {
    await this.expireInvites();
    const invite = await this.prisma.userInvite.findUnique({
      where: { token },
      include: {
        organization: true
      }
    });

    if (!invite) {
      throw new BadRequestException("Invite not found");
    }

    const isValid = invite.status === "pending" && invite.expiresAt > new Date() && invite.organization.isActive;

    return {
      token: invite.token,
      email: invite.email,
      role: invite.role as InvitePreviewPayload["role"],
      expiresAt: invite.expiresAt.toISOString(),
      organization: {
        id: invite.organization.id,
        name: invite.organization.name,
        slug: invite.organization.slug,
        logoUrl: invite.organization.logoUrl ?? undefined,
        brandMessage: invite.organization.brandMessage ?? undefined,
        brandAccentColor: invite.organization.brandAccentColor ?? undefined
      },
      isValid
    };
  }

  async createUser(dto: CreateUserDto): Promise<UserAccount> {
    const organizationId = dto.organizationId ?? (await this.ensureDefaultOrganization()).id;
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId }
    }) as CommercialOrganizationRecord | null;
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });
    if (existing) {
      throw new BadRequestException("User with this email already exists");
    }

    if (!organization?.isActive) {
      throw new BadRequestException("Organization is not active");
    }

    const activeMemberships = await this.prisma.userOrganizationMembership.findMany({
      where: {
        organizationId,
        isActive: true
      },
      include: {
        user: true
      }
    });
    const activeAdminUsers = activeMemberships.filter((membership) => membership.user.isActive && membership.role === "admin").length;
    const activeTrainerUsers = activeMemberships.filter((membership) => membership.user.isActive && membership.role === "trainer").length;

    if (dto.role === "admin" && activeAdminUsers >= organization.maxAdminUsers) {
      throw new BadRequestException("Organization has reached the admin user limit for the current plan");
    }

    if (dto.role === "trainer" && activeTrainerUsers >= organization.maxTrainerUsers) {
      throw new BadRequestException("Organization has reached the trainer user limit for the current plan");
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        role: dto.role,
        isActive: true,
        passwordHash: hashPassword(dto.password)
      } as never,
      include: {
        memberships: {
          include: {
            organization: true
          }
        },
        sessions: true
      }
    }) as {
      id: string;
      email: string;
      displayName: string;
      role: string;
      isActive?: boolean;
      createdAt: Date;
      updatedAt: Date;
      memberships: Array<{
        id: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        organization: { id: string; name: string; slug: string };
      }>;
      sessions: Array<{ revokedAt: Date | null; expiresAt: Date; lastSeenAt: Date }>;
    };

    await this.ensureMembership(user.id, organizationId, dto.role);

    const refreshed = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: true
      }
    });

    return this.toUserAccount(refreshed as never);
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<UserAccount> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
        role: dto.role
      },
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: {
          orderBy: { lastSeenAt: "desc" }
        }
      }
    }) as {
      id: string;
      email: string;
      displayName: string;
      role: string;
      isActive?: boolean;
      createdAt: Date;
      updatedAt: Date;
      memberships: Array<{
        id: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        organization: { id: string; name: string; slug: string };
      }>;
      sessions: Array<{ revokedAt: Date | null; expiresAt: Date; lastSeenAt: Date }>;
    };

    if (dto.role) {
      await this.prisma.userOrganizationMembership.updateMany({
        where: { userId },
        data: { role: dto.role }
      });
    }

    const refreshed = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: {
          orderBy: { lastSeenAt: "desc" }
        }
      }
    });

    return this.toUserAccount(refreshed as never);
  }

  async setUserActive(userId: string, isActive: boolean): Promise<UserAccount> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive
      } as never,
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: {
          orderBy: { lastSeenAt: "desc" }
        }
      }
    }) as {
      id: string;
      email: string;
      displayName: string;
      role: string;
      isActive?: boolean;
      createdAt: Date;
      updatedAt: Date;
      memberships: Array<{
        id: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        organization: { id: string; name: string; slug: string };
      }>;
      sessions: Array<{ revokedAt: Date | null; expiresAt: Date; lastSeenAt: Date }>;
    };

    if (!isActive) {
      await this.prisma.userSession.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });

      await this.prisma.userOrganizationMembership.updateMany({
        where: { userId },
        data: { isActive: false }
      });
    } else {
      await this.prisma.userOrganizationMembership.updateMany({
        where: { userId },
        data: { isActive: true }
      });
    }

    const refreshed = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: {
          orderBy: { lastSeenAt: "desc" }
        }
      }
    });

    return this.toUserAccount(refreshed as never);
  }

  async resetUserPassword(userId: string, dto: ResetUserPasswordDto): Promise<UserAccount> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(dto.password)
      },
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: {
          orderBy: { lastSeenAt: "desc" }
        }
      }
    }) as {
      id: string;
      email: string;
      displayName: string;
      role: string;
      isActive?: boolean;
      createdAt: Date;
      updatedAt: Date;
      memberships: Array<{
        id: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        organization: { id: string; name: string; slug: string };
      }>;
      sessions: Array<{ revokedAt: Date | null; expiresAt: Date; lastSeenAt: Date }>;
    };

    await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return this.toUserAccount(user);
  }

  async listOrganizations(userId?: string): Promise<Organization[]> {
    const organizations = (userId
      ? await this.prisma.organization.findMany({
          where: {
            memberships: {
              some: {
                userId,
                isActive: true
              }
            }
          },
          orderBy: [{ createdAt: "asc" as const }]
        })
      : await this.prisma.organization.findMany({
          orderBy: [{ createdAt: "asc" as const }]
        })) as CommercialOrganizationRecord[];
    const organizationIds = organizations.map((organization) => organization.id);
    const [memberships, jams, games, mediaUsage] = await Promise.all([
      organizationIds.length
        ? this.prisma.userOrganizationMembership.findMany({
            where: {
              organizationId: { in: organizationIds },
              isActive: true,
              user: { isActive: true }
            }
          })
        : Promise.resolve([]),
      organizationIds.length
        ? this.prisma.jam.findMany({
            where: {
              organizationId: { in: organizationIds },
              status: "active"
            }
          })
        : Promise.resolve([]),
      organizationIds.length
        ? this.prisma.game.findMany({
            where: {
              organizationId: { in: organizationIds },
              status: "published"
            }
          })
        : Promise.resolve([]),
      organizationIds.length
        ? this.prisma.mediaAsset.groupBy({
            by: ["organizationId"],
            where: {
              organizationId: { in: organizationIds }
            },
            _sum: {
              sizeBytes: true
            }
          })
        : Promise.resolve([])
    ]);

    return organizations.map((organization) => {
      const activeAdminUsers = memberships.filter((membership) => membership.organizationId === organization.id && membership.role === "admin").length;
      const activeTrainerUsers = memberships.filter((membership) => membership.organizationId === organization.id && membership.role === "trainer").length;
      const activeSessionsCount = jams.filter((jam) => jam.organizationId === organization.id).length;
      const publishedJamsCount = games.filter((game) => game.organizationId === organization.id).length;
      const storageBytesUsed = mediaUsage.find((item) => item.organizationId === organization.id)?._sum.sizeBytes ?? 0;

      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        planKey: organization.planKey as Organization["planKey"],
        logoUrl: organization.logoUrl ?? undefined,
        brandMessage: organization.brandMessage ?? undefined,
        brandAccentColor: organization.brandAccentColor ?? undefined,
        maxStorageBytes: Number(organization.maxStorageBytes),
        maxAdminUsers: organization.maxAdminUsers,
        maxTrainerUsers: organization.maxTrainerUsers,
        maxActiveSessions: organization.maxActiveJams,
        maxPublishedJams: organization.maxPublishedGames,
        activeAdminUsers,
        activeTrainerUsers,
        activeSessionsCount,
        publishedJamsCount,
        storageBytesUsed,
        isActive: organization.isActive,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: organization.updatedAt.toISOString()
      };
    });
  }

  async createOrganization(dto: CreateOrganizationDto, createdByUserId?: string): Promise<Organization> {
    const existing = await this.prisma.organization.findFirst({
      where: {
        OR: [{ slug: dto.slug }, { name: dto.name }]
      }
    });

    if (existing) {
      throw new BadRequestException("Organization with this name or slug already exists");
    }

    const organization = (await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        planKey: dto.planKey ?? "starter",
        logoUrl: dto.logoUrl,
        brandMessage: dto.brandMessage,
        brandAccentColor: dto.brandAccentColor,
        ...PLAN_DEFAULTS[dto.planKey ?? "starter"],
        maxStorageBytes: BigInt(dto.maxStorageBytes ?? PLAN_DEFAULTS[dto.planKey ?? "starter"].maxStorageBytes),
        isActive: true
      }
    } as never)) as CommercialOrganizationRecord;

    await (this.prisma as PrismaService & { organizationPlanEvent: { create: (args: unknown) => Promise<unknown> } }).organizationPlanEvent.create({
      data: {
        organizationId: organization.id,
        changedById: createdByUserId,
        fromPlanKey: null,
        toPlanKey: organization.planKey,
        reason: "organization_created",
        snapshotJson: {
          maxAdminUsers: organization.maxAdminUsers,
          maxTrainerUsers: organization.maxTrainerUsers,
          maxActiveJams: organization.maxActiveJams,
          maxPublishedGames: organization.maxPublishedGames,
          maxStorageBytes: Number(organization.maxStorageBytes)
        }
      }
    });

    if (createdByUserId) {
      await this.ensureMembership(createdByUserId, organization.id, "admin");
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      planKey: organization.planKey as Organization["planKey"],
      logoUrl: organization.logoUrl ?? undefined,
      brandMessage: organization.brandMessage ?? undefined,
      brandAccentColor: organization.brandAccentColor ?? undefined,
      maxStorageBytes: Number(organization.maxStorageBytes),
      maxAdminUsers: organization.maxAdminUsers,
      maxTrainerUsers: organization.maxTrainerUsers,
      maxActiveSessions: organization.maxActiveJams,
      maxPublishedJams: organization.maxPublishedGames,
      activeAdminUsers: 0,
      activeTrainerUsers: 0,
      activeSessionsCount: 0,
      publishedJamsCount: 0,
      storageBytesUsed: 0,
      isActive: organization.isActive,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    };
  }

  async updateOrganization(organizationId: string, dto: UpdateOrganizationDto, changedById?: string): Promise<Organization> {
    const existing = (await this.prisma.organization.findUnique({
      where: { id: organizationId }
    })) as CommercialOrganizationRecord | null;
    if (!existing) {
      throw new BadRequestException("Organization not found");
    }
    const planDefaults = dto.planKey ? PLAN_DEFAULTS[dto.planKey] : undefined;
    const organization = (await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name,
        slug: dto.slug,
        planKey: dto.planKey,
        logoUrl: dto.logoUrl,
        brandMessage: dto.brandMessage,
        brandAccentColor: dto.brandAccentColor,
        maxStorageBytes: dto.maxStorageBytes ? BigInt(dto.maxStorageBytes) : planDefaults?.maxStorageBytes ? BigInt(planDefaults.maxStorageBytes) : undefined,
        maxAdminUsers: dto.maxAdminUsers ?? planDefaults?.maxAdminUsers,
        maxTrainerUsers: dto.maxTrainerUsers ?? planDefaults?.maxTrainerUsers,
        maxActiveJams: dto.maxActiveSessions ?? planDefaults?.maxActiveJams,
        maxPublishedGames: dto.maxPublishedJams ?? planDefaults?.maxPublishedGames
      }
    } as never)) as CommercialOrganizationRecord;

    if (dto.planKey && dto.planKey !== existing.planKey) {
      await (this.prisma as PrismaService & { organizationPlanEvent: { create: (args: unknown) => Promise<unknown> } }).organizationPlanEvent.create({
        data: {
          organizationId,
          changedById,
          fromPlanKey: existing.planKey,
          toPlanKey: dto.planKey,
          reason: "plan_changed",
          snapshotJson: {
            maxAdminUsers: organization.maxAdminUsers,
            maxTrainerUsers: organization.maxTrainerUsers,
            maxActiveJams: organization.maxActiveJams,
            maxPublishedGames: organization.maxPublishedGames,
            maxStorageBytes: Number(organization.maxStorageBytes)
          }
        }
      });
    }

    const [activeMemberships, activeSessionsCount, publishedJamsCount, mediaUsage] = await Promise.all([
      this.prisma.userOrganizationMembership.findMany({
        where: {
          organizationId,
          isActive: true,
          user: { isActive: true }
        }
      }),
      this.prisma.jam.count({
        where: { organizationId, status: "active" }
      }),
      this.prisma.game.count({
        where: { organizationId, status: "published" }
      }),
      this.prisma.mediaAsset.aggregate({
        where: { organizationId },
        _sum: { sizeBytes: true }
      })
    ]);

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      planKey: organization.planKey as Organization["planKey"],
      logoUrl: organization.logoUrl ?? undefined,
      brandMessage: organization.brandMessage ?? undefined,
      brandAccentColor: organization.brandAccentColor ?? undefined,
      maxStorageBytes: Number(organization.maxStorageBytes),
      maxAdminUsers: organization.maxAdminUsers,
      maxTrainerUsers: organization.maxTrainerUsers,
      maxActiveSessions: organization.maxActiveJams,
      maxPublishedJams: organization.maxPublishedGames,
      activeAdminUsers: activeMemberships.filter((membership) => membership.role === "admin").length,
      activeTrainerUsers: activeMemberships.filter((membership) => membership.role === "trainer").length,
      activeSessionsCount,
      publishedJamsCount,
      storageBytesUsed: mediaUsage._sum.sizeBytes ?? 0,
      isActive: organization.isActive,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    };
  }

  async setOrganizationActive(organizationId: string, isActive: boolean): Promise<Organization> {
    const organization = (await this.prisma.organization.update({
      where: { id: organizationId },
      data: { isActive }
    } as never)) as CommercialOrganizationRecord;

    await this.prisma.userOrganizationMembership.updateMany({
      where: { organizationId },
      data: { isActive }
    });

    if (!isActive) {
      await this.prisma.userInvite.updateMany({
        where: { organizationId, status: "pending" },
        data: { status: "revoked" }
      });
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      planKey: organization.planKey as Organization["planKey"],
      logoUrl: organization.logoUrl ?? undefined,
      brandMessage: organization.brandMessage ?? undefined,
      brandAccentColor: organization.brandAccentColor ?? undefined,
      maxStorageBytes: Number(organization.maxStorageBytes),
      maxAdminUsers: organization.maxAdminUsers,
      maxTrainerUsers: organization.maxTrainerUsers,
      maxActiveSessions: organization.maxActiveJams,
      maxPublishedJams: organization.maxPublishedGames,
      activeAdminUsers: 0,
      activeTrainerUsers: 0,
      activeSessionsCount: 0,
      publishedJamsCount: 0,
      storageBytesUsed: 0,
      isActive: organization.isActive,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString()
    };
  }

  async listInvites(organizationId?: string): Promise<UserInvite[]> {
    await this.expireInvites();
    const invites = await this.prisma.userInvite.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return invites.map((invite) => this.toUserInvite(invite));
  }

  async listSupportCases(): Promise<SupportCase[]> {
    const items = await this.prisma.supportCase.findMany({
      include: {
        _count: {
          select: { comments: true }
        }
      },
      orderBy: [{ updatedAt: "desc" }]
    });

    return items.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      body: item.body,
      severity: item.severity as SupportCase["severity"],
      status: item.status as SupportCase["status"],
      createdBy: item.createdById,
      commentsCount: item._count.comments,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString()
    }));
  }

  async createSupportCase(createdById: string, dto: CreateSupportCaseDto): Promise<SupportCase> {
    const item = await this.prisma.supportCase.create({
      data: {
        organizationId: dto.organizationId,
        title: dto.title,
        body: dto.body,
        severity: dto.severity,
        status: "open",
        createdById
      }
    });

    return {
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      body: item.body,
      severity: item.severity as SupportCase["severity"],
      status: item.status as SupportCase["status"],
      createdBy: item.createdById,
      commentsCount: 0,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString()
    };
  }

  async updateSupportCase(caseId: string, dto: UpdateSupportCaseDto): Promise<SupportCase> {
    const item = await this.prisma.supportCase.update({
      where: { id: caseId },
      include: {
        _count: {
          select: { comments: true }
        }
      },
      data: {
        status: dto.status,
        resolvedAt: dto.status === "resolved" ? new Date() : dto.status ? null : undefined
      }
    });

    return {
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      body: item.body,
      severity: item.severity as SupportCase["severity"],
      status: item.status as SupportCase["status"],
      createdBy: item.createdById,
      commentsCount: item._count.comments,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString()
    };
  }

  async listSupportCaseComments(): Promise<Record<string, SupportCaseComment[]>> {
    const items = await this.prisma.supportCaseComment.findMany({
      include: {
        author: {
          select: {
            displayName: true
          }
        }
      },
      orderBy: [{ createdAt: "asc" }]
    });

    return items.reduce<Record<string, SupportCaseComment[]>>((accumulator, item) => {
      const comment: SupportCaseComment = {
        id: item.id,
        supportCaseId: item.supportCaseId,
        organizationId: item.organizationId,
        authorId: item.authorId,
        authorDisplayName: item.author.displayName,
        body: item.body,
        createdAt: item.createdAt.toISOString()
      };
      const bucket = accumulator[item.supportCaseId] ?? [];
      bucket.push(comment);
      accumulator[item.supportCaseId] = bucket;
      return accumulator;
    }, {});
  }

  async createSupportCaseComment(
    supportCaseId: string,
    authorId: string,
    dto: CreateSupportCaseCommentDto
  ): Promise<SupportCaseComment> {
    const supportCase = await this.prisma.supportCase.findUnique({
      where: { id: supportCaseId }
    });

    if (!supportCase) {
      throw new BadRequestException("Support case not found");
    }

    const item = await this.prisma.supportCaseComment.create({
      data: {
        supportCaseId,
        organizationId: supportCase.organizationId,
        authorId,
        body: dto.body
      },
      include: {
        author: {
          select: {
            displayName: true
          }
        }
      }
    });

    return {
      id: item.id,
      supportCaseId: item.supportCaseId,
      organizationId: item.organizationId,
      authorId: item.authorId,
      authorDisplayName: item.author.displayName,
      body: item.body,
      createdAt: item.createdAt.toISOString()
    };
  }

  async listIncidents(): Promise<ServiceIncident[]> {
    const items = await this.prisma.incidentStatus.findMany({
      orderBy: [{ startedAt: "desc" }]
    });

    return items.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      message: item.message,
      impact: item.impact ?? undefined,
      status: item.status as ServiceIncident["status"],
      startedAt: item.startedAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString(),
      createdBy: item.createdById
    }));
  }

  async getPublicStatus(): Promise<PublicStatusPayload> {
    const [items, organizations] = await Promise.all([
      this.prisma.incidentStatus.findMany({
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              brandMessage: true,
              brandAccentColor: true
            }
          }
        },
        orderBy: [{ startedAt: "desc" }]
      }),
      this.prisma.organization.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          brandMessage: true,
          brandAccentColor: true
        },
        orderBy: [{ createdAt: "asc" }]
      })
    ]);

    const mapped = items.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      organizationName: item.organization.name,
      organizationSlug: item.organization.slug,
      organizationLogoUrl: item.organization.logoUrl ?? undefined,
      organizationBrandMessage: item.organization.brandMessage ?? undefined,
      organizationBrandAccentColor: item.organization.brandAccentColor ?? undefined,
      title: item.title,
      message: item.message,
      impact: item.impact ?? undefined,
      status: item.status as ServiceIncident["status"],
      startedAt: item.startedAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString(),
      createdBy: item.createdById
    }));

    const activeIncidents = mapped.filter((item) => item.status !== "healthy" && item.status !== "resolved");
    const recentResolvedIncidents = mapped
      .filter((item) => item.status === "resolved" || item.status === "healthy")
      .sort((left, right) => {
        const rightAt = right.resolvedAt ?? right.updatedAt;
        const leftAt = left.resolvedAt ?? left.updatedAt;
        return rightAt.localeCompare(leftAt);
      })
      .slice(0, 5);

    const status = activeIncidents.some((item) => item.status === "outage")
      ? "outage"
      : activeIncidents.some((item) => item.status === "degraded")
        ? "degraded"
        : "healthy";

    return {
      generatedAt: new Date().toISOString(),
      status,
      activeIncidents,
      recentResolvedIncidents,
      organizations: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl ?? undefined,
        brandMessage: organization.brandMessage ?? undefined,
        brandAccentColor: organization.brandAccentColor ?? undefined
      }))
    };
  }

  async createIncident(createdById: string, dto: CreateIncidentDto): Promise<ServiceIncident> {
    const item = await this.prisma.incidentStatus.create({
      data: {
        organizationId: dto.organizationId,
        title: dto.title,
        message: dto.message,
        impact: dto.impact,
        status: dto.status,
        resolvedAt: dto.status === "resolved" || dto.status === "healthy" ? new Date() : null,
        createdById
      }
    });

    return {
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      message: item.message,
      impact: item.impact ?? undefined,
      status: item.status as ServiceIncident["status"],
      startedAt: item.startedAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString(),
      createdBy: item.createdById
    };
  }

  async updateIncident(incidentId: string, dto: UpdateIncidentDto): Promise<ServiceIncident> {
    const item = await this.prisma.incidentStatus.update({
      where: { id: incidentId },
      data: {
        message: dto.message,
        impact: dto.impact,
        status: dto.status,
        resolvedAt:
          dto.status === "resolved" || dto.status === "healthy"
            ? new Date()
            : dto.status
              ? null
              : undefined
      }
    });

    return {
      id: item.id,
      organizationId: item.organizationId,
      title: item.title,
      message: item.message,
      impact: item.impact ?? undefined,
      status: item.status as ServiceIncident["status"],
      startedAt: item.startedAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString(),
      createdBy: item.createdById
    };
  }

  async createInvite(invitedById: string, dto: CreateInviteDto): Promise<UserInvite> {
    const inviterMembership = await this.prisma.userOrganizationMembership.findFirst({
      where: {
        userId: invitedById,
        organizationId: dto.organizationId,
        isActive: true
      }
    });

    if (!inviterMembership) {
      throw new BadRequestException("Inviter does not have access to this organization");
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId }
    });

    if (!organization || !organization.isActive) {
      throw new BadRequestException("Organization not found");
    }

    const token = randomBytes(24).toString("hex");
    const expiresInDays = dto.expiresInDays ?? 7;
    const invite = await this.prisma.userInvite.create({
      data: {
        organizationId: dto.organizationId,
        email: dto.email,
        role: dto.role,
        token,
        invitedById,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      },
      include: {
        organization: true
      }
    });

    return this.toUserInvite(invite);
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<UserAccount> {
    await this.expireInvites();
    const invite = await this.prisma.userInvite.findUnique({
      where: { token: dto.token },
      include: {
        organization: true
      }
    });

    if (!invite || invite.status !== "pending" || invite.expiresAt <= new Date()) {
      throw new BadRequestException("Invite is invalid or expired");
    }

    let user = await this.prisma.user.findUnique({
      where: { email: invite.email }
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: dto.displayName,
          passwordHash: hashPassword(dto.password),
          role: invite.role,
          isActive: true
        }
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: invite.email,
          displayName: dto.displayName,
          passwordHash: hashPassword(dto.password),
          role: invite.role,
          isActive: true
        }
      });
    }

    await this.ensureMembership(user.id, invite.organizationId, invite.role as Exclude<Role, "child">);
    await this.prisma.userInvite.update({
      where: { id: invite.id },
      data: {
        status: "accepted",
        acceptedAt: new Date()
      }
    });

    const refreshed = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        memberships: {
          include: {
            organization: true
          },
          orderBy: { createdAt: "asc" }
        },
        sessions: {
          orderBy: { lastSeenAt: "desc" }
        }
      }
    });

    return this.toUserAccount(refreshed as never);
  }

  async listSessionsForUser(userId: string, currentToken?: string): Promise<AuthSessionInfo[]> {
    await this.cleanupExpiredSessions();
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: [{ lastSeenAt: "desc" }]
    });

    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString(),
      ipAddress: session.ipAddress ?? undefined,
      userAgent: session.userAgent ?? undefined,
      isCurrent: session.token === currentToken
    }));
  }

  async revokeAllSessionsForUser(userId: string, exceptToken?: string) {
    await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptToken ? { NOT: { token: exceptToken } } : {})
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async revokeSessionById(userId: string, sessionId: string, currentToken?: string) {
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: sessionId,
        userId
      }
    });

    if (!session) {
      throw new BadRequestException("Session not found");
    }

    if (currentToken && session.token === currentToken) {
      throw new BadRequestException("Use logout to revoke the current session");
    }

    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });

    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !verifyPassword(dto.currentPassword, user.passwordHash)) {
      throw new UnauthorizedException("Current password is invalid");
    }

    if (dto.currentPassword === dto.nextPassword) {
      throw new BadRequestException("New password must differ from the current password");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(dto.nextPassword)
      }
    });

    await this.revokeAllSessionsForUser(userId);
    return { ok: true };
  }

  private async ensureLocalUsers() {
    const organization = await this.ensureDefaultOrganization();
    await Promise.all(
      (Object.entries(LOCAL_USERS) as Array<[Exclude<Role, "child">, (typeof LOCAL_USERS)[Exclude<Role, "child">]]>).map(
        async ([role, localUser]) => {
          const user = await this.prisma.user.upsert({
            where: { email: localUser.email },
            update: {
              displayName: localUser.displayName,
              role,
              isActive: true,
              passwordHash: hashPassword(localUser.password)
            } as never,
            create: {
              email: localUser.email,
              displayName: localUser.displayName,
              role,
              isActive: true,
              passwordHash: hashPassword(localUser.password)
            } as never
          });

          await this.ensureMembership(user.id, organization.id, role);
        }
      )
    );
  }

  private async cleanupExpiredSessions() {
    await this.prisma.userSession.updateMany({
      where: {
        revokedAt: null,
        expiresAt: {
          lte: new Date()
        }
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private async trimActiveSessions(userId: string) {
    const activeSessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: [{ lastSeenAt: "desc" }]
    });

    const maxActiveSessions = getMaxActiveSessions();
    const sessionsToRevoke = activeSessions.slice(maxActiveSessions);

    if (!sessionsToRevoke.length) {
      return;
    }

    await this.prisma.userSession.updateMany({
      where: {
        id: {
          in: sessionsToRevoke.map((session) => session.id)
        }
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private toUserAccount(user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    isActive?: boolean;
    createdAt: Date;
    updatedAt: Date;
    memberships: Array<{
      id: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      organization: { id: string; name: string; slug: string };
    }>;
    sessions: Array<{
      revokedAt: Date | null;
      expiresAt: Date;
      lastSeenAt: Date;
    }>;
  }): UserAccount {
    const now = new Date();
    const activeSessions = user.sessions.filter((session) => !session.revokedAt && session.expiresAt > now);
    const lastSessionAt = user.sessions[0]?.lastSeenAt;

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as UserAccount["role"],
      isActive: user.isActive ?? true,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastSessionAt: lastSessionAt?.toISOString(),
      activeSessionCount: activeSessions.length,
      organizations: user.memberships.map((membership) => ({
        id: membership.id,
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        organizationSlug: membership.organization.slug,
        role: membership.role as Exclude<Role, "child">,
        isActive: membership.isActive,
        createdAt: membership.createdAt.toISOString(),
        updatedAt: membership.updatedAt.toISOString()
      }))
    };
  }

  private async ensureDefaultOrganization() {
    return (await this.prisma.organization.upsert({
      where: { slug: DEFAULT_ORGANIZATION.slug },
      update: {
        name: DEFAULT_ORGANIZATION.name,
        planKey: DEFAULT_ORGANIZATION.planKey,
        brandMessage: DEFAULT_ORGANIZATION.brandMessage,
        brandAccentColor: DEFAULT_ORGANIZATION.brandAccentColor,
        ...PLAN_DEFAULTS[DEFAULT_ORGANIZATION.planKey],
        isActive: true
      },
      create: {
        name: DEFAULT_ORGANIZATION.name,
        slug: DEFAULT_ORGANIZATION.slug,
        planKey: DEFAULT_ORGANIZATION.planKey,
        brandMessage: DEFAULT_ORGANIZATION.brandMessage,
        brandAccentColor: DEFAULT_ORGANIZATION.brandAccentColor,
        ...PLAN_DEFAULTS[DEFAULT_ORGANIZATION.planKey],
        isActive: true
      }
    } as never)) as CommercialOrganizationRecord;
  }

  private async ensureMembership(userId: string, organizationId: string, role: Exclude<Role, "child">) {
    await this.prisma.userOrganizationMembership.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId
        }
      },
      update: {
        role,
        isActive: true
      },
      create: {
        userId,
        organizationId,
        role,
        isActive: true
      }
    });
  }

  private async expireInvites() {
    await this.prisma.userInvite.updateMany({
      where: {
        status: "pending",
        expiresAt: {
          lte: new Date()
        }
      },
      data: {
        status: "expired"
      }
    });
  }

  private toUserInvite(invite: {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    status: string;
    token: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
    invitedById: string;
    organization: { name: string; slug: string };
  }): UserInvite {
    return {
      id: invite.id,
      organizationId: invite.organizationId,
      organizationName: invite.organization.name,
      organizationSlug: invite.organization.slug,
      email: invite.email,
      role: invite.role as Exclude<Role, "child">,
      status: invite.status as UserInvite["status"],
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString(),
      createdAt: invite.createdAt.toISOString(),
      invitedBy: invite.invitedById
    };
  }
}
