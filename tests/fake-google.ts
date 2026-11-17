// Napodobený Google (token endpoint a události jednoho kalendáře) pro testy Kalendáře.
// Ověřuje tvar požadavků a chování Wiki, NE skutečné chování Googlu.

export const CALENDAR = "vzdelavani-test@group.calendar.google.com";
export const RECIPIENT = "prijemce.test@example.com";

export type Stored = Record<string, unknown> & { id: string; etag: string; status: string; recurrence?: string[] };
type Recorded = { method: string; url: URL; body: Record<string, unknown> | null; headers: Headers };

/** Napodobený Google: token endpoint a události jednoho kalendáře. */
export class FakeGoogle {
  events = new Map<string, Stored>();
  requests: Recorded[] = [];
  /** Odpovědi, které se vrátí místo běžného zpracování (výpadky, limity). */
  forced: Array<{ status: number; body?: unknown }> = [];
  refreshTokens = new Set<string>();
  accessTokens = new Set<string>();
  /** Účet, který Google při výměně kódu vrátí v ID tokenu (ověřený e-mail). */
  accountEmail = "Organizator.Test@example.com";
  private counter = 0;

  calls = (method: string, part = "/calendar/") => this.requests.filter((r) => r.method === method && r.url.pathname.includes(part));

  /** Pořadí poslední změny události (pro `syncToken`). */
  private changedAt = new Map<string, number>();
  /** Další čtení se `syncToken` vrátí 410 Gone (propadlý token). */
  expireSyncTokens = false;
  /** Velikost stránky výpisu změn místo `maxResults` (test stránkování). */
  pageSize: number | null = null;

  put(event: Partial<Stored> & { id: string }): Stored {
    const stored = { status: "confirmed", organizer: { email: CALENDAR, self: true }, ...event, etag: `"${++this.counter}"` } as Stored;
    this.events.set(event.id, stored);
    this.changedAt.set(event.id, this.counter);
    return stored;
  }

  /** Napodobí `events.list` se `syncToken` a stránkováním (`maxResults`, `pageToken` = posun). */
  private listChanges(url: URL) {
    const token = url.searchParams.get("syncToken");
    if (token && this.expireSyncTokens) return { status: 410, body: { error: { errors: [{ reason: "fullSyncRequired" }] } } };
    const since = token ? Number(token.replace("st-", "")) : 0;
    const all = [...this.events.values()].filter((e) => !e.recurrence && (this.changedAt.get(e.id) ?? 0) > since);
    // Úplná synchronizace bez showDeleted by zrušené nevracela; Wiki posílá showDeleted=true.
    const items = token || url.searchParams.get("showDeleted") === "true" ? all : all.filter((e) => e.status !== "cancelled");
    const size = this.pageSize ?? Number(url.searchParams.get("maxResults") ?? "250");
    const offset = Number(url.searchParams.get("pageToken") ?? "0");
    const page = items.slice(offset, offset + size);
    const more = offset + size < items.length;
    return { status: 200, body: { items: page, ...(more ? { nextPageToken: String(offset + size) } : { nextSyncToken: `st-${this.counter}` }) } };
  }

  issueAccessToken(): string {
    const token = `at-${++this.counter}`;
    this.accessTokens.add(token);
    return token;
  }

  fetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const raw = typeof init?.body === "string" ? init.body : null;
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    if (url.hostname === "oauth2.googleapis.com") {
      const form = new URLSearchParams(raw ?? "");
      this.requests.push({ method, url, body: Object.fromEntries(form), headers });
      if (url.pathname === "/revoke") {
        this.refreshTokens.delete(form.get("token") ?? "");
        return json(200, {});
      }
      if (form.get("grant_type") === "authorization_code") {
        if (form.get("code") !== "valid-code" || !form.get("code_verifier")) return json(400, { error: "invalid_grant" });
        const refresh = `rt-${++this.counter}`;
        this.refreshTokens.add(refresh);
        const claims = { email: this.accountEmail, email_verified: true, aud: form.get("client_id") };
        const idToken = `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.x`;
        return json(200, {
          access_token: this.issueAccessToken(),
          refresh_token: refresh,
          expires_in: 3600,
          scope: "openid email https://www.googleapis.com/auth/calendar.events",
          id_token: idToken,
        });
      }
      if (!this.refreshTokens.has(form.get("refresh_token") ?? "")) return json(400, { error: "invalid_grant" });
      return json(200, { access_token: this.issueAccessToken(), expires_in: 3600 });
    }

    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    this.requests.push({ method, url, body, headers });
    const forced = this.forced.shift();
    if (forced) return json(forced.status, forced.body ?? {});
    if (!this.accessTokens.has((headers.get("authorization") ?? "").replace("Bearer ", ""))) return json(401, {});

    const [, calendarId, eventId] = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(url.pathname) ?? [];
    if (decodeURIComponent(calendarId ?? "") !== CALENDAR) return json(404, {});

    if (method === "GET" && !eventId && !url.searchParams.has("timeMin")) {
      const { status, body: listed } = this.listChanges(url);
      return json(status, listed);
    }
    if (method === "GET" && !eventId) {
      const from = Date.parse(url.searchParams.get("timeMin")!);
      const to = Date.parse(url.searchParams.get("timeMax")!);
      const items = [...this.events.values()].filter((e) => {
        const start = Date.parse((e.start as { dateTime: string }).dateTime);
        // singleEvents=true: hlavní událost série se nevrací, jen její výskyty.
        return !e.recurrence && e.status !== "cancelled" && start >= from && start < to;
      });
      return json(200, { items });
    }
    if (method === "POST" && !eventId) {
      const id = String(body!.id);
      if (this.events.has(id)) return json(409, { error: { errors: [{ reason: "duplicate" }] } });
      return json(200, this.put({ ...body, id }));
    }
    const current = this.events.get(decodeURIComponent(eventId ?? ""));
    if (!current) return json(404, {});
    if (method === "GET") return json(200, current);
    if (method === "PATCH") {
      if (headers.get("if-match") && headers.get("if-match") !== current.etag) return json(412, {});
      return json(200, this.put({ ...current, ...body, id: current.id }));
    }
    return json(405, {});
  };
}
