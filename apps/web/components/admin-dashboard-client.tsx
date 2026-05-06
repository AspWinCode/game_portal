"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getMe, login, loginAs } from "../lib/auth";
import { getAdminJams, getAdminJamTemplates } from "../lib/admin-jams"; // re-exported aliases
import { getTrainerJams } from "../lib/api";
import { AdminJamListClient } from "./admin-jam-list-client";

type AdminState = {
  displayName: string;
  jams: Awaited<ReturnType<typeof getAdminJams>>;
  templates: Awaited<ReturnType<typeof getAdminJamTemplates>>;
  sessions: Awaited<ReturnType<typeof getTrainerJams>>;
};

export function AdminDashboardClient() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAdminRole, setHasAdminRole] = useState(false);
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");

  async function loadAdminData() {
    const me = await getMe();

    setIsAuthenticated(true);
    setHasAdminRole(me.user.role === "admin");

    if (me.user.role !== "admin") {
      setState(null);
      return;
    }

    const [jams, templates, sessions] = await Promise.all([
      getAdminJams(),
      getAdminJamTemplates(),
      getTrainerJams().catch(() => [] as Awaited<ReturnType<typeof getTrainerJams>>)
    ]);
    setState({
      displayName: me.user.displayName,
      jams,
      templates,
      sessions
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        await loadAdminData();
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : "Failed to load.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAction(action: () => Promise<void>, fallbackMessage: string) {
    setPending(true);
    setError(null);
    try {
      await action();
      await loadAdminData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : fallbackMessage);
    } finally {
      setPending(false);
      setLoading(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    await runAction(async () => {
      await login(email, password);
    }, "Не удалось войти. Проверьте email и пароль.");
  }

  async function handleQuickLogin(role: "admin" | "trainer") {
    setLoading(true);
    await runAction(async () => {
      await loginAs(role);
      setEmail(role === "admin" ? "admin@example.com" : "trainer@example.com");
      setPassword(role === "admin" ? "admin123" : "trainer123");
    }, "Не удалось выполнить быстрый вход.");
  }

  if (loading) {
    return (
      <main className="shell">
        <div className="container">
          <div className="empty-state stack">
            <p className="subtle">Загружаю...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="shell">
        <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
          <div className="card stack">
            <h1 style={{ margin: 0, fontSize: 24 }}>Вход администратора</h1>
            <p className="subtle" style={{ margin: 0, fontSize: 14 }}>
              Для работы с играми войдите под учётной записью администратора.
            </p>

            <form className="stack" onSubmit={handleLogin}>
              <label className="stack-sm">
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Email</span>
                <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="stack-sm">
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Пароль</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <button className="button" type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
                {pending ? "Вхожу..." : "Войти"}
              </button>
            </form>

            <div className="button-row" style={{ justifyContent: "center" }}>
              <button className="button-ghost" onClick={() => void handleQuickLogin("admin")} disabled={pending}>
                Войти как админ
              </button>
              <button className="button-ghost" onClick={() => void handleQuickLogin("trainer")} disabled={pending}>
                Войти как тренер
              </button>
            </div>

            {error ? <p style={{ color: "var(--danger)", margin: 0, fontSize: 13 }}>{error}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  if (!hasAdminRole) {
    return (
      <main className="shell">
        <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
          <div className="card stack empty-state">
            <h2 style={{ margin: 0, fontSize: 20 }}>Недостаточно прав</h2>
            <p className="subtle" style={{ margin: 0 }}>
              Эта страница доступна только администраторам.
            </p>
            <div className="button-row">
              <button className="button-secondary" onClick={() => void handleQuickLogin("admin")} disabled={pending}>
                Войти как админ
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="shell">
        <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
          <div className="card stack empty-state">
            <h2 style={{ margin: 0, fontSize: 20 }}>Не удалось загрузить данные</h2>
            <p className="subtle" style={{ margin: 0 }}>
              {error ?? "Попробуйте обновить страницу."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="container stack">
        <AdminJamListClient jams={state.jams} templates={state.templates} sessions={state.sessions} onRefresh={() => void loadAdminData()} />
      </div>
    </main>
  );
}
