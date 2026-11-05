import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../calc-core.js', import.meta.url), 'utf8'), context);
// vm 안에서 만든 객체는 프로토타입이 달라 deepEqual 전에 현재 realm 객체로 옮긴다.
const plain = value => JSON.parse(JSON.stringify(value));
const c = vm.runInContext('({ formatNumber, fixedNumber, gradeFor, nextGradeGap, weightedSum, ceil2, requiredScore, rankPercentile, rankGrade, rankTier, rankRowStatus, mapGrade, gpaSummary, convertGpa, projectedScore, absGrade, suneungMinimum })', context);

// 수행·지필
assert.equal(c.weightedSum([{ score: 90, weight: 40 }, { score: 80, weight: 30 }, { score: 70, weight: 30 }]), 81);
assert.equal(c.weightedSum([{ score: 92, weight: 20 }, { score: 88, weight: 20 }, { score: 81, weight: 30 }, { score: 86, weight: 30 }]), 86.1);
assert.equal(c.weightedSum([{ score: 89.7, weight: 30 }, { score: 90.3, weight: 30 }, { score: 90, weight: 40 }]), 90);
assert.equal(c.gradeFor(90), 'A');
assert.equal(c.gradeFor(89.99), 'B');
assert.equal(c.gradeFor(59.99), 'E');
assert.deepEqual(plain(c.nextGradeGap(86.5)), { grade: 'A', gap: 3.5 });
assert.equal(c.nextGradeGap(95), null);
assert.equal(c.formatNumber(86.5), '86.5');
assert.equal(c.formatNumber(90 - 86.66), '3.34');
assert.equal(c.formatNumber(-0.001), '0');
// toFixed는 4.085를 4.08로 내린다(이진 표현). 사람 기대대로 반올림해야 한다.
assert.equal(c.fixedNumber(3.8 / 4 * 4.3), '4.09');
assert.equal(c.fixedNumber(1.005), '1.01');
assert.equal(c.fixedNumber(3.6), '3.60');
assert.equal(c.fixedNumber(-0.001), '0.00');
assert.equal(c.formatNumber(86.125), '86.13');

// 목표점수
assert.equal(c.requiredScore(90, 54, 40).score, 90);
assert.equal(c.requiredScore(90, 51, 40).score, 97.5);
assert.equal(c.requiredScore(80, 85, 20).status, 'reached');
assert.equal(c.requiredScore(95, 50, 40).status, 'impossible');
assert.equal(c.requiredScore(90, 90, 0).status, 'no-remaining');
assert.equal(c.ceil2(97.5), 97.5);
assert.equal(c.ceil2(97.501), 97.51);
assert.equal(c.ceil2(97.49999999999999), 97.5);

// 내신등급
assert.equal(c.rankPercentile(8, 1, 200), 4);
assert.equal(c.rankPercentile(10, 3, 100), 11);
assert.equal(c.rankGrade(4, 9), 1);
assert.equal(c.rankGrade(4.01, 9), 2);
assert.equal(c.rankGrade(100, 9), 9);
assert.equal(c.rankGrade(10, 5), 1);
assert.equal(c.rankGrade(10.1, 5), 2);
assert.equal(c.rankTier(3, 9), 'B');
assert.equal(c.rankTier(5, 5), 'E');
assert.equal(c.rankRowStatus({ total: 30, rank: 29, tie: 3 }), 'invalid');
assert.equal(c.rankRowStatus({ total: 30, rank: null, tie: 1 }), 'pending');
assert.equal(c.rankRowStatus({ total: 30, rank: 28, tie: 3 }), 'ok');

// 학점
assert.equal(c.gpaSummary([{ credit: 3, grade: 'A+' }, { credit: 2, grade: 'B0' }], '4.5').gpa, 3.9);
assert.equal(c.gpaSummary([{ credit: 3, grade: 'F' }, { credit: 2, grade: 'A0' }], '4.5').gpa, 1.6);
assert.deepEqual(plain(c.gpaSummary([{ credit: 2, grade: 'P' }], '4.5')), { total: 2, graded: 0, gpa: null });
assert.equal(c.mapGrade('A-', '4.5'), 'A0');
assert.equal(c.mapGrade('P', '4.3'), 'P');
assert.equal(c.mapGrade('??', '4.5'), 'A+');

// GPA 환산
assert.equal(c.convertGpa(4.5, 4.5, 4.3), 4.3);
assert.equal(c.convertGpa(-1, 4.5, 4.3), null);
assert.equal(c.convertGpa(5, 4.5, 4.3), null);
assert.equal(c.convertGpa(1, 0, 4.3), null);

// 비율 빠른 채우기: 합이 정확히 total이 되도록 나머지는 마지막 칸에

// 만약에 슬라이더
assert.equal(c.projectedScore(51, 40, 97.5), 90);
assert.equal(c.projectedScore(51, 40, 100), 91);
assert.equal(c.projectedScore(51, 40, 0), 51);

