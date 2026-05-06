"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Organization, ServiceIncident, SupportCase, SupportCaseComment } from "@game-game/shared";
import {
  createAdminIncident,
  createAdminSupportCase,
  createAdminSupportCaseComment,
  updateAdminIncident,
  updateAdminSupportCase
} from "../lib/api";

function statusTone(status: string) {
  if (status === "resolved" || status === "healthy") {
    return "completed";
  }
  if (status === "investigating" || status === "degraded") {
    return "active";
  }
  return "locked";
}

const CASE_STATUS_LABELS: Record<SupportCase["status"], string> = {
  open: "открыт",
  investigating: "в работе",
  resolved: "решён"
};

const INCIDENT_STATUS_LABELS: Record<ServiceIncident["status"], string> = {
  healthy: "в норме",
  degraded: "частично недоступно",
  outage: "сбой",
  resolved: "устранено"
};

const SEVERITY_LABELS: Record<SupportCase["severity"], string> = {
  low: "низкий",
  medium: "средний",
  high: "высокий"
};

export function AdminSupportCenterClient({
  organizations,
  initialCases,
  initialCommentsByCaseId,
  initialIncidents
}: {
  organizations: Organization[];
  initialCases: SupportCase[];
  initialCommentsByCaseId: Record<string, SupportCaseComment[]>;
  initialIncidents: ServiceIncident[];
}) {
  const [cases, setCases] = useState(initialCases);
  const [commentsByCaseId, setCommentsByCaseId] = useState(initialCommentsByCaseId);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [caseTitle, setCaseTitle] = useState("");
  const [caseBody, setCaseBody] = useState("");
  const [caseSeverity, setCaseSeverity] = useState<"low" | "medium" | "high">("medium");
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentMessage, setIncidentMessage] = useState("");
  const [incidentImpact, setIncidentImpact] = useState("");
  const [incidentStatus, setIncidentStatus] = useState<"healthy" | "degraded" | "outage" | "resolved">("degraded");
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(initialCases[0]?.id ?? null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCases = useMemo(() => cases.filter((item) => item.status !== "resolved"), [cases]);
  const activeIncidents = useMemo(
    () => incidents.filter((item) => item.status !== "healthy" && item.status !== "resolved"),
    [incidents]
  );

  async function handleCreateCase(event: FormEvent) {
    event.preventDefault();
    setPending("case:create");
    setError(null);
    try {
      const created = await createAdminSupportCase({
        organizationId,
        title: caseTitle,
        body: caseBody,
        severity: caseSeverity
      });
      setCases((current) => [created, ...current]);
      setExpandedCaseId(created.id);
      setCaseTitle("");
      setCaseBody("");
      setCaseSeverity("medium");
    } catch {
      setError("Не удалось создать кейс поддержки.");
    } finally {
      setPending(null);
    }
  }

  async function handleCreateIncident(event: FormEvent) {
    event.preventDefault();
    setPending("incident:create");
    setError(null);
    try {
      const created = await createAdminIncident({
        organizationId,
        title: incidentTitle,
        message: incidentMessage,
        impact: incidentImpact || undefined,
        status: incidentStatus
      });
      setIncidents((current) => [created, ...current]);
      setIncidentTitle("");
      setIncidentMessage("");
      setIncidentImpact("");
      setIncidentStatus("degraded");
    } catch {
      setError("Не удалось создать инцидент.");
    } finally {
      setPending(null);
    }
  }

  async function handleCaseStatus(caseId: string, status: "open" | "investigating" | "resolved") {
    setPending(`case:${caseId}`);
    setError(null);
    try {
      const updated = await updateAdminSupportCase(caseId, { status });
      setCases((current) => current.map((item) => (item.id === caseId ? updated : item)));
    } catch {
      setError("Не удалось обновить кейс поддержки.");
    } finally {
      setPending(null);
    }
  }

  async function handleIncidentStatus(incidentId: string, status: "healthy" | "degraded" | "outage" | "resolved") {
    const current = incidents.find((item) => item.id === incidentId);
    setPending(`incident:${incidentId}`);
    setError(null);
    try {
      const updated = await updateAdminIncident(incidentId, {
        status,
        message: current?.message,
        impact: current?.impact
      });
      setIncidents((items) => items.map((item) => (item.id === incidentId ? updated : item)));
    } catch {
      setError("Не удалось обновить инцидент.");
    } finally {
      setPending(null);
    }
  }

  async function handleComment(caseId: string) {
    const body = (commentDrafts[caseId] ?? "").trim();
    if (!body) {
      return;
    }
    setPending(`comment:${caseId}`);
    setError(null);
    try {
      const created = await createAdminSupportCaseComment(caseId, { body });
      setCommentsByCaseId((current) => ({
        ...current,
        [caseId]: [...(current[caseId] ?? []), created]
      }));
      setCases((current) =>
        current.map((item) => (item.id === caseId ? { ...item, commentsCount: item.commentsCount + 1 } : item))
      );
      setCommentDrafts((current) => ({ ...current, [caseId]: "" }));
      setExpandedCaseId(caseId);
    } catch {
      setError("Не удалось добавить комментарий к кейсу.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Поддержка</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>Кейсы поддержки и статус сервиса</h2>
          <p className="subtle">Операционная панель для клиентских кейсов, внутренних заметок и активных инцидентов по организациям.</p>
        </div>
        <div className="button-row">
          <span className="pill">открытых кейсов: {openCases.length}</span>
          <span className="pill">активных инцидентов: {activeIncidents.length}</span>
        </div>
      </div>

      <div className="grid grid-2">
        <form className="card stack" onSubmit={handleCreateCase}>
          <div className="eyebrow">Новый кейс поддержки</div>
          <label className="stack">
            <span>Организация</span>
            <select className="input" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            <span>Заголовок</span>
            <input className="input" value={caseTitle} onChange={(event) => setCaseTitle(event.target.value)} required />
          </label>
          <label className="stack">
            <span>Описание кейса</span>
            <textarea className="input" value={caseBody} onChange={(event) => setCaseBody(event.target.value)} rows={4} required />
          </label>
          <label className="stack">
            <span>Приоритет</span>
            <select className="input" value={caseSeverity} onChange={(event) => setCaseSeverity(event.target.value as "low" | "medium" | "high")}>
              <option value="low">низкий</option>
              <option value="medium">средний</option>
              <option value="high">высокий</option>
            </select>
          </label>
          <button className="button" type="submit" disabled={pending !== null}>
            {pending === "case:create" ? "Создаю..." : "Создать кейс"}
          </button>
        </form>

        <form className="card stack" onSubmit={handleCreateIncident}>
          <div className="eyebrow">Новый инцидент</div>
          <label className="stack">
            <span>Организация</span>
            <select className="input" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            <span>Заголовок</span>
            <input className="input" value={incidentTitle} onChange={(event) => setIncidentTitle(event.target.value)} required />
          </label>
          <label className="stack">
            <span>Сообщение</span>
            <textarea className="input" value={incidentMessage} onChange={(event) => setIncidentMessage(event.target.value)} rows={3} required />
          </label>
          <label className="stack">
            <span>Влияние на клиента</span>
            <textarea className="input" value={incidentImpact} onChange={(event) => setIncidentImpact(event.target.value)} rows={2} placeholder="Например: live-панель тренера обновляется с задержкой 10–20 секунд" />
          </label>
          <label className="stack">
            <span>Статус</span>
            <select className="input" value={incidentStatus} onChange={(event) => setIncidentStatus(event.target.value as "healthy" | "degraded" | "outage" | "resolved")}>
              <option value="healthy">в норме</option>
              <option value="degraded">частично недоступно</option>
              <option value="outage">сбой</option>
              <option value="resolved">устранено</option>
            </select>
          </label>
          <button className="button" type="submit" disabled={pending !== null}>
            {pending === "incident:create" ? "Создаю..." : "Создать инцидент"}
          </button>
        </form>
      </div>

      {error ? <div className="card" style={{ color: "#fda4af" }}>{error}</div> : null}

      <div className="grid grid-2">
        <div className="card stack">
          <div className="eyebrow">Очередь поддержки</div>
          {cases.length ? (
            cases.map((item) => {
              const comments = commentsByCaseId[item.id] ?? [];
              const isExpanded = expandedCaseId === item.id;
              return (
                <div key={item.id} className="card" style={{ padding: 16 }}>
                  <div className="stack" style={{ gap: 10 }}>
                    <div className="button-row" style={{ justifyContent: "space-between" }}>
                      <strong>{item.title}</strong>
                      <div className="button-row">
                        <span className="pill">{SEVERITY_LABELS[item.severity]}</span>
                        <span className="pill">заметок: {item.commentsCount}</span>
                        <span className={`status-pill ${statusTone(item.status)}`}>{CASE_STATUS_LABELS[item.status]}</span>
                      </div>
                    </div>
                    <p className="subtle" style={{ margin: 0 }}>{item.body}</p>
                    <div className="button-row">
                      {(["open", "investigating", "resolved"] as const).map((status) => (
                        <button
                          key={status}
                          className={item.status === status ? "button-primary" : "button-secondary"}
                          type="button"
                          disabled={pending === `case:${item.id}` || item.status === status}
                          onClick={() => handleCaseStatus(item.id, status)}
                        >
                          {CASE_STATUS_LABELS[status]}
                        </button>
                      ))}
                      <button className="button-secondary" type="button" onClick={() => setExpandedCaseId(isExpanded ? null : item.id)}>
                        {isExpanded ? "Скрыть заметки" : "Показать заметки"}
                      </button>
                    </div>

                    {isExpanded ? (
                      <div className="card stack" style={{ padding: 14 }}>
                        <div className="eyebrow">Комментарии по кейсу</div>
                        {comments.length ? (
                          comments.map((comment) => (
                            <div key={comment.id} className="card" style={{ padding: 12 }}>
                              <strong>{comment.authorDisplayName}</strong>
                              <p className="subtle" style={{ margin: "6px 0 0" }}>{comment.body}</p>
                              <div className="subtle" style={{ fontSize: 12 }}>{new Date(comment.createdAt).toLocaleString()}</div>
                            </div>
                          ))
                        ) : (
                          <div className="subtle">Внутренних комментариев пока нет.</div>
                        )}
                        <label className="stack">
                          <span>Новый комментарий</span>
                          <textarea
                            className="input"
                            value={commentDrafts[item.id] ?? ""}
                            onChange={(event) => setCommentDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
                            rows={3}
                            placeholder="Например: созвонились с тренером, ждём подтверждение от школы"
                          />
                        </label>
                        <button
                          className="button-secondary"
                          type="button"
                          disabled={pending === `comment:${item.id}`}
                          onClick={() => handleComment(item.id)}
                        >
                          {pending === `comment:${item.id}` ? "Сохраняю..." : "Добавить комментарий"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="subtle">Открытых кейсов поддержки пока нет.</div>
          )}
        </div>

        <div className="card stack">
          <div className="eyebrow">Статус сервиса</div>
          {incidents.length ? (
            incidents.map((item) => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div className="stack" style={{ gap: 10 }}>
                  <div className="button-row" style={{ justifyContent: "space-between" }}>
                    <strong>{item.title}</strong>
                    <span className={`status-pill ${statusTone(item.status)}`}>{INCIDENT_STATUS_LABELS[item.status]}</span>
                  </div>
                  <p className="subtle" style={{ margin: 0 }}>{item.message}</p>
                  {item.impact ? (
                    <div className="card" style={{ padding: 12 }}>
                      <div className="eyebrow">Влияние на клиента</div>
                      <div className="subtle">{item.impact}</div>
                    </div>
                  ) : null}
                  <div className="subtle" style={{ fontSize: 12 }}>
                    Начат: {new Date(item.startedAt).toLocaleString()} | Обновлён: {new Date(item.updatedAt).toLocaleString()}
                  </div>
                  <div className="button-row">
                    {(["healthy", "degraded", "outage", "resolved"] as const).map((status) => (
                      <button
                        key={status}
                        className={item.status === status ? "button-primary" : "button-secondary"}
                        type="button"
                        disabled={pending === `incident:${item.id}` || item.status === status}
                        onClick={() => handleIncidentStatus(item.id, status)}
                      >
                        {INCIDENT_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="subtle">Активных инцидентов пока нет.</div>
          )}
        </div>
      </div>
    </section>
  );
}
