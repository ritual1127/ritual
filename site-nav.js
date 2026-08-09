// 모든 페이지 최상단 서비스 이동 버튼 + 저장된 테마 적용
(function () {
  document.documentElement.setAttribute(
    'data-theme',
    localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  const LINKS = [
    ['수행·지필', '/'],
    ['목표점수', '/target-score/'],
    ['내신등급', '/rank/'],
    ['학점', '/gpa/'],
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

    // 계산기 페이지는 입력 화면이 주인공입니다. 긴 검색 도움말은 필요할 때만 펼칩니다.
    const calculatorPaths = ['/', '/target-score/', '/rank/', '/gpa/', '/gpa-converter/'];
    if (calculatorPaths.includes(here)) {
      const content = document.querySelector('.content-section:not(.article)');
      if (content) {
        const drawer = document.createElement('details');
        drawer.className = 'seo-drawer';
        const summary = document.createElement('summary');
        summary.innerHTML = '<span>계산법·예시·자주 묻는 질문</span><small>필요할 때 펼쳐보기</small>';
        content.parentNode.insertBefore(drawer, content);
        drawer.append(summary, content);
        const related = document.querySelector('.related-tools');
        if (related) drawer.appendChild(related);
      }
    }
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