// 수능: 절대평가 등급
assert.equal(c.absGrade('english', 100), 1); assert.equal(c.absGrade('english', 90), 1); assert.equal(c.absGrade('english', 89), 2);
assert.equal(c.absGrade('english', 20), 8); assert.equal(c.absGrade('english', 19), 9); assert.equal(c.absGrade('english', 0), 9);
assert.equal(c.absGrade('english', 101), null); assert.equal(c.absGrade('english', null), null); assert.equal(c.absGrade('english', NaN), null);
assert.equal(c.absGrade('history', 50), 1); assert.equal(c.absGrade('history', 40), 1); assert.equal(c.absGrade('history', 39), 2);
assert.equal(c.absGrade('history', 5), 8); assert.equal(c.absGrade('history', 4), 9); assert.equal(c.absGrade('history', 51), null); assert.equal(c.absGrade('history', -1), null);

// 수능: 최저 충족
const G = o => ({ kor: null, math: null, eng: null, hist: null, inq1: null, inq2: null, ...o });
const R = o => ({ areas: ['kor', 'math', 'eng', 'inq'], count: 3, mode: 'sum', limit: 6, inq: 'best', must: '', hist: 0, ...o });
const m = (g, r) => plain(c.suneungMinimum(G(g), R(r)));
let r = m({ kor: 2, math: 4, eng: 2, inq1: 1, inq2: 3 });
assert.equal(r.status, 'met'); assert.equal(r.sum, 5); assert.deepEqual(r.picked.map(p => p.area), ['inq', 'kor', 'eng']);
r = m({ kor: 3, math: 4, eng: 3, inq1: 3 }); assert.equal(r.status, 'unmet'); assert.equal(r.gap, 3);
// 탐구 평균·버림
r = m({ kor: 2, eng: 2, inq1: 2, inq2: 3 }, { inq: 'avgFloor' }); assert.equal(r.status, 'met'); assert.equal(r.sum, 6); assert.equal(r.inqValue, 2);
r = m({ kor: 2, eng: 2, inq1: 2, inq2: 3 }, { inq: 'avg' }); assert.equal(r.status, 'unmet'); assert.equal(r.sum, 6.5); assert.equal(r.gap, 0.5);
r = m({ kor: 2, eng: 1, inq1: 2, inq2: 3 }, { inq: 'avg' }); assert.equal(r.sum, 5.5); assert.equal(r.status, 'met');
// 평균은 두 과목이 다 있어야 한다: 한 과목으로 몰래 계산하지 않는다
r = m({ kor: 1, math: 2, eng: 2, inq1: 1 }, { inq: 'avg' }); assert.equal(r.status, 'met'); assert.ok(!r.picked.some(p => p.area === 'inq'));
r = m({ kor: 1, eng: 2, inq1: 1 }, { inq: 'avg' }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('inq'));
// 필수 영역
r = m({ kor: 1, math: 3, eng: 1, inq1: 1 }, { count: 2, limit: 4, must: 'math' }); assert.equal(r.status, 'met'); assert.deepEqual(r.picked.map(p => p.area), ['math', 'kor']);
r = m({ kor: 1, math: 3, eng: 1, inq1: 1 }, { count: 2, limit: 3, must: 'math' }); assert.equal(r.status, 'unmet'); assert.equal(r.gap, 1);
r = m({ kor: 1, eng: 1, inq1: 1 }, { count: 2, must: 'math' }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('must'));
r = m({ kor: 1, eng: 1 }, { areas: ['kor', 'eng'], count: 2, limit: 2, must: 'math' }); assert.equal(r.status, 'met'); // 꺼진 영역은 필수로 치지 않는다
// 각각 조건
r = m({ kor: 1, math: 3, eng: 2, inq1: 2 }, { mode: 'each', limit: 2 }); assert.equal(r.status, 'met'); assert.equal(r.within, 3);
r = m({ kor: 1, math: 3, eng: 3, inq1: 2 }, { mode: 'each', limit: 2 }); assert.equal(r.status, 'unmet'); assert.equal(r.within, 2); assert.equal(r.gap, 1);
// 한국사 조건
r = m({ kor: 1, math: 1, eng: 1, inq1: 1, hist: 5 }, { hist: 4 }); assert.equal(r.status, 'unmet'); assert.equal(r.histOk, false);
r = m({ kor: 1, math: 1, eng: 1, inq1: 1 }, { hist: 4 }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('hist'));
r = m({ kor: 1, math: 1, eng: 1, inq1: 1, hist: 4 }, { hist: 4 }); assert.equal(r.status, 'met'); assert.equal(r.histOk, true);
r = m({ kor: 1, math: 1, eng: 1, inq1: 1, hist: 9 }); assert.equal(r.status, 'met'); assert.equal(r.histOk, null); // 조건 없으면 한국사는 보지 않는다
// 입력 부족·잘못된 조건
r = m({ kor: 2, eng: 2 }); assert.equal(r.status, 'pending'); assert.ok(r.missing.includes('count')); assert.equal(r.need, 3); assert.equal(r.have, 2);
r = m({ kor: 1, math: 1, eng: 1 }, { areas: ['kor', 'math'], count: 3 }); assert.equal(r.status, 'invalid');
// 꺼진 영역은 등급이 있어도 고르지 않는다
r = m({ kor: 1, math: 9, eng: 1, inq1: 1 }, { areas: ['kor', 'math', 'inq'], count: 2, limit: 2 }); assert.equal(r.status, 'met'); assert.deepEqual(r.picked.map(p => p.area), ['kor', 'inq']);

