/**
 * GET /:code — 轉址。這是唯一會被大量呼叫的 Function。
 * 靜態資源都已在 public/_routes.json 排除，不會進到這裡。
 */

export async function onRequest(context) {
  const { params, env, next } = context;
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  // cacheTtl 讓熱門短網址在邊緣快取，減少 KV 讀取
  const target = code ? await env.LINKS.get(code, { cacheTtl: 60 }) : null;

  if (!target) {
    // 交回給靜態資源伺服器 → public/404.html
    return next();
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      // 短快取：重複點擊不必再進 Function，刪除後最多 60 秒生效
      'Cache-Control': 'public, max-age=60',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
