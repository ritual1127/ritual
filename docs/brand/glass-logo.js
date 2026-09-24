// 리퀴드 글래스 로고 SVG(512 기준). rx=0이면 풀블리드(마스커블), 115면 iOS 아이콘 모서리.
// 층: 오로라 배경 → 유리 A⁺ 그림자 → 유리 몸체(배경을 확대·이동·흐려 굴절 + 우윳빛) → 가장자리 두께 빛 → 반사 광택 → 얇은 테두리.
// 글자에 선을 직접 그으면 글꼴 안쪽 겹친 윤곽선이 드러나므로, 테두리·가장자리 빛은 알파(침식·흐림)로 만든다.
window.glassLogo = (rx, id = 'g') => {
  const glyph = `<text x="202" y="390" text-anchor="middle" font-family="Pretendard Variable" font-weight="800" font-size="350" letter-spacing="-6">A</text>
      <rect x="340" y="134" width="28" height="124" rx="14"/><rect x="292" y="182" width="124" height="28" rx="14"/>`;
  // 둥근 모서리로 살짝 두껍게(같은 색 둥근 선). 안쪽 겹친 윤곽선은 같은 색 채움에 묻힌다.
  const shape = (color, attrs = '') => `<g fill="${color}" stroke="${color}" stroke-width="14" stroke-linejoin="round" ${attrs}>${glyph}</g>`;
  const aurora = `
    <rect width="512" height="512" fill="url(#${id}base)"/>
    <g filter="url(#${id}soft)">
      <circle cx="110" cy="96" r="190" fill="#2F6BFF" opacity=".85"/>
      <circle cx="430" cy="470" r="170" fill="#5B3BE6" opacity=".45"/>
    </g>`;
  return `
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14235E"/><stop offset="1" stop-color="#0A1033"/></linearGradient>
    <filter id="${id}soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="62"/></filter>
    <filter id="${id}frost" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/><feColorMatrix type="saturate" values="1.5"/></filter>
    <filter id="${id}drop" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="${id}edge" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius="18" result="core"/>
      <feComposite in="SourceAlpha" in2="core" operator="out" result="band"/>
      <feGaussianBlur in="band" stdDeviation="8" result="soft"/>
      <feComposite in="soft" in2="SourceAlpha" operator="in" result="inside"/>
      <feFlood flood-color="#fff"/>
      <feComposite in2="inside" operator="in"/>
    </filter>
    <filter id="${id}rimf" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius="2.2" result="e"/>
      <feComposite in="SourceAlpha" in2="e" operator="out" result="ring"/>
      <feFlood flood-color="#fff"/>
      <feComposite in2="ring" operator="in"/>
    </filter>
    <filter id="${id}rimc" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius="2.5" result="e"/>
      <feComposite in="SourceAlpha" in2="e" operator="out" result="ring"/>
      <feFlood flood-color="#5CF2FF"/>
      <feComposite in2="ring" operator="in"/>
    </filter>
    <filter id="${id}rimp" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feMorphology in="SourceAlpha" operator="erode" radius="2.5" result="e"/>
      <feComposite in="SourceAlpha" in2="e" operator="out" result="ring"/>
      <feFlood flood-color="#FF6BD6"/>
      <feComposite in2="ring" operator="in"/>
    </filter>
    <filter id="${id}bevel" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="h"/>
      <feSpecularLighting in="h" surfaceScale="7" specularConstant="1.25" specularExponent="26" lighting-color="#fff" result="s">
        <feDistantLight azimuth="235" elevation="52"/>
      </feSpecularLighting>
      <feComposite in="s" in2="SourceAlpha" operator="in"/>
    </filter>
    <linearGradient id="${id}milk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".86"/><stop offset=".55" stop-color="#fff" stop-opacity=".68"/><stop offset="1" stop-color="#fff" stop-opacity=".56"/></linearGradient>
    <linearGradient id="${id}fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity=".75"/></linearGradient>
    <linearGradient id="${id}bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".3" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient>
    <radialGradient id="${id}sheen" cx=".3" cy="0" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">${shape('#fff')}</mask>
    <mask id="${id}fadeMask" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="url(#${id}fade)"/></mask>
    <clipPath id="${id}tile"><rect width="512" height="512" rx="${rx}"/></clipPath>
  </defs>
  <g clip-path="url(#${id}tile)">
    ${aurora}
    <rect width="512" height="512" fill="url(#${id}sheen)"/>
    <g transform="${rx ? '' : 'translate(256 262) scale(.88) translate(-256 -262)'}">
    <g transform="translate(6 20)" opacity=".7" filter="url(#${id}drop)">${shape('#0A0730')}</g>
    <g mask="url(#${id}m)">
      <g filter="url(#${id}frost)" transform="translate(256 256) scale(1.22) translate(-262 -268)">${aurora}</g>
      <rect width="512" height="512" fill="url(#${id}milk)"/>
    </g>
    <g filter="url(#${id}edge)" opacity=".58">${shape('#fff')}</g>
    <g filter="url(#${id}bevel)" opacity=".95">${shape('#fff')}</g>
    <g filter="url(#${id}rimc)" opacity=".25" transform="translate(-2 -1)">${shape('#fff')}</g>
    <g filter="url(#${id}rimp)" opacity=".25" transform="translate(2 1)">${shape('#fff')}</g>
    <g mask="url(#${id}fadeMask)"><g filter="url(#${id}rimf)" opacity=".9">${shape('#fff')}</g></g>
    </g>
    ${rx ? `<rect x="4" y="4" width="504" height="504" rx="${rx - 4}" fill="none" stroke="url(#${id}bezel)" stroke-width="6"/>` : ''}
  </g>
</svg>`;
};
