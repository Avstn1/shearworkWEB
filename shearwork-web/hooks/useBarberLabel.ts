// hooks/useBarberLabel.ts
export function useBarberLabel(barberType?: string) {
  const isCommission = barberType?.toLowerCase() === 'commission'
  const label = isCommission ? 'Earnings' : 'Revenue'
  return { label, isCommission }
}
