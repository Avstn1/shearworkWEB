'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { PieChart as PieIcon } from 'lucide-react'
import { EmptyState, PanelHeading } from '@/components/ui/AppKit'
import DonutBreakdown from '@/components/ui/DonutBreakdown'

// Graphite chart palette (series order); index 6 ("Others") is a neutral grey.

export interface ServiceBooking {
  service_name: string
  bookings: number
  [key: string]: string | number
}

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface YearlyServiceBreakdownChartProps {
  barberId: string
  year: number
  timeframe: Timeframe
}

const ALL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const MONTHS_BY_QUARTER: Record<Exclude<Timeframe, 'year'>, string[]> = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
}

const timeframeLabel = (timeframe: Timeframe, year: number) => {
  if (timeframe === 'year') return `Service Breakdown (${year})`
  switch (timeframe) {
    case 'Q1': return `Service Breakdown (Q1 • Jan–Mar ${year})`
    case 'Q2': return `Service Breakdown (Q2 • Apr–Jun ${year})`
    case 'Q3': return `Service Breakdown (Q3 • Jul–Sep ${year})`
    case 'Q4': return `Service Breakdown (Q4 • Oct–Dec ${year})`
  }
}

export default function YearlyServiceBreakdownChart({
  barberId,
  year,
  timeframe,
}: YearlyServiceBreakdownChartProps) {
  const [data, setData] = useState<ServiceBooking[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    if (!barberId || !year) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const monthsToUse =
          timeframe === 'year'
            ? ALL_MONTHS
            : MONTHS_BY_QUARTER[timeframe]

        const { data: bookings, error } = await supabase
          .from('service_bookings')
          .select('service_name, bookings, report_month')
          .eq('user_id', barberId)
          .eq('report_year', year)
          .in('report_month', monthsToUse)

        if (error) {
          console.error('Error fetching yearly service breakdown:', error)
          setData([])
          return
        }

        // Aggregate bookings per service across all selected months
        const totals: Record<string, number> = {}

        ;(bookings ?? []).forEach((row: any) => {
          const name = row.service_name ?? 'Unknown'
          const count = Number(row.bookings) || 0
          totals[name] = (totals[name] ?? 0) + count
        })

        const sorted: ServiceBooking[] = Object.entries(totals)
          .map(([service_name, bookings]) => ({
            service_name,
            bookings,
          }))
          .sort((a, b) => (b.bookings || 0) - (a.bookings || 0))

        // Take top 6, group the rest into "Others"
        let aggregated: ServiceBooking[]
        if (sorted.length <= 6) {
          aggregated = sorted
        } else {
          const top6 = sorted.slice(0, 6)
          const others = sorted.slice(6)
          const othersTotal = others.reduce((sum, item) => sum + (item.bookings || 0), 0)
          
          aggregated = [
            ...top6,
            { service_name: 'Others', bookings: othersTotal }
          ]
        }

        setData(aggregated)
      } catch (err) {
        console.error('Error preparing yearly service breakdown:', err)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [barberId, year, timeframe])

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col">
        <PanelHeading icon={PieIcon} tone="sage">{timeframeLabel(timeframe, year)}</PanelHeading>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-500">Loading service breakdown…</p>
        </div>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex min-h-[360px] flex-col">
        <PanelHeading icon={PieIcon} tone="sage">{timeframeLabel(timeframe, year)}</PanelHeading>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={PieIcon} title="No service data for this timeframe" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[360px] flex-1 flex-col">
      <PanelHeading icon={PieIcon} tone="sage" className="mb-4">{timeframeLabel(timeframe, year)}</PanelHeading>
      <DonutBreakdown
        items={data.map(d => ({ name: String(d.service_name), value: Number(d.bookings) || 0 }))}
        unit="bookings"
        totalLabel="Bookings"
      />
    </div>
  )
}
