/**
 * GET  /api/links   列出全部短網址
 * POST /api/links   建立短網址  { url, code? }
 */

// 去掉容易看錯的字元（0/O、1/l/I），方便口頭或手寫傳遞
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const MAX_URL_LENGTH = 2048;
const MAX_META_URL_BYTES = 700; // KV metadata 上限 1024 bytes，留餘裕

const RESERVED = new Set([
  'api', 'assets', 'index.html', '404.html', 'favicon.ico', 'favicon.svg', 'robots.txt',
]);

const enc = new TextEncoder();
const bad = (message, status = 400) => Response.json({ error: message }, { status });

/** 無偏差取樣：捨棄會造成餘數不均的位元組 */
function randomCode(length = CODE_LENGTH) {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = '';
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

function normalizeTarget(raw, selfHost) {
  if (typeof raw !== 'string' || raw.length > MAX_URL_LENGTH) return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;
  // 指回自己會造成無限轉址
  if (url.host.toLowerCase() === selfHost.toLowerCase()) return null;
  return url.href;
}

function buildMetadata(url) {
  const meta = { t: Date.now() };
  if (enc.encode(url).length <= MAX_META_URL_BYTES) meta.u = url;
  return meta;
}

export async function onRequestGet({ env }) {
  const links = [];
  let cursor;

  // KV list 依 key 名稱排序，要拿到「最新的」就得全部取回再排序。
  // 每頁最多 1000 筆，個人用途通常一次就取完（= 1 次 list 操作）。
  for (let page = 0; page < 5; page++) {
    const result = await env.LINKS.list({ limit: 1000, cursor });
    for (const key of result.keys) {
      links.push({
        code: key.name,
        url: key.metadata?.u || '',
        createdAt: key.metadata?.t || 0,
      });
    }
    if (result.list_complete) break;
    cursor = result.cursor;
  }

  links.sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({ links: links.slice(0, 500) });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad('請求格式不正確');
  }

  const selfHost = new URL(request.url).host;
  const url = normalizeTarget(body?.url, selfHost);
  if (!url) return bad('請提供有效的 http/https 網址');

  const metadata = buildMetadata(url);

  // ── 自訂短碼 ──
  if (body?.code != null && String(body.code).trim() !== '') {
    const code = String(body.code).trim();
    if (!/^[A-Za-z0-9_-]{1,48}$/.test(code)) {
      return bad('短碼只能使用英數字、連字號與底線（最多 48 字）');
    }
    if (RESERVED.has(code.toLowerCase()) || code.startsWith('_') || code.startsWith('.')) {
      return bad('這個短碼是保留字，請換一個');
    }
    if (await env.LINKS.get(code)) {
      return bad('這個短碼已經被使用了', 409);
    }
    await env.LINKS.put(code, url, { metadata });
    return Response.json({ code, url, createdAt: metadata.t }, { status: 201 });
  }

  // ── 自動產生 ──
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    if (await env.LINKS.get(code)) continue;
    await env.LINKS.put(code, url, { metadata });
    return Response.json({ code, url, createdAt: metadata.t }, { status: 201 });
  }

  return bad('產生短碼失敗，請再試一次', 503);
}
