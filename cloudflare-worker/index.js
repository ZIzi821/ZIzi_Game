const SERVICE_NAME = "zizi-game-api";
const ALLOWED_ORIGINS = new Set([
  "https://zizi821.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);
const GAME_IDS = ["starfall", "sentinel", "chomp"];
const MAX_LEADERBOARD_LIMIT = 50;
const MAX_COMMENT_LIMIT = 100;

function corsHeaders(request, contentType = true) {
  const origin = request.headers.get("Origin") || "";
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://zizi821.github.io");
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  if (contentType) headers.set("Content-Type", "application/json; charset=utf-8");
  return headers;
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request)
  });
}

function normalizeLimit(value, fallback, max) {
  const number = Number.parseInt(value || "", 10);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(number, max);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanMessage(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

function publicLeaderboardRow(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    levelId: row.level_id || "",
    playerName: row.player_name,
    nickname: row.player_name,
    score: row.score,
    region: row.region || "global",
    source: row.source || "cloudflare",
    externalId: row.external_id || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicCommentRow(row) {
  return {
    id: row.id,
    playerName: row.player_name,
    nickname: row.player_name,
    message: row.message,
    region: row.region || "global",
    source: row.source || "cloudflare",
    externalId: row.external_id || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function readLeaderboard(env, gameId, levelId, limit) {
  const stmt = env.DB.prepare(
    "SELECT id, game_id, level_id, player_name, score, region, source, external_id, created_at, updated_at " +
    "FROM leaderboards " +
    "WHERE game_id = ? AND (? IS NULL OR level_id = ?) " +
    "ORDER BY score DESC, created_at ASC " +
    "LIMIT ?"
  ).bind(gameId, levelId || null, levelId || null, limit);
  const result = await stmt.all();
  return (result.results || []).map(publicLeaderboardRow);
}

async function handleGetLeaderboards(request, env, url) {
  const gameId = cleanText(url.searchParams.get("gameId"));
  const levelId = cleanText(url.searchParams.get("levelId"));
  const limit = normalizeLimit(url.searchParams.get("limit"), 10, MAX_LEADERBOARD_LIMIT);
  if (!gameId) return jsonResponse(request, { ok: false, error: "gameId is required" }, 400);
  const items = await readLeaderboard(env, gameId, levelId, limit);
  return jsonResponse(request, { ok: true, items });
}

async function handlePostLeaderboard(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(request, { ok: false, error: "Origin is not allowed" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse(request, { ok: false, error: "Invalid JSON body" }, 400);
  }

  const gameId = cleanText(body.gameId);
  const levelId = cleanText(body.levelId);
  const playerName = cleanText(body.playerName || body.nickname);
  const score = Number(body.score);
  const region = cleanText(body.region) || "global";
  const source = cleanText(body.source) || "cloudflare";
  const externalId = cleanText(body.externalId);

  if (!gameId) return jsonResponse(request, { ok: false, error: "gameId is required" }, 400);
  if (playerName.length < 1 || playerName.length > 24) {
    return jsonResponse(request, { ok: false, error: "playerName must be 1-24 characters" }, 400);
  }
  if (!Number.isInteger(score) || score < 0) {
    return jsonResponse(request, { ok: false, error: "score must be a non-negative integer" }, 400);
  }

  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    gameId,
    levelId,
    playerName,
    nickname: playerName,
    score,
    region,
    source,
    externalId,
    createdAt: now,
    updatedAt: now
  };

  await env.DB.prepare(
    "INSERT INTO leaderboards (id, game_id, level_id, player_name, score, region, source, external_id, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(item.id, gameId, levelId || null, playerName, score, region, source, externalId || null, now, now).run();

  return jsonResponse(request, { ok: true, item });
}

async function handleLeaderboardOverview(request, env, url) {
  const limit = normalizeLimit(url.searchParams.get("limit"), 5, MAX_LEADERBOARD_LIMIT);
  const entries = await Promise.all(GAME_IDS.map(async (gameId) => [gameId, await readLeaderboard(env, gameId, "", limit)]));
  return jsonResponse(request, { ok: true, items: Object.fromEntries(entries) });
}

async function handleGetComments(request, env, url) {
  const limit = normalizeLimit(url.searchParams.get("limit"), 50, MAX_COMMENT_LIMIT);
  const result = await env.DB.prepare(
    "SELECT id, player_name, message, region, source, external_id, created_at, updated_at " +
    "FROM comments " +
    "ORDER BY created_at DESC " +
    "LIMIT ?"
  ).bind(limit).all();
  return jsonResponse(request, { ok: true, items: (result.results || []).map(publicCommentRow) });
}

async function handlePostComment(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(request, { ok: false, error: "Origin is not allowed" }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse(request, { ok: false, error: "Invalid JSON body" }, 400);
  }

  const playerName = cleanText(body.playerName || body.nickname);
  const message = cleanMessage(body.message);
  const region = cleanText(body.region) || "global";
  const source = cleanText(body.source) || "cloudflare";
  const externalId = cleanText(body.externalId);

  if (playerName.length < 1 || playerName.length > 24) {
    return jsonResponse(request, { ok: false, error: "playerName must be 1-24 characters" }, 400);
  }
  if (message.length < 1 || message.length > 300) {
    return jsonResponse(request, { ok: false, error: "message must be 1-300 characters" }, 400);
  }

  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(),
    playerName,
    nickname: playerName,
    message,
    region,
    source,
    externalId,
    createdAt: now,
    updatedAt: now
  };

  await env.DB.prepare(
    "INSERT INTO comments (id, player_name, message, region, source, external_id, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(item.id, playerName, message, region, source, externalId || null, now, now).run();

  return jsonResponse(request, { ok: true, item });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, false) });
    }

    try {
      if (method === "GET" && url.pathname === "/health") {
        return jsonResponse(request, { ok: true, service: SERVICE_NAME });
      }
      if (!env.DB) {
        return jsonResponse(request, { ok: false, error: "D1 binding DB is not configured" }, 500);
      }
      if (method === "GET" && url.pathname === "/leaderboards") {
        return handleGetLeaderboards(request, env, url);
      }
      if (method === "POST" && url.pathname === "/leaderboards") {
        return handlePostLeaderboard(request, env);
      }
      if (method === "GET" && url.pathname === "/leaderboard-overview") {
        return handleLeaderboardOverview(request, env, url);
      }
      if (method === "GET" && url.pathname === "/comments") {
        return handleGetComments(request, env, url);
      }
      if (method === "POST" && url.pathname === "/comments") {
        return handlePostComment(request, env);
      }
      return jsonResponse(request, { ok: false, error: "Not found" }, 404);
    } catch (error) {
      console.error("[zizi-game-api] request failed", error);
      return jsonResponse(request, { ok: false, error: "Internal server error" }, 500);
    }
  }
};
