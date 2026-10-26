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

export function Badge({ className = "mark" }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 72 64">
      <use href="#badge" />
      <text x="36" y="36.5" textAnchor="middle" fontFamily="Big Shoulders Display,Impact,sans-serif" fontWeight="900" fontSize="13" letterSpacing="1" fill="#FFCD11">
        RINAMAS
      </text>
    </svg>
  );
}

export function Brand() {
  return (
    <a className="brand" href="/">
      <Badge />
      <span className="name">
        RINAMAS<small>Equipment &amp; Trading Enterprise</small>
      </span>
    </a>
  );
}
