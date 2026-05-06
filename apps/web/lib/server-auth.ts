import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import type { OrganizationMembership, Role } from "@game-game/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export interface ServerSessionUser {
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

export async function getServerSessionUser() {
  const cookieHeader = await getServerCookieHeader();
  if (!cookieHeader) {
    return null;
  }

  const candidateUrls = [API_URL];
  if (API_URL.includes("localhost")) {
    candidateUrls.push(API_URL.replace("localhost", "127.0.0.1"));
  }

  for (const apiUrl of candidateUrls) {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, {
        method: "GET",
        cache: "no-store",
        headers: {
          cookie: cookieHeader
        }
      });

      if (!response.ok) {
        continue;
      }

      const json = (await response.json()) as {
        data: {
          user: ServerSessionUser;
          expiresAt: string;
        };
      };

      return json.data.user;
    } catch {
      continue;
    }
  }

  return null;
}

export async function getServerCookieHeader() {
  const requestHeaders = await headers();
  const rawCookieHeader = requestHeaders.get("cookie");
  if (rawCookieHeader?.trim()) {
    return rawCookieHeader;
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");

  if (!cookieHeader) {
    return null;
  }
  return cookieHeader;
}

export async function requireServerRole(
  role: Exclude<Role, "child"> | Exclude<Role, "child">[],
  fallbackPath: string
) {
  const user = await getServerSessionUser();
  const allowed = Array.isArray(role) ? role : [role];
  if (!user || !(allowed as Role[]).includes(user.role)) {
    redirect(fallbackPath as Route);
  }
  return user;
}
