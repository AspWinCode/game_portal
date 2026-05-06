"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { publishAdminGame } from "../lib/api";

export function AdminPublishClient({
  jamId,
  publishReady,
  nextVersionNumber,
  stepsCount,
  hintsCount,
  hasMedia,
  hasDraftChanges
}: {
  jamId: string;
  publishReady: boolean;
  nextVersionNumber: number;
  stepsCount: number;
  hintsCount: number;
  hasMedia: boolean;
  hasDraftChanges: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPending(true);
    setError(null);

    try {
      await publishAdminGame(jamId);
      router.refresh();
    } catch {
      setError("Не удалось опубликовать игру.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <div className="card accent-card stack" style={{ padding: 16 }}>
        <div className="eyebrow">Итог перед публикацией</div>
        <strong>Будет создана версия v{nextVersionNumber}</strong>
        <div className="button-row">
          <span className="pill">шаги: {stepsCount}</span>
          <span className="pill">подсказки: {hintsCount}</span>
          <span className="pill">{hasMedia ? "медиа добавлены" : "медиа пока не добавлены"}</span>
          <span className="pill">{hasDraftChanges ? "черновик отличается от последней версии" : "совпадает с последней версией"}</span>
        </div>
        <p className="subtle" style={{ marginBottom: 0 }}>
          В снимок версии попадут текущее описание игры, порядок шагов, подсказки, медиа и финальный экран в их текущем состоянии.
        </p>
      </div>

      <button className="button" disabled={!publishReady || pending} style={{ opacity: publishReady ? 1 : 0.5 }} onClick={handlePublish}>
        {pending ? "Публикую..." : `Опубликовать версию v${nextVersionNumber}`}
      </button>
      {error ? <p style={{ color: "#fda4af", margin: 0 }}>{error}</p> : null}
    </div>
  );
}
