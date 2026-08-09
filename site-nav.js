// 모든 페이지 최상단 서비스 이동 버튼 + 저장된 테마 적용
(function () {
  const CURRENT_PATH = location.pathname.replace(/index\.html$/, '');
  const CALCULATOR_PATHS = ['/', '/target-score/', '/rank/', '/gpa/', '/gpa-converter/'];
  if (CALCULATOR_PATHS.includes(CURRENT_PATH)) document.documentElement.classList.add('calculator-page');
  if (CALCULATOR_PATHS.includes(CURRENT_PATH) && CURRENT_PATH !== '/') document.documentElement.classList.add('tool-page');

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

  function setupNumberSteppers() {
    function isPercentageInput(input) {
      const hint = [
        input.className,
        input.id,
        input.getAttribute('aria-label') || '',
        input.closest('.percent-suffix') ? 'percent' : ''
      ].join(' ').toLowerCase();
      return /weight|percent|비율|퍼센트/.test(hint);
    }

    function stepFor(input, percentage) {
      if (percentage) return 5;
      const scoreInput = input.matches('.evaluation-score, .completed-score, #target') || input.closest('.score-suffix');
      if (scoreInput) return 1;
      const declared = Number(input.getAttribute('step'));
      return Number.isFinite(declared) && declared > 0 ? declared : 1;
    }

    function precisionOf(step) {
      const text = String(step);
      return text.includes('.') ? text.split('.')[1].length : 0;
    }

    function enhance(input) {
      if (input.dataset.customStepper || input.closest('.direct-count-stepper, .stepper, .number-stepper')) return;
      input.dataset.customStepper = 'true';

      const percentage = isPercentageInput(input);
      const step = stepFor(input, percentage);
      const oldParent = input.parentElement;
      const oldUnit = [...oldParent.children].find(element =>
        element !== input && /^(SPAN|B)$/.test(element.tagName) && ['%', '점'].includes(element.textContent.trim())
      );
      const inferredUnit = percentage ? '%' : ((input.matches('.evaluation-score, .completed-score, #target') || input.closest('.score-suffix')) ? '점' : '');
      const unit = oldUnit?.textContent.trim() || inferredUnit;
      if (oldUnit) oldUnit.classList.add('native-unit-hidden');

      const control = document.createElement('span');
      control.className = `number-stepper${percentage ? ' percentage-stepper' : ''}`;
      const down = document.createElement('button');
      const up = document.createElement('button');
      const valueWrap = document.createElement('span');
      const fieldName = input.getAttribute('aria-label') || input.id || '숫자';
      down.type = up.type = 'button';
      down.className = 'number-step-button number-step-down';
      up.className = 'number-step-button number-step-up';
      down.textContent = '−';
      up.textContent = '+';
      down.setAttribute('aria-label', `${fieldName} 줄이기`);
      up.setAttribute('aria-label', `${fieldName} 늘리기`);
      valueWrap.className = 'number-step-value';
      oldParent.insertBefore(control, input);
      valueWrap.appendChild(input);
      if (unit) {
        const unitElement = document.createElement('span');
        unitElement.className = 'number-step-unit';
        unitElement.textContent = unit;
        valueWrap.appendChild(unitElement);
      }
      control.append(down, valueWrap, up);
      input.setAttribute('step', String(step));

      function adjust(direction) {
        const min = input.min === '' ? -Infinity : Number(input.min);
        const max = input.max === '' ? Infinity : Number(input.max);
        let current = Number(input.value);
        if (input.value === '' || !Number.isFinite(current)) {
          current = Number.isFinite(min) ? (direction > 0 ? min - step : min) : 0;
        }
        const next = Math.min(max, Math.max(min, current + direction * step));
        input.value = next.toFixed(precisionOf(step));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }

      down.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        adjust(-1);
      });
      up.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        adjust(1);
      });
    }

    function enhanceWithin(root) {
      if (root.matches?.('input[type="number"]')) enhance(root);
      root.querySelectorAll?.('input[type="number"]').forEach(enhance);
    }

    enhanceWithin(document.body);
    new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) enhanceWithin(node);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  function render() {
    const here = CURRENT_PATH;
    const tagline = document.querySelector('body > .tagline');
    if (tagline) {
      tagline.setAttribute('role', 'region');
      tagline.setAttribute('aria-label', '페이지 소개');
    }
    document.querySelectorAll('.footer-links').forEach(links => {
      links.setAttribute('role', 'navigation');
      links.setAttribute('aria-label', '하단 링크');
    });
    document.querySelectorAll('.feedback-widget').forEach(widget => {
      widget.setAttribute('role', 'region');
      widget.setAttribute('aria-label', '페이지 평가');
    });
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.innerHTML = LINKS.map(
      ([label, href]) =>
        `<a href="${href}"${here === href ? ' class="active"' : ''}>${label}</a>`
    ).join('');
    document.body.prepend(nav);

    // 계산기 안에는 설명문을 쌓지 않습니다. 상세 글은 독립된 읽기 화면으로 보냅니다.
    if (CALCULATOR_PATHS.includes(here)) {
      const content = document.querySelector('.content-section:not(.article)');
      if (content) {
        const guides = {
          '/': ['/blog/performance-exam-weight/', '수행·지필 반영비율 계산법'],
          '/target-score/': ['/blog/target-exam-score/', '남은 시험 점수 계산법'],
          '/rank/': ['/blog/rank-percentile/', '석차백분율과 등급 계산법'],
          '/gpa/': ['/blog/gpa-average/', 'GPA 평점평균 계산법'],
          '/gpa-converter/': ['/blog/gpa-scale-conversion/', 'GPA 만점 환산 방법']
        };
        const [href, label] = guides[here];
        const support = document.createElement('aside');
        support.className = 'calc-support';
        support.innerHTML = `<span>공식이 궁금한가요?</span><a href="${href}">${label} 읽기 →</a>`;
        content.replaceWith(support);
        document.querySelector('.related-tools')?.remove();
        const footer = document.querySelector('.site-footer');
        if (footer) footer.parentNode.insertBefore(support, footer);
      }
    }

    // 글은 계산기와 분리된 읽기 전용 레이아웃으로 구성합니다.
    if (here === '/blog/') buildBlogHub();
    else if (here.startsWith('/blog/') && here !== '/blog/') buildArticlePage();

    setupNumberSteppers();
  }

  function buildBlogHub() {
    document.body.classList.add('blog-hub');
    const grid = document.querySelector('.article-card-grid');
    if (!grid) return;
    const groups = [
      ['점수 계산', '반영비율과 목표점수를 계산할 때', ['performance-exam-weight','target-exam-score','raw-score-and-grade','grade-calculation']],
      ['내신등급', '석차와 5·9등급제가 궁금할 때', ['five-grade-system','nine-grade-system','rank-percentile','tied-rank']],
      ['대학 학점', 'GPA 평균과 만점 환산이 필요할 때', ['gpa-average','gpa-scale-conversion']]
    ];
    const cards = [...grid.querySelectorAll('.article-card')];
    const targetCard = cards.find(card => card.getAttribute('href').includes('target-exam-score'));
    if (targetCard) {
      targetCard.querySelector('h2').textContent = '남은 시험에서 몇 점 받아야 할까?';
      targetCard.querySelector('p').textContent = '이미 받은 점수와 반영 비율을 적으면 필요한 시험 점수를 알 수 있어요.';
    }
    grid.className = 'blog-library';
    for (const [title, desc, slugs] of groups) {
      const section = document.createElement('section');
      section.className = 'topic-group';
      section.innerHTML = `<div class="topic-heading"><h2>${title}</h2><p>${desc}</p></div><div class="topic-cards"></div>`;
      const target = section.querySelector('.topic-cards');
      cards.filter(card => slugs.some(slug => card.getAttribute('href').includes(slug))).forEach(card => target.appendChild(card));
      grid.appendChild(section);
    }
  }

  function buildArticlePage() {
    const article = document.querySelector('main.article');
    const header = document.querySelector('header.top-bar');
    const dek = document.querySelector('body > .tagline');
    if (!article || !header) return;
    document.body.classList.add('article-page');
    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.setAttribute('aria-label', '현재 위치');
    breadcrumb.innerHTML = '<a href="/">계산기</a><span>›</span><a href="/blog/">계산 가이드</a>';
    header.parentNode.insertBefore(breadcrumb, header);
    const lead = article.querySelector(':scope > p:not(.updated)');
    if (lead) lead.classList.add('article-answer');
    [...article.querySelectorAll(':scope > h2')].forEach(heading => {
      const section = document.createElement('section');
      section.className = 'article-section';
      if (heading.textContent.includes('예시')) section.classList.add('article-example');
      if (heading.textContent.includes('공식')) section.classList.add('article-formula');
      if (heading.textContent === '관련 글' || heading.textContent === '이어서 확인하기') section.classList.add('article-related');
      heading.parentNode.insertBefore(section, heading);
      section.appendChild(heading);
      while (section.nextSibling && section.nextSibling.tagName !== 'H2') section.appendChild(section.nextSibling);
    });
    const layout = document.createElement('div');
    layout.className = 'article-layout';
    article.parentNode.insertBefore(layout, article);
    const rail = document.createElement('aside');
    rail.className = 'article-toc';
    const headings = [...article.querySelectorAll('.article-section > h2')];
    rail.innerHTML = '<strong>이 글에서 확인할 내용</strong>' + headings.map((h, i) => {
      h.id = `section-${i + 1}`;
      return `<a href="#${h.id}">${h.textContent}</a>`;
    }).join('');
    layout.append(article, rail);
    if (dek) header.appendChild(dek);
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
