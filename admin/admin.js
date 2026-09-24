// 관리자 대시보드: PIN으로 받은 토큰(12시간, 이 탭에만 저장)으로 통계·문의·지식 색인 API를 부른다.
// 방문자가 쓴 문의·질문은 textContent로만 그린다(HTML로 해석하지 않는다).
(function () {
  const API = window.SITE_API || 'https://seongjeok-feedback-api.smilepea.workers.dev';
  const KEY = 'adminToken';
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const num = n => Number(n || 0).toLocaleString('ko-KR');
  const PAGES = {
    '/': ['수행·지필', 'score'], '/target-score/': ['목표 점수', 'target'], '/rank/': ['석차등급', 'rank'], '/gpa/': ['학점', 'gpa'],
    '/gpa-converter/': ['GPA 환산', 'convert'], '/todayfood/': ['급식', 'food'], '/todayclass/': ['시간표', 'class'],
    '/blog/': ['가이드 목록'], '/faq/': ['FAQ'], '/guide/': ['사용법'], '/privacy/': ['개인정보처리방침']
  };
  const ROUTES = { rule: ['바로 계산', '#34C759'], faq: ['준비된 답', '#0A84FF'], ai: ['AI 답변', '#5E5CE6'], none: ['못 답함', '#FF9F0A'] };
  const KINDS = { bug: '오류 제보', idea: '기능 제안', etc: '기타' };
  const region = (() => { try { return new Intl.DisplayNames(['ko'], { type: 'region' }); } catch { return null; } })();
  const when = ts => new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  let token = null, days = 7, data = null, chatFilter = 'all', inqFilter = 'new', inquiries = [];
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (saved && saved.exp > Date.now()) token = saved.token;
  } catch {}

  function logout(message) {
    token = null;
    try { sessionStorage.removeItem(KEY); } catch {}
    $('dash').hidden = true;
    $('login').hidden = false;
    $('loginMsg').textContent = message || '';
    $('pin').value = '';
    $('pin').focus();
  }

  async function api(path, options = {}) {
    const headers = { Authorization: `Bearer ${token}` };
    if (options.body) headers['Content-Type'] = 'text/plain';
    const res = await fetch(`${API}${path}`, { ...options, headers });
    if (res.status === 401) { logout('시간이 지나 다시 로그인해야 해요.'); throw new Error('unauthorized'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `요청 실패 (${res.status})`);
    return body;
  }

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const pin = $('pin').value.trim();
    if (!pin) return;
    const btn = $('loginBtn');
    btn.disabled = true;
    $('loginMsg').textContent = '';
    try {
      const res = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ pin }) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        token = body.token;
        try { sessionStorage.setItem(KEY, JSON.stringify({ token, exp: body.exp })); } catch {}
        show();
      } else if (res.status === 429) {
        $('loginMsg').textContent = '여러 번 틀려서 15분 동안 잠겼어요. 잠시 뒤 다시 시도해 주세요.';
      } else if (res.status === 401) {
        $('loginMsg').textContent = body.left > 0 ? `비밀번호가 맞지 않아요. ${body.left}번 더 틀리면 15분 동안 잠겨요.` : '비밀번호가 맞지 않아 15분 동안 잠겼어요.';
        $('pin').select();
      } else {
        $('loginMsg').textContent = body.error || '서버에 연결하지 못했어요.';
      }
    } catch {
      $('loginMsg').textContent = '인터넷 연결을 확인해 주세요.';
    } finally {
      btn.disabled = false;
    }
  });

  // ── 그리기 ──
  function delta(now, before) {
    if (!before) return make('span', 'kpi-delta', now ? '이전 기간 기록 없음' : '');
    const change = Math.round((now - before) / before * 100);
    const label = days === 1 ? '어제보다' : '지난 기간보다';
    return make('span', `kpi-delta ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`, `${label} ${change > 0 ? '+' : ''}${change}%`);
  }

  function kpis() {
    const t = data.totals || {}, p = data.previous || {};
    const newInq = (data.inquiries.find(r => r.status === 'new') || {}).n || 0;
    const cards = [
      ['방문자', t.visitors, p.visitors], ['페이지뷰', t.views, p.views], ['계산 완료', t.calcs, p.calcs],
      ['AI 질문', t.chats, p.chats], ['새 문의', newInq]
    ];
    $('kpis').replaceChildren(...cards.map(([label, value, before], i) => {
      const card = make('div', 'kpi');
      card.append(make('span', 'kpi-label', label), make('span', 'kpi-value', num(value)));
      card.append(i === cards.length - 1 ? make('span', 'kpi-delta', '처리 전 문의 (기간과 상관없이)') : delta(value || 0, before || 0));
      return card;
    }));
  }

  // 날짜별 막대: 옅은 막대가 페이지뷰, 파란 막대가 방문자
  function chart() {
    const svg = $('chart');
    const W = 720, H = 220, L = 34, B = 24, T = 10;
    const series = [];
    const byDay = new Map(data.series.map(r => [r.day, r]));
    const count = Math.max(days, 14);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(Date.parse(`${data.today}T00:00:00Z`) - i * 86400000).toISOString().slice(0, 10);
      series.push({ day: d, ...(byDay.get(d) || { views: 0, visitors: 0 }) });
    }
    const max = Math.max(4, ...series.map(r => r.views || 0));
    const step = (W - L) / series.length, bar = Math.max(2, step * .62);
    const y = v => T + (H - B - T) * (1 - v / max);
    const parts = [];
    for (let k = 0; k <= 3; k++) {
      const v = Math.round(max * k / 3);
      parts.push(`<line class="grid-line" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`);
    }
    const every = Math.ceil(series.length / 8);
    series.forEach((r, i) => {
      const x = L + i * step + (step - bar) / 2;
      const [, m, d] = r.day.split('-').map(Number);
      parts.push(`<g><title>${m}월 ${d}일 · 방문자 ${num(r.visitors)} · 페이지뷰 ${num(r.views)}</title><rect class="bar-views" x="${x}" y="${y(r.views || 0)}" width="${bar}" height="${H - B - y(r.views || 0)}" rx="3"/><rect class="bar-visitors" x="${x + bar * .2}" y="${y(r.visitors || 0)}" width="${bar * .6}" height="${H - B - y(r.visitors || 0)}" rx="2"/></g>`);
      if (i % every === 0 || i === series.length - 1) parts.push(`<text class="axis" x="${x + bar / 2}" y="${H - 6}" text-anchor="middle">${m}/${d}</text>`);
    });
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = parts.join('');
    $('seriesRange').textContent = `최근 ${series.length}일`;
  }

  function rows(el, items, { name, icon, empty = '아직 기록이 없어요' }) {
    const max = Math.max(1, ...items.map(r => r.n));
    if (!items.length) return el.replaceChildren(make('p', 'empty', empty));
    el.replaceChildren(...items.map(r => {
      const row = make('div', 'row');
      const label = make('span', 'row-name');
      const app = icon?.(r);
      if (app) { const i = make('span', 'app-icon'); i.dataset.app = app; label.append(i); }
      label.append(document.createTextNode(name(r)));
      label.title = name(r);
      const bar = make('div', 'row-bar');
      const fill = make('span');
      fill.style.width = `${Math.round(r.n / max * 100)}%`;
      bar.append(fill);
      row.append(label, make('span', 'row-num', num(r.n)), bar);
      return row;
    }));
  }

  const pageName = path => PAGES[path]?.[0] || (path.startsWith('/blog/') ? `가이드 ${path.replace(/^\/blog\/|\/$/g, '')}` : path);

  function lists() {
    rows($('pages'), data.pages, { name: r => `${pageName(r.path)}  ·  ${r.path}`, icon: r => PAGES[r.path]?.[1] });
    rows($('tools'), data.tools, { name: r => pageName(r.path), icon: r => PAGES[r.path]?.[1], empty: '아직 계산 기록이 없어요' });
    rows($('refs'), data.refs, { name: r => r.ref, empty: '검색·링크로 들어온 기록이 없어요' });
    rows($('countries'), data.countries, { name: r => (r.country && region?.of(r.country)) || r.country || '알 수 없음' });
    const total = data.devices.reduce((a, r) => a + r.n, 0);
    const names = { mobile: '휴대폰', desktop: 'PC', tablet: '태블릿' };
    const colors = { mobile: 'var(--primary)', desktop: '#5E5CE6', tablet: '#FF9F0A' };
    const box = $('devices');
    if (!total) { box.replaceChildren(make('p', 'empty', '아직 기록이 없어요')); }
    else {
      const stack = make('div', 'stack');
      const legend = make('div', 'legend');
      data.devices.forEach(r => {
        const part = make('span');
        part.style.cssText = `width:${r.n / total * 100}%;background:${colors[r.device] || 'var(--ink-3)'}`;
        stack.append(part);
        const item = make('span');
        const dot = make('i');
        dot.style.background = colors[r.device] || 'var(--ink-3)';
        item.append(dot, `${names[r.device] || r.device} ${Math.round(r.n / total * 100)}%`);
        legend.append(item);
      });
      box.replaceChildren(stack, legend);
    }
    const hours = Array.from({ length: 24 }, (_, h) => (data.hours.find(r => r.hour === h) || {}).n || 0);
    const peak = Math.max(1, ...hours);
    $('hours').replaceChildren(...hours.map((n, h) => {
      const bar = make('span');
      bar.style.height = `${Math.max(2, n / peak * 100)}%`;
      bar.title = `${h}시 · ${num(n)}회`;
      return bar;
    }));
  }

  function chats() {
    const counts = Object.fromEntries(data.chatRoutes.map(r => [r.route, r.n]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    $('chatTotal').textContent = `${num(total)}개 질문`;
    const box = $('routes');
    if (!total) box.replaceChildren(make('p', 'empty', '아직 질문이 없어요'));
    else {
      const stack = make('div', 'stack');
      const legend = make('div', 'legend');
      for (const [route, [label, color]] of Object.entries(ROUTES)) {
        if (!counts[route]) continue;
        const part = make('span');
        part.style.cssText = `width:${counts[route] / total * 100}%;background:${color}`;
        stack.append(part);
        const item = make('span');
        const dot = make('i');
        dot.style.background = color;
        item.append(dot, `${label} ${num(counts[route])}`);
        legend.append(item);
      }
      box.replaceChildren(stack, legend);
    }
    const shown = data.chats.filter(c => chatFilter === 'all' || c.route === 'none');
    const list = $('chats');
    if (!shown.length) return list.replaceChildren(make('p', 'empty', chatFilter === 'none' ? '못 답한 질문이 없어요' : '아직 질문이 없어요'));
    list.replaceChildren(...shown.map(c => {
      const item = make('div', 'item');
      const head = make('div', 'item-head');
      head.append(make('span', `pill ${c.route === 'ai' ? 'ai' : ''}`, (ROUTES[c.route] || [c.route])[0]), make('span', '', when(c.ts)));
      item.append(head, make('div', 'item-body', c.q));
      const answer = String(c.a || '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
      if (answer) item.append(make('div', 'item-answer', answer.length > 220 ? `${answer.slice(0, 220)}…` : answer));
      return item;
    }));
  }

  function inquiryList() {
    const open = inquiries.filter(i => i.status === 'new').length;
    $('inqCount').textContent = `처리 전 ${num(open)} · 전체 ${num(inquiries.length)}`;
    const shown = inquiries.filter(i => inqFilter === 'all' || i.status === 'new');
    const list = $('inquiries');
    if (!shown.length) return list.replaceChildren(make('p', 'empty', inqFilter === 'new' ? '처리할 문의가 없어요' : '아직 문의가 없어요'));
    list.replaceChildren(...shown.map(q => {
      const item = make('div', 'item');
      const head = make('div', 'item-head');
      head.append(make('span', `pill ${q.kind === 'bug' ? 'bug' : ''}`, KINDS[q.kind] || q.kind), make('span', '', when(q.ts)));
      if (q.path && q.path !== '/') head.append(make('span', '', pageName(q.path)));
      if (q.status === 'done') head.append(make('span', 'pill done', '처리 완료'));
      const actions = make('div', 'item-actions');
      const toggle = make('button', '', q.status === 'done' ? '다시 열기' : '처리 완료');
      toggle.type = 'button';
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        try {
          await api(`/admin/inquiries/${q.id}`, { method: 'POST', body: JSON.stringify({ status: q.status === 'done' ? 'new' : 'done' }) });
          q.status = q.status === 'done' ? 'new' : 'done';
          inquiryList();
          kpisFromInquiries();
        } catch { toggle.disabled = false; }
      });
      // 지우기는 두 번 눌러야 한다(브라우저 확인 창 대신)
      const remove = make('button', 'danger', '삭제');
      remove.type = 'button';
      let armed = 0;
      remove.addEventListener('click', async () => {
        if (!armed) { remove.textContent = '한 번 더 누르면 삭제'; armed = setTimeout(() => { armed = 0; remove.textContent = '삭제'; }, 3000); return; }
        clearTimeout(armed);
        remove.disabled = true;
        try {
          await api(`/admin/inquiries/${q.id}`, { method: 'DELETE' });
          inquiries = inquiries.filter(i => i.id !== q.id);
          inquiryList();
          kpisFromInquiries();
        } catch { remove.disabled = false; }
      });
      actions.append(toggle, remove);
      head.append(actions);
      item.append(head, make('div', 'item-body', q.body));
      if (q.email) {
        const mail = make('a', '', q.email);
        mail.href = `mailto:${encodeURIComponent(q.email).replace(/%40/g, '@')}`;
        const line = make('div', 'item-head');
        line.append('답장: ', mail);
        item.append(line);
      }
      return item;
    }));
  }

  function kpisFromInquiries() {
    if (!data) return;
    const open = inquiries.filter(i => i.status === 'new').length;
    data.inquiries = [{ status: 'new', n: open }, { status: 'done', n: inquiries.length - open }];
    kpis();
  }

  async function kbInfo() {
    const info = $('kbInfo');
    let current = null;
    try { current = await (await fetch(`/assistant/kb.json?t=${Date.now()}`)).json(); } catch {}
    const kb = data?.kb;
    const parts = [];
    if (current) parts.push(`사이트 지식 ${num(current.docs.length)}개 (버전 ${current.v})`);
    parts.push(kb ? `의미 검색 색인 ${num(kb.count)}개 · ${when(kb.at)} (버전 ${kb.version || '?'})` : '의미 검색 색인이 아직 없어요');
    if (current && kb && current.v === kb.version) parts.push('최신 상태예요');
    else if (current) parts.push('새 버전을 색인해 주세요');
    info.textContent = parts.join(' · ');
    return current;
  }

  $('reindex').addEventListener('click', async () => {
    const btn = $('reindex');
    const bar = $('kbProgress');
    btn.disabled = true;
    bar.hidden = false;
    const fill = bar.querySelector('span');
    try {
      const kb = await (await fetch(`/assistant/kb.json?t=${Date.now()}`)).json();
      const docs = kb.docs;
      for (let i = 0; i < docs.length; i += 25) {
        await api('/admin/reindex', { method: 'POST', body: JSON.stringify({ items: docs.slice(i, i + 25) }) });
        fill.style.width = `${Math.round(Math.min(docs.length, i + 25) / docs.length * 100)}%`;
        $('kbInfo').textContent = `색인하는 중… ${Math.min(docs.length, i + 25)} / ${docs.length}`;
      }
      const done = await api('/admin/reindex', { method: 'POST', body: JSON.stringify({ finish: docs.map(d => d.id), version: kb.v }) });
      data.kb = { count: done.count, at: done.at, version: done.version };
      await kbInfo();
    } catch (error) {
      $('kbInfo').textContent = `색인하지 못했어요: ${error.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => { bar.hidden = true; fill.style.width = '0'; }, 800);
    }
  });

  async function load() {
    $('refresh').disabled = true;
    try {
      const [summary, inq] = await Promise.all([api(`/admin/summary?days=${days}`), api('/admin/inquiries')]);
      data = summary;
      inquiries = inq.items;
      kpis();
      chart();
      lists();
      chats();
      inquiryList();
      kbInfo();
    } catch (error) {
      if (error.message !== 'unauthorized') $('kbInfo').textContent = `불러오지 못했어요: ${error.message}`;
    } finally {
      $('refresh').disabled = false;
    }
  }

  function show() {
    $('login').hidden = true;
    $('dash').hidden = false;
    load();
  }

  $('period').addEventListener('click', event => {
    const b = event.target.closest('[data-days]');
    if (!b) return;
    days = Number(b.dataset.days);
    $('period').querySelectorAll('[data-days]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    load();
  });
  document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    chatFilter = b.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    chats();
  }));
  document.querySelectorAll('[data-inq]').forEach(b => b.addEventListener('click', () => {
    inqFilter = b.dataset.inq;
    document.querySelectorAll('[data-inq]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    inquiryList();
  }));
  $('refresh').addEventListener('click', load);
  $('logout').addEventListener('click', () => logout('로그아웃했어요.'));

  if (token) show();
  else $('pin').focus();
})();
