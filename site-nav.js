// 모든 페이지 공통: 테마, 도구 칩, 서비스워커, 계산기 입력 보조, 미니 결과, 모션(롤링·도장·축하·낙서), 되돌리기 알림
(function () {
  const root = document.documentElement;
  const PAPER = { light: '#FAF7F0', dark: '#14161D' };
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

  function setupToolnav() {
    const nav = document.querySelector('.toolnav-inner');
    if (!nav) return;
    const active = nav.querySelector('[aria-current="page"]');
    if (active) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    const edges = () => {
      nav.dataset.start = String(nav.scrollLeft <= 2);
      nav.dataset.end = String(nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2);
    };
    nav.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges, { passive: true });
    edges();
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

  // 결과 카드가 화면 밖일 때만 상단바에 결과를 띄운다. 스크린리더에는 입력이 멈춘 뒤 한 번만 읽힌다.
  let mini = null, live = null, liveTimer = 0, miniText = '', cardVisible = true;
  function paintMini() {
    mini.textContent = miniText;
    mini.setAttribute('aria-label', `결과 보기: ${miniText}`);
    mini.hidden = !miniText || cardVisible;
  }
  window.setMiniResult = text => {
    if (!mini) {
      const card = document.querySelector('.result-card');
      mini = document.createElement('button');
      mini.type = 'button';
      mini.className = 'mini-result';
      mini.hidden = true;
      mini.addEventListener('click', () => card?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }));
      document.querySelector('.appbar-inner')?.insertBefore(mini, document.querySelector('.theme-toggle'));
      live = document.createElement('p');
      live.className = 'sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.append(live);
      if (card && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => { cardVisible = entry.isIntersecting; paintMini(); }, { rootMargin: '-64px 0px 0px 0px' }).observe(card);
      }
    }
    miniText = text;
    paintMini();
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
      toast = make('div', 'toast');
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

  // 제목 아래 펜 낙서 밑줄. 고정 SVG 문자열만 넣는다.
  function doodle() {
    document.querySelectorAll('.page-head h1, .prose h1').forEach(h1 => {
      h1.insertAdjacentHTML('beforeend', '<svg class="doodle" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M2 9.5C28 4 52 12.5 82 8.5S140 3.5 168 7.5 194 10 198 7"/></svg>');
    });
  }

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/app-sw.js').catch(() => {}));
  }

  function init() { setupThemeToggle(); setupToolnav(); doodle(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
