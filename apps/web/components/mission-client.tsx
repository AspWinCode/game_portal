"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import type { GameStep, GameVersion, ParticipantProgress, ParticipantStepProgress, StepHint } from "@game-game/shared";
import { completeParticipantStep, openParticipantHint, requestParticipantHelp } from "../lib/api";
import { ChildAttemptHistoryPanel } from "./child-attempt-history-panel";
import { saveChildAttempt } from "./child-attempt-history";
import { clearChildSession, readChildSession } from "./child-session-sync";

const GDEVELOP_URL = "https://gdevelop.tirskix.space/";

// ── Theme helpers ─────────────────────────────────────────────────────────────
function adjustHex(hex: string, amount: number): string {
  if (!hex || hex[0] !== "#" || hex.length < 7) return hex;
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return `rgb(${r},${g},${b})`;
}

const THEME_BG: Record<string, string> = {
  "cyber-it":  "radial-gradient(ellipse at 15% 50%, rgba(0,200,255,0.05) 0%, transparent 65%)",
  "space":     "radial-gradient(ellipse at 85% 20%, rgba(138,43,226,0.06) 0%, transparent 65%)",
  "nature":    "radial-gradient(ellipse at 10% 80%, rgba(34,197,94,0.06) 0%, transparent 65%)",
  "retro":     "radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.06) 0%, transparent 65%)",
  "adventure": "radial-gradient(ellipse at 30% 70%, rgba(234,88,12,0.06) 0%, transparent 65%)",
  "science":   "radial-gradient(ellipse at 70% 30%, rgba(20,184,166,0.06) 0%, transparent 65%)",
  "art":       "radial-gradient(ellipse at 40% 60%, rgba(236,72,153,0.06) 0%, transparent 65%)",
};

const ACCENT_PATTERN: Record<string, React.CSSProperties> = {
  "neon-grid": {
    backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
  },
  "dots": {
    backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
    backgroundSize: "20px 20px",
  },
  "geometry": {
    backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.02) 25%, transparent 25%)",
    backgroundSize: "24px 24px",
  },
  "gradient": {
    background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 60%)",
  },
};

type PanelMode = "split" | "info-only" | "editor-full";

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ["#6366F1","#818CF8","#22C55E","#F59E0B","#EC4899","#38BDF8","#a78bfa","#fb923c"];

function launchConfetti(canvas: HTMLCanvasElement, accentColor?: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = accentColor ? [...CONFETTI_COLORS, accentColor] : CONFETTI_COLORS;

  type Particle = { x: number; y: number; vx: number; vy: number; r: number; color: string; angle: number; spin: number; shape: "rect" | "circle" };
  const particles: Particle[] = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 120,
    vx: (Math.random() - 0.5) * 4,
    vy: 2.5 + Math.random() * 4,
    r: 5 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    shape: Math.random() > 0.5 ? "rect" : "circle"
  }));

  let frame = 0;
  function draw() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.99;
      p.angle += p.spin;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.angle);
      ctx!.fillStyle = p.color;
      ctx!.globalAlpha = Math.max(0, 1 - frame / 90);
      if (p.shape === "rect") ctx!.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      else { ctx!.beginPath(); ctx!.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx!.fill(); }
      ctx!.restore();
    }
    frame++;
    if (frame < 100) requestAnimationFrame(draw);
    else ctx!.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    if (from === target) return;
    const diff = target - from;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + diff * ease));
      if (t < 1) requestAnimationFrame(tick);
      else prevRef.current = target;
    }
    requestAnimationFrame(tick);
  }, [target, duration]);
  return display;
}

function renderMedia(url: string, type: "image" | "video", label: string) {
  if (type === "image") {
    return <img src={url} alt={label} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8 }} />;
  }
  return (
    <video style={{ width: "100%", maxHeight: 200, borderRadius: 8 }} controls preload="metadata">
      <source src={url} />
    </video>
  );
}

