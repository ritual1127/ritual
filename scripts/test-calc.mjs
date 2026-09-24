import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../calc-core.js', import.meta.url), 'utf8'), context);
// vm 안에서 만든 객체는 프로토타입이 달라 deepEqual 전에 현재 realm 객체로 옮긴다.
const plain = value => JSON.parse(JSON.stringify(value));
const c = vm.runInContext('({ formatNumber, fixedNumber, gradeFor, nextGradeGap, weightedSum, ceil2, requiredScore, rankPercentile, rankGrade, rankTier, rankRowStatus, mapGrade, gpaSummary, convertGpa, splitWeights, projectedScore })', context);

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
assert.deepEqual(plain(c.splitWeights(40, 3)), [13.33, 13.33, 13.34]);
assert.deepEqual(plain(c.splitWeights(60, 2)), [30, 30]);
assert.deepEqual(plain(c.splitWeights(100, 1)), [100]);
assert.deepEqual(plain(c.splitWeights(50, 0)), []);
assert.equal(c.splitWeights(70, 3).reduce((a, b) => a + b, 0).toFixed(2), '70.00');

// 만약에 슬라이더
assert.equal(c.projectedScore(51, 40, 97.5), 90);
assert.equal(c.projectedScore(51, 40, 100), 91);
assert.equal(c.projectedScore(51, 40, 0), 51);

console.log('계산 함수 자체 점검 통과');
