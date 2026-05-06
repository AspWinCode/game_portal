"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Route } from "next";
import { clearChildSession, readChildSession } from "./child-session-sync";

export function ChildResumeCard({
  title = "Продолжить"
}: {
  title?: string;
  description?: string; // kept for API compatibility
}) {
  const router = useRouter();
  const [session, setSession] = useState(readChildSession());

  if (!session) return null;

  function handleClear() {
    clearChildSession();
    setSession(null);
    router.refresh();
  }

  return (
    <div className="card accent-card stack" style={{ padding: 24 }}>
      <div className="eyebrow">{title}</div>
      <strong style={{ fontSize: 22 }}>{session.displayName ?? "Участник"}</strong>

      <div className="button-row">
        <Link className="button" href={`/mission/${session.participantId}` as Route}>
          Вернуться в миссию
        </Link>
        <Link className="button-secondary" href={`/participant/${session.participantId}/jams` as Route}>
          Выбрать игру
        </Link>
      </div>

      <button
        type="button"
        className="button-ghost"
        onClick={handleClear}
        style={{ alignSelf: "flex-start", fontSize: 13, color: "var(--muted)" }}
      >
        Сменить ребёнка
      </button>
    </div>
  );
}