// 시즌 안내·수능 D-day(season.js는 document가 없으면 화면을 건드리지 않는다)
const sctx = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../season.js', import.meta.url), 'utf8'), sctx);
const s = vm.runInContext('({ SUNEUNG_DATES, seasonFor, suneungLine })', sctx);
for (const [exam, score] of s.SUNEUNG_DATES) { assert.equal(new Date(exam + 'T00:00').getDay(), 4); assert.equal(new Date(score + 'T00:00').getDay(), 5); assert.ok(score > exam); }
const sf = d => plain(s.seasonFor(d));
assert.deepEqual(sf('2026-11-05'), { tag: 'D-14', text: '수능 가채점·최저 계산기', href: '/suneung/' });
assert.equal(sf('2026-10-20').tag, 'D-30'); assert.equal(sf('2026-10-19'), null); assert.equal(sf('2026-11-18').tag, 'D-1');
assert.equal(sf('2026-11-19').tag, '오늘'); assert.equal(sf('2026-11-20').tag, '가채점'); assert.equal(sf('2026-11-23').tag, '가채점');
assert.deepEqual(sf('2026-11-24'), { tag: '기말', text: '기말고사 목표 점수 계산', href: '/target-score/' });
assert.equal(sf('2026-12-10').tag, '기말');
assert.equal(sf('2026-12-11').tag, '발표'); assert.equal(sf('2026-12-14').tag, '발표'); assert.equal(sf('2026-12-15').href, '/rank/');
assert.equal(sf('2027-01-15'), null); assert.equal(sf('2027-03-25').href, '/suneung/'); assert.equal(sf('2027-04-11').tag, '중간');
assert.equal(sf('2027-06-12').tag, '모평'); assert.equal(sf('2027-06-13').tag, '기말'); assert.equal(sf('2027-07-31').href, '/rank/');
assert.equal(sf('2027-08-20').tag, '모평'); assert.equal(sf('2027-10-18').tag, '중간'); assert.equal(sf('2027-10-19').tag, 'D-30');
assert.equal(sf('2027-11-22').tag, '가채점'); assert.equal(sf('2027-11-23'), null); assert.equal(sf('2027-12-13').tag, '발표'); assert.equal(sf('2027-12-14').href, '/rank/');
const sl = (...a) => plain(s.suneungLine(new Date(...a)));
assert.deepEqual(sl(2026, 10, 5, 9), { tag: 'D-14', text: '2027학년도 수능 · 11월 19일(목)', period: null });
assert.deepEqual(sl(2026, 10, 19, 7, 30), { tag: '오늘', text: '08:10까지 입실', period: 'enter' });
assert.deepEqual(sl(2026, 10, 19, 8, 10), { tag: '오늘', text: '다음 1교시 국어 08:40', period: '1' });
assert.deepEqual(sl(2026, 10, 19, 10, 15), { tag: '오늘', text: '다음 2교시 수학 10:30', period: '2' });
assert.deepEqual(sl(2026, 10, 19, 10, 45), { tag: '오늘', text: '지금 2교시 수학 · 12:10 종료', period: '2' });
assert.deepEqual(sl(2026, 10, 19, 12, 30), { tag: '오늘', text: '다음 3교시 영어 13:10', period: 'lunch' });
assert.equal(sl(2026, 10, 19, 13, 5).period, '3');
assert.deepEqual(sl(2026, 10, 19, 16, 36), { tag: '오늘', text: '지금 4교시 한국사·탐구 · 16:37 종료', period: '4' });
assert.deepEqual(sl(2026, 10, 19, 17, 44), { tag: '오늘', text: '지금 5교시 제2외국어·한문 · 17:45 종료', period: '5' });
assert.deepEqual(sl(2026, 10, 19, 17, 45), { tag: '오늘', text: '시험 끝 · 수고했어요', period: 'done' });
assert.deepEqual(sl(2026, 10, 20, 9), { tag: 'D-21', text: '수능 성적 통지 · 12월 11일(금)', period: null });
assert.deepEqual(sl(2026, 11, 11, 9), { tag: '오늘', text: '수능 성적 통지일', period: null });
assert.deepEqual(sl(2026, 11, 12, 9), { tag: 'D-341', text: '2028학년도 수능 · 2027년 11월 18일(목)', period: null });
assert.equal(s.suneungLine(new Date(2027, 11, 11, 9)), null);

console.log('계산 함수 자체 점검 통과');
