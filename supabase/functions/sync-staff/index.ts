// Supabase Edge Function: keeps the website's staff list matched to two
// Microsoft 365 security groups, so staff are managed in one place.
//
//   "Sky's Path Admins"  -> role admin   (everything, including Settings)
//   "Sky's Path Support" -> role support (everything except Settings)
//
// Each run asks Microsoft Graph who is in each group (nested groups count)
// and then:
//   * someone in a group with no website account gets one, so their first
//     "Sign in with Microsoft" works;
//   * someone whose group changed gets the new role (Admins wins if they
//     are in both);
//   * someone removed from both groups, or whose Microsoft sign-in is
//     blocked, loses their public.staff row. Every admin database policy
//     checks that row, so access ends on their next request.
//
// It never deletes a login account and never changes anything in
// Microsoft 365. If Microsoft doesn't answer, or the answer would leave the
// site with no Admin at all, nothing is changed and the problem is recorded
// in public.staff_sync_state (shown on Admin -> Settings).
//
// Called once a minute by the database (see
// supabase/migrations/20261114010000_staff_sync_schedule.sql) and by the
// Staff Login page just before it hands off to Microsoft, so a person added
// to a group seconds ago can sign in straight away. It takes no input and
// reports nothing about who is staff, so it is safe to call with the public
// key; runs closer together than MIN_GAP_MS are skipped.
//
// Microsoft side: the app registration "Sky's Path Website Admin Sign-in"
// needs the APPLICATION permissions GroupMember.Read.All and User.Read.All,
// with admin consent.
//
// Required secrets:
//   ENTRA_CLIENT_SECRET  a client secret of that app registration
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const TENANT_ID = "e8a5bf5d-5a62-447c-a4be-b11e051ad196";
const CLIENT_ID = "137eeb2e-e3e2-4f0c-b176-4b8773707354";

// Group object ids, not names: anyone in the tenant may be able to create a
// group with any name, but only these two count. Admins first, so it wins.
const GROUPS: { id: string; role: Role }[] = [
  { id: "454db29e-279c-4081-9fe1-4dced6ae030e", role: "admin" },
  { id: "a230e458-c075-466a-84e5-426906c1428c", role: "support" },
];

const STAFF_EMAIL_DOMAIN = "@skyspath.com";
const MIN_GAP_MS = 10_000;

type Role = "admin" | "support";

type GraphUser = {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string | null;
  accountEnabled: boolean | null;
};

type Wanted = { oid: string; email: string; name: string | null; role: Role };

type StaffRow = {
  user_id: string;
  entra_oid: string | null;
  email: string;
  display_name: string | null;
  role: Role;
  last_sign_in_at: string | null;
};

