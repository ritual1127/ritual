// AI 도우미 엔진·지식 베이스 자체 점검(npm test)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('calc-core.js'), context);
vm.runInContext(read('assistant-core.js'), context);
const A = context.AssistantCore;
const plain = value => JSON.parse(JSON.stringify(value));

// ── 날짜 말 ── (2026-09-24 목요일 기준)
const now = new Date(2026, 8, 24, 10, 0);
const ymd = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
assert.equal(ymd(A.dayFrom('오늘 급식', now)), '2026-9-24');
assert.equal(ymd(A.dayFrom('내일 점심 뭐야', now)), '2026-9-25');
assert.equal(ymd(A.dayFrom('모레 급식', now)), '2026-9-26');
assert.equal(ymd(A.dayFrom('금요일 시간표', now)), '2026-9-25');
assert.equal(ymd(A.dayFrom('월요일 급식', now)), '2026-9-28');
assert.equal(ymd(A.dayFrom('다음 주 수요일 급식', now)), '2026-9-30');
assert.equal(ymd(A.dayFrom('10월 2일 급식', now)), '2026-10-2');
assert.equal(ymd(A.dayFrom('30일 급식', now)), '2026-9-30');

// ── 규칙 의도 ──
const kind = text => A.intent(text, now)?.kind ?? null;
assert.equal(kind('오늘 급식 뭐야?'), 'meal');
assert.equal(kind('내일 석식 메뉴'), 'meal');
assert.equal(kind('금요일 시간표 알려줘'), 'timetable');
assert.equal(kind('3교시 뭐야'), 'timetable');
assert.deepEqual(plain(A.intent('200명 중에 15등이면 몇 등급이야?', now)), { kind: 'rank', total: 200, rank: 15, tie: 1 });
assert.deepEqual(plain(A.intent('15등인데 수강자 수는 180명이야', now)), { kind: 'rank', rank: 15, total: 180, tie: 1 });
assert.deepEqual(plain(A.intent('석차 12/250 등급?', now)), { kind: 'rank', rank: 12, total: 250, tie: 1 });
assert.deepEqual(plain(A.intent('수강자 150명 중 10등, 동점자 3명', now)), { kind: 'rank', total: 150, rank: 10, tie: 3 });
assert.equal(kind('200명 중 3등급이면 몇 등까지야?'), null);
assert.deepEqual(plain(A.intent('상위 12%면 몇 등급?', now)), { kind: 'percent', percent: 12 });
assert.deepEqual(plain(A.intent('4.5 만점에 3.8이면 4.3 만점으로 몇이야', now)), { kind: 'gpa', value: 3.8, from: 4.5, to: 4.3 });
assert.deepEqual(plain(A.intent('4.3 만점 4.0을 4.5로 바꾸면?', now)), { kind: 'gpa', value: 4, from: 4.3, to: 4.5 });
assert.deepEqual(plain(A.intent('87점이면 몇 등급이야?', now)), { kind: 'score', score: 87 });
assert.deepEqual(plain(A.intent('89.5점 성취도 뭐야', now)), { kind: 'score', score: 89.5 });
assert.equal(kind('중간 80점 기말 90점이면 몇 등급?'), null, '점수가 여럿이면 규칙 대신 AI가 계산한다');
assert.equal(kind('3.8/4.5 학점'), null);
assert.equal(kind('안녕'), 'hello');
assert.equal(kind('고마워요!'), 'thanks');
assert.equal(kind('오류 제보하고 싶어요'), 'contact');
assert.equal(kind('5등급제 1등급 비율'), null);

