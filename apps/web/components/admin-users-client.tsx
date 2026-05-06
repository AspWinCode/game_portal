"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Organization, UserAccount } from "@game-game/shared";
import {
  activateAdminUser,
  createAdminUser,
  deactivateAdminUser,
  resetAdminUserPassword,
  updateAdminUser
} from "../lib/api";
import { startSupportMode } from "../lib/auth";

type UserRole = "admin" | "trainer";

interface AdminUsersClientProps {
  initialUsers: UserAccount[];
  organizations: Organization[];
}

export function AdminUsersClient({ initialUsers, organizations }: AdminUsersClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("trainer");
  const [password, setPassword] = useState("");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(() => users.filter((item) => item.isActive).length, [users]);
  const showOrganizationSelect = organizations.length > 1;

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const user = await createAdminUser({
        email,
        displayName,
        role,
        password,
        organizationId: organizationId || undefined
      });
      setUsers((current) => [user, ...current]);
      setEmail("");
      setDisplayName("");
      setRole("trainer");
      setPassword("");
    } catch {
      setError("Не удалось создать пользователя.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(user: UserAccount) {
    setBusyId(user.id);
    setError(null);
    try {
      const updated = user.isActive ? await deactivateAdminUser(user.id) : await activateAdminUser(user.id);
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
    } catch {
      setError("Не удалось изменить статус пользователя.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSwitchRole(user: UserAccount) {
    setBusyId(user.id);
    setError(null);
    try {
      const updated = await updateAdminUser(user.id, {
        displayName: user.displayName,
        role: user.role === "admin" ? "trainer" : "admin"
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
    } catch {
      setError("Не удалось изменить роль пользователя.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(user: UserAccount) {
    const nextPassword = window.prompt(`Новый пароль для ${user.email}`, "changeme123");
    if (!nextPassword) {
      return;
    }

    setBusyId(user.id);
    setError(null);
    try {
      const updated = await resetAdminUserPassword(user.id, nextPassword);
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
    } catch {
      setError("Не удалось сбросить пароль.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSupportMode(user: UserAccount) {
    setBusyId(user.id);
    setError(null);
    try {
      await startSupportMode(user.id);
      window.location.assign(user.role === "admin" ? "/admin" : "/trainer");
    } catch {
      setError("Не удалось войти в режим поддержки.");
      setBusyId(null);
    }
  }

  return (
    <section className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Пользователи</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>Команда платформы</h2>
          <p className="subtle">Управление администраторами, тренерами, паролями и режимом поддержки.</p>
        </div>
        <span className="pill">активных пользователей: {activeCount}</span>
      </div>

      <form className="card stack" onSubmit={handleCreate}>
        <div className="grid grid-2">
          <label className="stack">
            <span>Email</span>
            <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label className="stack">
            <span>Имя</span>
            <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>

          <label className="stack">
            <span>Роль</span>
            <select className="input" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="trainer">Тренер</option>
              <option value="admin">Администратор</option>
            </select>
          </label>

          <label className="stack">
            <span>Пароль</span>
            <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>

          {showOrganizationSelect ? (
            <label className="stack" style={{ gridColumn: "1 / -1" }}>
              <span>Организация</span>
              <select className="input" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="button-row" style={{ justifyContent: "space-between" }}>
          {error ? <span style={{ color: "#fda4af" }}>{error}</span> : <span className="subtle">Пароль минимум 6 символов.</span>}
          <button className="button" type="submit" disabled={creating || organizations.length === 0}>
            {creating ? "Создаю..." : "Создать пользователя"}
          </button>
        </div>
      </form>

      <div className="stack">
        {users.map((user) => (
          <div key={user.id} className="card" style={{ padding: 18 }}>
            <div className="button-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="stack" style={{ gap: 6 }}>
                <strong>{user.displayName}</strong>
                <span className="subtle">{user.email}</span>

                <div className="button-row">
                  <span className={`status-pill ${user.isActive ? "completed" : "locked"}`}>
                    {user.isActive ? "активен" : "неактивен"}
                  </span>
                  <span className="pill">{user.role === "admin" ? "администратор" : "тренер"}</span>
                  <span className="pill">активных сессий: {user.activeSessionCount}</span>
                </div>

                {showOrganizationSelect ? (
                  <div className="button-row">
                    {user.organizations.map((membership) => (
                      <span key={membership.id} className="pill">
                        {membership.organizationName}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="subtle" style={{ marginBottom: 0 }}>
                  Последняя активность: {user.lastSessionAt ? new Date(user.lastSessionAt).toLocaleString("ru-RU") : "ещё не входил"}
                </p>
              </div>

              <div className="button-row">
                <button className="button-secondary" disabled={busyId === user.id} onClick={() => void handleSupportMode(user)}>
                  Войти как пользователь
                </button>
                <button className="button-secondary" disabled={busyId === user.id} onClick={() => void handleSwitchRole(user)}>
                  {user.role === "admin" ? "Сделать тренером" : "Сделать администратором"}
                </button>
                <button className="button-secondary" disabled={busyId === user.id} onClick={() => void handleResetPassword(user)}>
                  Сбросить пароль
                </button>
                <button className="button-secondary" disabled={busyId === user.id} onClick={() => void handleToggle(user)}>
                  {user.isActive ? "Деактивировать" : "Активировать"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
