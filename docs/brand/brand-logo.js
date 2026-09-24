// 성적계산기 로고(512 기준, 평면): 파란 스퀘어클 + 흰 A와 위첨자 +. rx=0이면 풀블리드(마스커블), 115면 iOS 아이콘 모서리.
window.brandLogo = (rx = 115) => `
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="${rx}" fill="#0A6CF0"/>
  <text x="214" y="364" text-anchor="middle" font-family="Pretendard Variable" font-weight="700" font-size="300" letter-spacing="-6" fill="#FFFFFF">A</text>
  <path d="M352 158v88M308 202h88" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round"/>
</svg>`;
