"use client";

import { useAuthed } from "@/lib/auth";
import Login from "@/components/Login";

// Gates the whole portal. Signed out -> only the login screen (nav/footer/dock,
// passed as children, are not rendered). Signed in -> the full app.
export default function AuthGate({ children }) {
  const authed = useAuthed();
  if (!authed) return <Login />;
  return <>{children}</>;
}
