import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { AuthRequest } from "../../common/auth.types.js";
import { Roles } from "../../common/roles.decorator.js";
import { getUploadMaxBytes, validateUploadFile } from "../../common/upload-policy.js";
import {
  CreateUserDtoClass,
  CreateInviteDtoClass,
  CreateIncidentDtoClass,
  CreateHintDtoClass,
  CreateGameDtoClass,
  CreateOrganizationDtoClass,
  CreateSupportCaseDtoClass,
  CreateSupportCaseCommentDtoClass,
  CreateStepDtoClass,
  ReorderStepsDtoClass,
  ResetUserPasswordDtoClass,
  UploadMediaDtoClass,
  UpdateHintDtoClass,
  UpdateIncidentDtoClass,
  UpdateGameDtoClass,
  UpdateOrganizationDtoClass,
  UpdateSupportCaseDtoClass,
  UpdateStepDtoClass,
  UpdateUserDtoClass
} from "../dto/admin.dto.js";
import { AppService } from "../services/app.service.js";
import { AuditLogService } from "../services/audit-log.service.js";

function requireOrganizationId(request: AuthRequest) {
  const organizationId = request.user?.currentOrganizationId;
  if (!organizationId) {
    throw new BadRequestException("Active organization is required");
  }
  return organizationId;
}

