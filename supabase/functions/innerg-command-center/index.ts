type Board = "energy" | "eco" | "ownyourweb" | "shopnasgfx";

type InputPayload = {
  id?: string;
  message?: string;
  board?: Board | "auto";
  priority?: "low" | "medium" | "high";
  due_at?: string | null;
  status?: "active" | "waiting" | "done" | "archived";
  source?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("CORS_ALLOW_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-command-center-token, x-telegram-bot-api-secret-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function env(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function clean(value: unknown, limit = 2000) {
  return String(value ?? "").trim().slice(0, limit);
}

function auth(req: Request, url: URL) {
  const expected = env("COMMAND_CENTER_TOKEN");
  const header = req.headers.get("x-command-center-token") || "";
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const query = url.searchParams.get("token") || "";
  return Boolean(expected && (header === expected || bearer === expected || query === expected));
}

function telegramAuth(req: Request) {
  const expected = env("COMMAND_CENTER_TELEGRAM_SECRET");
  return Boolean(expected && req.headers.get("x-telegram-bot-api-secret-token") === expected);
}

function supabaseHeaders(prefer = "") {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    ...(prefer ? { "Prefer": prefer } : {}),
  };
}

async function rest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${env("SUPABASE_URL")}${path}`, {
    ...init,
    headers: {
      ...supabaseHeaders(),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return data;
}

function routeBoard(message: string, manual?: string): Board {
  if (manual && manual !== "auto") return manual as Board;

  const text = message.toLowerCase();
  const explicit = text.match(/^\s*(energy|personal|eco|innerg|innerg intel|ownyourweb|own your web|shopnas|shopnasgfx|shop nas|nas graphics)\s*:/);
  if (explicit) {
    const key = explicit[1].replace(/\s+/g, "");
    if (key === "ownyourweb" || key === "ownyourweb") return "ownyourweb";
    if (key === "shopnas" || key === "shopnasgfx" || key === "shopnas" || key === "nasgraphics") return "shopnasgfx";
    if (key === "energy" || key === "personal") return "energy";
    if (key === "eco" || key === "innerg" || key === "innergintel") return "eco";
  }

  if (/(logo|brand|flyer|graphic|graphics|shopnas|nas graphics|paid already|design order|label)/.test(text)) return "shopnasgfx";
  if (/(website|landing page|domain|maintenance|ownyourweb|client site|stripe invoice|hosting)/.test(text)) return "ownyourweb";
  if (/(event|reminder|personal|workout|health|energy|relationship|calendar|habit)/.test(text)) return "energy";
  if (/(eco|ecosystem|skill|agent|automation|openclaw|innerg intel|innerg|framework|system)/.test(text)) return "eco";

  return "eco";
}

function titleFromMessage(message: string) {
  const stripped = message.replace(/^\s*(energy|personal|eco|innerg|innerg intel|ownyourweb|own your web|shopnas|shopnasgfx|shop nas|nas graphics)\s*:\s*/i, "");
  const firstLine = stripped.split("\n").find((line) => line.trim()) || stripped;
  return clean(firstLine, 120) || "Untitled update";
}

function bodyFromMessage(message: string) {
  return clean(message.replace(/^\s*(energy|personal|eco|innerg|innerg intel|ownyourweb|own your web|shopnas|shopnasgfx|shop nas|nas graphics)\s*:\s*/i, ""), 5000);
}

function inferType(message: string) {
  const text = message.toLowerCase();
  if (/(event|reminder|appointment|calendar)/.test(text)) return "event";
  if (/(new project|project|client|order|paid)/.test(text)) return "project";
  if (/(invoice|payment|stripe|paid)/.test(text)) return "finance";
  if (/(idea|build|system|skill|agent)/.test(text)) return "idea";
  return "update";
}

function parseTags(message: string) {
  return Array.from(message.matchAll(/#([a-z0-9_-]+)/gi)).map((match) => match[1].toLowerCase()).slice(0, 20);
}

async function listItems() {
  return await rest("/rest/v1/innerg_command_items?select=*&status=neq.archived&order=created_at.desc");
}

async function createItem(payload: InputPayload, rawPayload: unknown) {
  const message = clean(payload.message, 5000);
  if (!message) throw new Error("Message is required");

  const record = {
    board: routeBoard(message, payload.board),
    title: titleFromMessage(message),
    body: bodyFromMessage(message),
    raw_message: message,
    item_type: inferType(message),
    status: "active",
    priority: ["low", "medium", "high"].includes(payload.priority || "") ? payload.priority : "medium",
    due_at: payload.due_at || null,
    source: clean(payload.source, 40) || "dashboard",
    tags: parseTags(message),
    raw_payload: rawPayload,
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/innerg_command_items`, {
    method: "POST",
    headers: supabaseHeaders("return=representation"),
    body: JSON.stringify(record),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`insert_failed ${response.status}: ${text}`);
  return JSON.parse(text || "[]")[0] || null;
}

async function updateItem(payload: InputPayload) {
  const id = clean(payload.id, 80);
  if (!id) throw new Error("id is required");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.status) patch.status = payload.status;
  if (payload.priority) patch.priority = payload.priority;
  if (payload.due_at !== undefined) patch.due_at = payload.due_at || null;

  const response = await fetch(`${env("SUPABASE_URL")}/rest/v1/innerg_command_items?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: supabaseHeaders("return=representation"),
    body: JSON.stringify(patch),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`update_failed ${response.status}: ${text}`);
  return JSON.parse(text || "[]")[0] || null;
}

function extractTelegramMessage(update: Record<string, any>) {
  const message = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
  if (!message) return "";
  return clean(message.text || message.caption || "", 5000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (!env("SUPABASE_URL") || !env("SUPABASE_SERVICE_ROLE_KEY")) return jsonResponse({ ok: false, error: "Supabase env is not configured" }, 500);

  const url = new URL(req.url);
  const isTelegram = url.searchParams.get("source") === "telegram";

  try {
    if (req.method === "GET") {
      if (!auth(req, url)) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
      return jsonResponse({ ok: true, items: await listItems() });
    }

    if (req.method === "POST") {
      if (isTelegram) {
        if (!telegramAuth(req)) return jsonResponse({ ok: false, error: "Invalid Telegram secret" }, 401);
        const update = await req.json();
        const message = extractTelegramMessage(update);
        const item = await createItem({ message, board: "auto", priority: "medium", source: "telegram" }, update);
        return jsonResponse({ ok: true, item });
      }

      if (!auth(req, url)) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
      const payload = await req.json();
      const item = await createItem(payload, payload);
      return jsonResponse({ ok: true, item });
    }

    if (req.method === "PATCH") {
      if (!auth(req, url)) return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
      const payload = await req.json();
      const item = await updateItem(payload);
      return jsonResponse({ ok: true, item });
    }

    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
