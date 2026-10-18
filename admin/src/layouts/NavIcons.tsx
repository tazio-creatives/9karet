// Minimal hand-drawn line icons for the sidebar nav — no icon library
// dependency, consistent with the rest of the codebase's "no heavy
// libraries" approach (see web/src/pages/home/HeroCarousel.tsx's inline
// GemIcon/ExchangeIcon/ShippingIcon for the same pattern).
const common = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function DashboardIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function ProductsIcon() {
  return (
    <svg {...common}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12v9M12 12l8-4.5M12 12L4 7.5" />
    </svg>
  );
}

export function CategoriesIcon() {
  return (
    <svg {...common}>
      <path d="M11.6 3H18a1 1 0 0 1 1 1v6.4a1 1 0 0 1-.29.71l-7.6 7.6a1 1 0 0 1-1.42 0l-6.4-6.4a1 1 0 0 1 0-1.42l7.6-7.6A1 1 0 0 1 11.6 3z" />
      <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CollectionsIcon() {
  return (
    <svg {...common}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}

export function HomepageIcon() {
  return (
    <svg {...common}>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function OrdersIcon() {
  return (
    <svg {...common}>
      <path d="M6 8h12l-1 12.1a1 1 0 0 1-1 .9H8a1 1 0 0 1-1-.9L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CustomersIcon() {
  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <circle cx="17.3" cy="9" r="2.1" />
      <path d="M15.8 14.2c2.3.5 4.2 2.5 4.2 5.8" />
    </svg>
  );
}

export function ReviewsIcon() {
  return (
    <svg {...common}>
      <path d="M12 3.3l2.5 5.3 5.8.6-4.3 3.9 1.2 5.7-5.2-3-5.2 3 1.2-5.7-4.3-3.9 5.8-.6L12 3.3z" />
    </svg>
  );
}

export function BlogIcon() {
  return (
    <svg {...common}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}

export function MessagesIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

export function CouponsIcon() {
  return (
    <svg {...common}>
      <path d="M3 9.2A1.8 1.8 0 0 1 4.8 7.4h14.4A1.8 1.8 0 0 1 21 9.2v1a1.5 1.5 0 0 0 0 3v1a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 14.2v-1a1.5 1.5 0 0 0 0-3v-1z" />
      <path d="M9 7.6v9" strokeDasharray="2.2 2.2" />
    </svg>
  );
}

export function AdminUsersIcon() {
  return (
    <svg {...common}>
      <circle cx="10" cy="7.5" r="3.3" />
      <path d="M3.5 20c0-3.9 2.9-6.4 6.5-6.4" />
      <circle cx="16.8" cy="15.8" r="3.7" />
      <path d="M15.1 15.9l1.2 1.2 2.1-2.2" />
    </svg>
  );
}

export function PricingIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v9M14.7 9.5c0-1.1-1.2-2-2.7-2s-2.7.9-2.7 2c0 1.1 1.2 1.6 2.7 2s2.7.9 2.7 2c0 1.1-1.2 2-2.7 2s-2.7-.9-2.7-2" />
    </svg>
  );
}

export function AuditLogsIcon() {
  return (
    <svg {...common}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.3" width="6" height="3" rx="1" />
      <path d="M8 10.5h8M8 14h8M8 17.5h5" />
    </svg>
  );
}

export function AttributesIcon() {
  return (
    <svg {...common}>
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="15" width="7" height="7" rx="1.5" />
      <rect x="14" y="15" width="7" height="7" rx="1.5" />
    </svg>
  );
}
