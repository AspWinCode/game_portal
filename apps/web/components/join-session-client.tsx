"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { GameVersion, PublicOrganizationBranding, Jam } from "@game-game/shared";
import { joinJam } from "../lib/api";
import { LimitedMobileNotice } from "./limited-mobile-notice";
import { saveChildSession } from "./child-session-sync";

const avatars = [
  { id: "robot",  emoji: "🤖" },
  { id: "pilot",  emoji: "🧑‍✈️" },
  { id: "spark",  emoji: "⚡" },
  { id: "ninja",  emoji: "🥷" },
];

export function JoinSessionClient({
  joinCode,
  session,
  organization,
  jams,
  hasResumeOption = false
}: {
  joinCode: string;
  session: Jam;
  organization: PublicOrganizationBranding;
  jams: GameVersion[];
  hasResumeOption?: boolean;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("robot");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!displayName.trim()) {
      setError("Введи своё имя.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const participant = await joinJam(joinCode, {
        displayName: displayName.trim(),
        avatar
      });

      saveChildSession({
        participantId: participant.id,
        joinCode,
        sessionTitle: session.title,
        displayName: displayName.trim(),
        avatar
      });

      router.push(`/participant/${participant.id}/jams`);
    } catch {
      setError("Не удалось войти. Попробуй ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <LimitedMobileNotice />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{session.title}</div>
        <p className="subtle" style={{ margin: 0, fontSize: 14 }}>
          {organization.name} · код <span className="code">{joinCode}</span>
        </p>
      </div>

      {/* Join form */}
      <form className="card stack" onSubmit={handleSubmit} style={{ padding: 28 }}>
        <label className="stack">
          <span style={{ fontWeight: 600 }}>Как тебя зовут?</span>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Введи имя"
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
            style={{ fontSize: 18, padding: "12px 16px" }}
          />
        </label>

        <div className="stack">
          <span style={{ fontWeight: 600 }}>Выбери аватар</span>
          <div className="grid grid-2" style={{ gap: 10 }}>
            {avatars.map(({ id, emoji }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAvatar(id)}
                style={{
                  padding: "14px 10px",
                  borderRadius: "var(--radius)",
                  border: `2px solid ${avatar === id ? "var(--primary)" : "var(--panel-border)"}`,
                  background: avatar === id ? "rgba(99,102,241,0.12)" : "var(--bg-soft)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  transition: "border-color 150ms, background 150ms",
                }}
              >
                <span style={{ fontSize: 32 }}>{emoji}</span>
                <span style={{ fontSize: 13, textTransform: "capitalize", color: "var(--muted)" }}>{id}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          className="button"
          type="submit"
          disabled={pending}
          style={{ width: "100%", justifyContent: "center", fontSize: 16, padding: "14px 20px" }}
        >
          {pending ? "Вхожу..." : hasResumeOption ? "Войти как новый участник" : "Войти в джем"}
        </button>

        {error ? (
          <p role="alert" style={{ color: "#fda4af", margin: 0, textAlign: "center", fontSize: 14 }}>
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
