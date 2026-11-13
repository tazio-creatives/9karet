import type { ReactNode } from 'react';

// Thin line icons for the long-form policy pages' section cards — inline SVG
// (the storefront has no icon library), all on one 24px grid and drawn with
// currentColor so the card controls the colour.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const POLICY_ICONS = {
  calendar: (
    <Icon>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h2M14 13.5h2M8 16.5h2" />
    </Icon>
  ),
  video: (
    <Icon>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </Icon>
  ),
  upload: (
    <Icon>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </Icon>
  ),
  verify: (
    <Icon>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Icon>
  ),
  truck: (
    <Icon>
      <path d="M3 6.5h11v9H3zM14 9.5h3.5l3 3v3H14" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </Icon>
  ),
  sparkle: (
    <Icon>
      <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.5l-1.8-5.9-5.7-1.8L10.2 9 12 3.5Z" />
      <path d="M19 3.5v3M17.5 5h3" />
    </Icon>
  ),
  ruler: (
    <Icon>
      <rect x="2.5" y="8" width="19" height="8" rx="1.5" />
      <path d="M6.5 8v3M10 8v4M13.5 8v3M17 8v4" />
    </Icon>
  ),
  alert: (
    <Icon>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </Icon>
  ),
  package: (
    <Icon>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path d="m4 7 8 4 8-4M12 11v10M8 5l8 4" />
    </Icon>
  ),
  ban: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </Icon>
  ),
  gem: (
    <Icon>
      <path d="M6.5 4h11L21 9l-9 11L3 9l3.5-5Z" />
      <path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" />
    </Icon>
  ),
  search: (
    <Icon>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  ),
  clock: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  ),
  wallet: (
    <Icon>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M16 13.5h.1" />
    </Icon>
  ),
  card: (
    <Icon>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </Icon>
  ),
  xCircle: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  ),
  gift: (
    <Icon>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3 9h18M12 9v11M12 9S10.5 4.5 8 5s-1 4 4 4ZM12 9s1.5-4.5 4-4 1 4-4 4Z" />
    </Icon>
  ),
  refresh: (
    <Icon>
      <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1" />
      <path d="M17.5 3v4h-4M6.5 21v-4h4" />
    </Icon>
  ),
  cancel: (
    <Icon>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </Icon>
  ),
  user: (
    <Icon>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </Icon>
  ),
  handshake: (
    <Icon>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="M9 12h6M12 9v6" />
    </Icon>
  ),
  flag: (
    <Icon>
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Icon>
  ),
  scale: (
    <Icon>
      <path d="M12 4v16M7 20h10M5 7h14" />
      <path d="m5 7-2.5 6a2.5 2.5 0 0 0 5 0L5 7ZM19 7l-2.5 6a2.5 2.5 0 0 0 5 0L19 7Z" />
    </Icon>
  ),
  list: (
    <Icon>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5V5h6V3.5M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </Icon>
  ),
  mail: (
    <Icon>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </Icon>
  ),
  lock: (
    <Icon>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2" />
    </Icon>
  ),
  cookie: (
    <Icon>
      <path d="M20.5 12.5A8.5 8.5 0 1 1 11.5 3.5a3 3 0 0 0 4 3.5 3 3 0 0 0 5 5.5Z" />
      <path d="M8.5 9.5h.1M8 14.5h.1M12.5 16.5h.1M12 12h.1" />
    </Icon>
  ),
  share: (
    <Icon>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </Icon>
  ),
  archive: (
    <Icon>
      <rect x="3" y="4" width="18" height="4.5" rx="1" />
      <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" />
    </Icon>
  ),
  link: (
    <Icon>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icon>
  ),
  edit: (
    <Icon>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  ),
  copyright: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.8 9.5a3.5 3.5 0 1 0 0 5" />
    </Icon>
  ),
  map: (
    <Icon>
      <path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Icon>
  ),
  drop: (
    <Icon>
      <path d="M12 3.5s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z" />
      <path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5" />
    </Icon>
  ),
  feather: (
    <Icon>
      <path d="M20 4c-7 0-12 4.5-12 11v5" />
      <path d="M20 4c0 7-4.5 12-11 12M8 15l6-6M12 16H8" />
    </Icon>
  ),
  ring: (
    <Icon>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M9.5 6.5 12 3.5l2.5 3L12 9.5l-2.5-3Z" />
    </Icon>
  ),
  earring: (
    <Icon>
      <path d="M12 3.5v4" />
      <circle cx="12" cy="9" r="1.5" />
      <path d="M12 10.5 8.5 16a3.5 3.5 0 0 0 7 0L12 10.5Z" />
    </Icon>
  ),
  bracelet: (
    <Icon>
      <ellipse cx="12" cy="12" rx="8.5" ry="5.5" />
      <ellipse cx="12" cy="12" rx="5.5" ry="3" />
    </Icon>
  ),
  child: (
    <Icon>
      <circle cx="12" cy="7" r="2.8" />
      <path d="M7.5 20v-4.5a4.5 4.5 0 0 1 9 0V20M9 13l-3-2.5M15 13l3-2.5" />
    </Icon>
  ),
  coin: (
    <Icon>
      <ellipse cx="12" cy="7.5" rx="7" ry="3" />
      <path d="M5 7.5v4.5c0 1.7 3.1 3 7 3s7-1.3 7-3V7.5M5 12v4.5c0 1.7 3.1 3 7 3s7-1.3 7-3V12" />
    </Icon>
  ),
  briefcase: (
    <Icon>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3 12.5h18" />
    </Icon>
  ),
  wave: (
    <Icon>
      <path d="M3 9c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <path d="M3 15c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    </Icon>
  ),
  checklist: (
    <Icon>
      <path d="m4 6.5 1.5 1.5L8.5 5M4 12.5 5.5 14l3-3M4 18.5 5.5 20l3-3M11.5 6.5H20M11.5 12.5H20M11.5 18.5H20" />
    </Icon>
  ),
  users: (
    <Icon>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M16 14.3c2.3.1 4 1.6 4.5 4.2" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4 20h16M6.5 20v-5M11 20v-9M15.5 20v-7M20 20V6" />
      <path d="m5 10 5-4 4 3 5-5" />
    </Icon>
  ),
  partners: (
    <Icon>
      <path d="m2.5 11 3-4 4 1.5L12 7l4.5 1.5 2.5-1.5 2.5 4" />
      <path d="m5.5 7 5.5 6.5a1.5 1.5 0 0 0 2.2 0L18.5 8" />
      <path d="m8 14.5 2 2M10.5 13l2.5 2.5M13 11.5l2.5 2.5" />
    </Icon>
  ),
  gear: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
      <circle cx="12" cy="12" r="6.3" />
    </Icon>
  ),
  store: (
    <Icon>
      <path d="M3.5 9.5 5 4.5h14l1.5 5" />
      <path d="M3.5 9.5a2.8 2.8 0 0 0 5.7 0 2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.7 0" />
      <path d="M5 12.5V20h14v-7.5M10 20v-4.5h4V20" />
    </Icon>
  ),
  laptop: (
    <Icon>
      <rect x="4.5" y="5" width="15" height="10.5" rx="1.5" />
      <path d="M2.5 19h19" />
    </Icon>
  ),
  target: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="m13 11 7-7M17 4h3v3" />
    </Icon>
  ),
  eye: (
    <Icon>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  goldBar: (
    <Icon>
      <path d="M4 19.5 6 14h5l2 5.5H4ZM11 19.5l2-5.5h5l2 5.5h-9ZM7.5 14l2-5.5h5l2 5.5" />
    </Icon>
  ),
  penTool: (
    <Icon>
      <path d="m12 19.5 7-7 2.5 2.5-7 7-2.5-2.5Z" />
      <path d="m18 13.5-1.5-7L4 3.5l3 12.5 7 1.5M4 3.5l7.6 7.6" />
      <circle cx="13" cy="11" r="1.8" />
    </Icon>
  ),
  rupee: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 7.5h7M8.5 10.5h7M11 7.5c2.2 0 3.3 1.3 3.3 3s-1.4 3-3.8 3H9l5 4" />
    </Icon>
  ),
  leaf: (
    <Icon>
      <path d="M5 19c0-8.5 5-14 15-14 0 10-5.5 15-14 15" />
      <path d="M5 19c3-4 6.5-7 10-9" />
    </Icon>
  ),
  recycle: (
    <Icon>
      <path d="m8 5.5 2.2-2 2.3 3.9M7 8.5 4.2 13.3a2 2 0 0 0 1.7 3h3.6" />
      <path d="M16.6 9.5 19.8 15a2 2 0 0 1-1.7 3h-6.6M14.5 19.8 11.5 18l2.6-2.6" />
      <path d="M10 3.5a2 2 0 0 1 3.4 0l2.8 4.8M17.5 6.5l-1.3 1.8-2.4-.3" />
    </Icon>
  ),
  hallmark: (
    <Icon>
      <path d="M12 3.5 19 7v5c0 4.2-3 7.6-7 8.5-4-.9-7-4.3-7-8.5V7l7-3.5Z" />
      <path d="M9 10h6M9 13h6M12 10v6" />
    </Icon>
  ),
  tools: (
    <Icon>
      <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3L15 12l-3-3 2.5-2.5Z" />
    </Icon>
  ),
  compass: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </Icon>
  ),
  heart: (
    <Icon>
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m8.8 12 2.2 2.2 4.2-4.4" />
    </Icon>
  ),
} as const;

export type PolicyIconName = keyof typeof POLICY_ICONS;