// ── 계산 답 ──
assert.match(A.rankReply({ rank: 15, total: 200, tie: 1 }), /석차백분율 7\.5%.*\n- 5등급제\(2025년 고1부터\): \*\*1등급\*\*\n- 9등급제\(2024년 이전 입학\): \*\*2등급\*\*/);
assert.match(A.rankReply({ rank: 10, total: 150, tie: 3 }), /\(10 \+ \(3 − 1\) ÷ 2\) ÷ 150 × 100/);
assert.match(A.rankReply({ rank: 199, total: 200, tie: 3 }), /다시 확인/);
assert.match(A.percentReply({ percent: 12 }), /5등급제: \*\*2등급\*\*.*\n- 9등급제: \*\*3등급\*\*/);
assert.match(A.scoreReply({ score: 87 }), /성취도 \*\*B\*\*\(80점 이상 90점 미만\).*A까지 \*\*3점\*\*/);
assert.doesNotMatch(A.scoreReply({ score: 95 }), /까지/);
assert.match(A.gpaReply({ value: 3.8, from: 4.5, to: 4.3 }), /약 \*\*3\.63\*\*/);

// ── 검색 ──
const docs = [
  { id: 'faq-nine', k: 'faq', t: '9등급제 등급 비율은?', q: ['9등급 비율 알려줘', '1등급은 몇 퍼센트야'], a: '1등급 4%, 2등급 11%까지예요.', u: '/blog/nine-grade-system/' },
  { id: 'faq-five', k: 'faq', t: '5등급제 등급 비율은?', q: ['5등급제 비율'], a: '1등급 10%, 2등급 34%까지예요.', u: '/blog/five-grade-system/' },
  { id: 'doc-meal', k: 'doc', t: '오늘 급식', u: '/todayfood/', x: '학교를 고르면 오늘 급식 메뉴를 보여 줘요.' }
];
const index = A.buildIndex(docs);
const found = A.search(index, '5등급제 비율이 어떻게 돼?');
assert.equal(found[0].doc.id, 'faq-five');
assert.equal(A.matchFaq(index, found, '5등급제 비율이 어떻게 돼?').doc.id, 'faq-five');
assert.equal(A.matchFaq(index, A.search(index, '등급'), '등급 올리는 공부법'), null);
assert.ok(A.isWeak(A.search(index, '수학 공부 어떻게 해'), '수학 공부 어떻게 해'));
assert.ok(!A.isWeak(found, '5등급제 비율이 어떻게 돼?'));
assert.deepEqual(plain(A.contextOf(found)[0]), { id: 'faq-five', t: '5등급제 등급 비율은?', u: '/blog/five-grade-system/', x: '5등급제 비율\n1등급 10%, 2등급 34%까지예요.' });

// ── 지식 베이스(assistant/kb.json) ──
const kb = JSON.parse(read('assistant/kb.json'));
const ids = new Set();
for (const doc of kb.docs) {
  assert.ok(/^[a-z0-9-]{3,64}$/.test(doc.id), `id 형식: ${doc.id}`);
  assert.ok(!ids.has(doc.id), `id 중복: ${doc.id}`);
  ids.add(doc.id);
  assert.ok(doc.t && (doc.k === 'faq' ? doc.a : doc.x), `내용 없음: ${doc.id}`);
  if (doc.u) assert.ok(fs.existsSync(new URL(`..${doc.u.split('#')[0]}${doc.u.split('#')[0].endsWith('/') ? 'index.html' : ''}`, import.meta.url)), `없는 링크: ${doc.id} ${doc.u}`);
}
const faqCount = kb.docs.filter(d => d.k === 'faq').length;
assert.ok(faqCount >= 300, `문답이 300개 이상이어야 한다(현재 ${faqCount})`);
// 자주 묻는 질문은 준비된 답으로 바로 이어져야 한다
const kbIndex = A.buildIndex(kb.docs);
for (const [question, id] of kb.checks) {
  const results = A.search(kbIndex, question);
  const hit = A.matchFaq(kbIndex, results, question);
  assert.equal(hit?.doc.id, id, `"${question}" → ${id} (실제 ${hit?.doc.id ?? '없음'}, 1등 ${results[0]?.doc.id})`);
}

console.log(`AI 도우미 엔진 점검 통과 (문서 ${kb.docs.length}개, 문답 ${faqCount}개)`);
