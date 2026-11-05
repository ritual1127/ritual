// 시즌 안내 한 줄과 수능 D-day. 날짜 계산은 순수 함수라 scripts/test-calc.mjs가 Node에서 그대로 검증한다.
// 해마다 할 일: 교육부가 다음 수능 날짜를 발표하면 SUNEUNG_DATES에 [시험일, 성적 통지일, 학년도] 한 줄을 더하고, /suneung/ 본문의 일정을 고친다.
const SUNEUNG_DATES = [['2026-11-19', '2026-12-11', 2027], ['2027-11-18', '2027-12-10', 2028]];
const SUNEUNG_TIMES = [
  ['1', '1교시', '국어', '08:40', '10:00'],
  ['2', '2교시', '수학', '10:30', '12:10'],
  ['3', '3교시', '영어', '13:10', '14:20'],
  ['4', '4교시', '한국사·탐구', '14:50', '16:37'],
  ['5', '5교시', '제2외국어·한문', '17:05', '17:45']
];
// 해마다 반복되는 시기(월-일, 양 끝 포함). 수능 시기가 먼저고, 안 맞으면 위에서부터 처음 맞는 줄을 쓴다.
const SEASON_YEARLY = [
  ['03-20', '04-10', '학평', '3월 학평 등급으로 수시 최저 확인', '/suneung/'],
  ['04-11', '05-05', '중간', '중간고사 목표 점수 계산', '/target-score/'],
  ['06-01', '06-12', '모평', '6월 모평 등급으로 수시 최저 확인', '/suneung/'],
  ['06-13', '07-08', '기말', '기말고사 목표 점수 계산', '/target-score/'],
  ['07-09', '07-31', '성적', '1학기 내신 등급 계산', '/rank/'],
  ['08-20', '09-15', '모평', '모평 등급으로 수시 최저 확인', '/suneung/'],
  ['09-25', '10-18', '중간', '2학기 중간고사 목표 점수 계산', '/target-score/'],
  ['11-24', '12-10', '기말', '기말고사 목표 점수 계산', '/target-score/'],
  ['12-14', '12-31', '성적', '2학기 내신 등급 계산', '/rank/']
];

const seasonPad = value => String(value).padStart(2, '0');
const localYmd = now => `${now.getFullYear()}-${seasonPad(now.getMonth() + 1)}-${seasonPad(now.getDate())}`;
const dayNumber = ymd => { const [y, m, d] = ymd.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
function dateLabel(ymd, withYear) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${withYear ? `${y}년 ` : ''}${m}월 ${d}일(${'일월화수목금토'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

function seasonFor(today) {
  for (const [exam, score] of SUNEUNG_DATES) {
    const left = dayNumber(exam) - dayNumber(today);
    const sinceScore = dayNumber(today) - dayNumber(score);
    const hit = left >= 1 && left <= 30 ? [`D-${left}`, '수능 가채점·최저 계산기']
      : left === 0 ? ['오늘', '수능 시간표·가채점 최저 확인']
      : left >= -4 && left < 0 ? ['가채점', '가채점 등급으로 최저 확인']
      : sinceScore >= 0 && sinceScore <= 3 ? ['발표', '수능 성적으로 최저 확인'] : null;
    if (hit) return { tag: hit[0], text: hit[1], href: '/suneung/' };
  }
  const monthDay = today.slice(5);
  const row = SEASON_YEARLY.find(([from, to]) => from <= monthDay && monthDay <= to);
  return row ? { tag: row[2], text: row[3], href: row[4] } : null;
}

// 시험 당일: 기기 시계로 지금 교시를 고른다. 교시 사이에는 다음 교시를 알려 주고 그 줄을 표시한다.
function examDayLine(now) {
  const line = (text, period) => ({ tag: '오늘', text, period });
  const clock = `${seasonPad(now.getHours())}:${seasonPad(now.getMinutes())}`;
  if (clock < '08:10') return line('08:10까지 입실', 'enter');
  for (const [key, name, area, start, end] of SUNEUNG_TIMES) {
    if (clock < start) return line(`다음 ${name} ${area} ${start}`, key === '3' && clock < '13:00' ? 'lunch' : key);
    if (clock < end) return line(`지금 ${name} ${area} · ${end} 종료`, key);
  }
  return line('시험 끝 · 수고했어요', 'done');
}

function suneungLine(now) {
  const today = localYmd(now);
  const row = SUNEUNG_DATES.find(([, score]) => today <= score);
  if (!row) return null;
  const [exam, score, year] = row;
  if (today === exam) return examDayLine(now);
  const countdown = target => `D-${dayNumber(target) - dayNumber(today)}`;
  if (today < exam) return { tag: countdown(exam), text: `${year}학년도 수능 · ${dateLabel(exam, exam.slice(0, 4) !== today.slice(0, 4))}`, period: null };
  if (today < score) return { tag: countdown(score), text: `수능 성적 통지 · ${dateLabel(score)}`, period: null };
  return { tag: '오늘', text: '수능 성적 통지일', period: null };
}

// 화면: /suneung/은 D-day 줄과 시간표 강조만, 다른 페이지는 제목(휴대폰은 글자 탭) 아래에 시즌 줄을 넣는다.
if (typeof document !== 'undefined') {
  const dday = document.getElementById('dday');
  if (dday) {
    const render = () => {
      const line = suneungLine(new Date());
      dday.hidden = !line;
      document.querySelectorAll('tr[data-period]').forEach(row => row.classList.toggle('is-hit', row.dataset.period === line?.period));
      if (!line) return;
      dday.querySelector('.season-tag').textContent = line.tag;
      dday.querySelector('.season-text').textContent = line.text;
    };
    render();
    setInterval(render, 30000); // 시험 당일 켜 둔 화면의 교시가 낡지 않게
  } else {
    const head = document.querySelector('.page-head');
    const season = head && seasonFor(localYmd(new Date()));
    if (season && season.href !== location.pathname) {
      const link = document.createElement('a');
      link.className = 'season';
      link.href = season.href;
      link.innerHTML = `<span class="season-tag">${season.tag}</span><span class="season-text">${season.text}</span>`;
      (document.querySelector('.tool-seg') || head).after(link);
    }
  }
}
