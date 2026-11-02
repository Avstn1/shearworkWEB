'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { PieChart as PieIcon } from 'lucide-react'
import { EmptyState, PanelHeading } from '@/components/ui/AppKit'
import DonutBreakdown from '@/components/ui/DonutBreakdown'

export interface ServiceBooking {
  service_name: string
  bookings: number
  [key: string]: string | number
}

interface ServiceBreakdownChartProps {
  barberId: string
  month: string
  year: number
}

export default function ServiceBreakdownChart({
  barberId,
  month,
  year,
}: ServiceBreakdownChartProps) {
  const [data, setData] = useState<ServiceBooking[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const { data: bookings, error } = await supabase
        .from('service_bookings')
        .select('service_name, bookings')
        .eq('user_id', barberId)
        .eq('report_month', month)
        .eq('report_year', year)

      if (error) {
        console.error(error)
        return
      }

      setData(
        (bookings as ServiceBooking[]).sort(
          (a, b) => (b.bookings || 0) - (a.bookings || 0)
        )
      )
    }

    fetchData()
  }, [barberId, month, year])

  if (!data.length)
    return (
      <div className="flex min-h-[360px] flex-col lg:h-full lg:min-h-0">
        <PanelHeading icon={PieIcon} tone="sage">Service breakdown</PanelHeading>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={PieIcon} title="No data to see here yet" />
        </div>
      </div>
    )

  // -----------------------------
  // TOP 6 + OTHERS LOGIC
  // -----------------------------
  const TOP_COUNT = 6
  const topServices = data.slice(0, TOP_COUNT)
  const otherServices = data.slice(TOP_COUNT)

  let finalData = topServices

  if (otherServices.length > 0) {
    const otherTotal = otherServices.reduce(
      (sum, item) => sum + (item.bookings || 0),
      0
    )

    finalData = [
      ...topServices,
      { service_name: "Others", bookings: otherTotal },
    ]
  }

  return (
    <div className="flex min-h-[360px] flex-1 flex-col lg:h-full lg:min-h-0">
      <PanelHeading icon={PieIcon} tone="sage" className="mb-4">Service breakdown</PanelHeading>
      <DonutBreakdown
        items={finalData.map(d => ({ name: String(d.service_name), value: Number(d.bookings) || 0 }))}
        unit="bookings"
        totalLabel="Bookings"
      />
    </div>
  )
}
