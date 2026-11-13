// Icon set for the compact order panel's redesigned hero card — same
// hand-drawn inline-SVG approach as DashboardIcons.tsx, no icon library.
const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function BoxIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" strokeLinejoin="round" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" strokeLinejoin="round" />
    </svg>
  );
}

export function PersonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

export function PhoneIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M5 4h3.5l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5V18a2 2 0 0 1-2 2C10.5 20 4 13.5 4 6a2 2 0 0 1 1-2z" strokeLinejoin="round" />
    </svg>
  );
}

export function MailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
      <path d="M4 6.5l8 6.5 8-6.5" />
    </svg>
  );
}

export function CalendarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <rect x="3.5" y="5" width="17" height="16" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </svg>
  );
}

export function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function TruckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M3 7h10v9H3z" strokeLinejoin="round" />
      <path d="M13 10.5h4l3.5 3.5V16h-7.5z" strokeLinejoin="round" />
      <circle cx="7" cy="17.5" r="1.6" />
      <circle cx="17" cy="17.5" r="1.6" />
    </svg>
  );
}

export function RouteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M6 8.2V13a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1" />
    </svg>
  );
}

export function RefreshIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
      <path d="M17.5 3.5V7H14M6.5 20.5V17H10" />
    </svg>
  );
}

export function PrinterIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M6.5 8.5V4h11v4.5" strokeLinejoin="round" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="1.5" />
      <path d="M6.5 14.5h11v6h-11z" strokeLinejoin="round" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M9 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M14 4h6v6M20 4l-9 9" />
    </svg>
  );
}

export function DocumentIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" strokeLinejoin="round" />
      <path d="M14 3.5V8h4" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 15.5h6" />
    </svg>
  );
}

export function LocationIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.3" />
    </svg>
  );
}

export function HistoryIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M4 6v5h5" />
      <path d="M4.6 15a8 8 0 1 0 1.5-8.4L4 9" />
      <path d="M12 9v4l3 2" />
    </svg>
  );
}

export function PencilIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <path d="M15.5 4.5l4 4L8 20H4v-4z" strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function InfoIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
