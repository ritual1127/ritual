// AI 도우미 브라우저 엔진: 토큰화, BM25 검색, 질문 유사도, 규칙 의도와 계산 답. DOM을 건드리지 않으며
// scripts/test-assistant.mjs가 Node에서 calc-core.js와 함께 검증한다. 계산은 calc-core.js 함수를 그대로 쓴다.
(function (root) {
  const norm = text => String(text || '').toLowerCase().normalize('NFC');
  // 질문 말투 조각은 검색에 쓰지 않는다(문서에 드물어 엉뚱한 문서를 끌어온다).
  const STOP = new Set(['어떻', '떻게', '알려', '려줘', '려주', '주세', '세요', '해줘', '뭐야', '인가', '나요', '가요', '까요', '있어', '어요',
    '는데', '하는', '하나', '이야', '이에', '에요', '예요', '무엇', '엇인', '뭔가', '궁금', '금해', '합니', '니다', '습니', '입니', '해요',
    '할까', '인지', '건지', '싶어', '싶은', '되나', '돼요', '되요', '는지', '은지', '거야', '건가', '좀', '그럼', '근데',
    '내요', '써요', '봐요', '와요', '줘요', '래요', '대요', '네요', '지요', '아요', '워요', '려요']);

  // 끝에 붙은 조사·어미를 두 번까지 뗀다(비율이→비율, 계산해요→계산). 줄기는 2글자 이상 남기고 '평가'는 건드리지 않는다.
  // 세 글자 이상 문장 끝 말(뭐예요·뭐이야)은 한 글자만 남아도 떼서 버린다. 중요·필요처럼 두 글자 낱말은 그대로 둔다.
  const TAILS = ['이에요', '에서는', '에서', '으로', '이랑', '까지', '부터', '이면', '이야', '예요', '에요', '인데', '한테', '에게', '처럼', '보다', '하고',
    '은', '는', '을', '를', '이', '가', '의', '에', '로', '랑', '도', '만', '께', '면', '야', '요', '해'];
  const ENDINGS = new Set(['이에요', '이야', '예요', '에요', '야', '요']);
  function stem(word) {
    for (let pass = 0; pass < 2 && !word.endsWith('평가'); pass++) { // 계산해요 → 계산해 → 계산
      const tail = TAILS.find(t => word.endsWith(t) && word.length - t.length >= (ENDINGS.has(t) && word.length >= 3 ? 1 : 2));
      if (!tail) break;
      word = word.slice(0, -tail.length);
    }
    return word;
  }

  // 영문·숫자는 통째로, 한글은 조사를 뗀 뒤 2글자 조각으로 쪼갠다. 띄어쓰기가 달라도(다크모드·다크 모드) 조각이 겹친다.
  function tokens(text) {
    const out = [];
    for (const word of norm(text).match(/[가-힣]+|[a-z]+|\d+(?:\.\d+)?/g) || []) {
      if (!/^[가-힣]+$/.test(word)) { out.push(word); continue; }
      const w = stem(word);
      // 한 글자 한글(내·뭐·좀·몇)은 뜻이 흐려서 뺀다.
      for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
    }
    return out.filter(t => !STOP.has(t));
  }

  const docText = doc => doc.k === 'faq' ? doc.a : doc.x;

  function buildIndex(docs) {
    const postings = new Map(), lens = [];
    docs.forEach((doc, i) => {
      const tf = new Map();
      const add = (text, weight) => tokens(text).forEach(t => tf.set(t, (tf.get(t) || 0) + weight));
      add(doc.t, 2);
      (doc.q || []).forEach(q => add(q, 2));
      add(docText(doc), 1);
      let len = 0;
      tf.forEach((n, t) => {
        len += n;
        if (!postings.has(t)) postings.set(t, []);
        postings.get(t).push([i, n]);
      });
      lens.push(len);
    });
    return { docs, postings, lens, avg: lens.reduce((a, b) => a + b, 0) / (lens.length || 1) };
  }

  // BM25(k1 1.2, b 0.75)
  function search(index, query, limit = 8) {
    const { docs, postings, lens, avg } = index;
    const scores = new Map();
    for (const t of new Set(tokens(query))) {
      const list = postings.get(t);
      if (!list) continue;
      const idf = Math.log(1 + (docs.length - list.length + .5) / (list.length + .5));
      for (const [i, tf] of list) scores.set(i, (scores.get(i) || 0) + idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * lens[i] / avg)));
    }
    return [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([i, score]) => ({ doc: docs[i], score }));
  }

  const gramSet = text => new Set(tokens(text));
  // 조각 무게: 지식 베이스에 드문 조각일수록 크다(IDF). 지식 베이스에 없는 조각은 가장 드문 것으로 친다.
  function weightOf(index, t) {
    const n = index.postings.get(t)?.length || 0;
    return Math.log(1 + (index.docs.length - n + .5) / (n + .5));
  }
  // 두 문장의 조각 겹침(무게를 준 다이스 계수, 0~1). '수행·평가·점수'처럼 흔한 조각만 겹치면 낮게 나온다.
  function similarity(a, b, index) {
    const A = gramSet(a), B = gramSet(b);
    if (!A.size || !B.size) return 0;
    const w = t => (index ? weightOf(index, t) : 1);
    let shared = 0, total = 0;
    A.forEach(t => { total += w(t); if (B.has(t)) shared += w(t); });
    B.forEach(t => { total += w(t); if (A.has(t)) shared += w(t); });
    return shared / total;
  }

  // 알려진 질문(FAQ)과 거의 같은 질문이면 준비된 답을 바로 쓴다. 똑같지는 않은데 두 문답이 비슷하게 맞으면(차이 0.08 미만) AI에게 넘긴다.
  const FAQ_MATCH = .72, FAQ_MARGIN = .08;
  function matchFaq(index, results, query) {
    const best = [];
    for (const { doc } of results.slice(0, 5)) {
      if (doc.k !== 'faq') continue;
      best.push({ doc, sim: Math.max(...[doc.t, ...(doc.q || [])].map(v => similarity(query, v, index))) });
    }
    best.sort((a, b) => b.sim - a.sim);
    const [first, second] = best;
    if (!first || first.sim < FAQ_MATCH) return null;
    if (first.sim < .95 && second && first.sim - second.sim < FAQ_MARGIN) return null;
    return first;
  }

  // 질문 조각 중 1등 문서에 들어 있는 비율이 낮으면 서버가 의미 검색을 더한다.
  function isWeak(results, query) {
    if (!results.length) return true;
    const q = gramSet(query), top = results[0].doc;
    const d = gramSet(`${top.t} ${(top.q || []).join(' ')} ${docText(top)}`);
    if (!q.size) return true;
    let hit = 0;
    q.forEach(t => { if (d.has(t)) hit++; });
    return hit / q.size < .5;
  }

  const contextOf = results => results.slice(0, 5).map(({ doc }) => ({
    id: doc.id, t: doc.t, u: doc.u || '', x: doc.k === 'faq' ? `${(doc.q || [doc.t])[0]}\n${doc.a}` : doc.x
  }));

  // ── 날짜 말 → Date ──
  const WEEK = '일월화수목금토';
  function dayFrom(text, now = new Date()) {
    const s = norm(text);
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const shift = n => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
    let m = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (m) return new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
    if (/모레/.test(s)) return shift(2);
    if (/내일/.test(s)) return shift(1);
    if (/어제/.test(s)) return shift(-1);
    m = s.match(/(다음\s*주|담주|이번\s*주)?\s*([월화수목금토일])요일/);
    if (m) {
      const target = WEEK.indexOf(m[2]);
      let diff = (target - base.getDay() + 7) % 7;
      if (m[1] && /다음|담주/.test(m[1])) diff = ((target + 6) % 7) - ((base.getDay() + 6) % 7) + 7;
      return shift(diff);
    }
    m = s.match(/(?:^|[^\d.])(\d{1,2})\s*일(?!\s*(?:만|동안|째))/);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31) return new Date(now.getFullYear(), now.getMonth(), Number(m[1]));
    return base;
  }

  const SCALES = [4.5, 4.3, 4];
  // ── 규칙 의도: 급식·시간표·석차·상위 %·점수→성취도·학점 변환·인사·문의 ──
  function intent(text, now = new Date()) {
    const s = norm(text).replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (/급식|점심|중식|석식|조식|식단|학교\s*밥|밥\s*(뭐|메뉴)|메뉴\s*뭐/.test(s)) return { kind: 'meal', date: dayFrom(s, now) };
    if (/시간표|몇\s*교시|교시\s*(에|는)?\s*뭐|수업\s*뭐/.test(s)) return { kind: 'timetable', date: dayFrom(s, now) };

    const tieMatch = s.match(/(?:동점자?|동석차)\s*(?:는|가|이|수)?\s*(\d+)\s*명|(\d+)\s*명(?:이|이서|과)?\s*동점/);
    const tie = tieMatch ? Number(tieMatch[1] || tieMatch[2]) : 1;
    let m = s.match(/(\d+)\s*명\s*(?:중(?:에서|에)?|에서|가운데)?\s*(\d+)\s*등(?!급)/);
    if (m) return { kind: 'rank', total: Number(m[1]), rank: Number(m[2]), tie };
    m = s.match(/(\d+)\s*등(?!급)\s*(?:\/|이고|인데|,|이면|은|은데)?\s*(?:전체|수강자|총|학생)?\s*(?:수)?\s*(?:는|가)?\s*(\d+)\s*명/);
    if (m) return { kind: 'rank', rank: Number(m[1]), total: Number(m[2]), tie };
    m = s.match(/(?<![\d.])(\d+)\s*\/\s*(\d+)(?![\d.])/);
    if (m && /등급|석차|등/.test(s) && Number(m[1]) <= Number(m[2])) return { kind: 'rank', rank: Number(m[1]), total: Number(m[2]), tie };

    m = s.match(/상위\s*(\d+(?:\.\d+)?)\s*(?:%|퍼센트|프로)/);
    if (m && Number(m[1]) > 0 && Number(m[1]) <= 100) return { kind: 'percent', percent: Number(m[1]) };

    const numbers = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    if (/(학점|평점|만점|환산|변환|바꾸|으로|로)/.test(s) && numbers.length >= 3) {
      const scales = numbers.filter(n => SCALES.includes(n));
      if (scales.length >= 2) {
        const from = scales[0], to = scales[scales.length - 1];
        const rest = [...numbers];
        rest.splice(rest.indexOf(from), 1);
        rest.splice(rest.lastIndexOf(to), 1);
        const value = rest.find(n => n >= 0 && n <= from);
        if (value !== undefined && from !== to) return { kind: 'gpa', value, from, to };
      }
    }

    m = s.match(/(\d{1,3}(?:\.\d+)?)\s*점/g);
    if (m && m.length === 1 && /(성취도|몇\s*등급|등급\s*(이|은|뭐|몇)|무슨\s*등급|이면\s*(a|b|c|d|e|몇)|받으면\s*(몇|무슨))/.test(s)) {
      const score = Number(m[0].replace(/[^\d.]/g, ''));
      if (score >= 0 && score <= 100) return { kind: 'score', score };
    }

    if (/^(안녕|하이|헬로|hello|hi|ㅎㅇ)/.test(s) && s.length <= 12) return { kind: 'hello' };
    if (/(고마워|고맙|감사|땡큐|thank)/.test(s) && s.length <= 20) return { kind: 'thanks' };
    if (/(문의|건의|오류\s*제보|버그|개발자(에게|한테)|관리자(에게|한테)|불편\s*신고)/.test(s)) return { kind: 'contact' };
    return null;
  }

  // ── 계산 답(마크다운 조금: **굵게**, - 목록) ──
  const g = root;
  function rankReply({ rank, total, tie = 1 }) {
    if (!(total > 0) || !(rank > 0) || !(tie >= 1) || rank + tie - 1 > total) return '석차와 수강자 수를 다시 확인해 주세요. 석차(동점 포함)는 수강자 수보다 클 수 없어요.';
    const p = g.rankPercentile(rank, tie, total);
    const formula = tie > 1 ? `(${rank} + (${tie} − 1) ÷ 2) ÷ ${total} × 100` : `${rank} ÷ ${total} × 100`;
    return `**석차백분율 ${g.formatNumber(p)}%**예요.\n- 5등급제(2025년 고1부터): **${g.rankGrade(p, 5)}등급**\n- 9등급제(2024년 이전 입학): **${g.rankGrade(p, 9)}등급**\n식: ${formula}${tie > 1 ? '(동점자는 중간 석차)' : ''}\n동점자 처리는 학교 규정을 따르니 [석차로 등급 계산](/rank/)에서 과목별로 확인해 보세요.`;
  }
  function percentReply({ percent }) {
    return `상위 ${g.formatNumber(percent)}%는\n- 5등급제: **${g.rankGrade(percent, 5)}등급** (1등급 10%, 2등급 34%, 3등급 66%, 4등급 90%까지)\n- 9등급제: **${g.rankGrade(percent, 9)}등급** (1등급 4%, 2등급 11%, 3등급 23%, 4등급 40%까지)\n예요. 경계에 걸리면 수강자 수에 따라 달라질 수 있어요.`;
  }
  function scoreReply({ score }) {
    const grade = g.gradeFor(score), next = g.nextGradeGap(score);
    const range = { A: '90점 이상', B: '80점 이상 90점 미만', C: '70점 이상 80점 미만', D: '60점 이상 70점 미만', E: '60점 미만' }[grade];
    return `${g.formatNumber(score)}점은 성취도 **${grade}**(${range})예요.${next ? ` ${next.grade}까지 **${g.formatNumber(next.gap)}점** 남았어요.` : ''}\n일반 과목의 보통 기준(90·80·70·60점)이고, 소수점 처리는 학교 학업성적관리규정을 따라요.`;
  }
  function gpaReply({ value, from, to }) {
    const result = g.convertGpa(value, from, to);
    if (result === null) return '학점과 만점 기준을 다시 확인해 주세요.';
    return `${from} 만점 ${g.formatNumber(value)}점은 ${to} 만점으로 약 **${g.fixedNumber(result)}**예요.\n식: ${g.formatNumber(value)} ÷ ${from} × ${to} (단순 비례 환산)\n대학·기관마다 환산표가 다를 수 있어서 제출할 곳의 기준을 꼭 확인하세요. [학점 변환기](/gpa-converter/)`;
  }

  root.AssistantCore = { tokens, buildIndex, search, similarity, matchFaq, isWeak, contextOf, dayFrom, intent, rankReply, percentReply, scoreReply, gpaReply, FAQ_MATCH };
})(typeof window !== 'undefined' ? window : globalThis);
