"use client";

const STORAGE_KEY = "gg_child_attempts";

export interface ChildAttemptRecord {
  participantId: string;
  joinCode: string;
  jamTitle: string;
  completedAt: string;
  xpTotal: number;
  hintsOpenedCount: number;
  helpRequestsCount: number;
}

export function readChildAttemptHistory(): ChildAttemptRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ChildAttemptRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveChildAttempt(record: ChildAttemptRecord) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readChildAttemptHistory().filter(
    (item) => !(item.participantId === record.participantId && item.jamTitle === record.jamTitle)
  );
  const next = [record, ...current].slice(0, 8);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearChildAttemptHistory() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
