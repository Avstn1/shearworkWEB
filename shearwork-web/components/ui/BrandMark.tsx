/**
 * The Corva mark (the "C" with rising bars from the app icon) as a vector that takes the
 * current text colour, so it can follow the olive palette.
 */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="corva-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <path d="M25.6 9.2A12 12 0 1 0 25.6 22.8" stroke="url(#corva-mark)" strokeWidth="3.6" strokeLinecap="round" />
      <rect x="10.2" y="16.4" width="3" height="5.6" rx="1.1" fill="currentColor" />
      <rect x="14.6" y="13.6" width="3" height="8.4" rx="1.1" fill="currentColor" />
      <rect x="19" y="10.6" width="3" height="11.4" rx="1.1" fill="currentColor" />
    </svg>
  )
}

/** Mark + "orva" wordmark, as the navbar has always shown it. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <BrandMark className="h-8 w-8 text-sage-bright drop-shadow-[0_0_12px_rgb(143_181_122/0.45)]" />
      <span className="bg-gradient-to-r from-ivory via-sage-bright to-sage bg-clip-text text-[1.35rem] font-semibold tracking-tight text-transparent">
        Corva
      </span>
    </span>
  )
}
