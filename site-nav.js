// 모든 페이지 공통: 테마, 도구 칩, 서비스워커, 계산기 입력 보조, 미니 결과, 초기화 확인
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
  function paintMini() { mini.textContent = miniText; mini.hidden = !miniText || cardVisible; }
  window.setMiniResult = text => {
    if (!mini) {
      const card = document.querySelector('.result-card');
      mini = document.createElement('button');
      mini.type = 'button';
      mini.className = 'mini-result';
      mini.hidden = true;
      mini.addEventListener('click', () => card?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }));
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

  // 초기화처럼 되돌릴 수 없는 버튼: 3초 안에 두 번 눌러야 실행한다.
  window.armReset = (button, action) => {
    const label = button.textContent;
    let timer = 0;
    const disarm = () => { clearTimeout(timer); timer = 0; button.textContent = label; button.classList.remove('is-armed'); };
    button.addEventListener('click', () => {
      if (timer) { disarm(); action(); return; }
      button.textContent = '한 번 더 누르면 초기화';
      button.classList.add('is-armed');
      timer = setTimeout(disarm, 3000);
    });
  };

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/app-sw.js').catch(() => {}));
  }

  function init() { setupThemeToggle(); setupToolnav(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
