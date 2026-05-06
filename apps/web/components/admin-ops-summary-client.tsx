"use client";

import type { OpsSummaryPayload } from "@game-game/shared";

export function AdminOpsSummaryClient({ summary }: { summary: OpsSummaryPayload }) {
  return (
    <section className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Ops Summary</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>
            Операционная сводка
          </h2>
          <p className="subtle">
            Окно: последние {summary.windowHours} часов. Обновлено{" "}
            {new Date(summary.generatedAt).toLocaleString("ru-RU")}.
          </p>
        </div>
        <span className="pill">alerts: {summary.alerts.length}</span>
      </div>

      <div className="grid grid-3">
        <div className="card" style={{ padding: 16 }}>
          <strong>Auth</strong>
          <p className="subtle">active sessions: {summary.auth.activeSessions}</p>
          <p className="subtle">failed logins: {summary.auth.failedLogins24h}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <strong>Trainer</strong>
          <p className="subtle">active sessions: {summary.trainer.activeSessions}</p>
          <p className="subtle">pending help: {summary.trainer.pendingHelp}</p>
          <p className="subtle">awaiting review: {summary.trainer.awaitingReview}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <strong>Content</strong>
          <p className="subtle">uploads: {summary.content.uploads24h}</p>
          <p className="subtle">published versions: {summary.content.publishedVersions24h}</p>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <strong>Public flow</strong>
        <div className="button-row" style={{ flexWrap: "wrap", marginTop: 12 }}>
          <span className="pill">joins: {summary.publicFlow.joins24h}</span>
          <span className="pill">help requests: {summary.publicFlow.helpRequests24h}</span>
          <span className="pill">completed steps: {summary.publicFlow.completedSteps24h}</span>
        </div>
      </div>

      <div className="stack">
        <strong>Alerts</strong>
        {summary.alerts.length ? (
          summary.alerts.map((alert) => (
            <div key={alert.code} className="card" style={{ padding: 16 }}>
              <div className="button-row" style={{ justifyContent: "space-between" }}>
                <strong>{alert.code}</strong>
                <span
                  className={`status-pill ${
                    alert.level === "critical"
                      ? "needs-help"
                      : alert.level === "warning"
                        ? "active"
                        : "locked"
                  }`}
                >
                  {alert.level}
                </span>
              </div>
              <p className="subtle" style={{ marginBottom: 0 }}>
                {alert.message}
              </p>
            </div>
          ))
        ) : (
          <p className="subtle">Сейчас явных alert-сигналов нет.</p>
        )}
      </div>
    </section>
  );
}
