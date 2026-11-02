import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Graphite app kit: thin wrappers over the `.page-*`, `.panel*`, `.stat-*`, `.segmented`
 * and `.empty-state` classes in globals.css. Use these on every logged-in page so cards,
 * headers and numbers look the same everywhere.
 */

export type Tone = 'sage' | 'sky' | 'sand' | 'coral'

/** Tinted icon tile in one of the four accent tones. */
export function IconTile({ icon: Icon, tone = 'sage', size = 'md' }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' }) {
  return (
    <span className={`icon-tile tone-${tone} ${size === 'sm' ? 'icon-tile-sm' : ''}`} aria-hidden="true">
      <Icon strokeWidth={1.75} />
    </span>
  )
}

export function AppPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`app-page ${className}`}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  tone = 'sage',
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** Icon in a tinted tile beside the title */
  icon?: LucideIcon
  tone?: Tone
}) {
  return (
    <div className="page-header">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconTile icon={icon} tone={tone} />}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  icon,
  tone = 'sage',
  accent = false,
  className = '',
  bodyClassName = 'panel-body',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  /** Icon shown in a tinted tile before the title */
  icon?: LucideIcon
  tone?: Tone
  /** Thin tone-coloured line along the top edge, for the panel that matters most */
  accent?: boolean
  className?: string
  /** Pass '' to let children run edge to edge (tables, lists). */
  bodyClassName?: string
}) {
  return (
    <section className={`panel tone-${tone} ${accent ? 'panel-accent' : ''} ${className}`}>
      {(title || actions) && (
        <header className="panel-header">
          <div className="flex min-w-0 items-center gap-3">
            {icon && <IconTile icon={icon} tone={tone} size="sm" />}
            <div className="min-w-0">
              {title && <h2 className="panel-title">{title}</h2>}
              {subtitle && <p className="panel-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  delta,
  hint,
  icon,
  tone = 'sage',
}: {
  label: ReactNode
  value: ReactNode
  /** Icon in a tinted tile beside the label */
  icon?: LucideIcon
  tone?: Tone
  /** Signed percentage, e.g. 3.1 or -12.4 */
  delta?: number | null
  hint?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="stat-label">{label}</p>
        {icon && <IconTile icon={icon} tone={tone} size="sm" />}
      </div>
      <p className="stat-value mt-2">{value}</p>
      {(delta != null || hint) && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          {delta != null && (
            <span className={delta >= 0 ? 'stat-delta-up' : 'stat-delta-down'}>
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Array<{ value: T; label: ReactNode }>
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          data-active={o.value === value}
          className="segmented-item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon?: LucideIcon; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty-state">
      {Icon && <Icon aria-hidden="true" />}
      <strong>{title}</strong>
      {children && <p className="max-w-sm">{children}</p>}
    </div>
  )
}

/** Panel title with a tinted icon tile, for components that draw their own header row. */
export function PanelHeading({
  icon,
  tone = 'sage',
  children,
  className = '',
}: {
  icon: LucideIcon
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <IconTile icon={icon} tone={tone} size="sm" />
      <h2 className="panel-title truncate">{children}</h2>
    </div>
  )
}
