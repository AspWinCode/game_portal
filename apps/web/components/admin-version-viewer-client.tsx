"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminGameDetail, Game, GameVersion } from "@game-game/shared";
import { restoreAdminGameVersion } from "../lib/api";

type StepWithHints = AdminGameDetail["steps"][number];

function levelLabel(level: string) {
  if (level === "beginner") return "начальный";
  if (level === "intermediate") return "средний";
  if (level === "advanced") return "продвинутый";
  return level;
}

function compareJamMetadata(currentJam: Game, snapshotJam: Game) {
  const changes: string[] = [];

  if (currentJam.title !== snapshotJam.title) changes.push("название");
  if (currentJam.shortDescription !== snapshotJam.shortDescription) changes.push("краткое описание");
  if (currentJam.fullDescription !== snapshotJam.fullDescription) changes.push("полное описание");
  if (currentJam.themeCode !== snapshotJam.themeCode) changes.push("тема");
  if (currentJam.level !== snapshotJam.level) changes.push("уровень");
  if (currentJam.estimatedDurationMin !== snapshotJam.estimatedDurationMin) changes.push("длительность");
  if (currentJam.accentStyle !== snapshotJam.accentStyle) changes.push("стиль акцента");
  if (currentJam.accentColor !== snapshotJam.accentColor) changes.push("цвет акцента");
  if ((currentJam.coverImageUrl ?? "") !== (snapshotJam.coverImageUrl ?? "")) changes.push("обложка");
  if ((currentJam.previewVideoUrl ?? "") !== (snapshotJam.previewVideoUrl ?? "")) changes.push("превью-видео");
  if (currentJam.finalTitle !== snapshotJam.finalTitle) changes.push("заголовок финала");
  if (currentJam.finalDescription !== snapshotJam.finalDescription) changes.push("текст финала");
  if (currentJam.finalRewardXp !== snapshotJam.finalRewardXp) changes.push("награда XP");

  return changes;
}

function compareSteps(currentSteps: StepWithHints[], snapshotSteps: GameVersion["snapshotJson"]["steps"]) {
  const currentByOrder = new Map(currentSteps.map((step) => [step.orderIndex, step]));
  const snapshotByOrder = new Map(snapshotSteps.map((step) => [step.orderIndex, step]));
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [orderIndex, step] of currentByOrder.entries()) {
    const snapshotStep = snapshotByOrder.get(orderIndex);

    if (!snapshotStep) {
      added.push(`${orderIndex}. ${step.title}`);
      continue;
    }

    const stepChanges: string[] = [];
    if (step.title !== snapshotStep.title) stepChanges.push("название");
    if (step.description !== snapshotStep.description) stepChanges.push("описание");
    if (step.goalText !== snapshotStep.goalText) stepChanges.push("цель");
    if (step.successTitle !== snapshotStep.successTitle) stepChanges.push("заголовок успеха");
    if (step.successText !== snapshotStep.successText) stepChanges.push("текст успеха");
    if (step.successXp !== snapshotStep.successXp) stepChanges.push("XP");
    if ((step.resultImageUrl ?? "") !== (snapshotStep.resultImageUrl ?? "")) stepChanges.push("итоговое изображение");
    if ((step.resultVideoUrl ?? "") !== (snapshotStep.resultVideoUrl ?? "")) stepChanges.push("итоговое видео");
    if (step.hints.length !== snapshotStep.hints.length) stepChanges.push("число подсказок");

    const hintChanges = step.hints.reduce((sum, hint, index) => {
      const snapshotHint = snapshotStep.hints[index];
      if (!snapshotHint) {
        return sum + 1;
      }

      return sum + Number(
        hint.level !== snapshotHint.level ||
          hint.text !== snapshotHint.text ||
          hint.hintType !== snapshotHint.hintType ||
          (hint.mediaUrl ?? "") !== (snapshotHint.mediaUrl ?? "")
      );
    }, 0);

    if (hintChanges > 0) {
      stepChanges.push(`подсказки(${hintChanges})`);
    }

    if (stepChanges.length > 0) {
      changed.push(`${orderIndex}. ${step.title}: ${stepChanges.join(", ")}`);
    }
  }

  for (const [orderIndex, snapshotStep] of snapshotByOrder.entries()) {
    if (!currentByOrder.has(orderIndex)) {
      removed.push(`${orderIndex}. ${snapshotStep.title}`);
    }
  }

  return { changed, added, removed };
}

