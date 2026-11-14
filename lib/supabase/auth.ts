"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type SessionState = "loading" | "authenticated" | "anonymous";
// Decided by Microsoft 365 groups (Sky's Path Admins / Sky's Path Support)
// and copied into public.staff by the sync-staff function.
export type StaffRole = "admin" | "support";

// Set when a Microsoft sign-in worked but the person is in neither staff
// group, so the Staff Login page can say why they are back there.
export const NOT_STAFF_KEY = "admin_not_staff";

// Caps how long an admin stays signed in, independent of Supabase's normal
// token auto-refresh (which would otherwise keep a session alive
// indefinitely). Supabase has a native server-enforced version of this
// ("Time-box user sessions"), but it's gated behind the paid Pro plan; this
// is the client-side stand-in until/unless that's upgraded. It won't stop
// a stolen access token from being replayed directly against the API, but
// it does force the admin UI itself to re-authenticate after 8 hours.
const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
const SESSION_STARTED_KEY = "admin_session_started_at";
const RECHECK_INTERVAL_MS = 5 * 60 * 1000;

function isSessionExpired(): boolean {
  const startedAt = Number(localStorage.getItem(SESSION_STARTED_KEY));
  if (!startedAt) return false;
  return Date.now() - startedAt > SESSION_TIMEOUT_MS;
}

// Admins sign in with their Sky's Path Microsoft account, and Microsoft
// handles the second step (authenticator prompt) on its side. Microsoft is
// the only OAuth provider switched on in Supabase, so "this session was
// started by an OAuth sign-in" means "this session came through Microsoft".
// A session started any other way (an old password sign-in still sitting in
// a browser) is ended so the admin goes back through Microsoft.
async function startedWithMicrosoft(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return (data.currentAuthenticationMethods ?? []).some(
    (entry) => (typeof entry === "string" ? entry : entry.method) === "oauth"
  );
}

type Resolved = { state: SessionState; role: StaffRole | null };

const ANONYMOUS: Resolved = { state: "anonymous", role: null };

async function resolveState(session: Session | null): Promise<Resolved> {
  if (!session) {
    localStorage.removeItem(SESSION_STARTED_KEY);
    return ANONYMOUS;
  }

  if (!localStorage.getItem(SESSION_STARTED_KEY)) {
    localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
  }
  if (isSessionExpired() || !(await startedWithMicrosoft())) {
    localStorage.removeItem(SESSION_STARTED_KEY);
    await supabase.auth.signOut();
    return ANONYMOUS;
  }

  // A staff member can read exactly one row of public.staff: their own.
  // No row means Microsoft 365 no longer (or never did) list them in a
  // staff group. The database already refuses them everything; this just
  // makes the pages say so instead of showing empty screens.
  const { data: staff, error } = await supabase
    .from("staff")
    .select("role")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!error && !staff) {
    localStorage.removeItem(SESSION_STARTED_KEY);
    sessionStorage.setItem(NOT_STAFF_KEY, "1");
    await supabase.auth.signOut();
    return ANONYMOUS;
  }

  // If the lookup itself failed (a network blip), stay signed in at the
  // lower level rather than bounce a working admin to the login page.
  return { state: "authenticated", role: staff?.role ?? "support" };
}

export function useAdminSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<SessionState>("loading");
  const [role, setRole] = useState<StaffRole | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      const resolved = await resolveState(data.session);
      if (cancelled) return;
      setSession(resolved.state === "authenticated" ? data.session : null);
      setRole(resolved.role);
      setState(resolved.state);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // A fresh sign-in always restarts the 8-hour clock, even if a stale
      // timestamp from a previous session is still sitting in storage.
      if (event === "SIGNED_IN") {
        localStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
      }
      // Deferred a tick: supabase-js holds its auth lock while it runs this
      // callback, and resolveState calls back into supabase.auth.
      setTimeout(() => {
        resolveState(newSession).then((resolved) => {
          if (cancelled) return;
          setSession(resolved.state === "authenticated" ? newSession : null);
          setRole(resolved.role);
          setState(resolved.state);
        });
      }, 0);
    });

    // Catches a tab left open past the 8-hour mark, or left open after the
    // person was taken out of the staff groups (or moved between them),
    // with no other auth event to trigger a recheck. resolveState signs
    // them out itself when either is the case.
    const interval = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const resolved = await resolveState(data.session);
      if (cancelled || resolved.state !== "authenticated") return;
      setRole(resolved.role);
    }, RECHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { session, state, role };
}
