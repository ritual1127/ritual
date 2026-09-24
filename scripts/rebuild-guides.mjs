import fs from 'node:fs';
import path from 'node:path';

const guides = [
  {
    slug: 'performance-exam-weight',
    title: '수행평가·지필고사 반영비율 계산법',
    description: '수행평가와 지필고사의 반영비율을 최종 성적으로 합치는 공식, 두 가지 계산 예시와 합계 오류를 쉽게 설명합니다.',
    tagline: '각 점수에 반영 비율을 곱한 뒤 더하면 최종 반영 점수가 나옵니다.',
    intro: '수행평가와 시험 점수를 합칠 때는 단순 평균이 아니라 각각의 반영 비율을 적용해야 합니다. 수행 80점과 지필 90점이라고 해서 무조건 85점이 되는 것은 아닙니다.',
    sections: [
      ['반영점수 공식', '<strong>최종 점수 = (평가1 점수 × 평가1 비율) + (평가2 점수 × 평가2 비율) + …</strong>입니다. 40%는 계산할 때 0.4로 바꿉니다.'],
      ['예시 1: 수행 40%, 지필 60%', '수행평가 80점, 지필고사 90점이면 80×0.4 + 90×0.6 = 32 + 54로 <strong>86점</strong>입니다. 비율이 큰 지필고사가 최종 점수에 더 큰 영향을 줍니다.'],
      ['예시 2: 세 항목을 합칠 때', '발표 95점 30%, 보고서 80점 30%, 지필 90점 40%라면 28.5 + 24 + 36으로 <strong>88.5점</strong>입니다.'],
      ['비율 합계부터 확인하세요', '모든 평가가 입력됐다면 반영 비율 합계는 보통 100%가 됩니다. 합계가 90%라면 평가 하나를 빠뜨렸는지, 110%라면 비율을 중복 입력했는지 확인하세요. 수행평가가 20점 만점이라면 먼저 100점 만점 점수인지 학교의 환산 방식을 확인해야 합니다.'],
      ['반올림은 마지막에', '중간 항목마다 반올림하면 최종값이 달라질 수 있습니다. 계산 과정에서는 소수값을 유지하고, 학교가 정한 자릿수에서 마지막 결과만 반올림하는 편이 안전합니다.']
    ],
    cta: '/', ctaText: '수행·지필 점수 바로 계산하기',
    related: [['/blog/target-exam-score/','남은 시험에서 필요한 점수'], ['/target-score/','목표점수 계산기']],
    faqs: [['반영 비율이 모두 같으면 어떻게 되나요?','모든 항목 비율이 같을 때만 단순 평균과 같은 결과가 나옵니다.'], ['시험이 100점 만점이 아니면요?','학교가 안내한 환산 점수 또는 만점 대비 점수로 바꾼 뒤 반영해야 합니다.']]
  },
  {
    slug: 'raw-score-and-grade',
    title: '원점수와 A~E·내신등급의 차이',
    description: '시험 원점수, 성취도 A~E, 석차에 따른 내신등급이 서로 어떻게 다른지 사례와 함께 구분해 설명합니다.',
    tagline: '같은 90점이어도 원점수·성취도·석차등급은 서로 다른 정보입니다.',
    intro: '원점수는 내가 맞힌 정도이고, A~E는 정해진 성취 기준에 따른 구간이며, 내신등급은 같은 과목 수강자 안에서의 상대적인 위치를 나타낼 수 있습니다. 성적표의 열 이름을 먼저 확인해야 혼동하지 않습니다.',
    sections: [
      ['원점수는 실제 받은 점수', '100점 만점 시험에서 87점을 받았다면 원점수는 87점입니다. 수행평가와 지필고사를 반영비율로 합친 값도 원점수 산출에 쓰일 수 있습니다.'],
      ['A~E는 성취 수준', 'A, B, C, D, E는 학교가 적용하는 성취도 기준에 따라 결정됩니다. 예를 들어 90점 이상이 A인 기준에서는 92점과 98점이 모두 A지만 원점수는 서로 다릅니다. 정확한 구간은 과목의 평가계획을 확인하세요.'],
      ['내신등급은 석차 위치와 연결', '내신 석차등급은 수강자 수와 석차백분율을 사용합니다. 90점을 받아도 시험이 쉬워 상위 20%라면, 같은 90점으로 상위 4%인 과목과 등급이 다를 수 있습니다.'],
      ['예시: 92점인데 등급이 다른 이유', '학생 A는 100명 중 3등, 학생 B는 다른 과목에서 100명 중 18등이라고 해보겠습니다. 둘 다 원점수 92점이어도 상대적 위치가 다르므로 석차등급 결과는 같지 않을 수 있습니다.'],
      ['무엇을 계산기에 넣어야 하나요?', '수행·지필 계산기에는 각 평가 점수와 비율을, 내신등급 계산기에는 석차·동점자·수강자 수를 넣습니다. A~E 목표라면 해당 과목이 안내한 성취도 점수 구간을 기준으로 목표점수를 정하세요.']
    ],
    cta: '/rank/', ctaText: '내 석차로 등급 확인하기',
    related: [['/','수행·지필 반영점수 계산기'], ['/blog/five-grade-system/','내신 5등급제 구간']],
    faqs: [['A를 받으면 무조건 1등급인가요?','아닙니다. 성취도와 석차등급은 산출 기준이 다르므로 같은 의미가 아닙니다.'], ['원점수만으로 내신등급을 알 수 있나요?','수강자 분포와 석차 정보가 없다면 원점수만으로 정확한 석차등급을 정할 수 없습니다.']]
  },
  {
    slug: 'five-grade-system',
    title: '내신 5등급제 구간과 경계 계산법',
    description: '내신 5등급제의 누적 비율 10·34·66·90·100% 구간과 경계값을 석차백분율 예시로 설명합니다.',
    tagline: '5등급제는 석차백분율의 누적 경계 10·34·66·90·100%를 확인합니다.',
    intro: '5등급제 계산은 점수 자체보다 수강자 중 나의 위치를 백분율로 바꾸는 과정이 핵심입니다. 적용 대상과 실제 산출 기준은 학교의 성적 처리 안내를 먼저 확인하세요.',
    sections: [
      ['5등급 누적 구간', '<strong>1등급 10% 이하, 2등급 34% 이하, 3등급 66% 이하, 4등급 90% 이하, 5등급 100% 이하</strong>로 구분합니다. 앞 구간의 끝을 넘으면 다음 등급으로 이동합니다.'],
      ['예시 1: 정확히 10% 경계', '수강자 100명 중 중간석차가 10등이면 10÷100×100 = 10%이므로 1등급 구간입니다. 중간석차가 11등이면 11%로 2등급 구간입니다.'],
      ['예시 2: 34% 경계', '수강자 200명에서 중간석차 68등은 34%로 2등급 구간입니다. 69등은 34.5%이므로 3등급 구간으로 넘어갑니다.'],
      ['동점자는 중간석차 사용', '10등인 학생이 3명 동점이라면 10, 11, 12등 자리를 함께 차지합니다. 중간석차는 10 + (3−1)÷2 = 11등이며 이 값으로 백분율을 구합니다.'],
      ['단위수 평균과 개인 과목 등급은 다릅니다', '여러 과목 평균을 낼 때는 과목별 등급에 단위수를 곱해 합산한 뒤 총 단위수로 나눕니다. 한 과목의 석차등급 경계 계산과는 별도 과정입니다.']
    ],
    cta: '/rank/', ctaText: '5등급제로 계산하기',
    related: [['/blog/nine-grade-system/','내신 9등급제 경계'], ['/blog/tied-rank/','동점자 중간석차 계산']],
    faqs: [['10.0%는 1등급인가요?','이 계산 기준에서는 누적 10% 이하이므로 1등급 구간입니다.'], ['모든 학생에게 5등급제가 적용되나요?','적용 교육과정과 과목에 따라 다를 수 있으므로 학교의 공식 안내를 확인해야 합니다.']]
  },
  {
    slug: 'nine-grade-system',
    title: '내신 9등급제 석차백분율 경계표',
    description: '내신 9등급제 누적 경계 4·11·23·40·60·77·89·96·100%와 경계 바로 앞뒤 사례를 정리합니다.',
    tagline: '9등급제는 4%부터 100%까지 아홉 개 누적 구간으로 나눕니다.',
    intro: '9등급제에서는 석차를 수강자 수로 나눈 석차백분율이 어느 누적 구간에 들어가는지 확인합니다. 동점자가 있다면 실제 석차 대신 중간석차를 사용합니다.',
    sections: [
      ['9등급 누적 경계표', '<strong>1등급 4%, 2등급 11%, 3등급 23%, 4등급 40%, 5등급 60%, 6등급 77%, 7등급 89%, 8등급 96%, 9등급 100%</strong>가 각 구간의 누적 상한입니다.'],
      ['예시 1: 1등급 마지막 자리', '수강자 200명에서 중간석차 8등은 8÷200×100 = 4%로 1등급 구간입니다. 9등은 4.5%여서 2등급 구간입니다.'],
      ['예시 2: 5등급과 6등급 경계', '수강자 100명에서 중간석차 60등은 60%로 5등급 구간입니다. 61등은 61%로 6등급 구간에 해당합니다.'],
      ['수강자 수가 적을 때', '수강자 20명은 한 명이 5%에 해당하므로 4% 경계를 정수 석차로 딱 맞추기 어렵습니다. 실제 학교 성적 처리는 적용 규정과 동점자 처리에 따라 달라질 수 있습니다.'],
      ['등급 평균은 단위수를 반영', '국어 2등급 4단위와 영어 4등급 2단위를 단순 평균하면 3이지만, 단위수 가중평균은 (2×4 + 4×2)÷6 = 2.67입니다.']
    ],
    cta: '/rank/', ctaText: '9등급제로 계산하기',
    related: [['/blog/five-grade-system/','내신 5등급제 구간'], ['/blog/rank-percentile/','석차백분율 구하는 법']],
    faqs: [['상위 4%는 모두 1등급인가요?','이 계산 기준에서는 중간석차 백분율이 4% 이하인 구간을 1등급으로 봅니다.'], ['등급 경계에서 반올림하나요?','임의로 먼저 반올림하지 말고 계산된 백분율과 학교의 공식 처리 기준을 확인하세요.']]
  },
  {
    slug: 'rank-percentile',
    title: '석차백분율 계산법과 등급 찾는 순서',
    description: '석차와 수강자 수로 석차백분율을 구하는 공식, 동점자 중간석차 적용법과 계산 사례를 설명합니다.',
    tagline: '중간석차를 수강자 수로 나누고 100을 곱하면 석차백분율입니다.',
    intro: '석차백분율은 상위 몇 퍼센트에 있는지를 나타냅니다. 숫자가 작을수록 앞선 위치입니다. 90백분위 같은 시험 백분위와 표현이 비슷해도 의미가 다를 수 있으니 성적표 항목을 구분하세요.',
    sections: [
      ['기본 공식', '<strong>석차백분율 = 중간석차 ÷ 수강자 수 × 100</strong>입니다. 동점자가 한 명뿐이면 중간석차와 석차가 같습니다.'],
      ['예시 1: 동점자가 없을 때', '120명 중 12등이라면 12÷120×100 = <strong>10%</strong>입니다. 즉 수강자 중 상위 10% 지점입니다.'],
      ['예시 2: 동점자 4명일 때', '150명 중 20등이고 같은 석차가 4명이면 중간석차는 20 + (4−1)÷2 = 21.5등입니다. 21.5÷150×100 = 약 <strong>14.33%</strong>입니다.'],
      ['순위를 잘못 넣지 마세요', '1등부터 시작하는 석차를 입력해야 합니다. 등수와 동점자 수를 더해 차지하는 마지막 자리가 수강자 수를 넘으면 입력이 불가능한 조합입니다.'],
      ['백분율 다음에 등급 구간 확인', '백분율을 구한 뒤 자신에게 적용되는 5등급 또는 9등급 누적 경계와 비교합니다. 교육과정이나 과목별 적용 기준을 모르면 학교 안내가 우선입니다.']
    ],
    cta: '/rank/', ctaText: '석차백분율 계산하기',
    related: [['/blog/tied-rank/','동석차 중간석차 공식'], ['/blog/nine-grade-system/','9등급제 경계표']],
    faqs: [['석차백분율이 0%가 될 수 있나요?','석차는 1등부터 시작하므로 정상 입력에서는 0%가 되지 않습니다.'], ['백분율 10%는 상위 90%라는 뜻인가요?','이 페이지의 석차백분율 10%는 앞에서 10% 지점, 즉 상위 10%를 뜻합니다.']]
  },
  {
    slug: 'tied-rank',
    title: '동석차·동점자 중간석차 계산법',
    description: '같은 점수의 동점자가 있을 때 중간석차를 구하는 공식과 수강자 범위를 넘는 잘못된 입력 사례를 설명합니다.',
    tagline: '동점자가 차지한 순위 범위의 가운데 값을 중간석차로 사용합니다.',
    intro: '동점자가 여러 명이면 모두에게 시작 석차만 적용하지 않고, 그 학생들이 차지한 순위의 가운데를 사용합니다. 이를 중간석차라고 합니다.',
    sections: [
      ['중간석차 공식', '<strong>중간석차 = 석차 + (동점자 수 − 1) ÷ 2</strong>입니다. 동점자 수에는 본인도 포함합니다.'],
      ['예시 1: 10등이 3명', '10등부터 세 명이 10·11·12등 자리를 차지합니다. 중간은 11등이며 공식으로도 10 + (3−1)÷2 = <strong>11등</strong>입니다.'],
      ['예시 2: 공동 1등이 2명', '두 학생이 1·2등 자리를 함께 차지하므로 중간석차는 1 + (2−1)÷2 = <strong>1.5등</strong>입니다. 소수 석차가 나오는 것은 오류가 아닙니다.'],
      ['입력 가능한 범위 확인', '<strong>석차 + 동점자 수 − 1 ≤ 수강자 수</strong>여야 합니다. 30명 중 29등 동점자가 3명이라는 입력은 31등 자리까지 필요하므로 성립하지 않습니다.'],
      ['중간석차를 백분율로 바꾸기', '100명 중 20등 동점자 4명의 중간석차는 21.5등이고, 석차백분율은 21.5%입니다. 이 값으로 적용 등급 구간을 찾습니다. 동점자 모두에게 시작 석차 20등을 그대로 적용하면 백분율이 실제보다 앞서게 되므로 주의하세요.']
    ],
    cta: '/rank/', ctaText: '동점자 포함 등급 계산하기',
    related: [['/blog/rank-percentile/','석차백분율 계산 순서'], ['/blog/five-grade-system/','5등급제 경계']],
    faqs: [['동점자 수에 나를 포함하나요?','네. 같은 석차를 받은 전체 인원 수를 입력하며 본인도 포함합니다.'], ['동점자가 없으면 무엇을 입력하나요?','동점자 수 1명을 입력하면 중간석차가 원래 석차와 같아집니다.']]
  },
  {
    slug: 'gpa-average',
    title: '대학 GPA 학점 평균 계산법',
    description: '과목별 평점과 학점 수로 GPA 가중평균을 구하는 공식, F 포함과 P/F 과목 제외 사례를 설명합니다.',
    tagline: '평점에 학점 수를 곱해 합친 뒤 평점 대상 총 학점으로 나눕니다.',
    intro: 'GPA는 과목 평점을 단순히 더해 과목 수로 나누지 않습니다. 3학점 과목은 1학점 과목보다 평균에 세 배의 비중을 가집니다.',
    sections: [
      ['학점 가중평균 공식', '<strong>GPA = Σ(과목 평점 × 학점 수) ÷ Σ(평점 계산 대상 학점 수)</strong>입니다. 대학의 평점표가 4.5인지 4.3인지 먼저 선택하세요.'],
      ['예시 1: 두 과목 평균', '3학점 과목 A+가 4.5점, 2학점 과목 B0가 3.0점이라면 (4.5×3 + 3.0×2)÷5 = 19.5÷5로 <strong>3.90</strong>입니다.'],
      ['예시 2: F가 포함될 때', '3학점 F 0점과 2학점 A0 4.0점이면 (0×3 + 4.0×2)÷5 = <strong>1.60</strong>입니다. F 과목의 학점 수는 분모에도 포함됩니다.'],
      ['P/F 과목 처리', '일반적으로 P는 학점 취득에는 포함돼도 GPA의 평점 합계와 분모에서 제외됩니다. P 과목만 입력했다면 평점 대상 학점이 0이므로 GPA를 계산할 수 없습니다. 대학 규정이 우선입니다.'],
      ['재수강과 성적표 기준', '재수강 전 성적을 지우는지, 두 성적을 모두 반영하는지, 최고 성적 제한이 있는지는 대학마다 다릅니다. 계산기에는 공식 성적표에 GPA 대상으로 표시되는 성적을 넣으세요.']
    ],
    cta: '/gpa/', ctaText: '내 과목으로 GPA 계산하기',
    related: [['/blog/gpa-scale-conversion/','4.5·4.3·4.0 만점 환산'], ['/gpa-converter/','GPA 비례 환산기']],
    faqs: [['F도 총 신청학점에 넣나요?','일반적인 GPA 가중평균에서는 F의 학점 수도 평점 대상 분모에 포함하지만 대학 규정을 확인하세요.'], ['P만 있으면 GPA가 0인가요?','평점 대상 과목이 없으므로 0점이 아니라 계산할 수 없는 상태입니다.']]
  },
  {
    slug: 'gpa-scale-conversion',
    title: 'GPA 4.5·4.3·4.0 만점 환산법',
    description: 'GPA를 4.5·4.3·4.0 만점 사이에서 단순 비례로 바꾸는 공식과 예시, 공식 환산표와의 차이를 안내합니다.',
    tagline: '단순 비례 환산은 현재 GPA의 만점 대비 비율을 새 만점에 적용합니다.',
    intro: '서로 다른 만점의 GPA를 빠르게 비교하려면 비례 환산을 쓸 수 있습니다. 다만 대학·기관의 공식 환산표는 등급별 기준이나 별도 공식을 사용할 수 있어 결과가 다를 수 있습니다.',
    sections: [
      ['단순 비례 환산 공식', '<strong>환산 GPA = 현재 GPA ÷ 현재 만점 × 바꿀 만점</strong>입니다. 현재 점수가 0보다 작거나 현재 만점을 넘으면 계산하지 않습니다.'],
      ['예시 1: 4.5에서 4.3으로', '3.8÷4.5×4.3 = 3.631…이므로 소수 둘째 자리로 표시하면 약 <strong>3.63/4.3</strong>입니다.'],
      ['예시 2: 4.0에서 4.5로', '3.2÷4.0×4.5 = <strong>3.60/4.5</strong>입니다. 같은 만점 대비 80%를 4.5 만점에 적용한 값입니다.'],
      ['같은 만점이면 값이 그대로', '4.3 만점의 3.7을 다시 4.3 만점으로 바꾸면 3.7입니다. 현재 만점이 0이거나 음수라면 나눗셈이 불가능합니다.'],
      ['공식 제출에는 기관 표를 사용', '단순 비례 환산은 참고용입니다. 지원 대학, 장학기관, 기업이 자체 환산표를 제공한다면 그 표가 우선입니다. 백분위 성적과도 같은 개념이 아닙니다.']
    ],
    cta: '/gpa-converter/', ctaText: 'GPA 만점 환산하기',
    related: [['/blog/gpa-average/','학점 가중평균 계산'], ['/gpa/','GPA 계산기']],
    faqs: [['비례 환산값을 공식 지원서에 써도 되나요?','제출처가 요구한 공식 환산 방식이 있다면 반드시 그 방식을 사용하세요.'], ['4.5 만점 점수가 4.3으로 바꾸면 손해인가요?','만점과 점수가 함께 바뀌므로 숫자 크기만 비교하면 안 됩니다. 비율은 동일하게 유지됩니다.']]
  }
];

