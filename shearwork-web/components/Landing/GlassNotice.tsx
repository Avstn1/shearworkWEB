
type Size = 'sm' | 'md'

function MarkTile({ size }: { size: Size }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-md bg-white/[0.06] ring-1 ring-inset ring-white/10 ${
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/corvalogo.png" alt="" className={size === 'sm' ? 'h-5 w-auto' : 'h-6 w-auto'} />
    </span>
  )
}

const SHELL =
  'rounded-xl border border-white/[0.08] bg-[#181C24]/95 ' +
  'shadow-[0_20px_40px_-24px_rgb(0_0_0/0.8)] backdrop-blur-md'

/** Corva's Auto-Nudge text asking the barber before it reaches out to clients. */
export function SmsNotice({ size = 'md', compact = false }: { size?: Size; compact?: boolean }) {
  const sm = size === 'sm'
  return (
    <div className={`${SHELL} ${sm ? 'p-2.5 sm:p-3' : 'p-3.5 sm:p-4'}`}>
      <div className={`flex items-center ${sm ? 'mb-1.5 gap-1.5' : 'mb-2 gap-2'}`}>
        <MarkTile size={size} />
        <span className={`font-semibold text-ivory ${sm ? 'text-[11px]' : 'text-[13px]'}`}>Corva</span>
        <span className={`ml-auto text-muted/80 ${sm ? 'text-[9.5px]' : 'text-[11px]'}`}>10:00 AM</span>
      </div>
      <p className={`leading-relaxed text-gray-200 ${sm ? 'text-[10.5px]' : 'text-[12.5px]'}`}>
        {compact
          ? 'You have 22 empty slots this week. Want me to help fill them?'
          : <>Hey Gavin, it&apos;s Corva. You have 22 empty slots this week. Want me to help fill them?</>}
      </p>
      <p className={`mt-1.5 text-muted/80 ${sm ? 'text-[9.5px]' : 'text-[11px]'}`}>
        {compact ? 'Reply YES to continue' : 'Reply YES to continue and STOP to unsubscribe.'}
      </p>
    </div>
  )
}

/** The "SMS Auto-nudge success" push a barber gets when a nudged client books. */
export function BookingToast({ size = 'md' }: { size?: Size }) {
  const sm = size === 'sm'
  return (
    <div
      className={`${SHELL} flex items-start ${sm ? 'gap-2 p-2.5' : 'gap-3 p-3.5'} shadow-[inset_0_0_0_1px_rgb(61_210_122/0.25),0_20px_40px_-24px_rgb(0_0_0/0.8)]`}
    >
      <MarkTile size={size} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`font-semibold text-ivory ${sm ? 'text-[11px]' : 'text-[13px]'}`}>SMS Auto-nudge success!</span>
          <span className={`text-muted/80 ${sm ? 'text-[9.5px]' : 'text-[11px]'}`}>now</span>
        </span>
        <span className={`mt-0.5 block leading-snug text-gray-200 ${sm ? 'text-[10.5px]' : 'text-[12.5px]'}`}>
          Carlo booked your opening at Monday, Feb 23, 3:30 p.m.
        </span>
      </span>
    </div>
  )
}
