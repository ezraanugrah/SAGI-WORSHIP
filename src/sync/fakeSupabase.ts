/**
 * In-memory stand-in for the Supabase endpoints the song sync uses
 * (auth token + the songs table with the rules of supabase/songs-sync.sql).
 * Used only by unit and E2E tests.
 */
type Row = {
  id: string;
  data: unknown;
  version: number;
  deleted: boolean;
  updated_at: string;
};
export type FakeReply = { status: number; body: unknown };
export function createFakeSupabase(users: Record<string, string>) {
  const rows = new Map<string, Row>(),
    tokens = new Set<string>(),
    refresh = new Map<string, string>();
  let tick = 0,
    issued = 0;
  const stamp = () =>
    `2026-11-11T10:00:00.${String(++tick).padStart(6, "0")}+00:00`;
  const issue = (email: string, expiresIn = 3600) => {
    const access = `access-${++issued}`,
      next = `refresh-${issued}`;
    tokens.add(access);
    refresh.set(next, email);
    return {
      status: 200,
      body: {
        access_token: access,
        refresh_token: next,
        expires_in: expiresIn,
        user: { email },
      },
    };
  };
  const reply = (status: number, body: unknown = null): FakeReply => ({
    status,
    body,
  });
  function handle(
    url: string,
    method: string,
    headers: Record<string, string>,
    bodyText: string | null,
  ): FakeReply {
    const u = new URL(url),
      body = bodyText ? JSON.parse(bodyText) : null;
    if (u.pathname === "/auth/v1/token") {
      const grant = u.searchParams.get("grant_type");
      if (grant === "password") {
        // Same answers as Supabase Auth.
        if (fake.rateLimited)
          return reply(429, {
            code: 429,
            error_code: "over_request_rate_limit",
            msg: "Request rate limit reached",
          });
        if (users[body?.email] !== body?.password)
          return reply(400, {
            code: 400,
            error_code: "invalid_credentials",
            msg: "Invalid login credentials",
          });
        if (fake.unconfirmed.has(body.email))
          return reply(400, {
            code: 400,
            error_code: "email_not_confirmed",
            msg: "Email not confirmed",
          });
        return issue(body.email, fake.expiresIn);
      }
      if (grant === "refresh_token" && refresh.has(body?.refresh_token)) {
        const email = refresh.get(body.refresh_token)!;
        refresh.delete(body.refresh_token);
        fake.refreshes++;
        return issue(email);
      }
      return reply(400, { error: "invalid_grant" });
    }
    if (u.pathname !== "/rest/v1/songs") return reply(404);
    const auth = (headers.authorization ?? headers.Authorization ?? "").replace(
      /^Bearer /,
      "",
    );
    if (!tokens.has(auth)) return reply(401, { message: "JWT expired" });
    const eq = (name: string) =>
      u.searchParams.get(name)?.replace(/^eq\./, "") ?? null;
    if (method === "GET") {
      const since = u.searchParams.get("updated_at")?.replace(/^gte\./, "");
      const list = [...rows.values()]
        .filter((r) => !since || Date.parse(r.updated_at) >= Date.parse(since))
        .sort((a, b) =>
          a.updated_at === b.updated_at
            ? a.id.localeCompare(b.id)
            : a.updated_at.localeCompare(b.updated_at),
        );
      const offset = Number(u.searchParams.get("offset") ?? 0),
        limit = Number(u.searchParams.get("limit") ?? 1000);
      return reply(200, structuredClone(list.slice(offset, offset + limit)));
    }
    if (method === "POST") {
      if (rows.has(body.id)) return reply(409, { code: "23505" });
      if (body.version !== 1) return reply(400, { message: "version 1" });
      const row: Row = {
        id: body.id,
        data: body.data,
        version: 1,
        deleted: !!body.deleted,
        updated_at: stamp(),
      };
      rows.set(row.id, row);
      return reply(201, [structuredClone(row)]);
    }
    if (method === "PATCH") {
      const row = rows.get(eq("id") ?? "");
      if (!row || String(row.version) !== eq("version")) return reply(200, []);
      if (body.version !== row.version + 1)
        return reply(400, { message: "version must go up by one" });
      Object.assign(row, body, { updated_at: stamp() });
      return reply(200, [structuredClone(row)]);
    }
    return reply(405);
  }
  const fake = {
    rows,
    refreshes: 0,
    /** Lifetime of tokens issued at sign-in, in seconds. */
    expiresIn: 3600,
    /** Accounts created without "Auto Confirm User". */
    unconfirmed: new Set<string>(),
    /** Answer sign-ins with HTTP 429 (too many attempts). */
    rateLimited: false,
    handle,
    /** A fetch() bound to this fake server. */
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>).map(
          ([k, v]) => [k.toLowerCase(), v],
        ),
      );
      const r = handle(
        String(input),
        init?.method ?? "GET",
        headers,
        (init?.body as string | undefined) ?? null,
      );
      return new Response(r.body === null ? null : JSON.stringify(r.body), {
        status: r.status,
      });
    }) as typeof fetch,
  };
  return fake;
}
