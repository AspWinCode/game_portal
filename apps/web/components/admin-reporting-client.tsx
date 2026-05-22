"use client";

import { useMemo, useState } from "react";
import type { AdminReportingPayload } from "@game-game/shared";

function formatTimestamp(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU");
}

function toCsvRow(values: Array<string | number | undefined>) {
  return values.map((value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`).join(",");
}

function downloadCsv(filename: string, rows: string[]) {
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDelta(current: number, previous: number, suffix = "") {
  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}${suffix}`;
}

function StepInsightList({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: AdminReportingPayload["stepInsights"]["topHintHeavySteps"];
}) {
  return (
    <div className="card stack" style={{ padding: 16 }}>
      <div>
        <strong>{title}</strong>
        <p className="subtle" style={{ marginBottom: 0 }}>
          {description}
        </p>
      </div>

      {items.length ? (
        items.map((item) => (
          <div key={`${item.gameId}-${item.stepId}`} className="card" style={{ padding: 14 }}>
            <div className="button-row" style={{ justifyContent: "space-between" }}>
              <strong>
                {item.stepOrderIndex ? `${item.stepOrderIndex}. ` : ""}
                {item.stepTitle}
              </strong>
              <span className="pill">{item.gameTitle}</span>
            </div>
            <div className="button-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <span className="pill">начали: {item.startedCount}</span>
              <span className="pill">завершили: {item.completedCount}</span>
              <span className="pill">завершение: {item.completionRate}%</span>
              <span className="pill">подсказки: {item.hintsOpenedCount}</span>
              <span className="pill">помощь: {item.helpRequestsCount}</span>
              <span className="pill">drop-off: {item.dropOffCount}</span>
            </div>
          </div>
        ))
      ) : (
        <p className="subtle">Пока недостаточно данных.</p>
      )}
    </div>
  );
}

export function AdminReportingClient({
  reports,
  initialWindowDays
}: {
  reports: Record<number, AdminReportingPayload>;
  initialWindowDays: number;
}) {
  const availableWindows = useMemo(
    () =>
      Object.keys(reports)
        .map((value) => Number(value))
        .sort((left, right) => left - right),
    [reports]
  );
  const [selectedWindowDays, setSelectedWindowDays] = useState(initialWindowDays);
  const [copied, setCopied] = useState(false);

  const report = reports[selectedWindowDays] ?? reports[availableWindows[0]];
  const smallerWindow = availableWindows.filter((item) => item < selectedWindowDays).at(-1);
  const comparisonReport = smallerWindow ? reports[smallerWindow] : undefined;

  const topCompletionJams = useMemo(
    () => [...report.games].sort((left, right) => right.completionRate - left.completionRate).slice(0, 5),
    [report]
  );
  const topReviewJams = useMemo(
    () => [...report.games].sort((left, right) => right.reviewedCount - left.reviewedCount).slice(0, 5),
    [report]
  );

  const exportText = useMemo(() => {
    const lines = [
      `window_days:${report.windowDays}`,
      `generated_at:${report.generatedAt}`,
      `joins:${report.funnel.joinsCount}`,
      `mission_starts:${report.funnel.missionStartsCount}`,
      `completed_missions:${report.funnel.completedMissionsCount}`,
      `reviewed_missions:${report.funnel.reviewedMissionsCount}`,
      `completion_rate:${report.funnel.completionRate}%`,
      `review_rate:${report.funnel.reviewRate}%`,
      `avg_hints_per_mission:${report.engagement.averageHintsPerMission}`,
      `avg_help_per_mission:${report.engagement.averageHelpRequestsPerMission}`,
      `avg_completion_percent:${report.engagement.averageCompletionPercent}%`,
      `active_sessions:${report.engagement.activeJamsCount}`,
      `completed_sessions:${report.engagement.completedJamsCount}`
    ];

    if (comparisonReport) {
      lines.push(
        `compare_against:${comparisonReport.windowDays}d`,
        `delta_completion_rate:${formatDelta(report.funnel.completionRate, comparisonReport.funnel.completionRate, "%")}`,
        `delta_review_rate:${formatDelta(report.funnel.reviewRate, comparisonReport.funnel.reviewRate, "%")}`,
        `delta_mission_starts:${formatDelta(report.funnel.missionStartsCount, comparisonReport.funnel.missionStartsCount)}`
      );
    }

    lines.push("", "jam_performance:");
    for (const item of report.games) {
      lines.push(
        `${item.gameTitle} | participants:${item.participantsCount} | completed:${item.completedCount} | reviewed:${item.reviewedCount} | completion_rate:${item.completionRate}% | avg_progress:${item.averageProgressPercent}% | hints:${item.hintsOpenedCount} | help:${item.helpRequestsCount}`
      );
    }

    lines.push("", "top_hint_heavy_steps:");
    for (const item of report.stepInsights.topHintHeavySteps) {
      lines.push(
        `${item.gameTitle} | ${item.stepTitle} | hints:${item.hintsOpenedCount} | help:${item.helpRequestsCount} | drop_off:${item.dropOffCount} | completion:${item.completionRate}%`
      );
    }

    lines.push("", "top_help_steps:");
    for (const item of report.stepInsights.topHelpSteps) {
      lines.push(
        `${item.gameTitle} | ${item.stepTitle} | help:${item.helpRequestsCount} | hints:${item.hintsOpenedCount} | completion:${item.completionRate}%`
      );
    }

    lines.push("", "top_drop_off_steps:");
    for (const item of report.stepInsights.topDropOffSteps) {
      lines.push(
        `${item.gameTitle} | ${item.stepTitle} | drop_off:${item.dropOffCount} | started:${item.startedCount} | completed:${item.completedCount}`
      );
    }

    lines.push("", "trainer_activity:");
    for (const trainer of report.trainers) {
      lines.push(
        `${trainer.actorDisplay} | sessions_started:${trainer.sessionsStartedCount} | help_resolved:${trainer.helpResolvedCount} | reviews:${trainer.reviewsCompletedCount} | notes:${trainer.notesCreatedCount} | total_actions:${trainer.totalActionsCount}`
      );
    }

    lines.push("", "weekly_cohorts:");
    for (const cohort of report.cohorts) {
      lines.push(
        `${cohort.weekLabel} | joins:${cohort.joinsCount} | starts:${cohort.missionStartsCount} | completed:${cohort.completedMissionsCount} | reviewed:${cohort.reviewedMissionsCount} | completion_rate:${cohort.completionRate}% | review_rate:${cohort.reviewRate}%`
      );
    }

    lines.push("", "recent_sessions:");
    for (const session of report.recentJams) {
      lines.push(
        `${session.title} | status:${session.status} | participants:${session.participantsCount} | completed:${session.completedCount} | avg_progress:${session.averageProgressPercent}%`
      );
    }

    return lines.join("\n");
  }, [comparisonReport, report]);

  const jamsCsvRows = useMemo(() => {
    const rows = [
      toCsvRow([
        "jam_title",
        "versions_count",
        "participants_count",
        "completed_count",
        "reviewed_count",
        "completion_rate",
        "average_progress_percent",
        "hints_opened_count",
        "help_requests_count",
        "last_published_at"
      ])
    ];

    for (const item of report.games) {
      rows.push(
        toCsvRow([
          item.gameTitle,
          item.versionsCount,
          item.participantsCount,
          item.completedCount,
          item.reviewedCount,
          item.completionRate,
          item.averageProgressPercent,
          item.hintsOpenedCount,
          item.helpRequestsCount,
          item.lastPublishedAt ?? ""
        ])
      );
    }

    return rows;
  }, [report]);

  const sessionsCsvRows = useMemo(() => {
    const rows = [
      toCsvRow([
        "session_title",
        "status",
        "participants_count",
        "completed_count",
        "average_progress_percent",
        "started_at",
        "ended_at"
      ])
    ];

    for (const session of report.recentJams) {
      rows.push(
        toCsvRow([
          session.title,
          session.status,
          session.participantsCount,
          session.completedCount,
          session.averageProgressPercent,
          session.startedAt ?? "",
          session.endedAt ?? ""
        ])
      );
    }

    return rows;
  }, [report]);

  const trainersCsvRows = useMemo(() => {
    const rows = [
      toCsvRow([
        "actor_display",
        "sessions_started_count",
        "help_resolved_count",
        "reviews_completed_count",
        "notes_created_count",
        "total_actions_count"
      ])
    ];

    for (const trainer of report.trainers) {
      rows.push(
        toCsvRow([
          trainer.actorDisplay,
          trainer.sessionsStartedCount,
          trainer.helpResolvedCount,
          trainer.reviewsCompletedCount,
          trainer.notesCreatedCount,
          trainer.totalActionsCount
        ])
      );
    }

    return rows;
  }, [report]);

  const cohortsCsvRows = useMemo(() => {
    const rows = [
      toCsvRow([
        "week_label",
        "joins_count",
        "mission_starts_count",
        "completed_missions_count",
        "reviewed_missions_count",
        "completion_rate",
        "review_rate"
      ])
    ];

    for (const cohort of report.cohorts) {
      rows.push(
        toCsvRow([
          cohort.weekLabel,
          cohort.joinsCount,
          cohort.missionStartsCount,
          cohort.completedMissionsCount,
          cohort.reviewedMissionsCount,
          cohort.completionRate,
          cohort.reviewRate
        ])
      );
    }

    return rows;
  }, [report]);

  return (
    <section className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="eyebrow">Аналитика</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>
            Аналитика и отчёты
          </h2>
          <p className="subtle">
            Окно: последние {report.windowDays} дней. Обновлено {formatTimestamp(report.generatedAt)}.
          </p>
        </div>

        <div className="button-row">
          {availableWindows.map((windowDays) => (
            <button
              key={windowDays}
              type="button"
              className={windowDays === selectedWindowDays ? "button" : "button-secondary"}
              onClick={() => setSelectedWindowDays(windowDays)}
            >
              {windowDays} дней
            </button>
          ))}
        </div>
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button-secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(exportText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
        >
          {copied ? "Скопировано" : "Скопировать отчёт"}
        </button>
        <button type="button" className="button-secondary" onClick={() => downloadCsv(`jams-${report.windowDays}d.csv`, jamsCsvRows)}>
          Скачать игры.csv
        </button>
        <button type="button" className="button-secondary" onClick={() => downloadCsv(`sessions-${report.windowDays}d.csv`, sessionsCsvRows)}>
          Скачать сессии.csv
        </button>
        <button type="button" className="button-secondary" onClick={() => downloadCsv(`trainers-${report.windowDays}d.csv`, trainersCsvRows)}>
          Скачать тренеры.csv
        </button>
        <button type="button" className="button-secondary" onClick={() => downloadCsv(`cohorts-${report.windowDays}d.csv`, cohortsCsvRows)}>
          Скачать когорты.csv
        </button>
      </div>

      {comparisonReport ? (
        <div className="grid grid-3">
          <div className="card" style={{ padding: 16 }}>
            <strong>Сравнение с окном {comparisonReport.windowDays} дней</strong>
            <p className="subtle">
              Доля завершений: {report.funnel.completionRate}% ({formatDelta(report.funnel.completionRate, comparisonReport.funnel.completionRate, "%")})
            </p>
            <p className="subtle">
              Доля разборов: {report.funnel.reviewRate}% ({formatDelta(report.funnel.reviewRate, comparisonReport.funnel.reviewRate, "%")})
            </p>
            <p className="subtle">
              Стартов миссий: {report.funnel.missionStartsCount} ({formatDelta(report.funnel.missionStartsCount, comparisonReport.funnel.missionStartsCount)})
            </p>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <strong>Динамика вовлечения</strong>
            <p className="subtle">
              Среднее число подсказок на миссию: {report.engagement.averageHintsPerMission} ({formatDelta(report.engagement.averageHintsPerMission, comparisonReport.engagement.averageHintsPerMission)})
            </p>
            <p className="subtle">
              Среднее число help-запросов: {report.engagement.averageHelpRequestsPerMission} ({formatDelta(report.engagement.averageHelpRequestsPerMission, comparisonReport.engagement.averageHelpRequestsPerMission)})
            </p>
            <p className="subtle">
              Средний прогресс: {report.engagement.averageCompletionPercent}% ({formatDelta(report.engagement.averageCompletionPercent, comparisonReport.engagement.averageCompletionPercent, "%")})
            </p>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <strong>Динамика сессий</strong>
            <p className="subtle">
              Активные сессии: {report.engagement.activeJamsCount} ({formatDelta(report.engagement.activeJamsCount, comparisonReport.engagement.activeJamsCount)})
            </p>
            <p className="subtle">
              Завершённые сессии: {report.engagement.completedJamsCount} ({formatDelta(report.engagement.completedJamsCount, comparisonReport.engagement.completedJamsCount)})
            </p>
            <p className="subtle">
              Входы: {report.funnel.joinsCount} ({formatDelta(report.funnel.joinsCount, comparisonReport.funnel.joinsCount)})
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-3">
        <div className="card" style={{ padding: 16 }}>
          <strong>Воронка</strong>
          <p className="subtle">Входы: {report.funnel.joinsCount}</p>
          <p className="subtle">Старты: {report.funnel.missionStartsCount}</p>
          <p className="subtle">Завершили: {report.funnel.completedMissionsCount}</p>
          <p className="subtle">Разобрано: {report.funnel.reviewedMissionsCount}</p>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <strong>Конверсия</strong>
          <p className="subtle">Доля завершений: {report.funnel.completionRate}%</p>
          <p className="subtle">Доля разборов: {report.funnel.reviewRate}%</p>
          <p className="subtle">Открытий подсказок: {report.funnel.hintOpensCount}</p>
          <p className="subtle">Запросов помощи: {report.funnel.helpRequestsCount}</p>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <strong>Вовлечение</strong>
          <p className="subtle">Среднее число подсказок: {report.engagement.averageHintsPerMission}</p>
          <p className="subtle">Среднее число help-запросов: {report.engagement.averageHelpRequestsPerMission}</p>
          <p className="subtle">Средний прогресс: {report.engagement.averageCompletionPercent}%</p>
          <p className="subtle">Среднее число участников в сессии: {report.engagement.averageJamParticipants}</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card stack" style={{ padding: 16 }}>
          <strong>Топ игр по доле завершений</strong>
          {topCompletionJams.length ? (
            topCompletionJams.map((item) => (
              <div key={item.gameId} className="button-row" style={{ justifyContent: "space-between" }}>
                <span className="subtle">{item.gameTitle}</span>
                <span className="pill">{item.completionRate}%</span>
              </div>
            ))
          ) : (
            <p className="subtle">Пока недостаточно данных.</p>
          )}
        </div>

        <div className="card stack" style={{ padding: 16 }}>
          <strong>Топ игр по разобранным результатам</strong>
          {topReviewJams.length ? (
            topReviewJams.map((item) => (
              <div key={item.gameId} className="button-row" style={{ justifyContent: "space-between" }}>
                <span className="subtle">{item.gameTitle}</span>
                <span className="pill">{item.reviewedCount}</span>
              </div>
            ))
          ) : (
            <p className="subtle">Пока недостаточно данных.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="button-row" style={{ flexWrap: "wrap" }}>
          <span className="pill">активных сессий: {report.engagement.activeJamsCount}</span>
          <span className="pill">завершённых сессий: {report.engagement.completedJamsCount}</span>
          <span className="pill">игр в отчёте: {report.games.length}</span>
          <span className="pill">недавних сессий: {report.recentJams.length}</span>
          <span className="pill">тренеров в отчёте: {report.trainers.length}</span>
          <span className="pill">недель когорт: {report.cohorts.length}</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card stack" style={{ padding: 16 }}>
          <strong>Активность тренеров</strong>
          <p className="subtle">Кто чаще запускал сессии, снимал help-запросы, делал review и писал заметки.</p>
          {report.trainers.length ? (
            report.trainers.map((trainer) => (
              <div key={trainer.actorId} className="card" style={{ padding: 14 }}>
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <strong>{trainer.actorDisplay}</strong>
                  <span className="pill">действий: {trainer.totalActionsCount}</span>
                </div>
                <div className="button-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  <span className="pill">сессии: {trainer.sessionsStartedCount}</span>
                  <span className="pill">помощь обработана: {trainer.helpResolvedCount}</span>
                  <span className="pill">разборы: {trainer.reviewsCompletedCount}</span>
                  <span className="pill">заметки: {trainer.notesCreatedCount}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="subtle">За выбранное окно нет действий тренеров.</p>
          )}
        </div>

        <div className="card stack" style={{ padding: 16 }}>
          <strong>Недельные когорты</strong>
          <p className="subtle">Показывают, как меняется конверсия по неделям входа детей в продукт.</p>
          {report.cohorts.length ? (
            report.cohorts.map((cohort) => (
              <div key={cohort.weekLabel} className="card" style={{ padding: 14 }}>
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <strong>{cohort.weekLabel}</strong>
                  <span className="pill">входы: {cohort.joinsCount}</span>
                </div>
                <div className="button-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  <span className="pill">старты: {cohort.missionStartsCount}</span>
                  <span className="pill">завершили: {cohort.completedMissionsCount}</span>
                  <span className="pill">разобрано: {cohort.reviewedMissionsCount}</span>
                  <span className="pill">завершение: {cohort.completionRate}%</span>
                  <span className="pill">разбор: {cohort.reviewRate}%</span>
                </div>
              </div>
            ))
          ) : (
            <p className="subtle">Пока недостаточно данных по когортам.</p>
          )}
        </div>
      </div>

      <div className="grid grid-3">
        <StepInsightList
          title="Этапы с максимальным числом подсказок"
          description="Помогает увидеть, где дети чаще всего открывают подсказки."
          items={report.stepInsights.topHintHeavySteps}
        />
        <StepInsightList
          title="Этапы с максимальным числом help-запросов"
          description="Показывает, где чаще всего требуется помощь тренера."
          items={report.stepInsights.topHelpSteps}
        />
        <StepInsightList
          title="Этапы с максимальным drop-off"
          description="Показывает, где участники чаще всего останавливаются."
          items={report.stepInsights.topDropOffSteps}
        />
      </div>

      <div className="card stack" style={{ padding: 16 }}>
        <strong>Недавние сессии</strong>
        {report.recentJams.length ? (
          report.recentJams.map((session) => (
            <div key={session.jamId} className="card" style={{ padding: 14 }}>
              <div className="button-row" style={{ justifyContent: "space-between" }}>
                <strong>{session.title}</strong>
                <span className="pill">{session.status}</span>
              </div>
              <div className="button-row" style={{ marginTop: 10, flexWrap: "wrap" }}>
                <span className="pill">участников: {session.participantsCount}</span>
                <span className="pill">завершили: {session.completedCount}</span>
                <span className="pill">средний прогресс: {session.averageProgressPercent}%</span>
                <span className="pill">старт: {formatTimestamp(session.startedAt)}</span>
                <span className="pill">финиш: {formatTimestamp(session.endedAt)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="subtle">Пока нет активных или завершённых сессий за выбранное окно.</p>
        )}
      </div>
    </section>
  );
}
