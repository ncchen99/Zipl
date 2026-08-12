/* zipl — 前端邏輯（純靜態，由 Cloudflare Pages CDN 提供，不佔用 Workers 用量） */
'use strict';

const TOKEN_KEY = 'zipl.token';

const $ = (id) => document.getElementById(id);

const el = {
  gate: $('gate'), gateForm: $('gate-form'), pass: $('pass'), gateError: $('gate-error'),
  app: $('app'), lock: $('lock'),
  form: $('shorten'), url: $('url'), code: $('code'), go: $('go'), error: $('error'),
  customToggle: $('custom-toggle'), customWrap: $('custom-wrap'), originHint: $('origin-hint'),
  result: $('result'), resultFlag: $('result-flag'), resultUrl: $('result-url'),
  resultSrc: $('result-src'), resultCopy: $('result-copy'), resultOpen: $('result-open'),
  list: $('list'), listEmpty: $('list-empty'), listError: $('list-error'), count: $('count'),
  toast: $('toast'), rowTpl: $('row-tpl'),
};

let token = localStorage.getItem(TOKEN_KEY) || '';
let links = [];
let lastCreated = '';

/* ── 工具 ─────────────────────────────────────────────── */

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2000);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Safari / 非安全情境的退路
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function showError(node, msg) {
  node.textContent = msg;
  node.hidden = !msg;
}

/** 補上 https://、驗證格式，回傳正規化網址；不合法回傳 null */
function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) return null; // javascript:、mailto: 等一律擋掉
    s = 'https://' + s;
  }
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
  return u.href;
}

function prettyUrl(u) {
  try {
    const p = new URL(u);
    const rest = p.pathname === '/' ? '' : p.pathname;
    return p.host + rest + p.search;
  } catch { return u; }
}

const shortUrlFor = (code) => location.origin + '/' + code;

/* ── API ──────────────────────────────────────────────── */

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: 'Bearer ' + token,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    lockUp();
    throw new Error('通行碼無效，請重新解鎖。');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `發生錯誤（${res.status}）`);
  return data;
}

/* ── 鎖定狀態 ─────────────────────────────────────────── */

function lockUp() {
  token = '';
  localStorage.removeItem(TOKEN_KEY);
  el.app.hidden = true;
  el.lock.hidden = true;
  el.gate.hidden = false;
  el.pass.value = '';
  el.pass.focus();
}

function unlock() {
  el.gate.hidden = true;
  el.app.hidden = false;
  el.lock.hidden = false;
  el.url.focus();
}

/* ── 清單 ─────────────────────────────────────────────── */

function renderList() {
  el.list.textContent = '';
  el.listEmpty.hidden = links.length > 0;
  el.count.textContent = links.length ? `${links.length} 筆` : '';

  for (const link of links) {
    const node = el.rowTpl.content.firstElementChild.cloneNode(true);
    const main = node.querySelector('.item-main');
    const del = node.querySelector('.item-del');

    node.querySelector('.item-code').textContent = '/' + link.code;
    node.querySelector('.item-url').textContent = link.url ? prettyUrl(link.url) : '（網址過長，未顯示）';
    main.title = link.url || '';
    del.setAttribute('aria-label', `刪除 /${link.code}`);

    main.addEventListener('click', async () => {
      const ok = await copy(shortUrlFor(link.code));
      toast(ok ? `已複製 /${link.code}` : '複製失敗，請手動選取');
    });

    let armed = false, armTimer;
    del.addEventListener('click', async () => {
      if (!armed) {
        armed = true;
        del.classList.add('confirm');
        del.textContent = '確定刪除';
        node.classList.add('pending-del');
        armTimer = setTimeout(() => {
          armed = false;
          del.classList.remove('confirm');
          del.textContent = '';
          del.appendChild(delIcon());
          node.classList.remove('pending-del');
        }, 6000);
        return;
      }
      clearTimeout(armTimer);
      del.disabled = true;
      try {
        await api('/api/links/' + encodeURIComponent(link.code), { method: 'DELETE' });
        links = links.filter((l) => l.code !== link.code);
        if (lastCreated === link.code) el.result.hidden = true;
        renderList();
        toast(`已刪除 /${link.code}`);
      } catch (err) {
        del.disabled = false;
        showError(el.listError, err.message);
      }
    });

    el.list.appendChild(node);
  }
}

function delIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3');
  svg.appendChild(path);
  return svg;
}

