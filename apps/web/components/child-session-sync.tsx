"use client";

import { useEffect } from "react";

const STORAGE_KEY = "gg_child_session";

export interface ChildSessionState {
  participantId: string;
  joinCode: string;
  sessionTitle?: string;
  displayName?: string;
  avatar?: string;
}

export function saveChildSession(session: ChildSessionState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function readChildSession(): ChildSessionState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ChildSessionState;
  } catch {
    return null;
  }
}

export function clearChildSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function ChildSessionSync({ session }: { session: ChildSessionState }) {
  useEffect(() => {
    saveChildSession(session);
  }, [session]);

  return null;
}
