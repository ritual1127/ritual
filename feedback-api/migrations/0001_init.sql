-- 방문 통계: 쿠키·IP 없이 경로, 유입 도메인, 기기, 국가, 하루 단위 익명 식별값만 둔다(180일 보관)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  hour INTEGER NOT NULL,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  vid TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS events_day_type ON events(day, type);

-- AI 도우미 질문과 답한 방식(rule·faq·ai·none), 90일 보관
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  day TEXT NOT NULL,
  q TEXT NOT NULL,
  a TEXT NOT NULL DEFAULT '',
  route TEXT NOT NULL,
  ms INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS chats_day ON chats(day);

-- 문의하기, 1년 보관
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  vid TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new'
);

-- 관리자 PIN 실패(IP는 비밀값을 섞은 해시로만), 하루 보관
CREATE TABLE IF NOT EXISTS login_fails (
  ip TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_fails_ts ON login_fails(ts);

-- 지식 색인 상태 등
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
