"use client";

import Link from "next/link";
import type { OrganizationOnboardingPayload } from "@game-game/shared";

interface OrganizationOnboardingClientProps {
  payload: OrganizationOnboardingPayload;
}

export function OrganizationOnboardingClient({ payload }: OrganizationOnboardingClientProps) {
  const { organization, checklist, summary } = payload;
  const progressPercent = Math.round((summary.completedCount / Math.max(summary.totalCount, 1)) * 100);

  return (
    <section className="card stack">
      <div className="eyebrow">Запуск организации</div>
      <h1 style={{ margin: 0, fontSize: 36 }}>{organization.name}</h1>
      <p className="subtle" style={{ margin: 0 }}>
        Пошаговый запуск новой организации: брендинг, команда, контент, первая сессия и проверка загрузки файлов.
      </p>

      <div className="button-row" style={{ flexWrap: "wrap" }}>
        <span className="pill">прогресс {summary.completedCount}/{summary.totalCount}</span>
        <span className="pill">выполнено {progressPercent}%</span>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ height: 10, borderRadius: 999, background: "rgba(148, 163, 184, 0.18)", overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: organization.brandAccentColor ?? "linear-gradient(90deg, #8B5CF6, #06B6D4)"
            }}
          />
        </div>
      </div>

      <div className="stack">
        {checklist.map((item, index) => (
          <div key={item.id} className="card" style={{ padding: 18 }}>
            <div className="button-row" style={{ justifyContent: "space-between" }}>
              <strong>
                {index + 1}. {item.title}
              </strong>
              <span className={`status-pill ${item.completed ? "completed" : "active"}`}>
                {item.completed ? "готово" : "дальше"}
              </span>
            </div>
            <p className="subtle" style={{ marginBottom: 0 }}>{item.description}</p>
          </div>
        ))}
      </div>

      <div className="button-row">
        <Link className="button-secondary" href="/admin">
          Вернуться в админку
        </Link>
        <Link className="button-secondary" href="/account">
          Открыть аккаунт
        </Link>
      </div>
    </section>
  );
}