// 모든 페이지가 같은 셸을 쓴다(styles.css의 .appbar/.site-footer).
const SHELL = `  <a class="skip-link" href="#main">본문 바로가기</a>
  <header class="appbar">
    <div class="appbar-inner glass" data-mini="false">
      <a class="logo" href="/"><img class="logo-icon" src="/favicon.png?v=6" alt="" width="28" height="28"><span class="logo-text">성적계산기</span></a>
      <button type="button" class="tool-menu-btn" aria-expanded="false" aria-controls="toolMenu" aria-label="도구 메뉴"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg></button>
      <nav class="tools glass" id="toolMenu" aria-label="도구">
        <a class="tool" href="/"><span class="app-icon" data-app="score" aria-hidden="true"></span><span class="tool-name">수행·지필</span></a>
        <a class="tool" href="/target-score/"><span class="app-icon" data-app="target" aria-hidden="true"></span><span class="tool-name">목표점수</span></a>
        <a class="tool" href="/rank/"><span class="app-icon" data-app="rank" aria-hidden="true"></span><span class="tool-name">내신등급</span></a>
        <a class="tool" href="/gpa/"><span class="app-icon" data-app="gpa" aria-hidden="true"></span><span class="tool-name">학점</span></a>
        <a class="tool" href="/gpa-converter/"><span class="app-icon" data-app="convert" aria-hidden="true"></span><span class="tool-name">GPA 환산</span></a>
        <span class="tools-sep" aria-hidden="true"></span>
        <a class="tool" href="/todayfood/"><span class="app-icon" data-app="food" aria-hidden="true"></span><span class="tool-name">급식</span></a>
        <a class="tool" href="/todayclass/"><span class="app-icon" data-app="class" aria-hidden="true"></span><span class="tool-name">시간표</span></a>
      </nav>
      <button type="button" class="bar-main" data-label="성적계산기"><span class="bar-text"><span class="bar-label">성적계산기</span><span class="bar-value"></span></span><span class="bar-badge" hidden></span></button>
      <button type="button" class="theme-toggle" aria-pressed="false" aria-label="다크 모드">
        <svg class="icon icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/></svg>
        <svg class="icon icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>
      </button>
    </div>
  </header>`;

