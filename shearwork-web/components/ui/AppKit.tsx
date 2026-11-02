import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Graphite app kit: thin wrappers over the `.page-*`, `.panel*`, `.stat-*`, `.segmented`
 * and `.empty-state` classes in globals.css. Use these on every logged-in page so cards,
 * headers and numbers look the same everywhere.
 */

export function AppPage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`app-page ${className}`}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
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
  className = '',
  bodyClassName = 'panel-body',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  className?: string
  /** Pass '' to let children run edge to edge (tables, lists). */
  bodyClassName?: string
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-header">
          <div className="min-w-0">
            {title && <h2 className="panel-title">{title}</h2>}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
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
}: {
  label: ReactNode
  value: ReactNode
  /** Signed percentage, e.g. 3.1 or -12.4 */
  delta?: number | null
  hint?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="stat-label">{label}</p>
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
