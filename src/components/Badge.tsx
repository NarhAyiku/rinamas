export function BadgeDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFCD11" />
          <stop offset="1" stopColor="#FCB026" />
        </linearGradient>
        <pattern id="hz" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="16" fill="#2B2F34" />
          <rect x="8" width="8" height="16" fill="url(#gv)" />
        </pattern>
        <symbol id="badge" viewBox="0 0 72 64">
          <path d="M20 2 H52 L68 32 L52 62 H20 L4 32Z" fill="url(#hz)" />
          <path d="M20 2 H52 L68 32 L52 62 H20 L4 32Z" fill="none" stroke="#1A1C1F" strokeWidth="3" />
          <rect x="4" y="24" width="64" height="16" fill="#1A1C1F" />
        </symbol>
      </defs>
    </svg>
  );
}

/** The hazard hex mark. The name is written next to it by `Brand`, so the tiny wordmark inside the hex is off by default. */
export function Badge({ className = "mark", wordmark = false }: { className?: string; wordmark?: boolean }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 72 64">
      <use href="#badge" />
      {wordmark && (
        <text x="36" y="36.5" textAnchor="middle" fontFamily="Big Shoulders Display,Impact,sans-serif" fontWeight="900" fontSize="13" letterSpacing="1" fill="#FFCD11">
          RINAMAS
        </text>
      )}
    </svg>
  );
}

/** Two-line lockup: RINAMAS over Equipment & Trading Enterprise, both in the same ink so they read as one name. */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <a className="brand" href={href}>
      <Badge />
      <span className="name">
        <span className="n1">RINAMAS</span>
        <span className="n2">Equipment &amp;&nbsp;Trading Enterprise</span>
      </span>
    </a>
  );
}
