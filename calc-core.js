// 계산기 공용 순수 함수. DOM을 건드리지 않으며 scripts/test-calc.mjs가 Node에서 그대로 검증한다.
const GRADE_CUTS = [['A', 90], ['B', 80], ['C', 70], ['D', 60], ['E', 0]];
const RANK_CUTS = { 9: [4, 11, 23, 40, 60, 77, 89, 96, 100], 5: [10, 34, 66, 90, 100] };
const RANK_TIERS = { 9: ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E'], 5: ['A', 'B', 'C', 'D', 'E'] };
const GPA_SCALES = {
  '4.5': { 'A+': 4.5, 'A0': 4.0, 'B+': 3.5, 'B0': 3.0, 'C+': 2.5, 'C0': 2.0, 'D+': 1.5, 'D0': 1.0, 'F': 0 },
  '4.3': { 'A+': 4.3, 'A0': 4.0, 'A-': 3.7, 'B+': 3.3, 'B0': 3.0, 'B-': 2.7, 'C+': 2.3, 'C0': 2.0, 'C-': 1.7, 'D+': 1.3, 'D0': 1.0, 'D-': 0.7, 'F': 0 },
  '4.0': { 'A+': 4.0, 'A0': 4.0, 'A-': 3.7, 'B+': 3.3, 'B0': 3.0, 'B-': 2.7, 'C+': 2.3, 'C0': 2.0, 'C-': 1.7, 'D+': 1.3, 'D0': 1.0, 'D-': 0.7, 'F': 0 }
};

// 0.1 + 0.2 같은 이진 소수 오차를 등급 경계 비교 전에 걷어낸다.
function roundFloat(value) { return Math.round(value * 1e9) / 1e9; }

// toFixed는 4.085(실제 4.08499…)를 4.08로 내린다. 표시용 반올림은 아주 작은 값을 더해 사람 기대에 맞춘다.
function fixedNumber(value, digits = 2) {
  const fixed = (value + Math.sign(value) * 1e-9).toFixed(digits);
  return Number(fixed) === 0 ? (0).toFixed(digits) : fixed;
}

function formatNumber(value, digits = 2) { return String(Number(fixedNumber(value, digits))); }

function gradeFor(score) { return GRADE_CUTS.find(([, min]) => score >= min)[0]; }

function nextGradeGap(score) {
  const index = GRADE_CUTS.findIndex(([, min]) => score >= min);
  if (index === 0) return null;
  const [grade, min] = GRADE_CUTS[index - 1];
  return { grade, gap: roundFloat(min - score) };
}

function weightedSum(items) {
  return roundFloat(items.reduce((sum, { score, weight }) => sum + score * weight, 0) / 100);
}

// 필요 점수는 덜 보여주면 안 되므로 소수 둘째 자리에서 올림한다.
function ceil2(value) { return Math.ceil(value * 100 - 1e-7) / 100; }

function requiredScore(target, completedScore, remainingWeight) {
  if (!(remainingWeight > 0)) return { status: 'no-remaining' };
  const score = roundFloat((target - completedScore) * 100 / remainingWeight);
  if (score <= 0) return { status: 'reached', score: 0 };
  if (score > 100) return { status: 'impossible', score };
  return { status: 'possible', score };
}

function rankPercentile(rank, tie, total) { return roundFloat((rank + (tie - 1) / 2) * 100 / total); }

function rankGrade(percentile, system) {
  const index = RANK_CUTS[system].findIndex(max => percentile <= max);
  return (index === -1 ? RANK_CUTS[system].length - 1 : index) + 1;
}

function rankTier(grade, system) { return RANK_TIERS[system][grade - 1]; }

function rankRowStatus({ total, rank, tie }) {
  if (!(total > 0) || !(rank > 0)) return 'pending';
  if (!(tie >= 1) || rank + tie - 1 > total) return 'invalid';
  return 'ok';
}

function mapGrade(grade, scale) {
  if (grade === 'P' || grade in GPA_SCALES[scale]) return grade;
  const base = String(grade).replace('-', '0');
  return base in GPA_SCALES[scale] ? base : 'A+';
}

function gpaSummary(rows, scale) {
  let total = 0, graded = 0, points = 0;
  for (const { credit, grade } of rows) {
    if (!(credit > 0)) continue;
    total += credit;
    if (grade === 'P') continue;
    graded += credit;
    points += (GPA_SCALES[scale][grade] ?? 0) * credit;
  }
  return { total, graded, gpa: graded ? roundFloat(points / graded) : null };
}

function projectedScore(completedScore, remainingWeight, examScore) {
  return roundFloat(completedScore + examScore * remainingWeight / 100);
}

function convertGpa(value, fromScale, toScale) {
  if (![value, fromScale, toScale].every(Number.isFinite) || fromScale <= 0 || toScale <= 0 || value < 0 || value > fromScale) return null;
  return value / fromScale * toScale;
}