const FOOTER = `  <footer class="site-footer">
    <p>계산 결과는 참고용이며 학교·대학의 공식 성적 처리 규정을 우선 확인하세요.</p>
    <nav class="footer-links" aria-label="사이트 정보"><a href="/blog/">계산 가이드</a><a href="/faq/">자주 묻는 질문</a><a href="/guide/">사용법</a><a href="/privacy/">개인정보처리방침</a></nav>
    <p class="copyright">© 2026 성적 계산기</p>
  </footer>`;

function render(g) {
  const url = `https://naver1.cloud/blog/${g.slug}/`;
  const sections = g.sections.map(([heading, body]) => heading.includes('공식')
    ? `      <section class="formula-box">\n        <h2>${heading}</h2>\n        <p>${body}</p>\n      </section>`
    : `      <h2>${heading}</h2>\n      <p>${body}</p>`).join('\n\n');
  const related = g.related.map(([href, label]) => `        <li><a href="${href}">${label}</a></li>`).join('\n');
  const faqs = g.faqs.map(([q, a]) => `      <details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('\n');
  const schema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: g.title,
    description: g.description, url, image: 'https://naver1.cloud/og.png',
    mainEntityOfPage: {'@type': 'WebPage', '@id': url},
    datePublished: '2026-08-09', dateModified: '2026-08-09',
    author: {'@type': 'Organization', name: '성적 계산기'},
    publisher: {'@type': 'Organization', name: '성적 계산기'}
  });
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">
  <title>${g.title} | 성적 계산기</title>
  <meta name="description" content="${g.description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${url}">
  <link rel="alternate" type="application/rss+xml" title="성적 계산기 가이드 RSS" href="https://naver1.cloud/rss.xml">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${g.title}">
  <meta property="og:description" content="${g.description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://naver1.cloud/og.png?v=6">
  <meta property="og:locale" content="ko_KR">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${g.title}">
  <meta name="twitter:description" content="${g.description}">
  <meta name="twitter:image" content="https://naver1.cloud/og.png?v=6">
  <meta name="theme-color" content="#F5F5F7" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="../../icon-192.png?v=6">
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="../../styles.css?v=20260924f">
  <script src="../../site-nav.js?v=20260924f"></script>
  <script src="../../assistant.js?v=20260924f" defer></script>
  <script type="application/ld+json">${schema}</script>
</head>
<body>
${SHELL}

  <main id="main" class="page page-narrow article">
    <article class="prose">
      <a class="back-link" href="/blog/">← 계산 가이드</a>
      <h1>${g.title}</h1>
      <p class="lede">${g.tagline}</p>
      <p class="updated">게시·수정 2026-08-09</p>
      <p class="article-lead">${g.intro}</p>

${sections}

      <p class="cta"><a class="btn" href="${g.cta}">${g.ctaText}</a></p>

      <h2>이어서 확인하기</h2>
      <ul class="link-list">
${related}
      </ul>

      <h2>자주 묻는 질문</h2>
${faqs}
    </article>
  </main>

${FOOTER}
</body>
</html>
`;
}

for (const guide of guides) {
  fs.writeFileSync(path.join(process.cwd(), 'blog', guide.slug, 'index.html'), render(guide));
}

console.log(`${guides.length}개 가이드 재작성 완료`);
