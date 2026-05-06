"use client";

import type { AdminGameDetail, Game } from "@game-game/shared";

type StepWithHints = AdminGameDetail["steps"][number];

function levelLabel(level: string) {
  if (level === "beginner") return "начальный";
  if (level === "intermediate") return "средний";
  if (level === "advanced") return "продвинутый";
  return level;
}

export function AdminDraftPreviewClient({
  jam,
  steps
}: {
  jam: Game;
  steps: StepWithHints[];
}) {
  return (
    <div className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Предпросмотр черновика</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>
            Будущий экран для ребёнка
          </h2>
        </div>
        <div className="button-row">
          <span className="pill">{levelLabel(jam.level)}</span>
          <span className="pill">{jam.estimatedDurationMin} мин</span>
          <span className="pill">{steps.length} шага</span>
        </div>
      </div>

      <section className="hero" style={{ padding: 24 }}>
        <div className="eyebrow">Предпросмотр миссии</div>
        <h3 style={{ fontSize: 36, margin: 0 }}>{jam.title}</h3>
        <p className="subtle">{jam.fullDescription}</p>
        <div className="button-row">
          <span className="pill">тема: {jam.themeCode}</span>
          <span className="pill">акцент: {jam.accentStyle}</span>
          <span className="pill">награда в финале: {jam.finalRewardXp} XP</span>
        </div>
      </section>

      <div className="stack">
        <strong>Предпросмотр карты миссии</strong>
        <div className="mission-map">
          {steps.map((step, index) => (
            <div key={step.id} className={`step-node ${index === 0 ? "active" : "locked"}`}>
              <div className="eyebrow">Шаг {index + 1}</div>
              <strong style={{ display: "block", marginTop: 10 }}>{step.title}</strong>
              <p className="subtle">{step.goalText}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="stack">
        <strong>Предпросмотр содержимого шагов</strong>
        {steps.map((step) => (
          <div key={step.id} className="card" style={{ padding: 16 }}>
            <div className="button-row" style={{ justifyContent: "space-between" }}>
              <strong>
                {step.orderIndex}. {step.title}
              </strong>
              <div className="button-row">
                <span className="pill">XP {step.successXp}</span>
                <span className="pill">подсказки: {step.hints.length}</span>
              </div>
            </div>
            <p className="subtle">{step.description}</p>
            <p className="subtle" style={{ marginTop: 0 }}>
              Цель: {step.goalText}
            </p>
            <div className="button-row">
              {step.resultImageUrl ? <span className="pill">есть итоговое изображение</span> : null}
              {step.resultVideoUrl ? <span className="pill">есть итоговое видео</span> : null}
            </div>
            <div className="stack" style={{ gap: 10, marginTop: 8 }}>
              {step.hints.map((hint) => (
                <div key={hint.id} className="card" style={{ padding: 12 }}>
                  <div className="button-row" style={{ justifyContent: "space-between" }}>
                    <span className="pill">L{hint.level}</span>
                    <span className="pill">{hint.hintType === "text" ? "текст" : "медиа"}</span>
                  </div>
                  <p className="subtle" style={{ marginBottom: 0 }}>
                    {hint.text}
                  </p>
                </div>
              ))}
            </div>
            <div className="card accent-card" style={{ padding: 12, marginTop: 10 }}>
              <strong>{step.successTitle}</strong>
              <p className="subtle" style={{ marginBottom: 0 }}>
                {step.successText}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="card accent-card stack" style={{ padding: 16 }}>
        <div className="eyebrow">Предпросмотр финального экрана</div>
        <strong>{jam.finalTitle}</strong>
        <p className="subtle">{jam.finalDescription}</p>
        <div className="button-row">
          <span className="pill">{jam.finalRewardXp} XP</span>
          {jam.coverImageUrl ? <span className="pill">обложка добавлена</span> : null}
          {jam.previewVideoUrl ? <span className="pill">превью-видео добавлено</span> : null}
        </div>
      </div>
    </div>
  );
}
