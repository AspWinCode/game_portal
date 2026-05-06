"use client";

import type { InvitePreviewPayload, OrganizationMembership, Role, SessionMePayload } from "@game-game/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  currentOrganizationId?: string;
  currentOrganizationName?: string;
  currentOrganizationSlug?: string;
  organizations: OrganizationMembership[];
  supportMode?: {
    impersonatedById: string;
    impersonatedByEmail: string;
    impersonatedByDisplayName: string;
  };
}

export interface AuthSessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  isCurrent: boolean;
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Auth request failed: ${response.status}`);
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}

export async function login(email: string, password: string) {
  return authJson<SessionMePayload>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export async function loginAs(role: Exclude<Role, "child">) {
  const credentials =
    role === "admin"
      ? { email: "admin@example.com", password: "admin123" }
      : { email: "trainer@example.com", password: "trainer123" };

  return login(credentials.email, credentials.password);
}

export async function logout() {
  return authJson<{ ok: true }>("/auth/logout", {
    method: "POST"
  });
}

export async function logoutAll() {
  return authJson<{ ok: true }>("/auth/logout-all", {
    method: "POST"
  });
}

export async function listSessions() {
  return authJson<AuthSessionInfo[]>("/auth/sessions", {
    method: "GET"
  });
}

export async function revokeSession(sessionId: string) {
  return authJson<{ ok: true }>(`/auth/sessions/${sessionId}`, {
    method: "DELETE"
  });
}

export async function changePassword(currentPassword: string, nextPassword: string) {
  return authJson<{ ok: true }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, nextPassword })
  });
}

export async function getMe() {
  return authJson<SessionMePayload>("/auth/me", {
    method: "GET"
  });
}

export async function startSupportMode(userId: string) {
  return authJson<SessionMePayload>(`/auth/support/login-as/${userId}`, {
    method: "POST"
  });
}

export async function exitSupportMode() {
  return authJson<SessionMePayload>("/auth/support/exit", {
    method: "POST"
  });
}

export async function switchOrganization(organizationId: string) {
  return authJson<SessionMePayload>("/auth/switch-organization", {
    method: "POST",
    body: JSON.stringify({ organizationId })
  });
}

export async function getInvitePreview(token: string) {
  return authJson<InvitePreviewPayload>(`/auth/invites/${token}`, {
    method: "GET"
  });
}

export async function acceptInvite(token: string, displayName: string, password: string) {
  return authJson(`/auth/accept-invite`, {
    method: "POST",
    body: JSON.stringify({ token, displayName, password })
  });
}
