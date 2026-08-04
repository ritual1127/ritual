// 모든 페이지 최상단 서비스 이동 버튼 + 저장된 테마 적용
(function () {
  document.documentElement.setAttribute(
    'data-theme',
    localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  const LINKS = [
    ['성적 계산기', '/'],
    ['석차등급', '/rank/'],
    ['학점 계산기', '/gpa/'],
    ['급식', '/todayfood/'],
    ['시간표', '/todayclass/'],
  ];

  function render() {
    const here = location.pathname.replace(/index\.html$/, '');
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.innerHTML = LINKS.map(
      ([label, href]) =>
        `<a href="${href}"${here === href ? ' class="active"' : ''}>${label}</a>`
    ).join('');
    document.body.prepend(nav);
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
