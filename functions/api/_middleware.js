/**
 * /api/* 的驗證中介層。
 * 只有這裡與 /:code 會用到 Workers 用量，靜態頁面完全不經過。
 */

const enc = new TextEncoder();

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

/** 先雜湊再比對，長度固定且為常數時間，避免用回應時間猜出通行碼 */
async function tokenMatches(given, expected) {
  if (!expected || !given) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.ADMIN_TOKEN) {
    return Response.json(
      { error: '伺服器尚未設定 ADMIN_TOKEN' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const header = request.headers.get('Authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!(await tokenMatches(given, env.ADMIN_TOKEN))) {
    return Response.json(
      { error: '通行碼不正確' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // next() 回傳的 headers 是唯讀的，要重新包一層才能改
  const upstream = await context.next();
  const response = new Response(upstream.body, upstream);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
