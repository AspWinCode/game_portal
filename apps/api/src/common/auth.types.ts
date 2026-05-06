import type { OrganizationMembership, Role } from "@game-game/shared";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  currentOrganizationId?: string;
  currentOrganizationName?: string;
  currentOrganizationSlug?: string;
  organizations?: OrganizationMembership[];
  supportMode?: {
    impersonatedById: string;
    impersonatedByEmail: string;
    impersonatedByDisplayName: string;
  };
}

export interface AuthenticatedSession {
  id: string;
  token: string;
  expiresAt: string;
  user: AuthenticatedUser;
}

export interface AuthRequest {
  headers: Record<string, string | undefined>;
  ip?: string;
  method?: string;
  originalUrl?: string;
  requestId?: string;
  user?: AuthenticatedUser;
  session?: AuthenticatedSession;
}
