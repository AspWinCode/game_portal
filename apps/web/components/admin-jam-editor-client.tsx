"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game, GameEditLock, MediaAsset, UpdateGameDto } from "@game-game/shared";
import {
  acquireAdminGameEditLock,
  createAdminStep,
  heartbeatAdminGameEditLock,
  releaseAdminGameEditLock,
  updateAdminGame
} from "../lib/api";
import { AdminMediaPickerField } from "./admin-media-picker-field";

type LockState = "acquiring" | "owned" | "blocked" | "error";
type SaveState = "idle" | "dirty" | "saving" | "saved" | "conflict" | "error";

function isConflictError(error: unknown) {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 409);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Не удалось сохранить черновик.";
}

export function AdminJamEditorClient({
  jamId,
  jam,
  recentAssets,
  initialEditLock
}: {
  jamId: string;
  jam: Game;
  recentAssets: MediaAsset[];
  initialEditLock?: GameEditLock;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(jam.slug);
  const [title, setTitle] = useState(jam.title);
  const [shortDescription, setShortDescription] = useState(jam.shortDescription);
  const [fullDescription, setFullDescription] = useState(jam.fullDescription);
  const [themeCode, setThemeCode] = useState(jam.themeCode);
  const [level, setLevel] = useState(jam.level);
  const [estimatedDurationMin, setEstimatedDurationMin] = useState(String(jam.estimatedDurationMin));
  const [accentStyle, setAccentStyle] = useState(jam.accentStyle);
  const [accentColor, setAccentColor] = useState(jam.accentColor);
  const [coverImageUrl, setCoverImageUrl] = useState(jam.coverImageUrl ?? "");
  const [previewVideoUrl, setPreviewVideoUrl] = useState(jam.previewVideoUrl ?? "");
  const [finalTitle, setFinalTitle] = useState(jam.finalTitle);
  const [finalDescription, setFinalDescription] = useState(jam.finalDescription);
  const [finalRewardXp, setFinalRewardXp] = useState(String(jam.finalRewardXp));
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lockState, setLockState] = useState<LockState>("acquiring");
  const [busyAction, setBusyAction] = useState<"step" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [editLock, setEditLock] = useState<GameEditLock | undefined>(initialEditLock);
  const [pendingDraft, setPendingDraft] = useState<UpdateGameDto | null>(null);
  const expectedUpdatedAtRef = useRef(jam.updatedAt);
  const firstRenderRef = useRef(true);
  const draftKey = `game-draft-${jamId}`;

  const payload = useMemo<UpdateGameDto>(
    () => ({
      slug: slug.trim(),
      title: title.trim(),
      shortDescription: shortDescription.trim(),
      fullDescription: fullDescription.trim(),
      themeCode: themeCode.trim(),
      level: level.trim(),
      estimatedDurationMin: Number(estimatedDurationMin),
      accentStyle: accentStyle.trim(),
      accentColor: accentColor.trim(),
      coverImageUrl: coverImageUrl.trim() || undefined,
      previewVideoUrl: previewVideoUrl.trim() || undefined,
      finalTitle: finalTitle.trim(),
      finalDescription: finalDescription.trim(),
      finalRewardXp: Number(finalRewardXp)
    }),
    [
      accentColor,
      accentStyle,
      coverImageUrl,
      estimatedDurationMin,
      finalDescription,
      finalRewardXp,
      finalTitle,
      fullDescription,
      level,
      previewVideoUrl,
      shortDescription,
      slug,
      themeCode,
      title
    ]
  );

  const canEdit = lockState === "owned";

  // Fix C: keep the expected timestamp in sync with whatever the server sends back
  // after router.refresh() (e.g. following a step reorder that bumps game.updatedAt).
  useEffect(() => {
    expectedUpdatedAtRef.current = jam.updatedAt;
  }, [jam.updatedAt]);

  // Fix A (part 1): on mount, check if there is a localStorage backup from a previous 409.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setPendingDraft(JSON.parse(saved) as UpdateGameDto);
      }
    } catch {
      // localStorage unavailable or corrupt — ignore.
    }
  }, [draftKey]);

  const applyDraft = useCallback(() => {
    if (!pendingDraft) return;
    setSlug(pendingDraft.slug ?? "");
    setTitle(pendingDraft.title ?? "");
    setShortDescription(pendingDraft.shortDescription ?? "");
    setFullDescription(pendingDraft.fullDescription ?? "");
    setThemeCode(pendingDraft.themeCode ?? "");
    setLevel(pendingDraft.level ?? "");
    setEstimatedDurationMin(String(pendingDraft.estimatedDurationMin ?? ""));
    setAccentStyle(pendingDraft.accentStyle ?? "");
    setAccentColor(pendingDraft.accentColor ?? "");
    setCoverImageUrl(pendingDraft.coverImageUrl ?? "");
    setPreviewVideoUrl(pendingDraft.previewVideoUrl ?? "");
    setFinalTitle(pendingDraft.finalTitle ?? "");
    setFinalDescription(pendingDraft.finalDescription ?? "");
    setFinalRewardXp(String(pendingDraft.finalRewardXp ?? ""));
    try {
      localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
    setPendingDraft(null);
  }, [draftKey, pendingDraft]);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
    setPendingDraft(null);
  }, [draftKey]);

  async function saveDraft(manual = false) {
    if (!canEdit) {
      return;
    }

    setSaveState("saving");
    setError(null);

    try {
      const updated = await updateAdminGame(jamId, {
        ...payload,
        expectedUpdatedAt: expectedUpdatedAtRef.current
      });
      expectedUpdatedAtRef.current = updated.updatedAt;
      setSaveState("saved");
      if (manual) {
        router.refresh();
      }
    } catch (saveError) {
      const message = getErrorMessage(saveError);
      setError(message);
      if (isConflictError(saveError)) {
        // Fix A (part 2): back up the unsaved changes so the user can restore after refresh.
        try {
          localStorage.setItem(draftKey, JSON.stringify(payload));
        } catch { /* localStorage unavailable — skip backup */ }
        setSaveState("conflict");
      } else {
        setSaveState("error");
      }
    }
  }

  useEffect(() => {
    let disposed = false;

    async function acquireLock() {
      setLockState("acquiring");
      setLockError(null);

      try {
        const lock = await acquireAdminGameEditLock(jamId);
        if (disposed) {
          return;
        }
        setEditLock(lock);
        setLockState("owned");
      } catch (lockAcquireError) {
        if (disposed) {
          return;
        }
        setLockError(getErrorMessage(lockAcquireError));
        setLockState(isConflictError(lockAcquireError) ? "blocked" : "error");
      }
    }

    void acquireLock();

    return () => {
      disposed = true;
      void releaseAdminGameEditLock(jamId);
    };
  }, [jamId]);

  useEffect(() => {
    if (lockState !== "owned") {
      return;
    }

    const interval = window.setInterval(() => {
      void heartbeatAdminGameEditLock(jamId)
        .then((lock) => {
          setEditLock(lock);
        })
        .catch((heartbeatError) => {
          setLockError(getErrorMessage(heartbeatError));
          setLockState(isConflictError(heartbeatError) ? "blocked" : "error");
        });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [jamId, lockState]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (!canEdit) {
      return;
    }

    setSaveState("dirty");
    const timeout = window.setTimeout(() => {
      void saveDraft(false);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [canEdit, payload]);

  async function handleAddStep() {
    if (!canEdit) {
      return;
    }

    setBusyAction("step");
    setError(null);

    try {
      await createAdminStep(jamId, {
        title: `Новый этап ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
        description: "Опишите, что должен сделать ребёнок на этом этапе.",
        goalText: "Короткий и понятный результат, который легко проверить.",
        successTitle: "Этап выполнен",
        successText: "Можно двигаться дальше.",
        successXp: 20
      });
      router.refresh();
    } catch {
      setError("Не удалось добавить этап.");
    } finally {
      setBusyAction(null);
    }
  }

  const saveLabel =
    saveState === "saving"
      ? "Автосохранение..."
      : saveState === "saved"
        ? "Все изменения сохранены"
        : saveState === "dirty"
          ? "Есть несохранённые изменения"
          : saveState === "conflict"
            ? "Нужно обновить страницу"
            : "Редактор черновика";

  const lockLabel =
    lockState === "acquiring"
      ? "Проверяю блокировку редактора"
      : lockState === "owned"
        ? "Редактирование закреплено за вами"
        : lockState === "blocked"
          ? "Игра открыта в другой вкладке"
          : "Не удалось получить блокировку";

  return (
    <div className="stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <h2 className="section-title" style={{ fontSize: 24, margin: 0 }}>
          Основная информация
        </h2>
        <div className="button-row">
          <span className="pill">{saveLabel}</span>
          <span className="pill">{lockLabel}</span>
        </div>
      </div>

      {editLock ? (
        <div className="card" style={{ padding: 16 }}>
          <strong>Статус редактора</strong>
          <p className="subtle" style={{ marginBottom: 0 }}>
            {editLock.isOwnedByCurrentUser
              ? `Блокировка удерживается вашей сессией до ${new Date(editLock.expiresAt).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}.`
              : `Сейчас редактирует ${editLock.userDisplayName}. Блокировка действует до ${new Date(editLock.expiresAt).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit"
                })}.`}
          </p>
        </div>
      ) : null}

      {lockError ? <p style={{ color: "#fda4af", margin: 0 }}>{lockError}</p> : null}

      {pendingDraft ? (
        <div className="card stack" style={{ padding: 16, border: "1px solid #f59e0b" }}>
          <strong>Найден несохранённый черновик</strong>
          <p className="subtle" style={{ margin: 0 }}>
            При прошлом сохранении возник конфликт версий. Черновик был автоматически сохранён в браузере.
            Восстановить его сейчас?
          </p>
          <div className="button-row">
            <button className="button" type="button" onClick={applyDraft}>
              Восстановить черновик
            </button>
            <button className="button-secondary" type="button" onClick={discardDraft}>
              Удалить черновик
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-2">
        <label className="stack">
          <span>Код игры</span>
          <input className="input" value={slug} onChange={(event) => setSlug(event.target.value)} disabled={!canEdit} />
        </label>
        <label className="stack">
          <span>Уровень</span>
          <input className="input" value={level} onChange={(event) => setLevel(event.target.value)} disabled={!canEdit} />
        </label>
      </div>

      <label className="stack">
        <span>Название</span>
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canEdit} />
      </label>

      <label className="stack">
        <span>Краткое описание</span>
        <textarea className="textarea" value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} rows={3} disabled={!canEdit} />
      </label>

      <label className="stack">
        <span>Полное описание</span>
        <textarea className="textarea" value={fullDescription} onChange={(event) => setFullDescription(event.target.value)} rows={5} disabled={!canEdit} />
      </label>

      <div className="grid grid-3">
        <label className="stack">
          <span>Код темы</span>
          <input className="input" value={themeCode} onChange={(event) => setThemeCode(event.target.value)} disabled={!canEdit} />
        </label>
        <label className="stack">
          <span>Длительность, мин</span>
          <input className="input" value={estimatedDurationMin} onChange={(event) => setEstimatedDurationMin(event.target.value)} inputMode="numeric" disabled={!canEdit} />
        </label>
        <label className="stack">
          <span>Акцентный стиль</span>
          <input className="input" value={accentStyle} onChange={(event) => setAccentStyle(event.target.value)} disabled={!canEdit} />
        </label>
      </div>

      <label className="stack">
        <span>Акцентный цвет</span>
        <input className="input" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} placeholder="#8B5CF6" disabled={!canEdit} />
      </label>

      <AdminMediaPickerField
        label="URL обложки"
        value={coverImageUrl}
        onChange={setCoverImageUrl}
        placeholder="/uploads/manual/cover.png"
        recentAssets={recentAssets}
        allowedTypes={["image"]}
        disabled={!canEdit}
      />

      <AdminMediaPickerField
        label="URL preview-видео"
        value={previewVideoUrl}
        onChange={setPreviewVideoUrl}
        placeholder="/uploads/manual/preview.mp4"
        recentAssets={recentAssets}
        allowedTypes={["video"]}
        disabled={!canEdit}
      />

      <div className="card stack" style={{ padding: 16 }}>
        <div className="eyebrow">Финальный экран</div>
        <label className="stack">
          <span>Финальный заголовок</span>
          <input className="input" value={finalTitle} onChange={(event) => setFinalTitle(event.target.value)} disabled={!canEdit} />
        </label>
        <label className="stack">
          <span>Финальное описание</span>
          <textarea className="textarea" value={finalDescription} onChange={(event) => setFinalDescription(event.target.value)} rows={3} disabled={!canEdit} />
        </label>
        <label className="stack">
          <span>Финальная награда XP</span>
          <input className="input" value={finalRewardXp} onChange={(event) => setFinalRewardXp(event.target.value)} inputMode="numeric" disabled={!canEdit} />
        </label>
      </div>

      {error ? <p style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}

      <div className="button-row">
        <button className="button" onClick={() => void saveDraft(true)} disabled={!canEdit || saveState === "saving" || busyAction !== null}>
          Сохранить сейчас
        </button>
        <button className="button-secondary" onClick={handleAddStep} disabled={!canEdit || busyAction !== null || saveState === "saving"}>
          {busyAction === "step" ? "Добавляю..." : "Добавить этап"}
        </button>
      </div>
    </div>
  );
}