async function loadList() {
  showError(el.listError, '');
  try {
    const data = await api('/api/links');
    links = data.links || [];
    renderList();
  } catch (err) {
    if (token) showError(el.listError, err.message);
  }
}

/* ── 結果卡 ───────────────────────────────────────────── */

function showResult(link, copied) {
  const short = shortUrlFor(link.code);
  lastCreated = link.code;
  el.resultFlag.textContent = copied ? '已複製到剪貼簿' : '短網址已建立';
  el.resultUrl.textContent = short.replace(/^https?:\/\//, '');
  el.resultUrl.href = short;
  el.resultOpen.href = short;
  el.resultSrc.textContent = link.url ? '→ ' + prettyUrl(link.url) : '';
  el.result.hidden = false;
}

/* ── 事件 ─────────────────────────────────────────────── */

el.gateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(el.gateError, '');
  const value = el.pass.value.trim();
  if (!value) return;

  const btn = el.gateForm.querySelector('.primary');
  btn.disabled = true;
  try {
    // 直接驗證，不經過 api()（它在 401 時會重設畫面）
    const res = await fetch('/api/links', { headers: { Authorization: 'Bearer ' + value } });
    if (res.status === 401) {
      showError(el.gateError, '通行碼不正確。');
      el.pass.select();
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `發生錯誤（${res.status}）`);

    token = value;
    localStorage.setItem(TOKEN_KEY, token);
    links = data.links || [];
    renderList();
    unlock();
  } catch (err) {
    showError(el.gateError, err.message);
  } finally {
    btn.disabled = false;
  }
});

el.pass.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  el.gateForm.requestSubmit();
});

el.lock.addEventListener('click', () => {
  links = [];
  el.result.hidden = true;
  renderList();
  lockUp();
});

el.customToggle.addEventListener('click', () => {
  const open = el.customWrap.hidden;
  el.customWrap.hidden = !open;
  el.customToggle.setAttribute('aria-expanded', String(open));
  if (open) el.code.focus(); else el.code.value = '';
});

el.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError(el.error, '');

  const url = normalizeUrl(el.url.value);
  if (!url) {
    showError(el.error, '請輸入有效的網址，例如 example.com/article');
    el.url.focus();
    return;
  }

  const custom = el.code.value.trim();
  if (custom && !/^[A-Za-z0-9_-]{1,48}$/.test(custom)) {
    showError(el.error, '自訂短碼只能使用英數字、連字號與底線。');
    el.code.focus();
    return;
  }

  el.go.setAttribute('aria-busy', 'true');
  el.go.disabled = true;
  try {
    const link = await api('/api/links', {
      method: 'POST',
      body: JSON.stringify(custom ? { url, code: custom } : { url }),
    });
    const copied = await copy(shortUrlFor(link.code));

    links.unshift(link);
    renderList();
    showResult(link, copied);

    el.url.value = '';
    el.code.value = '';
    el.customWrap.hidden = true;
    el.customToggle.setAttribute('aria-expanded', 'false');
    el.url.focus();
  } catch (err) {
    showError(el.error, err.message);
  } finally {
    el.go.removeAttribute('aria-busy');
    el.go.disabled = false;
  }
});

el.resultCopy.addEventListener('click', async () => {
  const ok = await copy(el.resultUrl.href);
  toast(ok ? '已複製' : '複製失敗，請手動選取');
});

// Enter 送出。不依賴瀏覽器的隱式送出（表單有多個欄位時行為不一致）
for (const field of [el.url, el.code]) {
  field.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    el.form.requestSubmit();
  });
}

// 貼進空白輸入框就立即送出，省一次按鍵（想自訂短碼時不觸發）
el.url.addEventListener('paste', () => {
  const wasEmpty = el.url.value === '';
  setTimeout(() => {
    if (wasEmpty && el.customWrap.hidden && normalizeUrl(el.url.value)) {
      el.form.requestSubmit();
    }
  }, 0);
});

// 「/」快速聚焦輸入框
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (el.app.hidden) return;
  e.preventDefault();
  el.url.focus();
});

/* ── 啟動 ─────────────────────────────────────────────── */

el.originHint.textContent = location.host + '/';

if (token) {
  unlock();
  loadList();
} else {
  el.gate.hidden = false;
  el.pass.focus();
}

/* ── Service Worker 註冊 (PWA 支援) ────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker 註冊失敗:', err);
    });
  });
}