const ALLOWED_ORIGINS = new Set([
  "https://skyspath.com",
  "https://www.skyspath.com",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://skyspath.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function graphToken(secret: string): Promise<string> {
  const response = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: secret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Microsoft refused the sign-in for the sync (${response.status})`);
  }
  return (await response.json()).access_token as string;
}

async function groupMembers(token: string, groupId: string): Promise<GraphUser[]> {
  const members: GraphUser[] = [];
  let url: string | null =
    `https://graph.microsoft.com/v1.0/groups/${groupId}/transitiveMembers/microsoft.graph.user` +
    "?$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=999";
  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Microsoft could not list a staff group (${response.status})`);
    }
    const page = await response.json();
    members.push(...(page.value as GraphUser[]));
    url = page["@odata.nextLink"] ?? null;
  }
  return members;
}

// Who Microsoft 365 says is staff right now, keyed by their object id.
async function wantedStaff(secret: string): Promise<Map<string, Wanted>> {
  const token = await graphToken(secret);
  const wanted = new Map<string, Wanted>();
  for (const group of GROUPS) {
    for (const member of await groupMembers(token, group.id)) {
      // A missing accountEnabled means Microsoft didn't let us read it;
      // treat that as "can't tell" and fail the run rather than guess.
      if (member.accountEnabled === null || member.accountEnabled === undefined) {
        throw new Error("Microsoft did not say whether a staff account is enabled");
      }
      if (!member.accountEnabled) continue;
      const email = (member.mail ?? member.userPrincipalName ?? "").trim().toLowerCase();
      if (!email.endsWith(STAFF_EMAIL_DOMAIN)) continue;
      if (wanted.has(member.id)) continue; // already an Admin
      wanted.set(member.id, {
        oid: member.id,
        email,
        name: member.displayName,
        role: group.role,
      });
    }
  }
  return wanted;
}

Deno.serve(async (req) => {
  const headers = { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Claim this run. The update only lands if the last run is old enough, so
  // two calls arriving together can't both go on.
  const now = new Date();
  const { data: claimed, error: claimError } = await db
    .from("staff_sync_state")
    .update({ last_run_at: now.toISOString() })
    .eq("id", 1)
    .or(`last_run_at.is.null,last_run_at.lt.${new Date(now.getTime() - MIN_GAP_MS).toISOString()}`)
    .select("id");
  if (claimError) return json({ ok: false }, 500);
  if (!claimed?.length) return json({ ok: true, skipped: true });

  const fail = async (message: string) => {
    await db.from("staff_sync_state").update({ last_error: message }).eq("id", 1);
    return json({ ok: false }, 502);
  };

  const secret = Deno.env.get("ENTRA_CLIENT_SECRET");
  if (!secret) return await fail("The sync has no Microsoft client secret (ENTRA_CLIENT_SECRET).");

  let wanted: Map<string, Wanted>;
  try {
    wanted = await wantedStaff(secret);
  } catch (error) {
    return await fail(error instanceof Error ? error.message : "Microsoft did not answer.");
  }

  if (![...wanted.values()].some((person) => person.role === "admin")) {
    return await fail(
      "Microsoft 365 shows nobody in the Sky's Path Admins group, so nothing was changed."
    );
  }

  const { data: staffRows, error: staffError } = await db
    .from("staff")
    .select("user_id, entra_oid, email, display_name, role, last_sign_in_at");
  if (staffError) return await fail("Could not read the staff list.");
  const staff = (staffRows ?? []) as StaffRow[];

  const { data: accounts, error: accountsError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (accountsError) return await fail("Could not read the login accounts.");
  const accountByEmail = new Map(
    accounts.users.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u])
  );
  const accountById = new Map(accounts.users.map((u) => [u.id, u]));

  const keep = new Set<string>();
  const problems: string[] = [];

  for (const person of wanted.values()) {
    const row =
      staff.find((s) => s.entra_oid === person.oid) ??
      staff.find((s) => !s.entra_oid && s.email === person.email);

    let userId = row?.user_id ?? accountByEmail.get(person.email)?.id;

    if (!userId) {
      // email_confirm marks the address verified, which is what lets the
      // Microsoft sign-in attach to this account. No email is sent.
      const { data: created, error } = await db.auth.admin.createUser({
        email: person.email,
        email_confirm: true,
      });
      if (error || !created.user) {
        problems.push(`Could not create a login for ${person.email}.`);
        continue;
      }
      userId = created.user.id;
    } else if (row && row.email !== person.email) {
      // Their address changed in Microsoft 365; the login has to follow or
      // the next Microsoft sign-in won't find it.
      const { error } = await db.auth.admin.updateUserById(userId, {
        email: person.email,
        email_confirm: true,
      });
      if (error) {
        problems.push(`Could not move ${row.email} to ${person.email}.`);
        keep.add(userId);
        continue;
      }
    }

    keep.add(userId);
    const { error: upsertError } = await db.from("staff").upsert({
      user_id: userId,
      entra_oid: person.oid,
      email: person.email,
      display_name: person.name,
      role: person.role,
      last_sign_in_at: accountById.get(userId)?.last_sign_in_at ?? null,
      synced_at: now.toISOString(),
    });
    if (upsertError) problems.push(`Could not save ${person.email}.`);
  }

  const gone = staff.filter((s) => !keep.has(s.user_id)).map((s) => s.user_id);
  if (gone.length) {
    const { error } = await db.from("staff").delete().in("user_id", gone);
    if (error) problems.push("Could not remove people who left the staff groups.");
  }

  await db
    .from("staff_sync_state")
    .update({
      last_ok_at: problems.length ? undefined : now.toISOString(),
      last_error: problems.length ? problems.join(" ") : null,
    })
    .eq("id", 1);

  return json({ ok: problems.length === 0 }, problems.length ? 502 : 200);
});
