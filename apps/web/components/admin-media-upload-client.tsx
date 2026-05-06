"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import type { MediaLibraryAsset, MediaLibraryPayload } from "@game-game/shared";
import { deleteAdminMediaAsset, uploadAdminMediaFile } from "../lib/api";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

type AssetTypeFilter = "all" | "image" | "video" | "file";
type AssetUsageFilter = "all" | "used" | "unused";
type AssetSortMode = "newest" | "largest" | "usage" | "name";

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} КБ`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function assetTypeLabel(type: MediaLibraryAsset["type"]) {
  if (type === "image") return "Изображение";
  if (type === "video") return "Видео";
  return "Файл";
}

function sortAssets(assets: MediaLibraryAsset[], sortMode: AssetSortMode) {
  const next = [...assets];

  switch (sortMode) {
    case "largest":
      return next.sort((left, right) => right.sizeBytes - left.sizeBytes);
    case "usage":
      return next.sort((left, right) => right.usageCount - left.usageCount || right.sizeBytes - left.sizeBytes);
    case "name":
      return next.sort((left, right) => left.filename.localeCompare(right.filename, "ru"));
    case "newest":
    default:
      return next.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }
}

export function AdminMediaUploadClient({ initialLibrary }: { initialLibrary: MediaLibraryPayload }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetTypeFilter>("all");
  const [usageFilter, setUsageFilter] = useState<AssetUsageFilter>("all");
  const [sortMode, setSortMode] = useState<AssetSortMode>("newest");
  const [library, setLibrary] = useState(initialLibrary);

  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = library.assets.filter((asset) => {
      if (typeFilter !== "all" && asset.type !== typeFilter) {
        return false;
      }

      if (usageFilter === "used" && asset.orphaned) {
        return false;
      }

      if (usageFilter === "unused" && !asset.orphaned) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return [
        asset.filename,
        asset.mimeType,
        asset.url,
        ...asset.usages.map((usage) => `${usage.jamTitle} ${usage.stepTitle ?? ""}`)
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    return sortAssets(filtered, sortMode);
  }, [library.assets, query, sortMode, typeFilter, usageFilter]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setError("Файл слишком большой. Текущий лимит: 25 МБ.");
      return;
    }

    if (!file.type) {
      setError("Не удалось определить тип файла.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const uploaded = await uploadAdminMediaFile(file);
      setLibrary((current) => ({
        summary: {
          totalAssets: current.summary.totalAssets + 1,
          totalBytes: current.summary.totalBytes + uploaded.sizeBytes,
          storageLimitBytes: current.summary.storageLimitBytes,
          usagePercent:
            current.summary.storageLimitBytes > 0
              ? Math.round(((current.summary.totalBytes + uploaded.sizeBytes) / current.summary.storageLimitBytes) * 100)
              : 0,
          usedAssets: current.summary.usedAssets,
          orphanedAssets: current.summary.orphanedAssets + 1,
          imageCount: current.summary.imageCount + (uploaded.type === "image" ? 1 : 0),
          videoCount: current.summary.videoCount + (uploaded.type === "video" ? 1 : 0),
          fileCount: current.summary.fileCount + (uploaded.type === "file" ? 1 : 0),
          largestOrphanedBytes: Math.max(current.summary.largestOrphanedBytes, uploaded.sizeBytes)
        },
        assets: [
          {
            ...uploaded,
            usageCount: 0,
            orphaned: true,
            usages: []
          },
          ...current.assets.filter((asset) => asset.id !== uploaded.id)
        ]
      }));
    } catch {
      setError("Не удалось загрузить файл.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  async function handleDeleteAsset(assetId: string) {
    setError(null);

    try {
      await deleteAdminMediaAsset(assetId);
      setLibrary((current) => {
        const target = current.assets.find((asset) => asset.id === assetId);
        if (!target) {
          return current;
        }

        return {
          summary: {
            totalAssets: current.summary.totalAssets - 1,
            totalBytes: current.summary.totalBytes - target.sizeBytes,
            storageLimitBytes: current.summary.storageLimitBytes,
            usagePercent:
              current.summary.storageLimitBytes > 0
                ? Math.round(((current.summary.totalBytes - target.sizeBytes) / current.summary.storageLimitBytes) * 100)
                : 0,
            usedAssets: current.summary.usedAssets,
            orphanedAssets: current.summary.orphanedAssets - (target.orphaned ? 1 : 0),
            imageCount: current.summary.imageCount - (target.type === "image" ? 1 : 0),
            videoCount: current.summary.videoCount - (target.type === "video" ? 1 : 0),
            fileCount: current.summary.fileCount - (target.type === "file" ? 1 : 0),
            largestOrphanedBytes: current.assets
              .filter((asset) => asset.id !== assetId && asset.orphaned)
              .reduce((max, asset) => Math.max(max, asset.sizeBytes), 0)
          },
          assets: current.assets.filter((asset) => asset.id !== assetId)
        };
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Не удалось удалить файл.");
    }
  }

  return (
    <div className="card stack">
      <div className="eyebrow">Файлы игры</div>
      <strong>Обложки, видео и материалы миссии</strong>
      <p className="subtle">
        Здесь хранятся все загруженные файлы. Можно загрузить новый файл, быстро найти уже добавленный материал,
        посмотреть, где он используется, и удалить то, что больше не нужно.
      </p>

      <div className="button-row" style={{ flexWrap: "wrap" }}>
        <span className="pill">всего файлов: {library.summary.totalAssets}</span>
        <span className="pill">используется: {library.summary.usedAssets}</span>
        <span className="pill">не используется: {library.summary.orphanedAssets}</span>
        <span className="pill">занято: {formatBytes(library.summary.totalBytes)}</span>
      </div>

      <div className="button-row" style={{ flexWrap: "wrap" }}>
        <span className="pill">изображения: {library.summary.imageCount}</span>
        <span className="pill">видео: {library.summary.videoCount}</span>
        <span className="pill">файлы: {library.summary.fileCount}</span>
      </div>

      <label className="stack">
        <span>Загрузить файл</span>
        <input
          className="input"
          type="file"
          accept="image/*,video/*,.pdf,.zip,.txt"
          onChange={handleFileChange}
          disabled={pending}
        />
      </label>

      <label className="stack">
        <span>Поиск по библиотеке</span>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Имя файла, тип, игра или шаг"
        />
      </label>

      <div className="button-row" style={{ flexWrap: "wrap" }}>
        {(["all", "image", "video", "file"] as const).map((value) => (
          <button
            key={value}
            className={typeFilter === value ? "button-primary" : "button-secondary"}
            type="button"
            onClick={() => setTypeFilter(value)}
          >
            {value === "all" ? "Все типы" : value === "image" ? "Изображения" : value === "video" ? "Видео" : "Файлы"}
          </button>
        ))}
      </div>

      <div className="button-row" style={{ flexWrap: "wrap" }}>
        {(["all", "used", "unused"] as const).map((value) => (
          <button
            key={value}
            className={usageFilter === value ? "button-primary" : "button-secondary"}
            type="button"
            onClick={() => setUsageFilter(value)}
          >
            {value === "all" ? "Все файлы" : value === "used" ? "Только используемые" : "Только неиспользуемые"}
          </button>
        ))}

        <select
          className="input"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as AssetSortMode)}
          style={{ width: 220 }}
        >
          <option value="newest">Сначала новые</option>
          <option value="largest">Сначала большие</option>
          <option value="usage">Сначала используемые</option>
          <option value="name">По имени файла</option>
        </select>
      </div>

      {pending ? <p className="subtle">Загружаю файл...</p> : null}
      {error ? <p style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}

      {visibleAssets.length > 0 ? (
        <div className="stack">
          <div className="eyebrow">Библиотека файлов</div>
          {visibleAssets.map((asset) => (
            <div key={asset.id} className="card accent-card stack" style={{ padding: 18 }}>
              <div className="button-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="stack" style={{ gap: 6 }}>
                  <strong>{asset.filename}</strong>
                  <span className="subtle">{asset.mimeType}</span>
                </div>
                <span className="pill" style={{ color: asset.orphaned ? "#f59e0b" : "#84cc16" }}>
                  {asset.orphaned ? "не используется" : `используется: ${asset.usageCount}`}
                </span>
              </div>

              <div className="button-row" style={{ flexWrap: "wrap" }}>
                <span className="pill">{assetTypeLabel(asset.type)}</span>
                <span className="pill">{formatBytes(asset.sizeBytes)}</span>
                <span className="pill">дата: {new Date(asset.createdAt).toLocaleDateString("ru-RU")}</span>
              </div>

              <div className="button-row" style={{ flexWrap: "wrap" }}>
                <a className="button-secondary" href={asset.url} target="_blank" rel="noreferrer">
                  Открыть файл
                </a>
                <code style={{ fontSize: 12 }}>{asset.url}</code>
              </div>

              {asset.type === "image" ? (
                <img
                  src={asset.url}
                  alt={asset.filename}
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid rgba(139,92,246,0.2)"
                  }}
                />
              ) : null}

              {asset.type === "video" ? (
                <video
                  src={asset.url}
                  controls
                  preload="metadata"
                  style={{
                    width: "100%",
                    maxHeight: 260,
                    borderRadius: 14,
                    border: "1px solid rgba(139,92,246,0.2)"
                  }}
                />
              ) : null}

              {asset.usages.length > 0 ? (
                <div className="stack" style={{ gap: 8 }}>
                  <div className="eyebrow">Где используется</div>
                  {asset.usages.slice(0, 5).map((usage, index) => (
                    <p key={`${asset.id}-${index}`} className="subtle" style={{ margin: 0 }}>
                      {usage.jamTitle}
                      {usage.stepTitle ? ` -> ${usage.stepTitle}` : ""}
                    </p>
                  ))}
                  {asset.usages.length > 5 ? (
                    <p className="subtle" style={{ margin: 0 }}>
                      И ещё {asset.usages.length - 5} использований.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <p className="subtle" style={{ margin: 0 }}>
                    Файл пока ни к чему не привязан.
                  </p>
                  <div className="button-row">
                    <button type="button" className="button-secondary" onClick={() => handleDeleteAsset(asset.id)}>
                      Удалить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 18 }}>
          <strong>Файлы по текущему фильтру не найдены</strong>
          <p className="subtle" style={{ marginBottom: 0 }}>
            Попробуйте изменить поиск или загрузите новый файл.
          </p>
        </div>
      )}
    </div>
  );
}
