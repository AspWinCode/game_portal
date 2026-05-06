import { BadRequestException, Injectable } from "@nestjs/common";
import { MediaAssetType } from "@prisma/client";
import type { MediaAsset, MediaAssetUsage, MediaLibraryAsset, MediaLibraryPayload, UploadMediaDto } from "@game-game/shared";
import { PrismaService } from "../../prisma/prisma.service.js";
import { MediaStorageService } from "./media-storage.service.js";

@Injectable()
export class MediaRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStorage: MediaStorageService
  ) {}

  async createAsset(dto: UploadMediaDto, organizationId: string): Promise<MediaAsset> {
    await this.ensureStorageWithinLimit(organizationId, dto.sizeBytes);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        organizationId,
        type: dto.type as MediaAssetType,
        url: this.mediaStorage.buildManualUrl(dto.filename),
        filename: this.mediaStorage.sanitizeFilename(dto.filename),
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        uploadedBy: "admin_system"
      }
    });

    return this.toMediaAsset(asset);
  }

  async createAssetFromFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }, organizationId: string): Promise<MediaAsset> {
    await this.ensureStorageWithinLimit(organizationId, file.size);
    const type = this.detectType(file.mimetype);
    const stored = await this.mediaStorage.storeFile(file);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        organizationId,
        type,
        url: stored.url,
        filename: this.mediaStorage.sanitizeFilename(file.originalname),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedBy: "admin_system"
      }
    });

    return this.toMediaAsset(asset);
  }

  private async ensureStorageWithinLimit(organizationId: string, bytesToAdd: number) {
    const [organization, usage] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId }
      }) as Promise<{ maxStorageBytes: bigint } | null>,
      this.prisma.mediaAsset.aggregate({
        where: { organizationId },
        _sum: { sizeBytes: true }
      })
    ]);

    if (!organization) {
      throw new BadRequestException("Organization not found");
    }

    const currentUsage = usage._sum.sizeBytes ?? 0;
    const limit = Number(organization.maxStorageBytes);

    if (currentUsage + bytesToAdd > limit) {
      throw new BadRequestException("Organization has reached the storage quota for the current plan");
    }
  }

  async listRecentAssets(organizationId: string, limit = 12): Promise<MediaAsset[]> {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return assets.map((asset) => this.toMediaAsset(asset));
  }

  async getMediaLibrary(organizationId: string): Promise<MediaLibraryPayload> {
    const [assets, jams, organization] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.game.findMany({
        where: { organizationId },
        select: {
          id: true,
          title: true,
          coverImageUrl: true,
          previewVideoUrl: true,
          steps: {
            select: {
              id: true,
              title: true,
              resultImageUrl: true,
              resultVideoUrl: true,
              hints: {
                select: {
                  id: true,
                  mediaUrl: true
                }
              }
            }
          }
        }
      }),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          maxStorageBytes: true
        }
      })
    ]);

    const usageMap = new Map<string, MediaAssetUsage[]>();
    const pushUsage = (url: string | null | undefined, usage: MediaAssetUsage) => {
      if (!url?.trim()) {
        return;
      }

      const current = usageMap.get(url) ?? [];
      current.push(usage);
      usageMap.set(url, current);
    };

    for (const jam of jams) {
      pushUsage(jam.coverImageUrl, {
        scope: "jam_cover",
        jamId: jam.id,
        jamTitle: jam.title
      });

      pushUsage(jam.previewVideoUrl, {
        scope: "jam_preview",
        jamId: jam.id,
        jamTitle: jam.title
      });

      for (const step of jam.steps) {
        pushUsage(step.resultImageUrl, {
          scope: "step_result_image",
          jamId: jam.id,
          jamTitle: jam.title,
          stepId: step.id,
          stepTitle: step.title
        });

        pushUsage(step.resultVideoUrl, {
          scope: "step_result_video",
          jamId: jam.id,
          jamTitle: jam.title,
          stepId: step.id,
          stepTitle: step.title
        });

        for (const hint of step.hints) {
          pushUsage(hint.mediaUrl, {
            scope: "hint_media",
            jamId: jam.id,
            jamTitle: jam.title,
            stepId: step.id,
            stepTitle: step.title,
            hintId: hint.id
          });
        }
      }
    }

    const items: MediaLibraryAsset[] = assets.map((asset) => {
      const usages = usageMap.get(asset.url) ?? [];
      return {
        ...this.toMediaAsset(asset),
        usageCount: usages.length,
        orphaned: usages.length === 0,
        usages
      };
    });

    return {
      summary: {
        totalAssets: items.length,
        totalBytes: items.reduce((sum, asset) => sum + asset.sizeBytes, 0),
        storageLimitBytes: Number(organization?.maxStorageBytes ?? 0),
        usagePercent:
          organization && Number(organization.maxStorageBytes) > 0
            ? Math.round((items.reduce((sum, asset) => sum + asset.sizeBytes, 0) / Number(organization.maxStorageBytes)) * 100)
            : 0,
        usedAssets: items.filter((asset) => !asset.orphaned).length,
        orphanedAssets: items.filter((asset) => asset.orphaned).length,
        imageCount: items.filter((asset) => asset.type === "image").length,
        videoCount: items.filter((asset) => asset.type === "video").length,
        fileCount: items.filter((asset) => asset.type === "file").length,
        largestOrphanedBytes: items
          .filter((asset) => asset.orphaned)
          .reduce((max, asset) => Math.max(max, asset.sizeBytes), 0)
      },
      assets: items
    };
  }

  async deleteOrphanedAsset(assetId: string, organizationId: string): Promise<{ ok: true }> {
    const library = await this.getMediaLibrary(organizationId);
    const asset = library.assets.find((item) => item.id === assetId);

    if (!asset) {
      throw new Error("Media asset not found");
    }

    if (!asset.orphaned) {
      throw new Error("Only orphaned assets can be deleted");
    }

    await this.mediaStorage.deleteFileByUrl(asset.url);
    await this.prisma.mediaAsset.delete({
      where: { id: assetId }
    });

    return { ok: true };
  }

  private toMediaAsset(asset: {
    id: string;
    organizationId: string;
    type: MediaAssetType;
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
    createdAt: Date;
  }): MediaAsset {
    return {
      id: asset.id,
      organizationId: asset.organizationId,
      type: asset.type,
      url: asset.url,
      filename: asset.filename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      uploadedBy: asset.uploadedBy,
      createdAt: asset.createdAt.toISOString()
    };
  }

  private detectType(mimeType: string): MediaAssetType {
    if (mimeType.startsWith("image/")) {
      return MediaAssetType.image;
    }

    if (mimeType.startsWith("video/")) {
      return MediaAssetType.video;
    }

    return MediaAssetType.file;
  }
}
