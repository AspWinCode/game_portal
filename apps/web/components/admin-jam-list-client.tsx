"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminGameTemplate, Game, Jam } from "@game-game/shared";
import {
  archiveAdminJam,
  createAdminJam,
  createAdminJamFromTemplate,
  deleteAdminJam,
  duplicateAdminJam
} from "../lib/admin-jams";
import { cancelTrainerJam } from "../lib/api";

type Tab = "sessions" | "archive" | "games" | "templates";
type StatusFilter = "all" | "draft" | "published" | "archived";
type GameSortMode = "updated" | "title" | "duration";
type TemplateSortMode = "updated" | "title" | "steps";

function levelLabel(level: string) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  if (level === "advanced") return "Продвинутый";
  return level;
}

function statusLabel(status: string) {
  if (status === "draft") return "Черновик";
  if (status === "published") return "Опубликован";
  if (status === "archived") return "Архив";
  return status;
}

function statusClass(status: string) {
  if (status === "draft") return "status-draft";
  if (status === "published") return "status-published";
  if (status === "archived") return "status-archived";
  return "";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatRelativeDate(dateString: string | undefined) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  if (diffDays < 7) return `${diffDays} дн. назад`;
  return date.toLocaleDateString("ru-RU");
}

function sortGames(items: Game[], mode: GameSortMode) {
  const next = [...items];
  switch (mode) {
    case "title":
      return next.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    case "duration":
      return next.sort((a, b) => b.estimatedDurationMin - a.estimatedDurationMin);
    default:
      return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

function sortTemplates(items: AdminGameTemplate[], mode: TemplateSortMode) {
  const next = [...items];
  switch (mode) {
    case "title":
      return next.sort((a, b) => a.gameTitle.localeCompare(b.gameTitle, "ru"));
    case "steps":
      return next.sort((a, b) => b.stepsCount - a.stepsCount);
    default:
      return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}

export function AdminJamListClient({
  jams,
  templates,
  sessions,
  onRefresh
}: {
  jams: Game[];
  templates: AdminGameTemplate[];
  sessions: Jam[];
  onRefresh?: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("sessions");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [gameSortMode, setGameSortMode] = useState<GameSortMode>("updated");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateSortMode, setTemplateSortMode] = useState<TemplateSortMode>("updated");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = jams.filter((game) => {
      if (statusFilter !== "all" && game.status !== statusFilter) return false;
      if (!normalized) return true;
      return [game.title, game.slug, game.level, game.shortDescription].join(" ").toLowerCase().includes(normalized);
    });
    return sortGames(filtered, gameSortMode);
  }, [gameSortMode, jams, query, statusFilter]);

  const filteredTemplates = useMemo(() => {
    const normalized = templateQuery.trim().toLowerCase();
    const filtered = templates.filter((item) => {
      if (!normalized) return true;
      return [item.gameTitle, item.shortDescription, item.level].join(" ").toLowerCase().includes(normalized);
    });
    return sortTemplates(filtered, templateSortMode);
  }, [templateQuery, templateSortMode, templates]);

  const statusCounts = useMemo(() => {
    const counts = { all: jams.length, draft: 0, published: 0, archived: 0 };
    for (const game of jams) {
      if (game.status === "draft") counts.draft += 1;
      if (game.status === "published") counts.published += 1;
      if (game.status === "archived") counts.archived += 1;
    }
    return counts;
  }, [jams]);

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active" || s.status === "planned"),
    [sessions]
  );
  const archivedSessions = useMemo(
    () => sessions.filter((s) => s.status === "completed" || s.status === "cancelled"),
    [sessions]
  );

  async function handleCreateGame(isTemplate = false) {
    const key = isTemplate ? "create-template" : "create-game";
    setPending(key);
    setError(null);
    try {
      const created = await createAdminJam({
        slug: `${isTemplate ? "template" : "game"}-${Date.now()}`,
        title: isTemplate ? "Новый шаблон игры" : "Новая игра",
        shortDescription: isTemplate
          ? "Шаблон для быстрой сборки новой игры."
          : "Краткое описание новой игры.",
        fullDescription: isTemplate
          ? "Рабочий шаблон для методиста: шаги, подсказки и финал."
          : "Подробное описание новой игры для прохождения.",
        themeCode: "cyber-it",
        level: "beginner",
        estimatedDurationMin: 30,
        accentStyle: "neon-grid",
        accentColor: "#8B5CF6",
        finalTitle: isTemplate ? "Шаблон готов" : "Игра завершена",
        finalDescription: isTemplate ? "Создайте на основе шаблона рабочую игру." : "Покажи результат тренеру.",
        finalRewardXp: 100,
        isTemplate
      });
      router.push(`/admin/games/${created.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, isTemplate ? "Не удалось создать шаблон." : "Не удалось создать игру."));
      setPending(null);
    }
  }

  async function handleCreateFromTemplate(templateId: string) {
    setPending(`template:${templateId}`);
    setError(null);
    try {
      const created = await createAdminJamFromTemplate(templateId);
      router.push(`/admin/games/${created.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Не удалось создать игру из шаблона."));
      setPending(null);
    }
  }

  async function handleDuplicate(id: string) {
    setPending(`duplicate:${id}`);
    setError(null);
    try {
      const duplicated = await duplicateAdminJam(id);
      router.push(`/admin/games/${duplicated.id}`);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Не удалось дублировать игру."));
      setPending(null);
    }
  }

  async function handleArchive(id: string) {
    setPending(`archive:${id}`);
    setError(null);
    try {
      await archiveAdminJam(id);
      onRefresh?.();
      router.refresh();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Не удалось архивировать игру."));
    } finally {
      setPending(null);
    }
  }

  async function handleCancelSession(id: string) {
    if (!window.confirm("Отменить джем? Участники больше не смогут войти. Действие нельзя отменить.")) return;

    setPending(`cancel:${id}`);
    setError(null);
    try {
      await cancelTrainerJam(id);
      onRefresh?.();
      router.refresh();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Не удалось отменить джем."));
    } finally {
      setPending(null);
    }
  }

  async function handleDelete(id: string, kind: "игру" | "шаблон") {
    if (!window.confirm(`Удалить ${kind}? Действие нельзя отменить.`)) return;

    setPending(`delete:${id}`);
    setError(null);
    try {
      await deleteAdminJam(id);
      onRefresh?.();
      router.refresh();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, `Не удалось удалить ${kind}.`));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Панель администратора</h1>
        <div className="button-row">
          {tab === "sessions" ? (
            <Link className="button" href="/admin/jams/new">
              + Создать джем
            </Link>
          ) : null}
          {tab === "games" || tab === "templates" ? (
            <button
              className="button"
              onClick={() => void handleCreateGame(tab === "templates")}
              disabled={pending !== null}
            >
              {pending === (tab === "templates" ? "create-template" : "create-game")
                ? "Создаю..."
                : tab === "templates"
                  ? "+ Создать шаблон"
                  : "+ Создать игру"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "sessions" ? "active" : ""}`} onClick={() => setTab("sessions")}>
          Сессии ({activeSessions.length})
        </button>
        <button className={`tab ${tab === "archive" ? "active" : ""}`} onClick={() => setTab("archive")}>
          Архив джемов ({archivedSessions.length})
        </button>
        <button className={`tab ${tab === "games" ? "active" : ""}`} onClick={() => setTab("games")}>
          Игры ({jams.length})
        </button>
        <button className={`tab ${tab === "templates" ? "active" : ""}`} onClick={() => setTab("templates")}>
          Шаблоны ({templates.length})
        </button>
      </div>

      {error ? <p style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>{error}</p> : null}

      {/* ── SESSIONS TAB ── */}
      {tab === "sessions" ? (
        <div className="stack">
          {activeSessions.length === 0 ? (
            <div className="card stack empty-state">
              <h2 style={{ margin: 0, fontSize: 20 }}>Нет активных сессий</h2>
              <p className="subtle" style={{ margin: 0 }}>
                Создайте первый джем — участники войдут по join-коду.
              </p>
              <Link className="button" href="/admin/jams/new" style={{ alignSelf: "center" }}>
                + Создать джем
              </Link>
            </div>
          ) : (
            <>
              <AdminSessionGroup title="Активные" sessions={activeSessions.filter(s => s.status === "active")} onCancel={handleCancelSession} pendingId={pending} />
              <AdminSessionGroup title="Запланированные" sessions={activeSessions.filter(s => s.status === "planned")} onCancel={handleCancelSession} pendingId={pending} />
            </>
          )}
        </div>
      ) : null}

      {/* ── ARCHIVE TAB ── */}
      {tab === "archive" ? (
        <div className="stack">
          {archivedSessions.length === 0 ? (
            <div className="card stack empty-state">
              <h2 style={{ margin: 0, fontSize: 20 }}>Архив пуст</h2>
              <p className="subtle" style={{ margin: 0 }}>
                Завершённые и отменённые джемы будут отображаться здесь.
              </p>
            </div>
          ) : (
            <>
              <AdminSessionGroup title="Завершённые" sessions={archivedSessions.filter(s => s.status === "completed")} showSummary />
              <AdminSessionGroup title="Отменённые" sessions={archivedSessions.filter(s => s.status === "cancelled")} showSummary />
            </>
          )}
        </div>
      ) : null}

      {tab === "games" ? (
        <div className="stack">
          <div className="toolbar">
            <div className="search-input">
              <input
                className="input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по названию или коду"
              />
            </div>
            <select
              className="input"
              style={{ width: "auto", minWidth: 170 }}
              value={gameSortMode}
              onChange={(event) => setGameSortMode(event.target.value as GameSortMode)}
            >
              <option value="updated">Сначала новые</option>
              <option value="title">По названию</option>
              <option value="duration">По длительности</option>
            </select>
          </div>

          <div className="chips">
            {(["all", "draft", "published", "archived"] as StatusFilter[]).map((status) => (
              <button
                key={status}
                className={`chip ${statusFilter === status ? "active" : ""}`}
                onClick={() => setStatusFilter(status)}
              >
                {status === "all"
                  ? "Все"
                  : status === "draft"
                    ? "Черновики"
                    : status === "published"
                      ? "Опубликованные"
                      : "Архив"}{" "}
                ({statusCounts[status]})
              </button>
            ))}
          </div>

          {filteredGames.length === 0 ? (
            <div className="card stack empty-state">
              <h2 style={{ margin: 0, fontSize: 20 }}>{jams.length === 0 ? "Пока нет игр" : "Ничего не найдено"}</h2>
              <p className="subtle" style={{ margin: 0 }}>
                {jams.length === 0
                  ? "Создайте первую игру. Джем создаётся отдельно через кнопку «Создать джем»."
                  : "Измените поисковый запрос или фильтры."}
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Уровень</th>
                    <th>Статус</th>
                    <th>Обновлён</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGames.map((game) => (
                    <tr key={game.id}>
                      <td>
                        <Link href={`/admin/games/${game.id}`} style={{ fontWeight: 600 }}>
                          {game.title}
                        </Link>
                        <div style={{ fontSize: 12, color: "var(--dim)", marginTop: 2 }}>{game.slug}</div>
                      </td>
                      <td>
                        <span className="pill">{levelLabel(game.level)}</span>
                      </td>
                      <td>
                        <span className={`pill ${statusClass(game.status)}`}>{statusLabel(game.status)}</span>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 13 }}>{formatRelativeDate(game.updatedAt)}</td>
                      <td>
                        <div className="button-row">
                          <button
                            className="button-ghost"
                            onClick={() => router.push(`/admin/games/${game.id}`)}
                            disabled={pending !== null}
                          >
                            Открыть
                          </button>
                          <button
                            className="button-ghost"
                            onClick={() => void handleDuplicate(game.id)}
                            disabled={pending !== null}
                          >
                            Дублировать
                          </button>
                          {game.status !== "archived" ? (
                            <button
                              className="button-ghost"
                              onClick={() => void handleArchive(game.id)}
                              disabled={pending !== null}
                            >
                              Архивировать
                            </button>
                          ) : null}
                          {game.status !== "published" ? (
                            <button
                              className="button-danger"
                              onClick={() => void handleDelete(game.id, "игру")}
                              disabled={pending !== null}
                            >
                              Удалить
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === "templates" ? (
        <div className="stack">
          <div className="toolbar">
            <div className="search-input">
              <input
                className="input"
                value={templateQuery}
                onChange={(event) => setTemplateQuery(event.target.value)}
                placeholder="Поиск по шаблонам"
              />
            </div>
            <select
              className="input"
              style={{ width: "auto", minWidth: 170 }}
              value={templateSortMode}
              onChange={(event) => setTemplateSortMode(event.target.value as TemplateSortMode)}
            >
              <option value="updated">Сначала новые</option>
              <option value="title">По названию</option>
              <option value="steps">Больше шагов</option>
            </select>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="card stack empty-state">
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {templates.length === 0 ? "Пока нет шаблонов" : "Ничего не найдено"}
              </h2>
              <p className="subtle" style={{ margin: 0 }}>
                {templates.length === 0
                  ? "Создайте шаблон, чтобы быстрее запускать новые игры."
                  : "Измените поисковый запрос."}
              </p>
            </div>
          ) : (
            filteredTemplates.map((template) => (
              <div key={template.gameId} className="card stack">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div className="stack-sm" style={{ flex: 1 }}>
                    <strong>{template.gameTitle}</strong>
                    <p className="subtle" style={{ margin: 0 }}>
                      {template.shortDescription}
                    </p>
                    <div className="button-row">
                      <span className="pill">{levelLabel(template.level)}</span>
                      <span className="pill">шагов: {template.stepsCount}</span>
                      <span className="pill">подсказок: {template.hintsCount}</span>
                      <span className="pill">{formatRelativeDate(template.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="button-row">
                    <button
                      className="button"
                      onClick={() => void handleCreateFromTemplate(template.gameId)}
                      disabled={pending !== null}
                    >
                      {pending === `template:${template.gameId}` ? "Создаю..." : "Создать игру"}
                    </button>
                    <Link className="button-secondary" href={`/admin/games/${template.gameId}`}>
                      Редактировать
                    </Link>
                    {template.status !== "published" ? (
                      <button
                        className="button-danger"
                        onClick={() => void handleDelete(template.gameId, "шаблон")}
                        disabled={pending !== null}
                      >
                        Удалить
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── CopyLinkButton ────────────────────────────────────────────────────────────

function CopyLinkButton({ joinUrl }: { joinUrl: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const full = `${window.location.origin}${joinUrl}`;
    void navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button className="button-secondary" onClick={handleCopy}>
      {copied ? "✓ Скопировано" : "Копировать ссылку"}
    </button>
  );
}

// ── AdminSessionGroup ─────────────────────────────────────────────────────────

function AdminSessionGroup({
  title,
  sessions,
  showSummary = false,
  onCancel,
  pendingId
}: {
  title: string;
  sessions: Jam[];
  showSummary?: boolean;
  onCancel?: (id: string) => void;
  pendingId?: string | null;
}) {
  if (sessions.length === 0) return null;

  return (
    <div className="stack">
      <strong style={{ color: "var(--muted)", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title} ({sessions.length})
      </strong>
      {sessions.map((session) => (
        <div key={session.id} className="card stack" style={{ padding: 18 }}>
          <div className="button-row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{session.title}</strong>
              <p className="subtle" style={{ margin: "4px 0 0", fontSize: 13 }}>
                Join-код: <code>{session.joinCode}</code>
              </p>
            </div>
            <div className="button-row">
              <span className={`pill ${session.status === "active" ? "active" : ""}`}>
                {session.status === "active"
                  ? "Активен"
                  : session.status === "planned"
                    ? "Запланирован"
                    : session.status === "completed"
                      ? "Завершён"
                      : "Отменён"}
              </span>
              <span className="pill" style={{ fontSize: 12 }}>
                {new Date(session.createdAt).toLocaleDateString("ru-RU")}
              </span>
            </div>
          </div>

          {showSummary && session.archiveSummary ? (
            <div className="grid grid-3">
              <div className="card" style={{ padding: 12 }}>
                <strong style={{ fontSize: 13 }}>Участники</strong>
                <p className="subtle" style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {session.archiveSummary.participantsCount} всего, {session.archiveSummary.completedCount} завершили
                </p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <strong style={{ fontSize: 13 }}>Прогресс</strong>
                <p className="subtle" style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {session.archiveSummary.reviewedCount} проверено, ср. {session.archiveSummary.averageProgressPercent}%
                </p>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <strong style={{ fontSize: 13 }}>Подсказки</strong>
                <p className="subtle" style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {session.archiveSummary.hintsOpenedCount} открыто, {session.archiveSummary.helpRequestsCount} запросов помощи
                </p>
              </div>
            </div>
          ) : null}

          <div className="button-row">
            <Link className="button" href={`/trainer/jams/${session.id}`}>
              Открыть джем
            </Link>
            <CopyLinkButton joinUrl={session.joinUrl} />
            {onCancel ? (
              <button
                className="button-danger"
                onClick={() => onCancel(session.id)}
                disabled={pendingId !== null && pendingId !== undefined}
              >
                {pendingId === `cancel:${session.id}` ? "Отменяю..." : "Отменить джем"}
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
