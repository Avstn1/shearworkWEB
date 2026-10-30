import { BrandMark } from '@/components/ui/BrandMark'

type Size = 'sm' | 'md'

function MarkTile({ size }: { size: Size }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-olive-bright to-forest-900 text-sage-bright ring-1 ring-inset ring-white/10 shadow-[0_0_18px_-6px_rgb(170_179_154/0.6)] ${
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
      }`}
    >
      <BrandMark className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  )
}

const SHELL =
  'rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,rgb(30_36_26/0.78),rgb(16_19_14/0.78))] ' +
  'shadow-[inset_0_1px_0_rgb(247_245_239/0.07),0_20px_44px_-20px_rgb(0_0_0/0.85)] backdrop-blur-xl backdrop-saturate-150'

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
      className={`${SHELL} flex items-start ${sm ? 'gap-2 p-2.5' : 'gap-3 p-3.5'} shadow-[inset_0_1px_0_rgb(247_245_239/0.07),0_0_0_1px_rgb(170_179_154/0.22),0_20px_44px_-20px_rgb(0_0_0/0.85),0_0_36px_-14px_rgb(170_179_154/0.45)]`}
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