@Roles("admin")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly appService: AppService,
    private readonly auditLog: AuditLogService
  ) {}

  @Get("games")
  async listGames(@Req() request: AuthRequest) {
    return { data: await this.appService.listGamesForOrganization(requireOrganizationId(request)) };
  }

  @Get("game-templates")
  async listGameTemplates(@Req() request: AuthRequest) {
    return { data: await this.appService.listGameTemplates(requireOrganizationId(request)) };
  }

  @Post("games")
  async createGame(@Req() request: AuthRequest, @Body() body: CreateGameDtoClass) {
    const game = await this.appService.createGame(body, requireOrganizationId(request), request.user!.id);
    await this.auditLog.log({
      action: "admin.game.create",
      ...this.auditLog.actorFromRequest(request),
      targetType: "game",
      targetId: game.id,
      metadata: { slug: game.slug, title: game.title }
    });
    return { data: game };
  }

  @Get("games/:id")
  async getGame(@Req() request: AuthRequest, @Param("id") id: string) {
    return { data: await this.appService.getGameDetail(id, requireOrganizationId(request), request.user?.id) };
  }

  @Post("games/:id/edit-lock/acquire")
  async acquireGameEditLock(@Req() request: AuthRequest, @Param("id") id: string) {
    return {
      data: await this.appService.acquireGameEditLock(id, requireOrganizationId(request), {
        id: request.user!.id,
        displayName: request.user!.displayName
      })
    };
  }

  @Post("games/:id/edit-lock/heartbeat")
  async heartbeatGameEditLock(@Req() request: AuthRequest, @Param("id") id: string) {
    return { data: await this.appService.heartbeatGameEditLock(id, requireOrganizationId(request), request.user!.id) };
  }

  @Post("games/:id/edit-lock/release")
  async releaseGameEditLock(@Req() request: AuthRequest, @Param("id") id: string) {
    return { data: await this.appService.releaseGameEditLock(id, requireOrganizationId(request), request.user!.id) };
  }

  @Patch("games/:id")
  async updateGame(@Req() request: AuthRequest, @Param("id") id: string, @Body() body: UpdateGameDtoClass) {
    const game = await this.appService.updateGame(id, body, requireOrganizationId(request), request.user!.id);
    await this.auditLog.log({
      action: "admin.game.update",
      ...this.auditLog.actorFromRequest(request),
      targetType: "game",
      targetId: id,
      metadata: { fields: Object.keys(body) }
    });
    return { data: game };
  }

  @Post("games/:id/duplicate")
  async duplicateGame(@Req() request: AuthRequest, @Param("id") id: string) {
    return { data: await this.appService.duplicateGame(id, requireOrganizationId(request), request.user!.id) };
  }

  @Post("game-templates/:templateId/create-game")
  async createGameFromTemplate(@Req() request: AuthRequest, @Param("templateId") templateId: string) {
    const game = await this.appService.createGameFromTemplate(templateId, requireOrganizationId(request), request.user!.id);
    await this.auditLog.log({
      action: "admin.game.create_from_template",
      ...this.auditLog.actorFromRequest(request),
      targetType: "game",
      targetId: game.id,
      metadata: { templateGameId: templateId }
    });
    return { data: game };
  }

  @Post("games/:id/archive")
  async archiveGame(@Req() request: AuthRequest, @Param("id") id: string) {
    const game = await this.appService.archiveGame(id, requireOrganizationId(request), request.user!.id);
    await this.auditLog.log({
      action: "admin.game.archive",
      ...this.auditLog.actorFromRequest(request),
      targetType: "game",
      targetId: id
    });
    return { data: game };
  }

  @Delete("games/:id")
  async deleteGame(@Req() request: AuthRequest, @Param("id") id: string) {
    const result = await this.appService.deleteGame(id, requireOrganizationId(request));
    await this.auditLog.log({
      action: "admin.game.delete",
      ...this.auditLog.actorFromRequest(request),
      targetType: "game",
      targetId: id
    });
    return { data: result };
  }

  @Post("games/:id/publish")
  async publishGame(@Req() request: AuthRequest, @Param("id") id: string) {
    const version = await this.appService.publishGame(id, requireOrganizationId(request), request.user!.id);
    await this.auditLog.log({
      action: "admin.game.publish",
      ...this.auditLog.actorFromRequest(request),
      targetType: "game_version",
      targetId: version.id,
      metadata: { gameId: id, versionNumber: version.versionNumber }
    });
    return { data: version };
  }

  @Post("games/:id/steps")
  async createStep(@Param("id") gameId: string, @Body() body: CreateStepDtoClass) {
    return { data: await this.appService.createStep(gameId, body) };
  }

  @Patch("steps/:stepId")
  async updateStep(@Param("stepId") stepId: string, @Body() body: UpdateStepDtoClass) {
    return { data: await this.appService.updateStep(stepId, body) };
  }

  @Delete("steps/:stepId")
  async deleteStep(@Param("stepId") stepId: string) {
    return { data: await this.appService.deleteStep(stepId) };
  }

  @Post("games/:id/steps/reorder")
  async reorderSteps(@Param("id") gameId: string, @Body() body: ReorderStepsDtoClass) {
    return { data: await this.appService.reorderSteps(gameId, body) };
  }

  @Post("steps/:stepId/hints")
  async createHint(@Param("stepId") stepId: string, @Body() body: CreateHintDtoClass) {
    return { data: await this.appService.createHint(stepId, body) };
  }

  @Patch("hints/:hintId")
  async updateHint(@Param("hintId") hintId: string, @Body() body: UpdateHintDtoClass) {
    return { data: await this.appService.updateHint(hintId, body) };
  }

  @Delete("hints/:hintId")
  async deleteHint(@Param("hintId") hintId: string) {
    return { data: await this.appService.deleteHint(hintId) };
  }

  @Get("games/:id/versions")
  async listVersions(@Param("id") gameId: string) {
    return { data: await this.appService.listVersions(gameId) };
  }

  @Get("game-versions/:versionId")
  async getVersion(@Req() request: AuthRequest, @Param("versionId") versionId: string) {
    return { data: await this.appService.getVersion(versionId, requireOrganizationId(request)) };
  }

  @Post("game-versions/:versionId/restore-draft")
  async restoreVersion(@Req() request: AuthRequest, @Param("versionId") versionId: string) {
    const detail = await this.appService.restoreGameFromVersion(versionId, requireOrganizationId(request), request.user!.id);
    await this.auditLog.log({
      action: "admin.game.restore_draft",
      ...this.auditLog.actorFromRequest(request),
      targetType: "game_version",
      targetId: versionId,
      metadata: { gameId: detail.game.id }
    });
    return { data: detail };
  }

  @Get("media")
  async listMedia(@Req() request: AuthRequest) {
    return { data: await this.appService.listMediaAssets(requireOrganizationId(request)) };
  }

  @Get("media/library")
  async getMediaLibrary(@Req() request: AuthRequest) {
    return { data: await this.appService.getMediaLibrary(requireOrganizationId(request)) };
  }

  @Delete("media/:id")
  async deleteMediaAsset(@Req() request: AuthRequest, @Param("id") id: string) {
    const result = await this.appService.deleteOrphanedMediaAsset(id, requireOrganizationId(request));
    await this.auditLog.log({
      action: "admin.media.delete",
      ...this.auditLog.actorFromRequest(request),
      targetType: "media_asset",
      targetId: id
    });
    return { data: result };
  }

  @Get("audit-logs")
  async listAuditLogs(@Query("limit") limit?: string) {
    return { data: await this.appService.listAuditLogs(limit ? Number.parseInt(limit, 10) : undefined) };
  }

  @Get("ops-summary")
  async getOpsSummary(@Query("windowHours") windowHours?: string) {
    return { data: await this.appService.getOpsSummary(windowHours ? Number.parseInt(windowHours, 10) : undefined) };
  }

  @Get("reporting")
  async getReporting(@Req() request: AuthRequest, @Query("windowDays") windowDays?: string) {
    return {
      data: await this.appService.getAdminReporting(
        requireOrganizationId(request),
        windowDays ? Number.parseInt(windowDays, 10) : undefined
      )
    };
  }

  @Get("users")
  async listUsers(@Req() request: AuthRequest) {
    return { data: await this.appService.listUsers(requireOrganizationId(request)) };
  }

  @Get("organizations")
  async listOrganizations(@Req() request: AuthRequest) {
    return { data: await this.appService.listOrganizations(request.user?.id) };
  }

  @Get("organization-plan-events")
  async listOrganizationPlanEvents(@Req() request: AuthRequest) {
    return { data: await this.appService.listOrganizationPlanEvents(request.user?.currentOrganizationId) };
  }

  @Get("commercial-overview")
  async getCommercialOverview(@Req() request: AuthRequest) {
    return { data: await this.appService.getCommercialOverview(request.user?.id) };
  }

  @Get("commercial-history")
  async getCommercialHistory(@Req() request: AuthRequest, @Query("windowDays") windowDays?: string) {
    return { data: await this.appService.getCommercialHistory(request.user?.id, windowDays ? Number.parseInt(windowDays, 10) : undefined) };
  }

  @Post("organizations")
  async createOrganization(@Req() request: AuthRequest, @Body() body: CreateOrganizationDtoClass) {
    const organization = await this.appService.createOrganization(body, request.user?.id);
    await this.auditLog.log({
      action: "admin.organization.create",
      ...this.auditLog.actorFromRequest(request),
      targetType: "organization",
      targetId: organization.id,
      metadata: { slug: organization.slug, name: organization.name }
    });
    return { data: organization };
  }

  @Patch("organizations/:id")
  async updateOrganization(@Req() request: AuthRequest, @Param("id") id: string, @Body() body: UpdateOrganizationDtoClass) {
    const organization = await this.appService.updateOrganization(id, body, request.user?.id);
    await this.auditLog.log({
      action: "admin.organization.update",
      ...this.auditLog.actorFromRequest(request),
      targetType: "organization",
      targetId: organization.id,
      metadata: { fields: Object.keys(body) }
    });
    return { data: organization };
  }

  @Get("organizations/:id/onboarding")
  async getOrganizationOnboarding(@Req() request: AuthRequest, @Param("id") id: string) {
    return { data: await this.appService.getOrganizationOnboarding(id, request.user?.id) };
  }

  @Post("organizations/:id/activate")
  async activateOrganization(@Req() request: AuthRequest, @Param("id") id: string) {
    const organization = await this.appService.activateOrganization(id);
    await this.auditLog.log({
      action: "admin.organization.activate",
      ...this.auditLog.actorFromRequest(request),
      targetType: "organization",
      targetId: id
    });
    return { data: organization };
  }

  @Post("organizations/:id/deactivate")
  async deactivateOrganization(@Req() request: AuthRequest, @Param("id") id: string) {
    const organization = await this.appService.deactivateOrganization(id);
    await this.auditLog.log({
      action: "admin.organization.deactivate",
      ...this.auditLog.actorFromRequest(request),
      targetType: "organization",
      targetId: id
    });
    return { data: organization };
  }

  @Get("invites")
  async listInvites(@Req() request: AuthRequest) {
    return { data: await this.appService.listInvites(requireOrganizationId(request)) };
  }

  @Get("support-cases")
  async listSupportCases() {
    return { data: await this.appService.listSupportCases() };
  }

  @Get("support-case-comments")
  async listSupportCaseComments() {
    return { data: await this.appService.listSupportCaseComments() };
  }

  @Post("support-cases")
  async createSupportCase(@Req() request: AuthRequest, @Body() body: CreateSupportCaseDtoClass) {
    const item = await this.appService.createSupportCase(request.user?.id ?? "system", body);
    await this.auditLog.log({
      action: "admin.support_case.create",
      ...this.auditLog.actorFromRequest(request),
      targetType: "support_case",
      targetId: item.id,
      metadata: { organizationId: item.organizationId, severity: item.severity }
    });
    return { data: item };
  }

  @Patch("support-cases/:id")
  async updateSupportCase(@Req() request: AuthRequest, @Param("id") id: string, @Body() body: UpdateSupportCaseDtoClass) {
    const item = await this.appService.updateSupportCase(id, body);
    await this.auditLog.log({
      action: "admin.support_case.update",
      ...this.auditLog.actorFromRequest(request),
      targetType: "support_case",
      targetId: item.id,
      metadata: { fields: Object.keys(body) }
    });
    return { data: item };
  }

  @Post("support-cases/:id/comments")
  async createSupportCaseComment(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @Body() body: CreateSupportCaseCommentDtoClass
  ) {
    const item = await this.appService.createSupportCaseComment(id, request.user?.id ?? "system", body);
    await this.auditLog.log({
      action: "admin.support_case.comment",
      ...this.auditLog.actorFromRequest(request),
      targetType: "support_case",
      targetId: id
    });
    return { data: item };
  }

  @Get("incidents")
  async listIncidents() {
    return { data: await this.appService.listIncidents() };
  }

  @Post("incidents")
  async createIncident(@Req() request: AuthRequest, @Body() body: CreateIncidentDtoClass) {
    const item = await this.appService.createIncident(request.user?.id ?? "system", body);
    await this.auditLog.log({
      action: "admin.incident.create",
      ...this.auditLog.actorFromRequest(request),
      targetType: "incident",
      targetId: item.id,
      metadata: { organizationId: item.organizationId, status: item.status }
    });
    return { data: item };
  }

  @Patch("incidents/:id")
  async updateIncident(@Req() request: AuthRequest, @Param("id") id: string, @Body() body: UpdateIncidentDtoClass) {
    const item = await this.appService.updateIncident(id, body);
    await this.auditLog.log({
      action: "admin.incident.update",
      ...this.auditLog.actorFromRequest(request),
      targetType: "incident",
      targetId: item.id,
      metadata: { fields: Object.keys(body) }
    });
    return { data: item };
  }

  @Post("invites")
  async createInvite(@Req() request: AuthRequest, @Body() body: CreateInviteDtoClass) {
    const invite = await this.appService.createInvite(request.user?.id ?? "system", body);
    await this.auditLog.log({
      action: "admin.invite.create",
      ...this.auditLog.actorFromRequest(request),
      targetType: "user_invite",
      targetId: invite.id,
      metadata: { email: invite.email, role: invite.role, organizationId: invite.organizationId }
    });
    return { data: invite };
  }

  @Post("users")
  async createUser(@Req() request: AuthRequest, @Body() body: CreateUserDtoClass) {
    const user = await this.appService.createUser(body);
    await this.auditLog.log({
      action: "admin.user.create",
      ...this.auditLog.actorFromRequest(request),
      targetType: "user",
      targetId: user.id,
      metadata: { email: user.email, role: user.role }
    });
    return { data: user };
  }

  @Patch("users/:id")
  async updateUser(@Req() request: AuthRequest, @Param("id") id: string, @Body() body: UpdateUserDtoClass) {
    const user = await this.appService.updateUser(id, body);
    await this.auditLog.log({
      action: "admin.user.update",
      ...this.auditLog.actorFromRequest(request),
      targetType: "user",
      targetId: user.id,
      metadata: { fields: Object.keys(body) }
    });
    return { data: user };
  }

  @Post("users/:id/activate")
  async activateUser(@Req() request: AuthRequest, @Param("id") id: string) {
    const user = await this.appService.activateUser(id);
    await this.auditLog.log({
      action: "admin.user.activate",
      ...this.auditLog.actorFromRequest(request),
      targetType: "user",
      targetId: user.id
    });
    return { data: user };
  }

  @Post("users/:id/deactivate")
  async deactivateUser(@Req() request: AuthRequest, @Param("id") id: string) {
    const user = await this.appService.deactivateUser(id);
    await this.auditLog.log({
      action: "admin.user.deactivate",
      ...this.auditLog.actorFromRequest(request),
      targetType: "user",
      targetId: user.id
    });
    return { data: user };
  }

  @Post("users/:id/reset-password")
  async resetUserPassword(@Req() request: AuthRequest, @Param("id") id: string, @Body() body: ResetUserPasswordDtoClass) {
    const user = await this.appService.resetUserPassword(id, body);
    await this.auditLog.log({
      action: "admin.user.reset_password",
      ...this.auditLog.actorFromRequest(request),
      targetType: "user",
      targetId: user.id
    });
    return { data: user };
  }

  @Post("media/upload")
  async uploadMedia(@Req() request: AuthRequest, @Body() body: UploadMediaDtoClass) {
    const asset = await this.appService.uploadMedia(body, requireOrganizationId(request));
    await this.auditLog.log({
      action: "admin.media.create",
      ...this.auditLog.actorFromRequest(request),
      targetType: "media_asset",
      targetId: asset.id,
      metadata: { filename: asset.filename, type: asset.type }
    });
    return { data: asset };
  }

  @Post("media/upload-file")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: getUploadMaxBytes() }
    })
  )
  async uploadMediaFile(
    @Req() request: AuthRequest,
    @UploadedFile()
    file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }
  ) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    validateUploadFile(file);
    const asset = await this.appService.uploadMediaFile(file, requireOrganizationId(request));
    await this.auditLog.log({
      action: "admin.media.upload_file",
      ...this.auditLog.actorFromRequest(request),
      targetType: "media_asset",
      targetId: asset.id,
      metadata: { filename: asset.filename, type: asset.type, sizeBytes: asset.sizeBytes }
    });

    return { data: asset };
  }
}
