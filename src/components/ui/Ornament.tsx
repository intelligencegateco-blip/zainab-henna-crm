/**
 * Decorative shapes drawn from the logo: the rhombic "nuqta" dot that a
 * calligrapher's reed pen leaves, and the stacked tapered strokes.
 * Purely decorative — always aria-hidden.
 */

export function Nuqta({ size = 10, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`nuqta ${className}`} width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      <path d="M6.4 0.6 C8.2 2.6 9.6 3.6 11.6 4.6 C9.6 6.8 8.4 8.6 7.2 11.4 C5.2 9.6 3.4 8.6 0.6 7.6 C2.8 5.6 4.6 3.6 6.4 0.6 Z" fill="currentColor" />
    </svg>
  );
}

export function NuqtaCluster() {
  return (
    <svg width="56" height="40" viewBox="0 0 56 40" aria-hidden style={{ color: 'var(--brand-gold)', marginBottom: 4 }}>
      <g fill="currentColor">
        <path transform="translate(4 14)" d="M6.4 0.6 C8.2 2.6 9.6 3.6 11.6 4.6 C9.6 6.8 8.4 8.6 7.2 11.4 C5.2 9.6 3.4 8.6 0.6 7.6 C2.8 5.6 4.6 3.6 6.4 0.6 Z" />
        <path transform="translate(22 2) scale(1.3)" d="M6.4 0.6 C8.2 2.6 9.6 3.6 11.6 4.6 C9.6 6.8 8.4 8.6 7.2 11.4 C5.2 9.6 3.4 8.6 0.6 7.6 C2.8 5.6 4.6 3.6 6.4 0.6 Z" />
        <path transform="translate(40 22)" d="M6.4 0.6 C8.2 2.6 9.6 3.6 11.6 4.6 C9.6 6.8 8.4 8.6 7.2 11.4 C5.2 9.6 3.4 8.6 0.6 7.6 C2.8 5.6 4.6 3.6 6.4 0.6 Z" opacity="0.55" />
      </g>
    </svg>
  );
}

/** One tapered brushstroke: thick at the left, sweeping up and thinning at the right. */
export function Brushstroke({ width = 120, className = '' }: { width?: number; className?: string }) {
  return (
    <svg className={className} width={width} height={width * 0.18} viewBox="0 0 120 22" aria-hidden preserveAspectRatio="none">
      <path
        d="M2 15 C 18 9, 46 9, 78 11 C 96 12, 108 9, 118 2 C 114 10, 104 17, 84 18 C 56 20, 26 18, 4 21 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Stacked strokes echoing the logo, used as a faint backdrop on dark bands. */
export function StrokeStack({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 220" aria-hidden preserveAspectRatio="xMaxYMid meet">
      <g fill="currentColor">
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            transform={`translate(0 ${i * 42})`}
            d="M20 28 C 60 14, 130 12, 180 18 C 205 21, 222 14, 236 2 C 232 16, 214 30, 186 32 C 130 36, 66 32, 22 40 Z"
          />
        ))}
        <rect x="16" y="6" width="9" height="200" rx="4" />
      </g>
    </svg>
  );
}