function HintCard({ hint }: { hint: StepHint }) {
  return (
    <div style={{ background: "var(--bg-tertiary)", borderRadius: 8, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary-hover)" }}>Подсказка L{hint.level}</span>
        <span className="pill" style={{ fontSize: 10 }}>{hint.hintType}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{hint.text}</p>
      {hint.mediaUrl && hint.hintType !== "text" ? (
        <div style={{ marginTop: 8 }}>
          {renderMedia(hint.mediaUrl, hint.hintType === "image" ? "image" : "video", `Hint L${hint.level}`)}
        </div>
      ) : null}
    </div>
  );
}

function ensureLocalStepProgress(
  version: GameVersion,
  provided: ParticipantStepProgress[],
  participantId: string,
  gameVersionId: string
): ParticipantStepProgress[] {
  return version.snapshotJson.steps.map((step, index) => {
    const existing = provided.find((item) => item.stepId === step.id);
    if (existing) return existing;
    return {
      id: `local-${step.id}`,
      participantId,
      gameVersionId,
      stepId: step.id,
      status: index === 0 ? "active" : "locked",
      hintsOpenedCount: 0,
      lastHintLevelOpened: 0,
      needsHelpFlag: false
    };
  });
}

function getHardestStep(stepProgress: ParticipantStepProgress[]) {
  return [...stepProgress]
    .sort((l, r) => {
      const ls = l.hintsOpenedCount + (l.needsHelpAt ? 3 : 0);
      const rs = r.hintsOpenedCount + (r.needsHelpAt ? 3 : 0);
      return rs - ls;
    })
    .find((item) => item.hintsOpenedCount > 0 || item.needsHelpAt);
}

export function MissionClient({
  version,
  initialProgress,
  initialStepProgress,
  participantId
}: {
  version: GameVersion;
  initialProgress: ParticipantProgress;
  initialStepProgress: ParticipantStepProgress[];
  participantId: string;
}) {
  const router = useRouter();
  const childSession = readChildSession();
  const attemptSavedRef = useRef(false);

  const [completedStepsCount, setCompletedStepsCount] = useState(initialProgress.completedStepsCount);
  const [xpTotal, setXpTotal] = useState(initialProgress.xpTotal);
  const [stepProgress, setStepProgress] = useState<ParticipantStepProgress[]>(
    ensureLocalStepProgress(version, initialStepProgress, participantId, version.id)
  );
  const [pending, setPending] = useState<"complete" | "hint" | "help" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successStep, setSuccessStep] = useState<GameStep | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("split");
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [leftWidth, setLeftWidth] = useState(380);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [floatingXp, setFloatingXp] = useState<{ id: number; amount: number } | null>(null);
  const floatIdRef = useRef(0);

  const xpDisplay = useCountUp(xpTotal);

  const steps = version.snapshotJson.steps;

  // ── Per-game theming ──────────────────────────────────────────────────────
  const gameData = version.snapshotJson.game as typeof version.snapshotJson.game & {
    themeCode?: string;
    accentStyle?: string;
    accentColor?: string;
  };
  const themeCode   = gameData.themeCode   ?? "";
  const accentStyle = gameData.accentStyle ?? "";
  const accentColor = gameData.accentColor ?? "";
  const isValidHex  = /^#[0-9a-fA-F]{6}$/.test(accentColor);

  const accentVars: React.CSSProperties = isValidHex ? {
    "--accent":        accentColor,
    "--accent-hover":  adjustHex(accentColor, 30),
    "--accent-active": adjustHex(accentColor, -20),
    // Override --primary so all existing CSS classes (button, pill.active, etc.) inherit the game colour
    "--primary":        accentColor,
    "--primary-hover":  adjustHex(accentColor, 30),
    "--primary-active": adjustHex(accentColor, -20),
  } as React.CSSProperties : {};

  const themeBgGradient = THEME_BG[themeCode] ?? "";
  const leftPanelBg     = themeBgGradient ? `${themeBgGradient}, var(--bg-soft)` : "var(--bg-soft)";
  const patternStyle    = ACCENT_PATTERN[accentStyle] ?? null;
  // ─────────────────────────────────────────────────────────────────────────

  const currentStepIndex = Math.min(completedStepsCount, steps.length - 1);
  const currentStep = steps[currentStepIndex];
  const activeStepProgress = stepProgress.find((item) => item.stepId === currentStep?.id);
  const openedHintLevel = activeStepProgress?.lastHintLevelOpened ?? 0;
  const openedHints = currentStep?.hints.slice(0, openedHintLevel) ?? [];
  const progressPercent = initialProgress.totalStepsCount
    ? (completedStepsCount / initialProgress.totalStepsCount) * 100
    : 0;
  const isCompleted = completedStepsCount >= steps.length;
  const joinHref = childSession?.joinCode ? `/join/${childSession.joinCode}` : "/";
  const helpRequested = activeStepProgress?.needsHelpFlag ?? false;
  const totalHintsOpened = stepProgress.reduce((sum, item) => sum + item.hintsOpenedCount, 0);
  const helpRequestsCount = stepProgress.filter((item) => item.needsHelpAt).length;
  const hardestStep = getHardestStep(stepProgress);
  const hardestStepTitle = hardestStep
    ? steps.find((step) => step.id === hardestStep.stepId)?.title
    : undefined;

  const missionSummary = useMemo(() => {
    const helpPart = helpRequestsCount > 0 ? `запросов помощи: ${helpRequestsCount}` : "без запросов помощи";
    return `${version.snapshotJson.game.title}: ${steps.length} шагов, ${xpTotal} XP, ${totalHintsOpened} подсказок, ${helpPart}.`;
  }, [helpRequestsCount, totalHintsOpened, version, xpTotal, steps]);

  useEffect(() => {
    if (!isCompleted || attemptSavedRef.current) return;
    saveChildAttempt({
      participantId,
      joinCode: childSession?.joinCode ?? "",
      jamTitle: version.snapshotJson.game.title,
      completedAt: new Date().toISOString(),
      xpTotal,
      hintsOpenedCount: totalHintsOpened,
      helpRequestsCount
    });
    attemptSavedRef.current = true;
  }, [childSession?.joinCode, helpRequestsCount, isCompleted, participantId, totalHintsOpened, version, xpTotal]);

  async function handleCompleteStep() {
    if (!currentStep) return;
    setPending("complete");
    setError(null);
    try {
      const finishedStep = currentStep;
      const nextProgress = await completeParticipantStep(currentStep.id, participantId);
      setCompletedStepsCount(nextProgress.completedStepsCount);
      const xpGained = nextProgress.xpTotal - xpTotal;
      setXpTotal(nextProgress.xpTotal);
      setStepProgress((current) =>
        current.map((item) => {
          if (item.stepId === finishedStep.id) return { ...item, status: "completed", completedAt: new Date().toISOString(), needsHelpFlag: false };
          if (item.stepId === nextProgress.currentStepId && item.status === "locked") return { ...item, status: "active", startedAt: new Date().toISOString() };
          return item;
        })
      );
      // 🎉 Конфетти
      if (canvasRef.current) launchConfetti(canvasRef.current, isValidHex ? accentColor : undefined);
      // +XP floating badge
      if (xpGained > 0) {
        const id = ++floatIdRef.current;
        setFloatingXp({ id, amount: xpGained });
        setTimeout(() => setFloatingXp((cur) => cur?.id === id ? null : cur), 1500);
      }
      setSuccessStep(finishedStep);
    } catch {
      setError("Не удалось отметить шаг выполненным.");
    } finally {
      setPending(null);
    }
  }

  async function handleOpenHint() {
    if (!currentStep) return;
    setPending("hint");
    setError(null);
    try {
      const hint = await openParticipantHint(currentStep.id, participantId);
      setStepProgress((current) =>
        current.map((item) =>
          item.stepId === currentStep.id
            ? { ...item, hintsOpenedCount: item.hintsOpenedCount + 1, lastHintLevelOpened: hint.level }
            : item
        )
      );
    } catch {
      setError("Не удалось открыть подсказку.");
    } finally {
      setPending(null);
    }
  }

  async function handleNeedHelp() {
    if (!currentStep) return;
    setPending("help");
    setError(null);
    try {
      await requestParticipantHelp(currentStep.id, participantId);
      setStepProgress((current) =>
        current.map((item) =>
          item.stepId === currentStep.id
            ? { ...item, needsHelpFlag: true, needsHelpAt: item.needsHelpAt ?? new Date().toISOString() }
            : item
        )
      );
    } catch {
      setError("Не удалось отправить запрос помощи.");
    } finally {
      setPending(null);
    }
  }

  // ── Layout calculations ──
  const showInfo = panelMode === "split" || panelMode === "info-only";
  const showEditor = panelMode === "split" || panelMode === "editor-full";
  const editorFull = panelMode === "editor-full";

  function startDrag(e: React.MouseEvent) {
    if (panelMode !== "split") return;
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - dragStartX.current;
      const next = Math.max(240, Math.min(window.innerWidth - 300, dragStartWidth.current + delta));
      setLeftWidth(next);
    }
    function onUp() {
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const colLeft  = editorFull ? "0px" : panelMode === "info-only" ? "100%" : `${leftWidth}px`;
  const gridStyle: React.CSSProperties = {
    ...accentVars,
    position: "fixed",
    inset: 0,
    zIndex: 10,
    display: "grid",
    gridTemplateColumns: `${colLeft} 5px 1fr`,
    overflow: "hidden",
    transition: panelMode !== "split" ? "grid-template-columns 250ms ease" : "none"
  };

  return (
    <>
      <div style={gridStyle}>
        {/* ── LEFT: Mission info ── */}
        <div style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRight: "1px solid var(--panel-border)",
          background: leftPanelBg,
          opacity: editorFull ? 0 : 1,
          transition: "opacity 250ms ease",
          pointerEvents: editorFull ? "none" : "auto"
        }}>
          {/* Accent style pattern overlay */}
          {patternStyle ? (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, ...patternStyle }} />
          ) : null}
          {/* Left header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase" }}>Миссия</div>
              <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {version.snapshotJson.game.title}
              </div>
            </div>
            <div className="button-row" style={{ gap: 6, flexShrink: 0 }}>
              <span className="pill" style={{ fontSize: 11 }}>Шаг {Math.min(completedStepsCount + 1, steps.length)}/{steps.length}</span>
              <span className="pill active" style={{ fontSize: 11 }}>{xpDisplay} XP</span>
              {panelMode === "info-only" ? (
                <button
                  className="button"
                  style={{ fontSize: 11, padding: "3px 8px" }}
                  onClick={() => setPanelMode("split")}
                  title="Открыть GDevelop"
                >
                  GDevelop ▶
                </button>
              ) : null}
            </div>
          </div>

          {/* Progress bar with shimmer */}
          <div style={{ height: 3, background: "var(--bg-tertiary)", flexShrink: 0 }}>
            <div className="progress-shimmer" style={{ height: "100%", width: `${Math.min(progressPercent, 100)}%`, transition: "width 600ms ease", borderRadius: 999 }} />
          </div>

          {/* Scrollable content */}
          <div style={{ overflowY: "auto", flex: 1, padding: 16 }}>
            {isCompleted ? (
              /* ── FINAL SCREEN ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="card accent-card" style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                  <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>{version.snapshotJson.finalScreen.title}</h2>
                  <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: 13 }}>{version.snapshotJson.finalScreen.description}</p>
                  <div className="button-row" style={{ justifyContent: "center" }}>
                    <span className="pill active" style={{ fontSize: 14, padding: "6px 16px" }}>+{version.snapshotJson.finalScreen.rewardXp} XP</span>
                  </div>
                </div>
                <div className="grid grid-2" style={{ gap: 8 }}>
                  {[
                    ["Шагов", steps.length],
                    ["XP", xpTotal],
                    ["Подсказок", totalHintsOpened],
                    ["Запросов помощи", helpRequestsCount]
                  ].map(([label, value]) => (
                    <div key={label as string} className="card" style={{ padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
                    </div>
                  ))}
                </div>
                {hardestStepTitle ? (
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>СЛОЖНЕЕ ВСЕГО</div>
                    <strong style={{ fontSize: 13 }}>{hardestStepTitle}</strong>
                  </div>
                ) : null}
                <ChildAttemptHistoryPanel title="История миссий" />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Link className="button" href={joinHref as Route} style={{ textAlign: "center" }}>
                    Показать тренеру
                  </Link>
                  <Link className="button-secondary" href={`/participant/${participantId}/jams` as Route} style={{ textAlign: "center" }}>
                    Попробовать ещё
                  </Link>
                  <button className="button-ghost" style={{ fontSize: 13 }} onClick={() => { clearChildSession(); router.push(joinHref as Route); }}>
                    Завершить сессию
                  </button>
                </div>
              </div>
            ) : (
              /* ── ACTIVE STEP ── */
              <div key={currentStepIndex} className="slide-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Step counter mini-map */}
                <div style={{ display: "flex", gap: 4 }}>
                  {steps.map((step, i) => {
                    const done = i < completedStepsCount;
                    const active = i === currentStepIndex;
                    return (
                      <div key={step.id} title={step.title} className={active ? "step-active-pulse" : ""} style={{
                        flex: 1, height: 4, borderRadius: 999,
                        background: done ? "var(--success)" : active ? "var(--primary)" : "var(--bg-tertiary)",
                        transition: "background 400ms"
                      }} />
                    );
                  })}
                </div>

                {/* Step title */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>
                    Шаг {currentStepIndex + 1} из {steps.length}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>{currentStep.title}</h2>
                </div>

                {/* Description — supports both legacy plain text and rich HTML */}
                {currentStep.description?.trimStart().startsWith("<") ? (
                  <div
                    className="rich-content"
                    style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: currentStep.description }}
                  />
                ) : (
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>{currentStep.description}</p>
                )}

                {/* Task media */}
                {(currentStep.taskImageUrl || currentStep.taskVideoUrl) ? (
                  <div>
                    {currentStep.taskImageUrl ? renderMedia(currentStep.taskImageUrl, "image", "task") : null}
                    {currentStep.taskVideoUrl ? renderMedia(currentStep.taskVideoUrl, "video", "task") : null}
                  </div>
                ) : null}

                {/* Goal */}
                <div style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary-hover)", marginBottom: 4, letterSpacing: "0.05em" }}>ЦЕЛЬ ШАГА</div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{currentStep.goalText}</p>
                </div>

                {/* Result media */}
                {(currentStep.resultImageUrl || currentStep.resultVideoUrl) ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.05em" }}>ПРИМЕР РЕЗУЛЬТАТА</div>
                    {currentStep.resultImageUrl ? renderMedia(currentStep.resultImageUrl, "image", "result") : null}
                    {currentStep.resultVideoUrl ? renderMedia(currentStep.resultVideoUrl, "video", "result") : null}
                  </div>
                ) : null}

                {/* Actions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button className="button" disabled={pending !== null} onClick={handleCompleteStep} style={{ width: "100%", justifyContent: "center" }}>
                    {pending === "complete" ? "Сохраняю..." : "✓ Я сделал!"}
                  </button>
                  <div className="button-row">
                    <button className="button-secondary" style={{ flex: 1, justifyContent: "center", fontSize: 13 }} disabled={pending !== null || openedHintLevel >= (currentStep.hints.length)} onClick={handleOpenHint}>
                      {pending === "hint" ? "..." : openedHintLevel >= currentStep.hints.length ? "Все подсказки открыты" : `Подсказка${openedHintLevel > 0 ? ` L${openedHintLevel + 1}` : ""}`}
                    </button>
                    <button className="button-secondary" style={{ flex: 1, justifyContent: "center", fontSize: 13 }} disabled={pending !== null || helpRequested} onClick={handleNeedHelp}>
                      {helpRequested ? "Тренер уведомлён" : "Нужна помощь"}
                    </button>
                  </div>
                </div>

                {error ? <p style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>{error}</p> : null}

                {/* Hints */}
                {openedHints.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", marginBottom: 8, letterSpacing: "0.05em" }}>ОТКРЫТЫЕ ПОДСКАЗКИ</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {openedHints.map((hint) => <HintCard key={hint.id} hint={hint} />)}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div
          onMouseDown={startDrag}
          style={{
            cursor: panelMode === "split" ? "col-resize" : "default",
            background: "var(--panel-border)",
            flexShrink: 0,
            position: "relative",
            transition: "background 150ms",
            zIndex: 1
          }}
          onMouseEnter={(e) => { if (panelMode === "split") (e.currentTarget as HTMLDivElement).style.background = "var(--accent)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--panel-border)"; }}
          title="Потяни чтобы изменить размер"
        >
          {/* Drag handle dots */}
          {panelMode === "split" ? (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex", flexDirection: "column", gap: 3
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)" }} />
              ))}
            </div>
          ) : null}
        </div>

        {/* ── RIGHT: GDevelop editor ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#1a1a2e" }}>
          {/* Editor toolbar */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 12px", background: "var(--bg-soft)", borderBottom: "1px solid var(--panel-border)",
            flexShrink: 0, gap: 8
          }}>
            {/* Left: title + status */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>GDevelop</span>
              {!editorLoaded ? (
                <span className="pill" style={{ fontSize: 11, color: "var(--muted)" }}>загрузка…</span>
              ) : (
                <span className="pill status-published" style={{ fontSize: 11 }}>готов</span>
              )}
              {editorFull && !isCompleted ? (
                <span className="pill" style={{ fontSize: 11, background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent-hover)" }}>
                  Шаг {currentStepIndex + 1}/{steps.length}: {currentStep?.title}
                </span>
              ) : null}
            </div>
            {/* Right: controls */}
            <div className="button-row" style={{ gap: 6, flexShrink: 0 }}>
              {editorFull ? (
                <>
                  <button
                    className="button-secondary"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setPanelMode("split")}
                    title="Показать задание"
                  >
                    ← Задание
                  </button>
                  <button
                    className="button-ghost"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setPanelMode("info-only")}
                    title="Только задание"
                  >
                    Только задание
                  </button>
                </>
              ) : null}
              {panelMode === "split" ? (
                <>
                  <button
                    className="button-ghost"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setPanelMode("info-only")}
                    title="Скрыть редактор"
                  >
                    Скрыть ✕
                  </button>
                  <button
                    className="button"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setPanelMode("editor-full")}
                    title="Развернуть на весь экран"
                  >
                    На весь экран ⤢
                  </button>
                </>
              ) : null}
              {panelMode === "info-only" ? (
                <button
                  className="button-secondary"
                  style={{ fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setPanelMode("split")}
                >
                  Показать редактор ▶
                </button>
              ) : null}
            </div>
          </div>

          {/* iframe wrapper — position:relative для оверлея */}
          <div style={{ flex: 1, position: "relative", display: showEditor ? "flex" : "none", flexDirection: "column" }}>
            {/* iframe — всегда в DOM, никогда не размонтируется */}
            <iframe
              src={GDEVELOP_URL}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
              allow="clipboard-read; clipboard-write"
              title="GDevelop Editor"
              onLoad={() => setEditorLoaded(true)}
            />
            {/* Прозрачный оверлей во время drag'а — блокирует iframe от перехвата событий мыши */}
            {dragging ? (
              <div style={{ position: "absolute", inset: 0, zIndex: 100, cursor: "col-resize" }} />
            ) : null}
          </div>

          {/* Placeholder when editor hidden */}
          {!showEditor ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 32 }}>🎮</span>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>Редактор скрыт</p>
              <button className="button-secondary" onClick={() => setPanelMode("split")}>Показать GDevelop</button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Success overlay ── */}
      {successStep ? (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="card accent-card stack overlay-card card-bounce">
            <div className="eyebrow">Шаг выполнен</div>
            <h2 className="section-title" style={{ fontSize: 28 }}>{successStep.successTitle}</h2>
            <p className="subtle">{successStep.successText}</p>
            {(successStep.resultImageUrl || successStep.resultVideoUrl) ? (
              <div>
                {successStep.resultImageUrl ? renderMedia(successStep.resultImageUrl, "image", "success") : null}
                {successStep.resultVideoUrl ? renderMedia(successStep.resultVideoUrl, "video", "success") : null}
              </div>
            ) : null}
            <div className="button-row">
              <span className="pill active">+{successStep.successXp} XP</span>
              <span className="pill">{completedStepsCount >= steps.length ? "Миссия завершена!" : "Следующий шаг открыт"}</span>
            </div>
            <button className="button" onClick={() => setSuccessStep(null)} style={{ width: "100%", justifyContent: "center" }}>
              {completedStepsCount >= steps.length ? "Смотреть итог" : "Продолжить →"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Confetti canvas (pointer-events:none чтобы не мешать кликам) ── */}
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}
      />

      {/* ── Floating +XP badge ── */}
      {floatingXp ? (
        <div
          key={floatingXp.id}
          className="xp-float"
          style={{
            position: "fixed",
            bottom: 120,
            left: `${leftWidth / 2}px`,
            transform: "translateX(-50%)",
            zIndex: 9998,
            pointerEvents: "none",
            background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
            color: "#fff",
            fontWeight: 800,
            fontSize: 22,
            borderRadius: 999,
            padding: "8px 22px",
            boxShadow: "0 4px 24px color-mix(in srgb, var(--accent) 50%, transparent)",
            whiteSpace: "nowrap",
            letterSpacing: "0.02em"
          }}
        >
          +{floatingXp.amount} XP
        </div>
      ) : null}
    </>
  );
}
