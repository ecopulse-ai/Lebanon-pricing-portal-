"use client";

// ─── Lightweight portal access gate ──────────────────────────────────────────
// Demo-grade auth: a username/password check held client-side with the session
// flag in localStorage (same pattern as the KSA / GCC portals). Not real
// security — it gates the UI for demos and stakeholder access, nothing more.

import { useCallback, useSyncExternalStore } from "react";

const KEY = "lpiu-auth";

// Accepted demo accounts. Change/extend as needed.
const ACCOUNTS = [
  { user: "minister", pass: "lebanon2026" },
];

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function readAuthed() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setAuthed(v) {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ }
  emit();
}

export function logout() {
  setAuthed(false);
}

export function checkCredentials(user, pass) {
  const u = (user || "").trim().toLowerCase();
  return ACCOUNTS.some((a) => a.user === u && a.pass === pass);
}

// Reactive auth flag — hydration-safe (server snapshot = signed out).
export function useAuthed() {
  const subscribe = useCallback((cb) => {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
  }, []);
  return useSyncExternalStore(subscribe, readAuthed, () => false);
}
