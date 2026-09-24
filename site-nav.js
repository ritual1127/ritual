// 모든 페이지 공통: 테마, 도구 메뉴, 서비스워커, 계산기 입력 보조, 결과 바, 리퀴드 글래스 굴절, 모션(롤링·도장·축하), 되돌리기 알림
(function () {
  const root = document.documentElement;
  const PAPER = { light: '#F4F5F8', dark: '#0F1117' };
  const media = matchMedia('(prefers-color-scheme: dark)');

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

  // 모바일 도구 메뉴: 캡슐의 현재 도구 버튼으로 여닫는다(데스크톱은 CSS가 탭으로 펼친다).
  function setupToolMenu() {
    const bar = document.querySelector('.appbar-inner');
    const button = bar?.querySelector('.tool-menu-btn');
    if (!button) return;
    const setOpen = open => {
      bar.dataset.menu = open ? 'open' : 'closed';
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
      setOpen(false);
      button.focus();
    });
    document.addEventListener('click', event => { if (!bar.contains(event.target)) setOpen(false); });
    addEventListener('pageshow', () => setOpen(false));
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

  // 리퀴드 글래스 굴절: 가장자리 띠에서 뒤 화면이 휘어 보이게 요소 크기에 맞춘 SVG 변위 필터를 만든다.
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
      mapX.setAttribute('href', edgeMap(w, h, 'x', band));
      mapY.setAttribute('href', edgeMap(w, h, 'y', band));
    };
    draw();
    new ResizeObserver(draw).observe(el);
    el.style.setProperty('--lens', `url(#${filter.id})`);
  }

  // 결과 바: 결과 카드의 큰 숫자가 화면 밖일 때 아래에 떠서 실시간 결과를 보여 준다(데스크톱은 CSS가 숨긴다).
  // 누르면 결과 카드로 간다. "값 · 등급"이면 등급을 배지로 보여 준다. 스크린리더에는 입력이 멈춘 뒤 한 번만 읽힌다.
  let dock = null, live = null, liveTimer = 0, miniText = '', resultVisible = true;
  function paintDock() {
    const [value, ...rest] = miniText.split(' · ');
    dock.querySelector('.dock-label').textContent = document.querySelector('.result-card .result-label')?.textContent || '결과';
    dock.querySelector('.dock-value').textContent = value;
    const badge = dock.querySelector('.dock-badge');
    badge.textContent = rest.join(' · ');
    badge.hidden = !rest.length;
    dock.setAttribute('aria-label', `결과 보기: ${miniText}`);
    const show = Boolean(miniText) && !resultVisible;
    dock.dataset.show = String(show);
    dock.inert = !show;
  }
  window.setMiniResult = text => {
    if (!dock) {
      const card = document.querySelector('.result-card');
      dock = make('button', 'dock glass');
      dock.type = 'button';
      dock.innerHTML = '<span class="dock-text"><span class="dock-label"></span><span class="dock-value"></span></span><span class="dock-badge" hidden></span><span class="dock-go" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></span>';
      dock.addEventListener('click', () => card?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }));
      document.body.append(dock);
      lens(dock, 18, 40);
      live = make('p', 'sr-only');
      live.setAttribute('aria-live', 'polite');
      document.body.append(live);
      const target = card?.querySelector('.result-main') || card;
      if (target && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => { resultVisible = entry.isIntersecting; paintDock(); }, { rootMargin: '-70px 0px -90px 0px' }).observe(target);
      }
    }
    miniText = text;
    paintDock();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = text; }, 600);
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

  const CONFETTI = ['--hl', '--primary', '--gA', '--gB', '--gC', '--gD'];
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

  // 되돌리기 알림: 한 번에 하나, 상단바 아래, 5초 뒤 사라진다. 포커스나 마우스가 머무는 동안은 기다린다.
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

  function init() { setupThemeToggle(); setupToolMenu(); lens(document.querySelector('.appbar-inner'), 14, 30); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
