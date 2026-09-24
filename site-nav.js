// 모든 페이지 공통: 테마, 내비게이션 바(휴대폰 하단·크기 변화, 도구 메뉴, 실시간 결과), 유리 굴절, 서비스워커, 계산기 입력 보조, 모션, 되돌리기 알림
(function () {
  const root = document.documentElement;
  const PAPER = { light: '#F5F5F7', dark: '#000000' };
  const media = matchMedia('(prefers-color-scheme: dark)');

  // 방문 통계(관리자 대시보드): 쿠키·IP 없이 경로와 유입 사이트만 보낸다. 로봇은 서버가 거른다.
  let apiBase = null;
  try { apiBase = localStorage.getItem('apiBase'); } catch {}
  const API = window.SITE_API = apiBase || 'https://seongjeok-feedback-api.smilepea.workers.dev';
  // 브라우저에서 '추적 안 함'이나 GPC를 켰으면 보내지 않는다.
  const optOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  window.track = data => { if (optOut) return; try { navigator.sendBeacon(`${API}/t`, JSON.stringify({ path: location.pathname, ...data })); } catch {} };
  if (!location.pathname.startsWith('/admin')) window.track({ type: 'view', ref: document.referrer });
  // 계산 완료는 사용자가 직접 입력한 뒤 결과가 처음 나올 때 한 번만 센다(저장된 값을 불러온 건 빼고).
  let typed = false, counted = false;
  document.addEventListener('input', () => { typed = true; }, true);

  function savedTheme() { try { return localStorage.getItem('theme'); } catch { return null; } }
  function currentTheme() { return root.dataset.theme || (media.matches ? 'dark' : 'light'); }
  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute('content', PAPER[currentTheme()]));
    document.querySelector('.theme-toggle')?.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
  }
  applyTheme(savedTheme());

  function setupThemeToggle() {
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    applyTheme(savedTheme());
    button.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch {}
      applyTheme(next);
    });
    media.addEventListener('change', () => applyTheme(savedTheme()));
  }

  // 도구 메뉴: 휴대폰은 하단 바 위로 열리는 시트(데스크톱은 CSS가 상단 링크로 펼친다).
  // 바 가운데는 결과가 있으면 결과 카드로 가고, 없으면(현재 도구명) 메뉴를 연다.
  function setupToolMenu() {
    const bar = document.querySelector('.appbar-inner');
    const button = bar?.querySelector('.tool-menu-btn');
    if (!button) return;
    const main = bar.querySelector('.bar-main');
    const setOpen = open => {
      bar.dataset.menu = open ? 'open' : 'closed';
      button.setAttribute('aria-expanded', String(open));
      if (open) bar.dataset.mini = 'false';
    };
    const toggle = () => setOpen(button.getAttribute('aria-expanded') !== 'true');
    button.addEventListener('click', toggle);
    if (main && !main.hasAttribute('aria-label')) main.setAttribute('aria-label', `도구 메뉴, 현재 ${main.dataset.label}`);
    main?.addEventListener('click', () => {
      if (!main.classList.contains('has-result')) return toggle();
      setOpen(false);
      document.querySelector('.result-card')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
      setOpen(false);
      button.focus();
    });
    document.addEventListener('click', event => { if (!bar.contains(event.target)) setOpen(false); });
    addEventListener('pageshow', () => setOpen(false));
  }

  // 휴대폰 하단 바 크기: 아래로 스크롤하거나 입력 중이면 작은 알약, 위로 스크롤하거나 맨 위면 원래 크기.
  // 작은 상태에서 누르면 커진다. 결과가 떠 있으면 그 탭으로 결과 카드까지 바로 간다(두 번 누를 필요 없게).
  function setupBarSize() {
    const bar = document.querySelector('.appbar-inner');
    if (!bar) return;
    const phone = matchMedia('(max-width: 959px)');
    const isField = el => el?.matches?.('.page input, .page select, .page textarea');
    let lastY = scrollY, typing = false;
    const setMini = mini => { bar.dataset.mini = String(mini && bar.dataset.menu !== 'open'); };
    addEventListener('scroll', () => {
      if (!phone.matches) return;
      const y = scrollY, dy = y - lastY;
      if (y < 24) { lastY = y; setMini(typing); return; }
      if (Math.abs(dy) < 10) return;
      lastY = y;
      setMini(typing || dy > 0);
    }, { passive: true });
    document.addEventListener('focusin', event => {
      if (!phone.matches || !isField(event.target)) return;
      typing = true;
      setMini(true);
    });
    // 칸 사이를 옮겨 다닐 때 깜빡이지 않게, 입력칸을 완전히 떠난 뒤에만 되돌린다.
    document.addEventListener('focusout', event => {
      if (!isField(event.target)) return;
      typing = false;
      setTimeout(() => { if (!typing && !isField(document.activeElement)) setMini(false); }, 250);
    });
    bar.addEventListener('click', event => {
      if (bar.dataset.mini !== 'true') return;
      event.preventDefault();
      event.stopPropagation();
      setMini(false);
      if (bar.querySelector('.bar-main')?.classList.contains('has-result')) {
        document.querySelector('.result-card')?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    }, true);
  }

  // 계산기 입력 보조: 포커스 시 전체 선택, Enter로 다음 칸, blur 시 범위 보정
  document.addEventListener('focusin', event => {
    const input = event.target;
    if (input.matches?.('.calc input[type="number"]')) setTimeout(() => input.select(), 0);
  });
  document.addEventListener('keydown', event => {
    const input = event.target;
    // 한글 조합을 확정하는 Enter는 칸 이동으로 쓰지 않는다.
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229 || !input.matches?.('.calc input')) return;
    event.preventDefault();
    const fields = [...input.closest('.calc').querySelectorAll('input, select')].filter(field => !field.disabled && field.offsetParent !== null);
    const next = fields[fields.indexOf(input) + 1];
    if (next) next.focus(); else input.blur();
  });
  document.addEventListener('focusout', event => {
    const input = event.target;
    if (!input.matches?.('input[type="number"]') || input.value === '' || !Number.isFinite(input.valueAsNumber)) return;
    const min = input.min === '' ? -Infinity : Number(input.min);
    const max = input.max === '' ? Infinity : Number(input.max);
    const clamped = Math.min(max, Math.max(min, input.valueAsNumber));
    if (clamped === input.valueAsNumber) return;
    input.value = String(clamped);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 유리 가장자리 굴절: 가장자리 띠에서 뒤 화면이 휘어 보이게 요소 크기에 맞춘 SVG 변위 필터를 만든다.
  // backdrop-filter에 SVG 필터를 거는 건 크로미움만 되므로 거기서만 켠다. 나머지는 CSS의 흐림 유리로 남는다.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const canLens = 'ResizeObserver' in window && !!navigator.userAgentData?.brands?.some(brand => brand.brand === 'Chromium');
  let lensDefs = null, lensCount = 0;
  // 가운데는 128(변위 없음), 가장자리로 갈수록 0·255로 기울어 바깥쪽을 끌어온다. R은 가로, G는 세로.
  const edgeMap = (w, h, axis, band) => {
    const t = Math.min(band / (axis === 'x' ? w : h), .45).toFixed(4);
    const [mid, end, dir] = axis === 'x' ? ['#800000', '#f00', ''] : ['#008000', '#0f0', ' x2="0" y2="1"'];
    return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="${SVG_NS}" width="${w}" height="${h}"><linearGradient id="g"${dir}><stop offset="0" stop-color="#000"/><stop offset="${t}" stop-color="${mid}"/><stop offset="${1 - t}" stop-color="${mid}"/><stop offset="1" stop-color="${end}"/></linearGradient><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
  };
  function lens(el, band = 16, strength = 34) {
    if (!canLens || !el) return;
    if (!lensDefs) {
      lensDefs = document.createElementNS(SVG_NS, 'svg');
      lensDefs.setAttribute('aria-hidden', 'true');
      lensDefs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      document.body.append(lensDefs);
    }
    const filter = document.createElementNS(SVG_NS, 'filter');
    filter.id = `glass-lens-${++lensCount}`;
    for (const [name, value] of Object.entries({ x: 0, y: 0, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })) filter.setAttribute(name, value);
    filter.innerHTML = `<feImage result="x" preserveAspectRatio="none"/><feImage result="y" preserveAspectRatio="none"/><feComposite in="x" in2="y" operator="arithmetic" k2="1" k3="1" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="${strength}" xChannelSelector="R" yChannelSelector="G"/>`;
    lensDefs.append(filter);
    const [mapX, mapY] = filter.querySelectorAll('feImage');
    const draw = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      for (const node of [filter, mapX, mapY]) { node.setAttribute('width', w); node.setAttribute('height', h); }
      // 화면 폭을 꽉 채운 바(데스크톱)는 좌우 끝이 화면 끝이라 세로 방향만 굴절시킨다.
      mapX.setAttribute('href', edgeMap(w, h, 'x', w >= innerWidth - 2 ? 0 : band));
      mapY.setAttribute('href', edgeMap(w, h, 'y', band));
    };
    draw();
    new ResizeObserver(draw).observe(el);
    el.style.setProperty('--lens', `url(#${filter.id})`);
  }

  // 바 가운데: 결과가 없으면 현재 도구명, 있으면 결과 라벨과 값. "값 · 등급"이면 등급을 원 배지로 보여 준다.
  // 스크린리더에는 입력이 멈춘 뒤 한 번만 읽힌다.
  let live = null, liveTimer = 0;
  window.setMiniResult = text => {
    if (text && typed && !counted) { counted = true; window.track({ type: 'calc' }); }
    const main = document.querySelector('.bar-main');
    if (main) {
      const [value, ...rest] = text.split(' · ');
      const label = text ? document.querySelector('.result-card .result-label')?.textContent || '결과' : main.dataset.label;
      const badge = main.querySelector('.bar-badge');
      main.classList.toggle('has-result', Boolean(text));
      main.querySelector('.bar-label').textContent = label;
      main.querySelector('.bar-value').textContent = text ? value : '';
      badge.textContent = rest.join(' · ');
      badge.hidden = !rest.length;
      main.setAttribute('aria-label', text ? `결과 보기: ${label} ${text}` : `도구 메뉴, 현재 ${label}`);
    }
    if (!live) {
      live = make('p', 'sr-only');
      live.setAttribute('aria-live', 'polite');
      document.body.append(live);
    }
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = text; }, 600);
  };

  // 결과 링(애플 워치 활동 링처럼): 결과 카드와 하단 바에 도구 색으로 결과 비율(0~1)을 채운다.
  // ticks는 링 위 경계 눈금(예: 등급 기준). 다 차면 링이 한 번 빛난다.
  const RING = 2 * Math.PI * 50;
  let ringParts = null;
  window.setRing = (ratio, { ticks = [] } = {}) => {
    const card = document.querySelector('.result-card');
    const main = card?.querySelector('.result-main');
    if (!main) return;
    if (!ringParts) {
      const at = t => { const a = t * 2 * Math.PI; return [60 + Math.cos(a) * 41, 60 + Math.sin(a) * 41, 60 + Math.cos(a) * 59, 60 + Math.sin(a) * 59].map(n => n.toFixed(2)); };
      const svg = (cls, extra = '') => `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true" focusable="false">${extra}<circle class="ring-track" cx="60" cy="60" r="50"/><circle class="ring-fill" cx="60" cy="60" r="50" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="${RING.toFixed(2)}"/>`;
      const big = make('div', 'ring');
      big.innerHTML = svg('ring-svg', '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient></defs>')
        + ticks.map(t => { const [x1, y1, x2, y2] = at(t); return `<line class="ring-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join('') + '</svg>';
      main.prepend(big);
      card.classList.add('has-ring');
      const bar = document.querySelector('.bar-main');
      const small = bar ? make('span', 'bar-ring') : null;
      if (small) { small.innerHTML = svg('ring-svg') + '</svg>'; bar.prepend(small); }
      ringParts = { big, fills: [big, small].filter(Boolean).map(el => el.querySelector('.ring-fill')) };
      void big.offsetWidth; // 빈 링에서 채워지며 시작하도록 첫 상태를 확정한다
    }
    const r = Math.max(0, Math.min(1, Number(ratio) || 0));
    ringParts.fills.forEach(fill => { fill.style.strokeDashoffset = (RING * (1 - r)).toFixed(2); });
    ringParts.big.classList.toggle('is-full', r >= .999);
  };

  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // 결과 숫자를 슬롯머신처럼 굴린다. 보이지 않는 원문이 너비·기준선을, 롤 레이어가 움직임을, sr-only가 읽기를 맡는다.
  window.rollNumber = (el, text) => {
    if (el.dataset.value === text) return;
    el.dataset.value = text;
    const shape = text.replace(/\d/g, '0');
    let roll = el.querySelector(':scope > .roll');
    if (!roll || roll.dataset.shape !== shape) {
      roll = make('span', 'roll');
      roll.dataset.shape = shape;
      const ghost = make('span', 'roll-ghost');
      const layer = make('span', 'roll-layer');
      ghost.setAttribute('aria-hidden', 'true');
      layer.setAttribute('aria-hidden', 'true');
      let column = 0;
      for (const ch of text) {
        if (!/\d/.test(ch)) { layer.append(make('span', 'roll-char', ch)); continue; }
        const strip = make('span', 'roll-strip');
        strip.style.setProperty('--i', column++);
        strip.append(...[...'0123456789'].map(digit => make('span', '', digit)));
        const col = make('span', 'roll-col');
        col.append(strip);
        layer.append(col);
      }
      roll.append(ghost, layer, make('span', 'sr-only'));
      el.replaceChildren(roll);
      void roll.offsetWidth; // 새 띠는 0에서 굴러 들어오도록 첫 위치를 확정한다
    }
    roll.querySelector('.roll-ghost').textContent = text;
    roll.querySelector('.sr-only').textContent = text;
    const digits = [...text].filter(ch => /\d/.test(ch));
    roll.querySelectorAll('.roll-strip').forEach((strip, i) => { strip.style.transform = `translateY(calc(var(--roll-h) * -${digits[i]}))`; });
  };

  window.stampIn = el => {
    el.classList.remove('is-stamp');
    void el.offsetWidth;
    el.classList.add('is-stamp');
  };

  // 결과 옆 빨간 인주 스티커. 빈 문자열이면 숨긴다.
  window.setSticker = (card, text, animate) => {
    let sticker = card.querySelector('.sticker');
    if (!text) { if (sticker) sticker.hidden = true; return; }
    if (!sticker) {
      sticker = make('span', 'sticker');
      sticker.setAttribute('aria-hidden', 'true');
      card.querySelector('.result-main').append(sticker);
    }
    const changed = sticker.hidden || sticker.textContent !== text;
    sticker.textContent = text;
    sticker.hidden = false;
    if (animate && changed) stampIn(sticker);
  };

  // 달성 여부를 받아 0.6초 동안 유지될 때만 스티커·축하를 바꾼다. 입력 도중 잠깐 A를 벗어났다 돌아와도 다시 터지지 않는다.
  window.achievement = (card, text) => {
    let settled = null, timer = 0;
    return achieved => {
      clearTimeout(timer);
      if (settled === null) { settled = achieved; setSticker(card, achieved ? text : '', false); return; }
      timer = setTimeout(() => {
        if (achieved === settled) return;
        settled = achieved;
        setSticker(card, achieved ? text : '', true);
        if (achieved) celebrate(card);
      }, 600);
    };
  };

  const CONFETTI = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];
  window.celebrate = card => {
    if (reduceMotion()) return;
    navigator.vibrate?.(18);
    const box = (card.querySelector('.result-main') || card).getBoundingClientRect();
    const colors = getComputedStyle(document.documentElement);
    const layer = make('div', 'confetti');
    layer.setAttribute('aria-hidden', 'true');
    const x0 = box.left + box.width / 2, y0 = box.top + box.height / 2;
    let longest = 0;
    for (let i = 0; i < 26; i++) {
      const piece = make('i');
      Object.assign(piece.style, {
        left: `${x0}px`, top: `${y0}px`,
        width: `${6 + Math.random() * 6}px`, height: `${8 + Math.random() * 10}px`,
        background: colors.getPropertyValue(CONFETTI[i % CONFETTI.length]).trim(),
        borderRadius: i % 5 === 0 ? '50%' : '2px'
      });
      layer.append(piece);
      const angle = (-165 + Math.random() * 150) * Math.PI / 180;
      const dist = 90 + Math.random() * 130;
      const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
      const spin = (Math.random() - .5) * 900;
      const duration = 1100 + Math.random() * 450;
      longest = Math.max(longest, duration);
      piece.animate([
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg)`, opacity: 1, offset: .45 },
        { transform: `translate(calc(-50% + ${dx * 1.25}px), calc(-50% + ${dy + 260}px)) rotate(${spin}deg)`, opacity: 0 }
      ], { duration, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' });
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), longest + 120);
  };

  // 되돌리기 알림: 한 번에 하나, 화면 위쪽, 5초 뒤 사라진다. 포커스나 마우스가 머무는 동안은 기다린다.
  let toast = null, toastTimer = 0;
  const hideToast = () => toast.classList.remove('is-shown');
  const holdToast = () => clearTimeout(toastTimer);
  const releaseToast = () => { clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 5000); };
  window.showToast = (message, { action, onAction } = {}) => {
    if (!toast) {
      toast = make('div', 'toast glass');
      toast.setAttribute('role', 'status');
      toast.addEventListener('focusin', holdToast);
      toast.addEventListener('mouseenter', holdToast);
      toast.addEventListener('focusout', releaseToast);
      toast.addEventListener('mouseleave', releaseToast);
      document.body.append(toast);
    }
    clearTimeout(toastTimer);
    toast.replaceChildren(make('span', '', message));
    if (action) {
      const button = make('button', '', action);
      button.type = 'button';
      button.addEventListener('click', () => { hideToast(); onAction(); });
      toast.append(button);
    }
    toast.classList.add('is-shown');
    releaseToast();
  };


  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/app-sw.js').catch(() => {}));
  }

  function init() { setupThemeToggle(); setupToolMenu(); setupBarSize(); lens(document.querySelector('.appbar-inner'), 14, 30); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