export function AdminVersionViewerClient({
  versions,
  currentJam,
  currentSteps,
  canEdit
}: {
  versions: GameVersion[];
  currentJam: Game;
  currentSteps: StepWithHints[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [selectedVersionId, setSelectedVersionId] = useState(versions[0]?.id ?? "");
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? versions[0],
    [selectedVersionId, versions]
  );

  const comparison = useMemo(() => {
    if (!selectedVersion) {
      return null;
    }

    return {
      jamChanges: compareJamMetadata(currentJam, selectedVersion.snapshotJson.game),
      stepChanges: compareSteps(currentSteps, selectedVersion.snapshotJson.steps)
    };
  }, [currentJam, currentSteps, selectedVersion]);

  async function handleRestore() {
    if (!selectedVersion || !canEdit) {
      return;
    }

    const confirmed = window.confirm(
      `Восстановить текущий черновик из версии v${selectedVersion.versionNumber}? Текущие несохранённые правки будут перезаписаны.`
    );
    if (!confirmed) {
      return;
    }

    setRestoring(true);
    setError(null);
    setSuccess(null);

    try {
      await restoreAdminGameVersion(selectedVersion.id);
      setSuccess(`Черновик восстановлен из v${selectedVersion.versionNumber}. Обновляю страницу...`);
      window.setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Не удалось восстановить черновик из выбранной версии.");
    } finally {
      setRestoring(false);
    }
  }

  if (!selectedVersion || !comparison) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <strong>Версий пока нет</strong>
        <p className="subtle" style={{ marginBottom: 0 }}>
          После первой публикации здесь появится сохранённая версия игры.
        </p>
      </div>
    );
  }

  const totalChanges =
    comparison.jamChanges.length +
    comparison.stepChanges.changed.length +
    comparison.stepChanges.added.length +
    comparison.stepChanges.removed.length;

  return (
    <div className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">История версий</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>
            История публикаций
          </h2>
        </div>
        <span className="pill">всего: {versions.length}</span>
      </div>

      <label className="stack">
        <span>Выбрать версию</span>
        <select className="input" value={selectedVersion.id} onChange={(event) => setSelectedVersionId(event.target.value)}>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              v{version.versionNumber} · {new Date(version.createdAt).toLocaleString("ru-RU")}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-3">
        <div className="card" style={{ padding: 16 }}>
          <strong>Версия</strong>
          <p className="subtle">v{selectedVersion.versionNumber}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <strong>Шагов</strong>
          <p className="subtle">{selectedVersion.snapshotJson.steps.length}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <strong>Награда в финале</strong>
          <p className="subtle">{selectedVersion.snapshotJson.finalScreen.rewardXp} XP</p>
        </div>
      </div>

      <div className="button-row">
        {selectedVersion.isPublishedVersion ? <span className="pill">опубликованная версия</span> : null}
        <span className="pill">создал: {selectedVersion.createdBy}</span>
        <span className="pill">тема: {selectedVersion.snapshotJson.game.themeCode}</span>
        <span className="pill">изменений в черновике: {totalChanges}</span>
      </div>

      {!canEdit ? (
        <div className="card" style={{ padding: 14 }}>
          <strong>Восстановление временно недоступно</strong>
          <p className="subtle" style={{ marginBottom: 0 }}>
            Сначала получите блокировку на игру, затем выполняйте восстановление черновика из выбранной версии.
          </p>
        </div>
      ) : null}

      <div className="button-row">
        <button className="button-secondary" onClick={() => void handleRestore()} disabled={!canEdit || restoring}>
          {restoring ? "Восстанавливаю..." : "Восстановить черновик из версии"}
        </button>
        <span className="subtle">Пересобирает текущий черновик из выбранной опубликованной версии.</span>
      </div>

      {success ? (
        <div className="card" style={{ padding: 14, borderColor: "#84cc16" }}>
          <strong>Восстановление выполнено</strong>
          <p className="subtle" style={{ marginBottom: 0 }}>
            {success}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="card" style={{ padding: 14, borderColor: "#fda4af" }}>
          <strong>Восстановление не выполнено</strong>
          <p style={{ color: "#fda4af", marginBottom: 12 }}>{error}</p>
          <button className="button-secondary" onClick={() => router.refresh()}>
            Обновить страницу
          </button>
        </div>
      ) : null}

      <div className="card stack" style={{ padding: 16 }}>
        <div className="eyebrow">Черновик и выбранная версия</div>
        {totalChanges === 0 ? (
          <p className="subtle" style={{ marginBottom: 0 }}>
            Текущий черновик совпадает с выбранной опубликованной версией.
          </p>
        ) : (
          <>
            {comparison.jamChanges.length > 0 ? (
              <div className="stack">
                <strong>Изменения в общей информации</strong>
                <p className="subtle" style={{ marginBottom: 0 }}>
                  {comparison.jamChanges.join(", ")}
                </p>
              </div>
            ) : null}

            {comparison.stepChanges.changed.length > 0 ? (
              <div className="stack">
                <strong>Изменённые шаги</strong>
                {comparison.stepChanges.changed.map((item) => (
                  <div key={item} className="card" style={{ padding: 12 }}>
                    <p className="subtle" style={{ margin: 0 }}>
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {comparison.stepChanges.added.length > 0 ? (
              <div className="stack">
                <strong>Добавленные шаги</strong>
                <p className="subtle" style={{ marginBottom: 0 }}>
                  {comparison.stepChanges.added.join(", ")}
                </p>
              </div>
            ) : null}

            {comparison.stepChanges.removed.length > 0 ? (
              <div className="stack">
                <strong>Удалённые шаги</strong>
                <p className="subtle" style={{ marginBottom: 0 }}>
                  {comparison.stepChanges.removed.join(", ")}
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="card accent-card stack" style={{ padding: 18 }}>
        <strong>{selectedVersion.snapshotJson.game.title}</strong>
        <p className="subtle">{selectedVersion.snapshotJson.game.shortDescription}</p>
        <div className="button-row">
          <span className="pill">{levelLabel(selectedVersion.snapshotJson.game.level)}</span>
          <span className="pill">{selectedVersion.snapshotJson.game.estimatedDurationMin} мин</span>
          <span className="pill">{selectedVersion.snapshotJson.steps.length} шага</span>
        </div>
      </div>

      <div className="stack">
        <strong>Шаги в версии</strong>
        {selectedVersion.snapshotJson.steps.map((step) => (
          <div key={step.id} className="card" style={{ padding: 16 }}>
            <div className="button-row" style={{ justifyContent: "space-between" }}>
              <strong>
                {step.orderIndex}. {step.title}
              </strong>
              <div className="button-row">
                <span className="pill">XP {step.successXp}</span>
                <span className="pill">подсказки: {step.hints.length}</span>
              </div>
            </div>
            <p className="subtle">{step.goalText}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
