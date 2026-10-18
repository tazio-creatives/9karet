import styles from './SuccessIllustration.module.css';

// A small 4-point sparkle star, reused at a few positions/sizes.
function Sparkle({ x, y, size = 5, className }: { x: number; y: number; size?: number; className?: string }) {
  const s = size;
  return (
    <path
      className={className}
      d={`M${x} ${y - s} Q${x + s * 0.3} ${y - s * 0.3} ${x + s} ${y} Q${x + s * 0.3} ${y + s * 0.3} ${x} ${y + s} Q${x - s * 0.3} ${y + s * 0.3} ${x - s} ${y} Q${x - s * 0.3} ${y - s * 0.3} ${x} ${y - s} Z`}
      fill="#d9ad42"
    />
  );
}

// Premium, hand-built success visual — a jewellery box (deep teal), its lid
// tilted open, a gold ring resting inside on a cushion, a floating emerald
// checkmark medallion, and a few gold sparkles. Flat/soft-3D illustration
// style (gradients + layered shapes), not a literal 3D render — kept to
// simple primitives (rects/ellipses/short paths) rather than intricate
// hand-authored path data.
export function SuccessIllustration() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.glow} />
      <svg className={styles.svg} viewBox="0 0 200 190" fill="none">
        <defs>
          <linearGradient id="boxFront" x1="40" y1="112" x2="160" y2="176" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#600a15" />
            <stop offset="100%" stopColor="#38040b" />
          </linearGradient>
          <linearGradient id="boxLid" x1="40" y1="58" x2="160" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#700e1b" />
            <stop offset="100%" stopColor="#520711" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="72" y1="96" x2="128" y2="122" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f0c94a" />
            <stop offset="50%" stopColor="#c6a15b" />
            <stop offset="100%" stopColor="#9c7a3a" />
          </linearGradient>
          <radialGradient id="medallionGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#3fbf7f" />
            <stop offset="100%" stopColor="#1a7f37" />
          </radialGradient>
          <filter id="medallionShadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0c3d1f" floodOpacity="0.35" />
          </filter>
          <filter id="boxShadow" x="-30%" y="-10%" width="160%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#1c2b1f" floodOpacity="0.22" />
          </filter>
        </defs>

        <g filter="url(#boxShadow)">
          {/* lid, hinged at the box's back-left rim, tilted open */}
          <rect x="40" y="58" width="120" height="40" rx="10" fill="url(#boxLid)" transform="rotate(-24 40 98)" />
          <rect x="40" y="93" width="120" height="4" rx="2" fill="#d9ad42" opacity="0.85" transform="rotate(-24 40 98)" />

          {/* box front */}
          <rect x="40" y="112" width="120" height="62" rx="12" fill="url(#boxFront)" />
          <rect x="40" y="112" width="120" height="10" rx="5" fill="#700e1b" />

          {/* contact shadow + cushion inside the opening */}
          <ellipse cx="100" cy="116" rx="34" ry="8" fill="#200307" opacity="0.28" />
          <ellipse cx="100" cy="113" rx="30" ry="7" fill="#f8e8ec" opacity="0.9" />

          {/* ring resting on the cushion */}
          <ellipse cx="100" cy="107" rx="25" ry="10" stroke="url(#ringGrad)" strokeWidth="7" fill="none" />
          <ellipse cx="94" cy="103" rx="5" ry="2.4" fill="#fff6d8" opacity="0.75" />
        </g>

        {/* floating success medallion */}
        <g filter="url(#medallionShadow)">
          <circle cx="152" cy="54" r="25" fill="url(#medallionGrad)" />
          <path d="M141 55l7 7 13-15" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>

        <Sparkle x={180} y={30} size={5} className={styles.sparkle} />
        <Sparkle x={24} y={88} size={4} className={styles.sparkle} />
        <Sparkle x={168} y={96} size={3.5} className={styles.sparkle} />
      </svg>
    </div>
  );
}
