"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GameVersion } from "@game-game/shared";
import { selectParticipantGame } from "../lib/api";
import { readChildSession, saveChildSession } from "./child-session-sync";

export function JamChooserClient({
  participantId,
  jams,
  joinCode
}: {
  participantId: string;
  jams: GameVersion[];
  joinCode: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState(jams[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const selectedVersion = jams.find((v) => v.id === selectedVersionId) ?? jams[0];

  async function handleSelect(versionId: string) {
    setBusyId(versionId);
    setError(null);
    try {
      await selectParticipantGame(participantId, versionId);
      const current = readChildSession();
      if (current) saveChildSession({ ...current, participantId, joinCode });
      router.push(`/mission/${participantId}`);
    } catch {
      setError("Не удалось выбрать игру. Попробуй ещё раз.");
      setBusyId(null);
    }
  }

  // ── Одна игра → сразу старт ───────────────────────────────────────────────
  if (jams.length === 1 && selectedVersion) {
    const game = selectedVersion.snapshotJson.game;
    return (
      <div className="container stack" style={{ maxWidth: 520, paddingTop: 40 }}>
        <div className="card stack" style={{ padding: 28, textAlign: "center" }}>
          {game.coverImageUrl ? (
            <img
              src={game.coverImageUrl}
              alt={game.title}
              style={{ width: "100%", borderRadius: "var(--radius)", objectFit: "cover", maxHeight: 200 }}
            />
          ) : null}
          <div>
            <h1 style={{ fontSize: 32, margin: "0 0 8px" }}>{game.title}</h1>
            <p className="subtle" style={{ margin: 0 }}>{game.shortDescription}</p>
          </div>
          <button
            className="button"
            onClick={() => void handleSelect(selectedVersion.id)}
            disabled={busyId !== null}
            style={{ width: "100%", justifyContent: "center", fontSize: 18, padding: "16px 24px" }}
          >
            {busyId ? "Запускаю..." : "Старт →"}
          </button>
          {error ? <p role="alert" style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}
        </div>
      </div>
    );
  }

  // ── Несколько игр → выбор слева, preview справа ───────────────────────────
  return (
    <div className="container stack" style={{ paddingTop: 32 }}>
      <div>
        <div className="eyebrow">Выбери игру</div>
        <h1 style={{ fontSize: 36, marginTop: 8 }}>Какую миссию проходим?</h1>
      </div>

      <div className="split" style={{ alignItems: "flex-start" }}>
        {/* Список игр */}
        <div className="stack">
          {jams.map((version) => {
            const game = version.snapshotJson.game;
            const isSelected = version.id === selectedVersion?.id;
            return (
              <button
                key={version.id}
                type="button"
                className="card stack"
                onClick={() => setSelectedVersionId(version.id)}
                style={{
                  textAlign: "left",
                  padding: 18,
                  borderColor: isSelected ? "var(--primary)" : undefined,
                  boxShadow: isSelected ? "0 0 0 1px rgba(99,102,241,0.35) inset" : undefined,
                  background: isSelected ? "rgba(99,102,241,0.06)" : undefined,
                  cursor: "pointer",
                  transition: "border-color 150ms, background 150ms",
                }}
              >
                <strong>{game.title}</strong>
                <p className="subtle" style={{ margin: "4px 0 0", fontSize: 14 }}>{game.shortDescription}</p>
              </button>
            );
          })}
        </div>

        {/* Preview выбранной игры */}
        {selectedVersion ? (
          <div className="card stack" style={{ padding: 24 }}>
            {selectedVersion.snapshotJson.game.coverImageUrl ? (
              <img
                src={selectedVersion.snapshotJson.game.coverImageUrl}
                alt={selectedVersion.snapshotJson.game.title}
                style={{ width: "100%", borderRadius: "var(--radius)", objectFit: "cover", maxHeight: 180 }}
              />
            ) : null}
            <div>
              <h2 style={{ fontSize: 24, margin: "0 0 6px" }}>{selectedVersion.snapshotJson.game.title}</h2>
              <p className="subtle" style={{ margin: 0 }}>{selectedVersion.snapshotJson.game.shortDescription}</p>
            </div>
            <button
              className="button"
              onClick={() => void handleSelect(selectedVersion.id)}
              disabled={busyId !== null}
              style={{ width: "100%", justifyContent: "center", fontSize: 16, padding: "14px 20px" }}
            >
              {busyId === selectedVersion.id ? "Запускаю..." : "Старт →"}
            </button>
            {error ? <p role="alert" style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
