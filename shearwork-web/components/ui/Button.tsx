import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

// Brand buttons. Styling lives in app/globals.css (.btn, .btn-primary, ...).

export type ButtonVariant = 'primary' | 'bright' | 'glass' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

type StyleProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Adds the sliding arrow capsule */
  arrow?: boolean
  className?: string
  children: ReactNode
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''
  return `btn btn-${variant} ${sizeClass} ${className}`.trim()
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Content({ arrow, children }: { arrow?: boolean; children: ReactNode }) {
  return (
    <>
      <span>{children}</span>
      {arrow && (
        <span className="btn-cap" aria-hidden="true">
          <Arrow />
          <Arrow />
        </span>
      )}
    </>
  )
}

export function ButtonLink({
  variant,
  size,
  arrow,
  className,
  children,
  ...props
}: StyleProps & Omit<ComponentProps<typeof Link>, 'className' | 'children'>) {
  return (
    <Link {...props} className={buttonClasses(variant, size, className)}>
      <Content arrow={arrow}>{children}</Content>
    </Link>
  )
}

export function Button({
  variant,
  size,
  arrow,
  className,
  children,
  type = 'button',
  ...props
}: StyleProps & Omit<ComponentProps<'button'>, 'className' | 'children'>) {
  return (
    <button type={type} {...props} className={buttonClasses(variant, size, className)}>
      <Content arrow={arrow}>{children}</Content>
    </button>
  )
}

export function ArrowLink({ className = '', children, ...props }: Omit<ComponentProps<typeof Link>, 'className'> & { className?: string }) {
  return (
    <Link {...props} className={`link-arrow ${className}`}>
      {children}
      <Arrow />
    </Link>
  )
}
