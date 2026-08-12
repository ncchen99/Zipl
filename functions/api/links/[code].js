/** DELETE /api/links/:code */

export async function onRequestDelete({ params, env }) {
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  if (!code) return Response.json({ error: '缺少短碼' }, { status: 400 });

  await env.LINKS.delete(code);
  return Response.json({ ok: true, code });
}
