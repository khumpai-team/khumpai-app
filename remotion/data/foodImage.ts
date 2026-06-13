/**
 * A hand-built top-down "photo" of a Peruvian lomo saltado, encoded as an SVG
 * data URI. The real app stores photo attachments as data URLs (see
 * lib/image.ts → readAttachment), so passing this to MessageBubble's imageUrl is
 * exactly how a real uploaded photo renders — and it needs no network or binary
 * asset, keeping the render deterministic.
 */

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7a5436"/>
      <stop offset="1" stop-color="#4d3520"/>
    </linearGradient>
    <radialGradient id="plate" cx="0.42" cy="0.36" r="0.8">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.82" stop-color="#f3f1ee"/>
      <stop offset="1" stop-color="#dcd7d0"/>
    </radialGradient>
    <linearGradient id="meat" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7a4326"/>
      <stop offset="1" stop-color="#4f2614"/>
    </linearGradient>
    <linearGradient id="fry" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0c259"/>
      <stop offset="1" stop-color="#cf942f"/>
    </linearGradient>
  </defs>

  <rect width="400" height="300" fill="url(#wood)"/>
  <g opacity="0.18" stroke="#2c1d10" stroke-width="2">
    <line x1="0" y1="70" x2="400" y2="70"/>
    <line x1="0" y1="150" x2="400" y2="150"/>
    <line x1="0" y1="232" x2="400" y2="232"/>
  </g>

  <!-- plate shadow + plate -->
  <ellipse cx="202" cy="160" rx="150" ry="116" fill="#1c1109" opacity="0.35"/>
  <ellipse cx="200" cy="152" rx="150" ry="116" fill="url(#plate)"/>
  <ellipse cx="200" cy="152" rx="118" ry="88" fill="none" stroke="#e6e1da" stroke-width="3"/>

  <!-- rice mound -->
  <g>
    <ellipse cx="135" cy="150" rx="60" ry="46" fill="#f6efdd"/>
    <ellipse cx="135" cy="146" rx="52" ry="38" fill="#fcf7ea"/>
    <g fill="#efe4c8" opacity="0.9">
      <ellipse cx="115" cy="138" rx="6" ry="3"/>
      <ellipse cx="150" cy="132" rx="6" ry="3" transform="rotate(30 150 132)"/>
      <ellipse cx="158" cy="160" rx="6" ry="3" transform="rotate(-20 158 160)"/>
      <ellipse cx="120" cy="166" rx="6" ry="3" transform="rotate(50 120 166)"/>
      <ellipse cx="138" cy="150" rx="6" ry="3" transform="rotate(-40 138 150)"/>
    </g>
  </g>

  <!-- lomo saltado pile -->
  <g>
    <!-- fries -->
    <g>
      <rect x="232" y="186" width="58" height="11" rx="5" fill="url(#fry)" transform="rotate(-18 232 186)"/>
      <rect x="246" y="196" width="54" height="11" rx="5" fill="url(#fry)" transform="rotate(8 246 196)"/>
      <rect x="226" y="200" width="50" height="11" rx="5" fill="url(#fry)" transform="rotate(26 226 200)"/>
    </g>
    <!-- onion slivers -->
    <g fill="none" stroke="#f3e7f0" stroke-width="6" stroke-linecap="round" opacity="0.92">
      <path d="M236 120 q22 6 30 26"/>
      <path d="M270 132 q18 10 20 30"/>
      <path d="M214 132 q16 12 14 32"/>
    </g>
    <!-- meat strips -->
    <g>
      <rect x="214" y="108" width="62" height="20" rx="9" fill="url(#meat)" transform="rotate(-14 214 108)"/>
      <rect x="246" y="120" width="60" height="20" rx="9" fill="url(#meat)" transform="rotate(20 246 120)"/>
      <rect x="222" y="142" width="58" height="20" rx="9" fill="url(#meat)" transform="rotate(-6 222 142)"/>
      <rect x="256" y="150" width="54" height="19" rx="9" fill="url(#meat)" transform="rotate(34 256 150)"/>
    </g>
    <!-- tomato wedges -->
    <g fill="#cf3b2c">
      <path d="M230 96 q18 -6 30 8 q-14 12 -30 6 z"/>
      <path d="M286 150 q12 14 2 30 q-16 -8 -14 -26 z"/>
    </g>
    <!-- cilantro -->
    <g fill="#3f8a3a">
      <circle cx="240" cy="138" r="4"/>
      <circle cx="268" cy="118" r="3.5"/>
      <circle cx="252" cy="168" r="3.5"/>
      <circle cx="220" cy="120" r="3"/>
    </g>
  </g>

  <!-- sheen -->
  <ellipse cx="150" cy="96" rx="60" ry="20" fill="#ffffff" opacity="0.18"/>
</svg>`;

export const FOOD_DATA_URI = `data:image/svg+xml,${encodeURIComponent(SVG.trim())}`;
