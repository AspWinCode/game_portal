"use client";

import { useMemo, useState } from "react";
import type { AuditLog } from "@game-game/shared";

interface AdminAuditLogClientProps {
  items: AuditLog[];
  total: number;
}

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Вход",
  "auth.logout": "Выход",
  "admin.jam.create": "Создание игры",
  "admin.jam.update": "Обновление игры",
  "admin.jam.archive": "Архивация игры",
  "admin.jam.publish": "Публикация игры",
  "admin.media.create": "Создание медиа-ресурса",
  "admin.media.upload_file": "Загрузка файла",
  "trainer.session.create": "Создание сессии",
  "trainer.session.start": "Запуск сессии",
  "trainer.session.complete": "Завершение сессии",
  "trainer.session.attach_jam": "Подключение игры",
  "trainer.participant.resolve_help": "Обработка запроса помощи",
  "trainer.participant.mark_reviewed": "Результат просмотрен",
  "public.session.join": "Вход ребёнка",
  "public.participant.select_jam": "Выбор миссии",
  "public.step.open_hint": "Открытие подсказки",
  "public.step.need_help": "Запрос помощи",
  "public.step.complete": "Завершение этапа"
};

export function AdminAuditLogClient({ items, total }: AdminAuditLogClientProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failure">("all");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const haystack = [
        item.action,
        ACTION_LABELS[item.action] ?? "",
        item.actorEmail ?? "",
        item.actorRole ?? "",
        item.targetType ?? "",
        item.targetId ?? ""
      ]
        .join(" ")
        .toLowerCase();

      return statusMatch && haystack.includes(query.toLowerCase());
    });
  }, [items, query, statusFilter]);

  return (
    <section className="card stack">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Аудит</div>
          <h2 style={{ margin: "8px 0 0" }}>Операционные события</h2>
          <p className="subtle" style={{ marginTop: 8 }}>
            Последние события по авторизации, админке, тренерам и детскому сценарию. Всего записей: {total}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по действию, пользователю или цели"
            style={{ minWidth: 260 }}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">Все статусы</option>
            <option value="success">Только успешно</option>
            <option value="failure">Только ошибки</option>
          </select>
        </div>
      </div>

      <div className="stack">
        {filtered.length === 0 ? (
          <div className="card" style={{ background: "rgba(148, 163, 184, 0.08)" }}>
            <strong>Ничего не найдено.</strong>
            <p className="subtle" style={{ marginTop: 8 }}>Попробуйте очистить фильтр или расширить поисковый запрос.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                background: item.status === "failure" ? "rgba(239, 68, 68, 0.10)" : "rgba(15, 23, 42, 0.85)",
                borderColor: item.status === "failure" ? "rgba(239, 68, 68, 0.4)" : "rgba(148, 163, 184, 0.12)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>{ACTION_LABELS[item.action] ?? item.action}</strong>
                  <p className="subtle" style={{ marginTop: 6 }}>
                    {item.action} · {item.status === "success" ? "успех" : "ошибка"} · {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`status-pill ${item.status === "failure" ? "needs-help" : "completed"}`}>
                  {item.status === "success" ? "успех" : "ошибка"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 14 }}>
                <div>
                  <div className="subtle">Кто выполнил</div>
                  <strong>{item.actorEmail ?? item.actorId ?? item.actorType}</strong>
                  <div className="subtle">{item.actorRole ?? item.actorType}</div>
                </div>
                <div>
                  <div className="subtle">Цель</div>
                  <strong>{item.targetType ?? "не указано"}</strong>
                  <div className="subtle">{item.targetId ?? "—"}</div>
                </div>
                <div>
                  <div className="subtle">Запрос</div>
                  <strong>{item.ipAddress ?? "ip не указан"}</strong>
                  <div className="subtle">{item.userAgent ?? "user-agent не указан"}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
