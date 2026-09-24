// 리퀴드 글래스 로고 SVG(512 기준). rx=0이면 풀블리드(마스커블), 115면 iOS 아이콘 모서리.
window.glassLogo = (rx, id = 'g') => `
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F8CFF"/><stop offset=".55" stop-color="#4A5BFF"/><stop offset="1" stop-color="#7B3CF2"/></linearGradient>
    <radialGradient id="${id}glow" cx=".22" cy=".12" r=".75"><stop offset="0" stop-color="#9FE3FF" stop-opacity=".85"/><stop offset=".55" stop-color="#9FE3FF" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#EEF1FF"/><stop offset="1" stop-color="#C9D1FF"/></linearGradient>
    <linearGradient id="${id}rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient>
    <linearGradient id="${id}bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".22"/></linearGradient>
    <filter id="${id}drop" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="12"/></filter>
    <clipPath id="${id}clip"><text x="210" y="372" text-anchor="middle" font-family="Pretendard Variable" font-weight="800" font-size="312" letter-spacing="-6">A</text><path d="M333 152h34v42h42v34h-42v42h-34v-42h-42v-34h42z"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="${rx}" fill="url(#${id}bg)"/>
  <rect width="512" height="512" rx="${rx}" fill="url(#${id}glow)"/>
  <g transform="translate(0 14)" opacity=".38" filter="url(#${id}drop)" fill="#1A0F6B">
    <text x="210" y="372" text-anchor="middle" font-family="Pretendard Variable" font-weight="800" font-size="312" letter-spacing="-6">A</text>
    <path d="M333 152h34v42h42v34h-42v42h-34v-42h-42v-34h42z"/>
  </g>
  <g fill="url(#${id}glass)" stroke="url(#${id}rim)" stroke-width="9" stroke-linejoin="round" paint-order="stroke">
    <text x="210" y="372" text-anchor="middle" font-family="Pretendard Variable" font-weight="800" font-size="312" letter-spacing="-6">A</text>
    <path d="M333 152h34v42h42v34h-42v42h-34v-42h-42v-34h42z"/>
  </g>
  <g clip-path="url(#${id}clip)">
    <ellipse cx="170" cy="150" rx="230" ry="120" fill="#fff" opacity=".5"/>
  </g>
  ${rx ? `<rect x="5" y="5" width="502" height="502" rx="${rx - 5}" fill="none" stroke="url(#${id}bezel)" stroke-width="7"/>` : ''}
</svg>`;
