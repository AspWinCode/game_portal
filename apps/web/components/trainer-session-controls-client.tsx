"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GameVersion, Jam, JamAnalytics } from "@game-game/shared";
import { attachTrainerJamGame, completeTrainerJam, startTrainerJam } from "../lib/api";

export function TrainerSessionControlsClient({
  session,
  jamVersions,
  attachedJamVersionIds,
  analytics
}: {
  session: Jam;
  jamVersions: GameVersion[];
  attachedJamVersionIds: string[];
  analytics?: JamAnalytics;
}) {
  const router = useRouter();
  const [selectedVersionId, setSelectedVersionId] = useState(
    jamVersions.find((version) => !attachedJamVersionIds.includes(version.id))?.id ?? jamVersions[0]?.id ?? ""
  );
  const [pending, setPending] = useState<"attach" | "start" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAttach() {
    if (!selectedVersionId) {
      return;
    }

    setPending("attach");
    setError(null);
    try {
      await attachTrainerJamGame(session.id, {
        gameVersionId: selectedVersionId,
        isDefault: attachedJamVersionIds.length === 0
      });
      router.refresh();
    } catch {
      setError("Не удалось подключить игру к джему.");
    } finally {
      setPending(null);
    }
  }

  async function handleStart() {
    setPending("start");
    setError(null);
    try {
      await startTrainerJam(session.id);
      router.refresh();
    } catch {
      setError("Не удалось запустить джем.");
    } finally {
      setPending(null);
    }
  }

  async function handleComplete() {
    setPending("complete");
    setError(null);
    try {
      await completeTrainerJam(session.id);
      router.refresh();
    } catch {
      setError("Не удалось завершить джем.");
    } finally {
      setPending(null);
    }
  }

  const availableVersions = jamVersions.filter((version) => !attachedJamVersionIds.includes(version.id));

  return (
    <div className="card stack">
      <div className="eyebrow">УПРАВЛЕНИЕ ДЖЕМОМ</div>

      <div className="button-row">
        <button className="button" onClick={handleStart} disabled={pending !== null || session.status === "active"}>
          {pending === "start" ? "Запускаю..." : "Запустить джем"}
        </button>
        <button className="button-secondary" onClick={handleComplete} disabled={pending !== null || session.status === "completed"}>
          {pending === "complete" ? "Завершаю..." : "Завершить джем"}
        </button>
      </div>

      <label className="stack">
        <span>Подключить опубликованную игру</span>
        <select
          className="input"
          value={selectedVersionId}
          onChange={(event) => setSelectedVersionId(event.target.value)}
          disabled={pending !== null || availableVersions.length === 0}
        >
          {availableVersions.length === 0 ? <option value="">Все игры уже подключены</option> : null}
          {availableVersions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.snapshotJson.game.title} · v{version.versionNumber}
            </option>
          ))}
        </select>
      </label>

      <button className="button-secondary" onClick={handleAttach} disabled={pending !== null || !selectedVersionId || availableVersions.length === 0}>
        {pending === "attach" ? "Подключаю..." : "Добавить игру в джем"}
      </button>

      {error ? <p style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}
    </div>
  );
}
