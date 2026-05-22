"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChildAttemptHistoryPanel } from "./child-attempt-history-panel";
import { ChildResumeCard } from "./child-resume-card";

export function StudentHomeClient() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Введи код джема — тренер сообщит его перед стартом.");
      return;
    }
    router.push(`/join/${trimmed}`);
  }

  return (
    <main className="shell">
      <div className="container stack">

        {/* Hero */}
        <section className="hero child-hero">
          <div className="eyebrow">Игровой портал</div>
          <h1 style={{ fontSize: 52, marginTop: 16 }}>
            Привет! 👋
          </h1>
          <p className="subtle" style={{ fontSize: 16, maxWidth: 480 }}>
            Введи код от тренера — и сразу переходи к игре. Всё остальное
            настроено уже за тебя.
          </p>

          {/* Quick steps */}
          <div className="grid grid-3" style={{ marginTop: 20 }}>
            {[
              { icon: "🔑", title: "1. Введи код", text: "Тренер даёт его перед стартом." },
              { icon: "🎮", title: "2. Выбери игру", text: "Смотри preview и жми «Старт»." },
              { icon: "🏆", title: "3. Пройди миссию", text: "Завершай этапы и зарабатывай XP." },
            ].map((item) => (
              <div key={item.title} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                <strong style={{ display: "block", marginBottom: 4 }}>{item.title}</strong>
                <p className="subtle" style={{ margin: 0, fontSize: 13 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="split">
          {/* Join form */}
          <form className="card stack" onSubmit={handleSubmit}>
            <h2 className="section-title" style={{ fontSize: 28 }}>Войти в джем</h2>
            <p className="subtle" style={{ margin: 0 }}>
              Тренер сообщает код в начале занятия.
            </p>
            <label className="stack">
              <span>Код джема</span>
              <input
                className="input"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (error) setError(null);
                }}
                placeholder="XXXXXX"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{ fontSize: 22, letterSpacing: "0.2em", textAlign: "center" }}
                aria-label="Код джема"
                aria-describedby={error ? "student-code-error" : undefined}
                aria-invalid={Boolean(error)}
              />
            </label>
            {error ? (
              <p id="student-code-error" role="alert" style={{ color: "#fda4af", margin: 0, fontSize: 13 }}>
                {error}
              </p>
            ) : null}
            <button className="button" type="submit" style={{ justifyContent: "center", fontSize: 16, padding: "12px 20px" }}>
              Войти →
            </button>
          </form>

          {/* Right column: resume + history */}
          <div className="stack">
            <ChildResumeCard
              title="Продолжить последнюю игру"
              description="Если на этом устройстве уже была активная сессия — можешь вернуться прямо к ней."
            />
            <ChildAttemptHistoryPanel title="Твои завершённые игры" />
          </div>
        </section>

      </div>
    </main>
  );
}
