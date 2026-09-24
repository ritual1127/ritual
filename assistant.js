// AI 도우미·문의하기: PC는 화면 왼쪽 아래 유리 도크, 휴대폰은 도구 메뉴 맨 아래 두 줄. 누르면 대화·문의 패널이 열린다.
// 답은 3단계로 찾는다: ① 규칙(계산·급식·시간표, 즉시) ② 준비된 문답(키워드 검색, 즉시) ③ AI(서버, 글자가 흘러나오듯 스트리밍).
// 엔진(assistant-core.js)·계산(calc-core.js)·지식(assistant/kb.json)은 패널을 처음 열 때만 불러온다.
(function () {
  if (location.pathname.startsWith('/admin')) return;
  const V = '20260924f';
  const API = window.SITE_API || 'https://seongjeok-feedback-api.smilepea.workers.dev';
  const STORE = 'assistChat';
  const SUGGEST = ['200명 중 15등이면 몇 등급?', '5등급제 등급 비율 알려줘', '내일 급식 뭐야?', '기말에서 몇 점 받아야 A야?'];
  const PLACES = {
    '/': '성적 계산기', '/target-score/': '목표 점수 계산기', '/rank/': '석차등급 계산기', '/gpa/': '학점 계산기',
    '/gpa-converter/': 'GPA 환산기', '/todayfood/': '오늘의 급식', '/todayclass/': '오늘의 시간표', '/blog/': '계산법 가이드',
    '/faq/': 'FAQ', '/guide/': '사용법 안내', '/privacy/': '개인정보처리방침'
  };
  const ICON = {
    send: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>',
    stop: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/></svg>',
    close: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    fresh: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.2L15.6 5.4a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.2 18.8z"/><path d="M13.5 7.5l3 3"/></svg>',
    chevron: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (className, html, label) => {
    const node = make('button', className);
    node.type = 'button';
    node.innerHTML = html;
    if (label) node.setAttribute('aria-label', label);
    return node;
  };
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const load = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${src}?v=${V}`;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });

  // ── 엔진 준비(처음 열 때 한 번) ──
  let engine = null;
  const pageTitles = new Map(); // 경로 → 페이지 제목(출처 칩 이름)
  const placeName = (u, fallback) => PLACES[u] || pageTitles.get(u) || fallback;
  function ready() {
    if (!engine) {
      engine = (async () => {
        await Promise.all([
          typeof window.rankPercentile === 'function' ? null : load('/calc-core.js'),
          window.AssistantCore ? null : load('/assistant-core.js')
        ]);
        const kb = await (await fetch(`/assistant/kb.json?v=${V}`)).json();
        for (const d of kb.docs) if (d.k === 'doc' && d.u && !pageTitles.has(d.u)) pageTitles.set(d.u, d.t.split(' · ')[0]);
        return { A: window.AssistantCore, index: window.AssistantCore.buildIndex(kb.docs) };
      })();
      engine.catch(() => { engine = null; });
    }
    return engine;
  }

  // ── 대화 기록(이 탭에만, 페이지를 옮겨도 이어진다) ──
  let messages = [];
  try { messages = JSON.parse(sessionStorage.getItem(STORE) || '[]'); } catch {}
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30))); } catch {} };

  // ── 답 글자: **굵게**, - 목록, [글](/경로), 사이트 경로만 링크로 만든다(HTML은 해석하지 않는다) ──
  const PATH = /\/(?:target-score|rank|gpa-converter|gpa|todayfood|todayclass|faq|guide|privacy|blog(?:\/[a-z-]+)?)\//;
  function inline(parent, text) {
    const re = new RegExp(String.raw`\*\*(.+?)\*\*|\[([^\]]+)\]\((\/(?!\/)[\w\-/#]*)\)|(` + PATH.source + ')', 'g');
    let last = 0, m;
    while ((m = re.exec(text))) {
      parent.append(text.slice(last, m.index));
      if (m[1]) parent.append(make('strong', '', m[1]));
      else {
        const a = make('a', '', m[2] || PLACES[m[4]] || m[4]);
        a.href = m[3] || m[4];
        parent.append(a);
      }
      last = re.lastIndex;
    }
    parent.append(text.slice(last));
  }
  function rich(el, text) {
    el.replaceChildren();
    let list = null;
    for (const raw of String(text).split('\n')) {
      const line = raw.trim();
      const item = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)/);
      if (item) {
        if (!list) { list = make(/^\d/.test(line) ? 'ol' : 'ul'); el.append(list); }
        const li = make('li');
        inline(li, item[1]);
        list.append(li);
        continue;
      }
      list = null;
      if (!line) continue;
      const p = make('p');
      inline(p, line.replace(/^#+\s*/, ''));
      el.append(p);
    }
  }

  // ── 화면 ──
  let panel = null, log = null, input = null, sendBtn = null, dock = null, controller = null, busy = false;
  const ROUTE_TAG = { rule: '바로 계산', faq: '준비된 답', ai: 'AI 답변 · 틀릴 수 있어요', none: '관련 자료' };

  function bubble(msg, animate) {
    const row = make('div', `assist-msg is-${msg.role}`);
    const body = make('div', 'assist-bubble');
    if (msg.role === 'user') body.textContent = msg.text;
    else rich(body, msg.text);
    row.append(body);
    if (msg.role === 'bot') {
      const foot = make('div', 'assist-foot');
      if (msg.route) foot.append(make('span', `assist-tag is-${msg.route}`, ROUTE_TAG[msg.route] || ''));
      for (const s of (msg.sources || []).filter(s => /^\/(?!\/)/.test(s.u))) {
        const a = make('a', 'assist-src', placeName(s.u, s.t.split(' · ').pop()));
        a.href = s.u;
        foot.append(a);
      }
      if (msg.route === 'faq' && msg.q) {
        const more = button('assist-more', 'AI에게 더 물어보기');
        more.addEventListener('click', () => { more.remove(); ask(msg.q, { skipLocal: true }); });
        foot.append(more);
      }
      if (msg.offerContact) {
        const go = button('assist-more', '문의하기로 보내기');
        go.addEventListener('click', () => { switchView('contact'); panel.querySelector('.assist-contact textarea').value = msg.offerContact; });
        foot.append(go);
      }
      if (foot.childNodes.length) row.append(foot);
    }
    if (animate && !reduceMotion()) row.classList.add('is-new');
    log.append(row);
    return row;
  }

  function greet() {
    const row = bubble({ role: 'bot', text: '안녕하세요! 성적 계산, 내신 등급, 수행평가, 수능·대입, 공부법, 급식·시간표까지 물어보세요.' });
    const chips = make('div', 'assist-chips');
    for (const q of SUGGEST) {
      const chip = button('assist-chip', '');
      chip.textContent = q;
      chip.addEventListener('click', () => ask(q));
      chips.append(chip);
    }
    row.append(chips);
  }

  function renderLog() {
    log.replaceChildren();
    greet();
    messages.forEach(m => bubble(m));
    log.scrollTop = log.scrollHeight;
  }

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function setBusy(on) {
    busy = on;
    sendBtn.innerHTML = on ? ICON.stop : ICON.send;
    sendBtn.setAttribute('aria-label', on ? '답변 멈추기' : '보내기');
    sendBtn.classList.toggle('is-stop', on);
  }

  function push(msg) {
    messages.push(msg);
    save();
    const row = bubble(msg, true);
    scrollDown();
    return row;
  }

  // 로컬 답(규칙·문답)도 관리자 통계에 질문으로 남긴다.
  const logLocal = (q, route, a) => window.track?.({ type: 'chat', q, route, a: String(a).slice(0, 300) });

  // ── ① 규칙 ──
  async function neis() {
    if (typeof window.fetchNeisMeal !== 'function') await load('/neis-common.js');
  }
  async function ruleAnswer(A, q) {
    const it = A.intent(q);
    if (!it) return null;
    if (it.kind === 'rank') return { text: A.rankReply(it), sources: [{ t: '석차등급 계산기', u: '/rank/' }] };
    if (it.kind === 'percent') return { text: A.percentReply(it), sources: [{ t: '석차등급 계산기', u: '/rank/' }] };
    if (it.kind === 'score') return { text: A.scoreReply(it), sources: [{ t: '목표 점수 계산기', u: '/target-score/' }] };
    if (it.kind === 'gpa') return { text: A.gpaReply(it), sources: [{ t: 'GPA 환산기', u: '/gpa-converter/' }] };
    if (it.kind === 'hello') return { text: '안녕하세요! 궁금한 성적 계산이나 학교생활 질문을 편하게 적어 주세요.' };
    if (it.kind === 'thanks') return { text: '도움이 됐다니 다행이에요. 더 궁금한 게 있으면 언제든 물어보세요!' };
    if (it.kind === 'contact') return { text: '불편한 점이나 제안은 문의하기로 보내 주세요. 위쪽 **문의하기** 탭을 누르면 바로 쓸 수 있어요.', contact: true };
    if (it.kind === 'meal' || it.kind === 'timetable') {
      await neis();
      const school = window.loadNeisSchool?.();
      const label = window.neisDateLabel(it.date);
      if (!school) {
        const place = it.kind === 'meal' ? '/todayfood/' : '/todayclass/';
        return { text: `먼저 학교를 골라 주세요. [${PLACES[place]}](${place})에서 학교를 한 번 검색해 두면 다음부터 여기서 바로 알려 드릴게요.` };
      }
      if (it.kind === 'meal') {
        const { slots } = await window.fetchNeisMeal(school, window.neisYmd(it.date));
        const want = /조식|아침/.test(q) ? '1' : /석식|저녁/.test(q) ? '3' : /중식|점심/.test(q) ? '2' : null;
        const shown = want ? slots.filter(s => s.code === want) : slots;
        if (!shown.length) return { text: `**${school.schoolName}** ${label}에는 ${want ? '해당 ' : ''}급식 정보가 없어요. 방학·주말이거나 학교가 아직 올리지 않았을 수 있어요.`, sources: [{ t: '오늘의 급식', u: '/todayfood/' }] };
        return { text: `**${school.schoolName} ${label} 급식**\n${shown.map(s => `- ${s.label}: ${s.items.join(', ')}`).join('\n')}`, sources: [{ t: '오늘의 급식', u: '/todayfood/' }] };
      }
      const info = window.loadNeisClass?.() || {};
      if (!info.grade || !info.classNum) return { text: `시간표를 보려면 학년과 반이 필요해요. [오늘의 시간표](/todayclass/)에서 한 번 입력해 두면 다음부터 바로 알려 드릴게요.` };
      const { periods } = await window.fetchNeisTimetable(school, window.neisYmd(it.date), info.grade, info.classNum, info.department);
      const which = Number((q.match(/(\d)\s*교시/) || [])[1]);
      const shown = which ? periods.filter(p => p.period === which) : periods;
      if (!shown.length) return { text: `${label} ${info.grade}학년 ${info.classNum}반 시간표가 없어요. 주말·방학이거나 학교가 아직 올리지 않았을 수 있어요.`, sources: [{ t: '오늘의 시간표', u: '/todayclass/' }] };
      return { text: `**${label} ${info.grade}학년 ${info.classNum}반 시간표**\n${shown.map(p => `- ${p.period}교시 ${p.subject}`).join('\n')}`, sources: [{ t: '오늘의 시간표', u: '/todayclass/' }] };
    }
    return null;
  }

  // ── ③ 서버 AI(스트리밍) ──
  async function askServer(A, index, q, results) {
    controller = new AbortController();
    const history = messages.slice(0, -1).slice(-6).filter(m => m.text).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
    const body = JSON.stringify({ q, history, ctx: A.contextOf(results), weak: A.isWeak(results, q), path: location.pathname });
    const row = make('div', 'assist-msg is-bot is-new');
    const bodyEl = make('div', 'assist-bubble');
    bodyEl.innerHTML = '<span class="assist-typing" aria-label="답을 쓰는 중"><i></i><i></i><i></i></span>';
    row.append(bodyEl);
    log.append(row);
    scrollDown();
    const msg = { role: 'bot', text: '', route: 'ai', sources: [] };
    let stopped = false;
    const finish = () => {
      row.remove();
      if (stopped && !msg.text) return;
      if (!msg.text) {
        const local = results.slice(0, 3).filter(r => r.doc.u).map(r => ({ t: r.doc.t, u: r.doc.u }));
        msg.route = 'none';
        msg.text = msg.error || '지금은 AI가 답하기 어려워요. 아래 관련 자료를 확인하거나, 해결되지 않으면 문의하기로 알려 주세요.';
        msg.sources = msg.sources.length ? msg.sources : local;
        msg.offerContact = q;
      }
      delete msg.error;
      push(msg);
    };
    try {
      // text/plain이면 브라우저가 사전 확인 요청(preflight)을 보내지 않아 한 번 덜 오간다.
      const res = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, signal: controller.signal });
      if (!res.ok || !res.body || !/event-stream/.test(res.headers.get('Content-Type') || '')) {
        const data = await res.json().catch(() => ({}));
        if (data.error) msg.error = data.error;
        if (data.sources) msg.sources = data.sources.filter(s => s.u);
        return finish();
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '', event = 'message', started = false;
      const handle = (ev, data) => {
        let j;
        try { j = JSON.parse(data); } catch { return; }
        if (ev === 'meta') msg.sources = (j.sources || []).filter(s => s.u);
        else if (ev === 'message' && j.t) {
          msg.text += j.t;
          if (!started) { started = true; bodyEl.replaceChildren(); }
          rich(bodyEl, msg.text);
          scrollDown();
        }
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trimEnd();
          buf = buf.slice(i + 1);
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) handle(event, line.slice(5).trim());
          else if (!line) event = 'message';
        }
      }
    } catch (error) {
      stopped = error.name === 'AbortError';
      if (stopped && msg.text) msg.text += ' …';
    } finally {
      controller = null;
    }
    finish();
  }

  async function ask(text, { skipLocal = false } = {}) {
    const q = String(text || '').trim().slice(0, 500);
    if (!q || busy) return;
    if (!skipLocal) push({ role: 'user', text: q });
    setBusy(true);
    try {
      const { A, index } = await ready();
      const results = A.search(index, q);
      if (!skipLocal) {
        const rule = await ruleAnswer(A, q).catch(() => null);
        if (rule) {
          push({ role: 'bot', text: rule.text, route: 'rule', sources: rule.sources || [] });
          if (rule.contact) setTimeout(() => switchView('contact'), 900);
          logLocal(q, 'rule', rule.text);
          return;
        }
        const hit = A.matchFaq(index, results, q);
        if (hit) {
          const doc = hit.doc;
          push({ role: 'bot', text: doc.a, route: 'faq', q, sources: doc.u ? [{ t: placeName(doc.u, '관련 가이드'), u: doc.u }] : [] });
          logLocal(q, 'faq', doc.a);
          return;
        }
      }
      await askServer(A, index, q, results);
    } catch {
      push({ role: 'bot', text: '연결이 잠시 불안정해요. 잠시 뒤 다시 물어봐 주세요.', route: 'none', offerContact: q });
    } finally {
      setBusy(false);
    }
  }

  // ── 문의하기 ──
  function contactView() {
    const view = make('section', 'assist-view assist-contact');
    view.dataset.view = 'contact';
    view.hidden = true;
    view.innerHTML = `
      <form novalidate>
        <div class="seg assist-kinds" role="group" aria-label="문의 유형">
          <button type="button" data-kind="bug" aria-pressed="true">오류 제보</button>
          <button type="button" data-kind="idea" aria-pressed="false">기능 제안</button>
          <button type="button" data-kind="etc" aria-pressed="false">기타</button>
        </div>
        <label class="field"><span class="field-label">내용</span>
          <textarea class="input assist-textarea" rows="5" maxlength="2000" placeholder="어느 화면에서 무엇이 불편했는지 적어 주세요"></textarea></label>
        <label class="field"><span class="field-label">이메일 <span class="assist-optional">선택</span></span>
          <input class="input" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="답변이 필요할 때만 적어 주세요"></label>
        <input class="assist-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="assist-error" role="alert" hidden></p>
        <button class="btn assist-submit" type="submit">보내기</button>
        <p class="assist-note">보낸 내용은 문의 처리에만 쓰고 1년 뒤 지워요. 만 14세 미만은 이메일 없이 보내 주세요. <a href="/privacy/">개인정보처리방침</a></p>
      </form>
      <div class="assist-done" hidden>
        <span class="assist-done-icon">${ICON.check}</span>
        <p class="assist-done-title">잘 받았어요</p>
        <p class="assist-note">꼼꼼히 읽고 반영할게요. 이메일을 남겼다면 답장을 보내 드려요.</p>
        <button type="button" class="btn-ghost btn-sm assist-again">하나 더 보내기</button>
      </div>`;
    const form = view.querySelector('form');
    const kinds = [...view.querySelectorAll('[data-kind]')];
    kinds.forEach(b => b.addEventListener('click', () => kinds.forEach(k => k.setAttribute('aria-pressed', String(k === b)))));
    const error = view.querySelector('.assist-error');
    const submit = view.querySelector('.assist-submit');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const text = view.querySelector('textarea').value.trim();
      const email = view.querySelector('input[type="email"]').value.trim();
      const fail = message => { error.textContent = message; error.hidden = false; };
      if (text.length < 5) return fail('내용을 5자 이상 적어 주세요.');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('이메일 형식을 확인해 주세요.');
      error.hidden = true;
      submit.disabled = true;
      submit.textContent = '보내는 중…';
      try {
        const res = await fetch(`${API}/contact`, {
          method: 'POST', headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ kind: kinds.find(k => k.getAttribute('aria-pressed') === 'true').dataset.kind, body: text, email, website: view.querySelector('.assist-hp').value, path: location.pathname })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return fail(data.error || '보내지 못했어요. 잠시 뒤 다시 시도해 주세요.');
        form.reset();
        kinds.forEach((k, i) => k.setAttribute('aria-pressed', String(i === 0)));
        form.hidden = true;
        view.querySelector('.assist-done').hidden = false;
      } catch {
        fail('인터넷 연결을 확인하고 다시 보내 주세요.');
      } finally {
        submit.disabled = false;
        submit.textContent = '보내기';
      }
    });
    view.querySelector('.assist-again').addEventListener('click', () => {
      form.hidden = false;
      view.querySelector('.assist-done').hidden = true;
      view.querySelector('textarea').focus();
    });
    return view;
  }

  function build() {
    panel = make('div', 'assist-panel glass');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'AI 도우미와 문의하기');
    panel.hidden = true;
    const head = make('div', 'assist-head');
    const seg = make('div', 'assist-tabs');
    seg.setAttribute('role', 'tablist');
    for (const [view, label] of [['chat', 'AI 도우미'], ['contact', '문의하기']]) {
      const tab = button('', label);
      tab.textContent = label;
      tab.dataset.view = view;
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', () => switchView(view));
      seg.append(tab);
    }
    const fresh = button('assist-icon-btn', ICON.fresh, '새 대화');
    fresh.addEventListener('click', () => {
      controller?.abort();
      messages = [];
      save();
      renderLog();
      input.focus();
    });
    const close = button('assist-icon-btn', ICON.close, '닫기');
    close.addEventListener('click', () => toggle(false));
    head.append(seg, fresh, close);

    const chat = make('section', 'assist-view assist-chat');
    chat.dataset.view = 'chat';
    log = make('div', 'assist-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.addEventListener('click', event => { if (event.target.closest('a[href]')) toggle(false); });
    const form = make('form', 'assist-form');
    input = make('textarea', 'assist-input');
    input.rows = 1;
    input.maxLength = 500;
    input.placeholder = '무엇이든 물어보세요';
    input.setAttribute('aria-label', '질문');
    const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; };
    input.addEventListener('input', grow);
    input.addEventListener('keydown', event => {
      // 한글 조합을 확정하는 Enter는 보내지 않는다. Shift+Enter는 줄바꿈.
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      form.requestSubmit();
    });
    sendBtn = button('assist-send', ICON.send, '보내기');
    sendBtn.type = 'submit';
    form.append(input, sendBtn);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (busy) { controller?.abort(); return; }
      const q = input.value;
      input.value = '';
      grow();
      ask(q);
    });
    const note = make('p', 'assist-note', '개인정보는 적지 마세요 · 질문은 서비스 개선을 위해 90일 보관돼요');
    chat.append(log, form, note);
    panel.append(head, chat, contactView());
    document.body.append(panel);
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); toggle(false); } });
    renderLog();
  }

  let current = 'chat';
  function switchView(view) {
    current = view;
    panel.querySelectorAll('.assist-tabs [data-view]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.view === view)));
    panel.querySelectorAll('.assist-view').forEach(section => { section.hidden = section.dataset.view !== view; });
    panel.dataset.view = view;
    dock?.querySelectorAll('[data-open]').forEach(b => b.setAttribute('aria-pressed', String(!panel.hidden && b.dataset.open === view)));
    if (matchMedia('(pointer: fine)').matches) (view === 'chat' ? input : panel.querySelector('.assist-contact textarea'))?.focus();
  }

  function toggle(open, view) {
    if (!panel) build();
    if (open === undefined) open = panel.hidden || (view && view !== current);
    panel.hidden = !open;
    document.documentElement.classList.toggle('assist-open', open);
    if (open) {
      ready().catch(() => {});
      switchView(view || current);
      scrollDown();
    } else {
      dock?.querySelectorAll('[data-open]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      if (matchMedia('(pointer: fine)').matches) dock?.querySelector(`[data-open="${current}"]`)?.focus({ preventScroll: true });
    }
  }
  window.openAssistant = view => toggle(true, view);

  // ── 여는 곳: PC 도크 + 휴대폰 도구 메뉴 두 줄 ──
  function mount() {
    dock = make('div', 'assist-dock glass');
    dock.setAttribute('role', 'group');
    dock.setAttribute('aria-label', 'AI 도우미와 문의하기');
    for (const [view, app, label] of [['chat', 'ai', 'AI 도우미'], ['contact', 'mail', '문의하기']]) {
      const b = button('assist-dock-btn', `<span class="app-icon" data-app="${app}" aria-hidden="true"></span><span class="assist-dock-label">${label}</span>`, label);
      b.dataset.open = view;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => toggle(undefined, view));
      dock.append(b);
    }
    document.body.append(dock);

    const menu = document.querySelector('.tools');
    if (menu) {
      const rows = make('div', 'tools-extra');
      for (const [view, app, label, hint] of [['chat', 'ai', 'AI 도우미', '성적·입시·급식 무엇이든'], ['contact', 'mail', '문의하기', '오류 제보·기능 제안']]) {
        const b = button('tools-row', `<span class="app-icon" data-app="${app}" aria-hidden="true"></span><span class="tools-row-text"><span class="tools-row-title">${label}</span><span class="tools-row-hint">${hint}</span></span>${ICON.chevron}`);
        b.addEventListener('click', () => {
          const menuBtn = document.querySelector('.tool-menu-btn');
          if (menuBtn?.getAttribute('aria-expanded') === 'true') menuBtn.click();
          toggle(true, view);
        });
        rows.append(b);
      }
      menu.append(rows);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
