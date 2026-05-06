"use client";

import { useMemo, useState } from "react";
import type { CommercialHistoryPayload, CommercialOverviewPayload } from "@game-game/shared";

interface AdminCommercialOverviewClientProps {
  overview: CommercialOverviewPayload;
  histories: Record<number, CommercialHistoryPayload>;
}

function formatBytes(value: number) {
  return `${Math.round(value / 1024 / 1024)} МБ`;
}

export function AdminCommercialOverviewClient({ overview, histories }: AdminCommercialOverviewClientProps) {
  const windows = [14, 30, 90] as const;
  const [windowDays, setWindowDays] = useState<(typeof windows)[number]>(30);
  const history = histories[windowDays];

  const totals = useMemo(() => {
    if (!history) {
      return {
        organizationsCreated: 0,
        invitesAccepted: 0,
        jamsCreated: 0,
        gamesPublished: 0,
        mediaUploads: 0
      };
    }

    return history.points.reduce(
      (accumulator, point) => ({
        organizationsCreated: accumulator.organizationsCreated + point.organizationsCreated,
        invitesAccepted: accumulator.invitesAccepted + point.invitesAccepted,
        jamsCreated: accumulator.jamsCreated + point.jamsCreated,
        gamesPublished: accumulator.gamesPublished + point.gamesPublished,
        mediaUploads: accumulator.mediaUploads + point.mediaUploads
      }),
      {
        organizationsCreated: 0,
        invitesAccepted: 0,
        jamsCreated: 0,
        gamesPublished: 0,
        mediaUploads: 0
      }
    );
  }, [history]);

  return (
    <section className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Коммерция</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>Планы, лимиты и коммерческая динамика</h2>
        </div>
        <span className="pill">обновлено {new Date(overview.generatedAt).toLocaleString("ru-RU")}</span>
      </div>

      <div className="button-row" style={{ flexWrap: "wrap" }}>
        <span className="pill">организаций {overview.totals.organizationsCount}</span>
        <span className="pill">активных {overview.totals.activeOrganizationsCount}</span>
        <span className="pill">хранилище {formatBytes(overview.totals.storageBytesUsed)}</span>
        <span className="pill">активных сессий {overview.totals.activeSessionsCount}</span>
        <span className="pill">опубликованных игр {overview.totals.publishedJamsCount}</span>
      </div>

      <div className="card stack">
        <div className="button-row" style={{ justifyContent: "space-between" }}>
          <strong>История использования</strong>
          <div className="button-row">
            {windows.map((item) => (
              <button
                key={item}
                className={windowDays === item ? "button-primary" : "button-secondary"}
                type="button"
                onClick={() => setWindowDays(item)}
              >
                {item} дней
              </button>
            ))}
          </div>
        </div>
        <div className="button-row" style={{ flexWrap: "wrap" }}>
          <span className="pill">создано организаций {totals.organizationsCreated}</span>
          <span className="pill">принято инвайтов {totals.invitesAccepted}</span>
          <span className="pill">создано сессий {totals.jamsCreated}</span>
          <span className="pill">опубликовано игр {totals.gamesPublished}</span>
          <span className="pill">загрузок медиа {totals.mediaUploads}</span>
        </div>
        <div className="stack">
          {history?.points.slice(-10).map((point) => (
            <div key={point.label} className="card" style={{ padding: 16 }}>
              <div className="button-row" style={{ justifyContent: "space-between" }}>
                <strong>{point.label}</strong>
                <span className="subtle">
                  сессии {point.jamsCreated} · публикации {point.gamesPublished} · загрузки {point.mediaUploads}
                </span>
              </div>
              <p className="subtle" style={{ marginBottom: 0 }}>
                организации {point.organizationsCreated} · принято инвайтов {point.invitesAccepted}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card stack">
          <div className="eyebrow">Кандидаты на апгрейд</div>
          {overview.upgradeCandidates.length ? (
            overview.upgradeCandidates.map((candidate) => (
              <div key={candidate.organizationId} className="card" style={{ padding: 16 }}>
                <strong>{candidate.organizationName}</strong>
                <p className="subtle" style={{ marginBottom: 0 }}>
                  точки давления: {candidate.reasons.join(", ")}
                </p>
              </div>
            ))
          ) : (
            <p className="subtle">Сейчас нет организаций, которые подходят к лимитам плана.</p>
          )}
        </div>

        <div className="card stack">
          <div className="eyebrow">Последние изменения планов</div>
          {overview.planEvents.length ? (
            overview.planEvents.slice(0, 10).map((event) => (
              <div key={event.id} className="card" style={{ padding: 16 }}>
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <strong>{event.fromPlanKey ? `${event.fromPlanKey} -> ${event.toPlanKey}` : `первичный план -> ${event.toPlanKey}`}</strong>
                  <span className="subtle">{new Date(event.createdAt).toLocaleString("ru-RU")}</span>
                </div>
                {event.reason ? <p className="subtle" style={{ marginBottom: 0 }}>{event.reason}</p> : null}
              </div>
            ))
          ) : (
            <p className="subtle">История изменений планов пока пуста.</p>
          )}
        </div>
      </div>
    </section>
  );
}
