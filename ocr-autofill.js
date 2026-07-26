// NEIS 표준 성적표 사진 OCR 텍스트를 과목별 블록으로 분리 및 매칭
// 각 행 패턴: [과목(선택)] [구분:지필/수행] [항목명(비율%)] [만점] [점수]

function parseReportCardText(text) {
  const itemPattern = /(지필|수행)[^(]*\((\d+(?:\.\d+)?)\s*%?\)\s*([\d]+(?:\.\d+)?)\s+([\d]+(?:\.\d+)?)/;
  const subjectOnlyPattern = /^[가-힣·\s]{1,12}$/;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const blocks = [];
  let current = { subject: null, items: [] };

  lines.forEach(line => {
    const m = line.match(itemPattern);
    if (m) {
      const [, kind, weight, , score] = m;
      const prefix = line.slice(0, m.index).trim();
      if (prefix && !/[\d%()]/.test(prefix)) {
        if (current.items.length) { blocks.push(current); current = { subject: null, items: [] }; }
        current.subject = prefix;
      }
      current.items.push({ kind: kind === '지필' ? 'exam' : 'performance', weight: +weight, score: +score });
      return;
    }
    if (!/\d/.test(line) && subjectOnlyPattern.test(line)) {
      if (current.items.length) { blocks.push(current); current = { subject: null, items: [] }; }
      current.subject = line;
    }
  });
  if (current.items.length) blocks.push(current);
  return blocks;
}

// 파싱된 블록들 중 subjectName과 일치하는 블록을 찾아, 등록된 cfg(performances/exams)와
// "구분 + 등장 순서" 기준으로 매칭한다. 항목명 텍스트는 절대 비교하지 않는다.
function matchOcrBlockToSubject(blocks, subjectName, cfg) {
  const norm = s => (s || '').replace(/\s/g, '');
  let block = blocks.find(b => b.subject && (
    norm(b.subject) === norm(subjectName) ||
    norm(b.subject).includes(norm(subjectName)) ||
    norm(subjectName).includes(norm(b.subject))
  ));
  if (!block && blocks.length === 1) block = blocks[0];
  if (!block) return null;

  const perfItems = block.items.filter(it => it.kind === 'performance');
  const examItems = block.items.filter(it => it.kind === 'exam');

  const matchList = (registered, ocrItems) => registered.map((reg, i) => {
    const ocr = ocrItems[i];
    if (!ocr) return { index: i, label: reg.label, weight: reg.weight, score: null, weightMismatch: false };
    return { index: i, label: reg.label, weight: reg.weight, score: ocr.score, weightMismatch: Math.abs(ocr.weight - reg.weight) > 1 };
  });

  return {
    performances: matchList(cfg.performances, perfItems),
    exams: matchList(cfg.exams, examItems),
    countMismatch: {
      performances: perfItems.length !== cfg.performances.length,
      exams: examItems.length !== cfg.exams.length
    }
  };
}
