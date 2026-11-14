"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAdminSession } from "@/lib/supabase/auth";
import type { CredentialExpiration, Staff, StaffSyncState } from "@/types/database";

const ROLE_LABELS: Record<Staff["role"], string> = { admin: "Admin", support: "Support" };

// The check runs every minute; several misses in a row means it is stuck.
const SYNC_STALE_MS = 10 * 60 * 1000;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// expires_on is a plain date; pin it to UTC so it doesn't shift a day in
// Mountain time.
function formatExpiry(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Whole days from today (the admin's own calendar day) to the expiry date.
function daysUntil(isoDate: string): number {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - today) / (24 * 60 * 60 * 1000));
}

// Same steps as the reminder emails: 30 days yellow, 15 orange, 5 red.
function expiryHighlight(daysLeft: number): string {
  if (daysLeft <= 5) return "border-red-300 bg-red-100 text-red-900";
  if (daysLeft <= 15) return "border-orange-300 bg-orange-100 text-orange-900";
  if (daysLeft <= 30) return "border-yellow-300 bg-yellow-100 text-yellow-900";
  return "border-transparent text-brand-charcoal";
}

function expiryText(isoDate: string, daysLeft: number): string {
  const date = formatExpiry(isoDate);
  if (daysLeft > 30) return `Expires ${date}`;
  if (daysLeft > 1) return `Expires ${date} (in ${daysLeft} days)`;
  if (daysLeft === 1) return `Expires ${date} (tomorrow)`;
  if (daysLeft === 0) return `Expires today`;
  return `Expired ${date}`;
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const { session, role } = useAdminSession();

  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<StaffSyncState | null>(null);
  const [syncStale, setSyncStale] = useState(false);
  const [expirations, setExpirations] = useState<CredentialExpiration[]>([]);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Settings is for Admins. The menu hides it from Support and the database
  // refuses them the data; this sends them back if they type the address.
  useEffect(() => {
    if (role === "support") router.replace("/admin/");
  }, [role, router]);

  useEffect(() => {
    if (role !== "admin") return;
    supabase
      .from("staff")
      .select("*")
      .order("role")
      .order("email")
      .then(({ data, error }) => {
        if (error) setStaffError("Could not load the staff list.");
        else setStaff(data ?? []);
      });
    supabase
      .from("staff_sync_state")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        setSyncState(data);
        setSyncStale(
          !!data &&
            (!data.last_ok_at || Date.now() - Date.parse(data.last_ok_at) > SYNC_STALE_MS)
        );
      });
    supabase
      .from("credential_expirations")
      .select("*")
      .order("expires_on")
      .then(({ data }) => setExpirations(data ?? []));
  }, [role]);

  async function handleSendTestReminder() {
    setTestResult(null);
    setTestBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "credential-expiry-reminder",
      { body: { test: true } }
    );
    setTestBusy(false);
    if (invokeError || !data || data.error || data.failed?.length) {
      setTestResult({ ok: false, text: "The test reminder could not be sent." });
      return;
    }
    setTestResult({ ok: true, text: `Test reminder sent to ${data.to}.` });
  }

  if (role !== "admin") return null;

  const syncProblem =
    syncState?.last_error ??
    (syncStale ? "The check against Microsoft 365 has not completed recently." : null);

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-brand-deep-blue">Settings</h1>

      <div className="mt-6 max-w-lg rounded-xl border border-brand-soft-blue/60 bg-brand-white p-6">
        <h2 className="font-heading text-lg font-semibold text-brand-deep-blue">Sign-in</h2>
        <p className="mt-3 text-sm text-brand-charcoal">
          Staff sign in with their Sky&rsquo;s Path Microsoft account. Passwords and the second
          sign-in step are managed by Microsoft, not on this site.
        </p>
        {expirations.length > 0 && (
          <div className="mt-4 border-t border-brand-soft-blue/40 pt-4">
            <h3 className="text-sm font-medium text-brand-charcoal">Renewal dates</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {expirations.map((item) => {
                const daysLeft = daysUntil(item.expires_on);
                return (
                  <li
                    key={item.id}
                    className={`flex flex-wrap justify-between gap-2 rounded-md border px-2 py-1 ${expiryHighlight(daysLeft)}`}
                  >
                    <span>{item.name}</span>
                    <span className={daysLeft <= 30 ? "font-semibold" : "text-brand-charcoal/70"}>
                      {expiryText(item.expires_on, daysLeft)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-brand-charcoal/60">
              Reminders with renewal steps are emailed to support@skyspath.com 30, 15 and 5 days
              before each date.{" "}
              <button
                type="button"
                onClick={handleSendTestReminder}
                disabled={testBusy}
                className="font-medium text-brand-purple hover:underline disabled:opacity-60"
              >
                {testBusy ? "Sending…" : "Send a test reminder"}
              </button>
            </p>
            {testResult && (
              <p
                role={testResult.ok ? "status" : "alert"}
                className={`mt-1 text-xs ${testResult.ok ? "text-green-700" : "text-red-700"}`}
              >
                {testResult.text}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 max-w-lg rounded-xl border border-brand-soft-blue/60 bg-brand-white p-6">
        <h2 className="font-heading text-lg font-semibold text-brand-deep-blue">Staff</h2>
        <p className="mt-3 text-sm text-brand-charcoal">
          Staff are managed in Microsoft 365, not on this site. Add a person to the{" "}
          <strong>Sky&rsquo;s Path Admins</strong> or <strong>Sky&rsquo;s Path Support</strong>{" "}
          group and they can sign in within a minute. Remove them from the group, or block their
          sign-in, and their access ends within a minute.
        </p>
        <p className="mt-2 text-sm text-brand-charcoal">
          Admins can do everything. Support can do everything except this Settings page.
        </p>

        {staffError && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {staffError}
          </p>
        )}

        {!staff ? (
          !staffError && <p className="mt-3 text-sm text-brand-charcoal/80">Loading…</p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-soft-blue/40">
            {staff.map((person) => (
              <li
                key={person.user_id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="text-brand-charcoal">
                  {person.display_name ?? person.email}
                  {person.user_id === session?.user.id && (
                    <span className="ml-1 text-xs text-brand-charcoal/60">(you)</span>
                  )}
                  {person.display_name && (
                    <span className="block text-xs text-brand-charcoal/60">{person.email}</span>
                  )}
                </span>
                <span className="text-xs text-brand-charcoal/60">
                  <span className="font-medium text-brand-charcoal">{ROLE_LABELS[person.role]}</span>{" "}
                  &middot; Last sign-in {formatDate(person.last_sign_in_at)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {syncProblem ? (
          <p role="alert" className="mt-4 text-xs text-red-700">
            {syncProblem} The list above is the last one confirmed
            {syncState?.last_ok_at ? ` (${formatDateTime(syncState.last_ok_at)})` : ""}.
          </p>
        ) : (
          syncState?.last_ok_at && (
            <p className="mt-4 text-xs text-brand-charcoal/60">
              Last checked against Microsoft 365: {formatDateTime(syncState.last_ok_at)}
            </p>
          )
        )}
      </div>
    </div>
  );
}
