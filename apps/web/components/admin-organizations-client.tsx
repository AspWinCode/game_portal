"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Route } from "next";
import type { Organization, OrganizationPlanEvent, UserInvite } from "@game-game/shared";
import {
  activateAdminOrganization,
  createAdminInvite,
  createAdminOrganization,
  deactivateAdminOrganization,
  updateAdminOrganization
} from "../lib/api";

type InviteRole = "admin" | "trainer";
interface AdminOrganizationsClientProps {
  initialOrganizations: Organization[];
  initialInvites: UserInvite[];
  initialPlanEvents: OrganizationPlanEvent[];
}

export function AdminOrganizationsClient({
  initialOrganizations,
  initialInvites,
  initialPlanEvents
}: AdminOrganizationsClientProps) {
  const [organizations, setOrganizations] = useState(initialOrganizations);
  const [invites, setInvites] = useState(initialInvites);
  const [planEvents] = useState(initialPlanEvents);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");
  const [orgBrandMessage, setOrgBrandMessage] = useState("");
  const [orgBrandAccentColor, setOrgBrandAccentColor] = useState("#8B5CF6");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("trainer");
  const [inviteOrganizationId, setInviteOrganizationId] = useState(initialOrganizations[0]?.id ?? "");
  const [editingBrandingId, setEditingBrandingId] = useState<string | null>(null);
  const [brandingDrafts, setBrandingDrafts] = useState<Record<string, { logoUrl: string; brandMessage: string; brandAccentColor: string }>>(
    Object.fromEntries(
      initialOrganizations.map((organization) => [
        organization.id,
        {
          logoUrl: organization.logoUrl ?? "",
          brandMessage: organization.brandMessage ?? "",
          brandAccentColor: organization.brandAccentColor ?? "#8B5CF6"
        }
      ])
    )
  );
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [busyOrganizationId, setBusyOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingInvites = useMemo(() => invites.filter((invite) => invite.status === "pending").length, [invites]);

  async function handleCreateOrganization(event: FormEvent) {
    event.preventDefault();
    setCreatingOrganization(true);
    setError(null);

    try {
      const organization = await createAdminOrganization({
        name: orgName,
        slug: orgSlug,
        logoUrl: orgLogoUrl || undefined,
        brandMessage: orgBrandMessage || undefined,
        brandAccentColor: orgBrandAccentColor || undefined
      });
      setOrganizations((current) => [organization, ...current]);
      setBrandingDrafts((current) => ({
        ...current,
        [organization.id]: {
          logoUrl: organization.logoUrl ?? "",
          brandMessage: organization.brandMessage ?? "",
          brandAccentColor: organization.brandAccentColor ?? "#8B5CF6"
        }
      }));
      setInviteOrganizationId((current) => current || organization.id);
      setOrgName("");
      setOrgSlug("");
      setOrgLogoUrl("");
      setOrgBrandMessage("");
      setOrgBrandAccentColor("#8B5CF6");
    } catch {
      setError("Не удалось создать организацию.");
    } finally {
      setCreatingOrganization(false);
    }
  }

  async function handleCreateInvite(event: FormEvent) {
    event.preventDefault();
    setCreatingInvite(true);
    setError(null);

    try {
      const invite = await createAdminInvite({
        organizationId: inviteOrganizationId,
        email: inviteEmail,
        role: inviteRole
      });
      setInvites((current) => [invite, ...current]);
      setInviteEmail("");
      setInviteRole("trainer");
    } catch {
      setError("Не удалось создать приглашение.");
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleToggleOrganization(organization: Organization) {
    setBusyOrganizationId(organization.id);
    setError(null);

    try {
      const updated = organization.isActive
        ? await deactivateAdminOrganization(organization.id)
        : await activateAdminOrganization(organization.id);
      setOrganizations((current) => current.map((item) => (item.id === organization.id ? updated : item)));
    } catch {
      setError("Не удалось изменить статус организации.");
    } finally {
      setBusyOrganizationId(null);
    }
  }

  async function handleSaveBranding(organization: Organization) {
    const draft = brandingDrafts[organization.id];
    if (!draft) {
      return;
    }

    setBusyOrganizationId(organization.id);
    setError(null);

    try {
      const updated = await updateAdminOrganization(organization.id, {
        logoUrl: draft.logoUrl || undefined,
        brandMessage: draft.brandMessage || undefined,
        brandAccentColor: draft.brandAccentColor || undefined
      });
      setOrganizations((current) => current.map((item) => (item.id === organization.id ? updated : item)));
      setEditingBrandingId(null);
    } catch {
      setError("Не удалось сохранить настройки бренда.");
    } finally {
      setBusyOrganizationId(null);
    }
  }

  async function handleCopyInvite(invite: UserInvite) {
    setError(null);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`);
    } catch {
      setError("Не удалось скопировать ссылку-приглашение.");
    }
  }

  return (
    <section className="card stack">
      <div className="button-row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="eyebrow">Организации</div>
          <h2 className="section-title" style={{ fontSize: 28, marginTop: 10 }}>Организации, приглашения и брендинг</h2>
          <p className="subtle">Здесь настраиваются организации, приглашения и публичный стиль экранов входа и статуса.</p>
        </div>
        <div className="button-row">
          <span className="pill">организаций: {organizations.length}</span>
          <span className="pill">ожидают принятия: {pendingInvites}</span>
        </div>
      </div>

      <div className="grid grid-2">
        <form className="card stack" onSubmit={handleCreateOrganization}>
          <div className="eyebrow">Новая организация</div>
          <label className="stack">
            <span>Название</span>
            <input className="input" value={orgName} onChange={(event) => setOrgName(event.target.value)} required />
          </label>
          <label className="stack">
            <span>Слаг</span>
            <input className="input" value={orgSlug} onChange={(event) => setOrgSlug(event.target.value)} required />
          </label>
          <label className="stack">
            <span>URL логотипа</span>
            <input className="input" value={orgLogoUrl} onChange={(event) => setOrgLogoUrl(event.target.value)} placeholder="/uploads/manual/logo.png" />
          </label>
          <label className="stack">
            <span>Сообщение бренда</span>
            <textarea
              className="input"
              rows={3}
              value={orgBrandMessage}
              onChange={(event) => setOrgBrandMessage(event.target.value)}
              placeholder="Например: добро пожаловать в лабораторию цифровых миссий"
            />
          </label>
          <label className="stack">
            <span>Акцентный цвет</span>
            <input className="input" value={orgBrandAccentColor} onChange={(event) => setOrgBrandAccentColor(event.target.value)} placeholder="#8B5CF6" />
          </label>
          <button className="button" type="submit" disabled={creatingOrganization}>
            {creatingOrganization ? "Создаю..." : "Создать организацию"}
          </button>
        </form>

        <form className="card stack" onSubmit={handleCreateInvite}>
          <div className="eyebrow">Пригласить пользователя</div>
          <label className="stack">
            <span>Организация</span>
            <select className="input" value={inviteOrganizationId} onChange={(event) => setInviteOrganizationId(event.target.value)} required>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            <span>Email</span>
            <input className="input" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required />
          </label>
          <label className="stack">
            <span>Роль</span>
            <select className="input" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as InviteRole)}>
              <option value="trainer">Тренер</option>
              <option value="admin">Администратор</option>
            </select>
          </label>
          <button className="button" type="submit" disabled={creatingInvite || organizations.length === 0}>
            {creatingInvite ? "Создаю..." : "Создать приглашение"}
          </button>
        </form>
      </div>

      {error ? <div className="card" style={{ color: "#fda4af" }}>{error}</div> : null}

      <div className="grid grid-2">
        <div className="card stack">
          <div className="eyebrow">Список организаций</div>
          {organizations.map((organization) => {
            const branding = brandingDrafts[organization.id] ?? {
              logoUrl: "",
              brandMessage: "",
              brandAccentColor: "#8B5CF6"
            };

            return (
              <div key={organization.id} className="card" style={{ padding: 16 }}>
                <div className="stack" style={{ gap: 12 }}>
                  <div className="button-row" style={{ justifyContent: "space-between" }}>
                    <div className="stack" style={{ gap: 4 }}>
                      <strong>{organization.name}</strong>
                      <span className="subtle">{organization.slug}</span>
                    </div>
                    <span className={`status-pill ${organization.isActive ? "completed" : "locked"}`}>
                      {organization.isActive ? "активна" : "неактивна"}
                    </span>
                  </div>

                  <div className="button-row">
                    <span className="pill">админы: {organization.activeAdminUsers}</span>
                    <span className="pill">тренеры: {organization.activeTrainerUsers}</span>
                  </div>
                  <div className="button-row">
                    <span className="pill">активные сессии: {organization.activeSessionsCount}</span>
                    <span className="pill">опубликованные игры: {organization.publishedJamsCount}</span>
                  </div>
                  <div className="button-row">
                    <span className="pill">хранилище: {Math.round(organization.storageBytesUsed / 1024 / 1024)} МБ</span>
                  </div>

                  <div className="button-row">
                    <Link className="button-secondary" href={`/admin/organizations/${organization.id}/onboarding` as Route}>
                      Онбординг
                    </Link>
                  </div>

                  <div
                    className="card"
                    style={{
                      padding: 14,
                      borderColor: branding.brandAccentColor ? `${branding.brandAccentColor}66` : undefined
                    }}
                  >
                    <div className="button-row" style={{ justifyContent: "space-between" }}>
                      <div className="eyebrow">Публичный брендинг</div>
                      <button className="button-secondary" type="button" onClick={() => setEditingBrandingId(editingBrandingId === organization.id ? null : organization.id)}>
                        {editingBrandingId === organization.id ? "Скрыть" : "Редактировать"}
                      </button>
                    </div>
                    {organization.logoUrl ? (
                      <img
                        src={organization.logoUrl}
                        alt={`${organization.name} logo`}
                        style={{ width: 56, height: 56, marginTop: 10, borderRadius: 14, objectFit: "cover" }}
                      />
                    ) : null}
                    <p className="subtle" style={{ marginBottom: 0 }}>
                      {organization.brandMessage || "Пока нет публичного сообщения для экранов входа и статуса."}
                    </p>

                    {editingBrandingId === organization.id ? (
                      <div className="stack" style={{ marginTop: 12 }}>
                        <label className="stack">
                          <span>URL логотипа</span>
                          <input
                            className="input"
                            value={branding.logoUrl}
                            onChange={(event) =>
                              setBrandingDrafts((current) => ({
                                ...current,
                                [organization.id]: { ...branding, logoUrl: event.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="stack">
                          <span>Сообщение бренда</span>
                          <textarea
                            className="input"
                            rows={3}
                            value={branding.brandMessage}
                            onChange={(event) =>
                              setBrandingDrafts((current) => ({
                                ...current,
                                [organization.id]: { ...branding, brandMessage: event.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="stack">
                          <span>Акцентный цвет</span>
                          <input
                            className="input"
                            value={branding.brandAccentColor}
                            onChange={(event) =>
                              setBrandingDrafts((current) => ({
                                ...current,
                                [organization.id]: { ...branding, brandAccentColor: event.target.value }
                              }))
                            }
                          />
                        </label>
                        <button
                          className="button-secondary"
                          type="button"
                          disabled={busyOrganizationId === organization.id}
                          onClick={() => handleSaveBranding(organization)}
                        >
                          {busyOrganizationId === organization.id ? "Сохраняю..." : "Сохранить брендинг"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="button-row">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={busyOrganizationId === organization.id}
                      onClick={() => handleToggleOrganization(organization)}
                    >
                      {busyOrganizationId === organization.id ? "Сохраняю..." : organization.isActive ? "Деактивировать" : "Активировать"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card stack">
          <div className="eyebrow">Недавние приглашения</div>
          {invites.slice(0, 8).map((invite) => (
            <div key={invite.id} className="card" style={{ padding: 16 }}>
              <div className="stack" style={{ gap: 6 }}>
                <div className="button-row" style={{ justifyContent: "space-between" }}>
                  <strong>{invite.email}</strong>
                  <span className="pill">{invite.role === "admin" ? "Администратор" : "Тренер"}</span>
                </div>
                <span className="subtle">{invite.organizationName}</span>
                <div className="button-row">
                  <span className={`status-pill ${invite.status === "pending" ? "active" : invite.status === "accepted" ? "completed" : "locked"}`}>
                    {invite.status === "pending" ? "ожидает" : invite.status === "accepted" ? "принято" : "отозвано"}
                  </span>
                  <span className="pill">истекает {new Date(invite.expiresAt).toLocaleDateString()}</span>
                </div>
                {invite.status === "pending" ? (
                  <div className="button-row">
                    <button className="button-secondary" type="button" onClick={() => handleCopyInvite(invite)}>
                      Скопировать ссылку
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          <div className="eyebrow" style={{ marginTop: 20 }}>История изменений</div>
          {planEvents.slice(0, 8).map((event) => (
            <div key={event.id} className="card" style={{ padding: 16 }}>
              <div className="button-row" style={{ justifyContent: "space-between" }}>
                <strong>{event.fromPlanKey ? `${event.fromPlanKey} -> ${event.toPlanKey}` : `первичная настройка: ${event.toPlanKey}`}</strong>
                <span className="subtle">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              {event.reason ? <div className="subtle">{event.reason}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
