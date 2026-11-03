'use client'

import { useFitCount } from '@/hooks/useFitCount'
import { ShowAllButton } from '@/components/ui/ShowAllModal'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

import MarketingFunnelsDetailsModal from './MarketingFunnelsDetailsModal';
import { Megaphone, Filter } from 'lucide-react'
import { EmptyState, PanelHeading } from '@/components/ui/AppKit'
import { CHART_COLORS } from '@/lib/chartTheme'


export interface MarketingFunnel {
  source: string
  new_clients: number
  returning_clients: number
  new_clients_retained: number
  retention: number
  avg_ticket: number
  [key: string]: string | number | undefined
}

interface MarketingFunnelsChartProps {
  barberId: string
  month: string
  year: number
  topN?: number
}

export default function MarketingFunnelsChart({
  barberId,
  month,
  year,
  topN = 5,
}: MarketingFunnelsChartProps) {
  const [data, setData] = useState<MarketingFunnel[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { ref: fitRef, count: fitCount } = useFitCount<HTMLUListElement>({ fallbackRowHeight: 42, gap: 12, deps: [data.length] })

  // Convert month name to number
  const getMonthNumber = (monthName: string): number => {
    const monthMap: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4,
      'May': 5, 'June': 6, 'July': 7, 'August': 8,
      'September': 9, 'October': 10, 'November': 11, 'December': 12
    }
    return monthMap[monthName] || 1
  }

  // Check if a date falls within the timeline
  const isDateInTimeline = (dateString: string, monthName: string, yearNum: number): boolean => {
    if (!dateString) return false
    
    const date = new Date(dateString + 'T00:00:00')
    const dateMonth = date.getMonth() + 1
    const dateYear = date.getFullYear()
    
    if (dateYear !== yearNum) return false
    
    const targetMonth = getMonthNumber(monthName)
    return dateMonth === targetMonth
  }

  useEffect(() => {
    const fetchData = async () => {
      const monthNumber = getMonthNumber(month)

      // Fetch clients who had their first appointment in the selected month/year
      const { data: clients, error } = await supabase
        .from('acuity_clients')
        .select('client_id, first_name, last_name, first_appt, second_appt, first_source')
        .eq('user_id', barberId)
        .not('first_source', 'is', null)
        .not('first_source', 'eq', 'Unknown')
        .not('first_source', 'eq', 'Returning Client')
        .not('first_source', 'eq', 'No Source')
        .gte('first_appt', `${year}-01-01`)
        .lte('first_appt', `${year}-12-31`)

      if (error) {
        console.error('Error fetching client details:', error)
        return
      }

      // Filter clients whose first_appt is in the selected month
      const filteredClients = clients?.filter(client => {
        if (!client.first_appt) return false
        const apptMonth = new Date(client.first_appt + 'T00:00:00').getMonth() + 1
        return apptMonth === monthNumber
      }) || []

      // Group clients by source and calculate metrics
      const sourceMap = new Map<string, MarketingFunnel>()

      filteredClients.forEach(client => {
        const source = client.first_source || 'Unknown'
        
        if (!sourceMap.has(source)) {
          sourceMap.set(source, {
            source,
            new_clients: 0,
            returning_clients: 0,
            new_clients_retained: 0,
            retention: 0,
            avg_ticket: 0,
          })
        }
        
        const funnel = sourceMap.get(source)!
        funnel.new_clients += 1
        
        // Check if client returned within the same month
        const hasSecondAppt = !!client.second_appt
        const isInTimeline = hasSecondAppt && isDateInTimeline(client.second_appt, month, year)
        
        if (isInTimeline) {
          funnel.new_clients_retained += 1
        }
      })

      // Calculate retention for each source
      const funnelData = Array.from(sourceMap.values()).map(funnel => ({
        ...funnel,
        retention: funnel.new_clients > 0 
          ? (funnel.new_clients_retained / funnel.new_clients) * 100 
          : 0
      }))

      // Sort by total new clients
      funnelData.sort((a, b) => b.new_clients - a.new_clients)

      const topSources = funnelData.slice(0, topN)
      const otherSources = funnelData.slice(topN)
      
      if (otherSources.length > 0) {
        const other = otherSources.reduce(
          (acc, f) => {
            acc.new_clients += f.new_clients || 0
            acc.returning_clients += f.returning_clients || 0
            acc.new_clients_retained += f.new_clients_retained || 0
            acc.avg_ticket += f.avg_ticket || 0
            return acc
          },
          {
            source: 'Other',
            new_clients: 0,
            returning_clients: 0,
            new_clients_retained: 0,
            retention: 0,
            avg_ticket: 0,
          } as MarketingFunnel
        )
        
        // Calculate retention for "Other" bucket
        other.retention = other.new_clients > 0
          ? (other.new_clients_retained / other.new_clients) * 100
          : 0
        other.avg_ticket = otherSources.length
          ? other.avg_ticket / otherSources.length
          : 0
        topSources.push(other)
      }

      setData(topSources)
    }

    fetchData()
  }, [barberId, month, year, topN])

  if (data.length === 0)
    return (
      <div className="flex min-h-[400px] flex-col lg:h-full lg:min-h-0">
        <PanelHeading icon={Filter} tone="sky">Marketing funnels</PanelHeading>
        <div className="flex flex-1 items-center justify-center">
          <EmptyState icon={Megaphone} title="No data to see here yet" />
        </div>
      </div>
    )

  const filteredData = data.filter(d => d.new_clients > 0)
  const maxNew = Math.max(1, ...filteredData.map(d => d.new_clients))

  return (
    <>
      <div className="flex min-h-[400px] max-h-[500px] flex-1 flex-col lg:h-full lg:max-h-none lg:min-h-0">
        <div className="mb-4 flex flex-shrink-0 items-center justify-between">
          <PanelHeading icon={Filter} tone="sky">Marketing funnels</PanelHeading>
          <button
            onClick={() => setIsModalOpen(true)}
            type="button"
            className="btn btn-glass btn-sm"
          >
            Details
          </button>
        </div>

        {/* One row per source: bar = new clients (relative to the top source), inner bar =
            those who came back the same month. Reads well in a narrow column. */}
        <ul ref={fitRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {filteredData.slice(0, fitCount).map(f => (
            <li key={f.source}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-gray-200">{f.source}</span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="text-ivory">{f.new_clients}</span>
                  <span className="text-gray-500">new</span>
                  <span className={`badge ${f.retention >= 50 ? 'badge-sage' : f.retention > 0 ? 'badge-info' : ''}`}>
                    {Math.round(f.retention)}% back
                  </span>
                </span>
              </div>
              <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(f.new_clients / maxNew) * 100}%`, backgroundColor: CHART_COLORS[0] }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${(f.new_clients_retained / maxNew) * 100}%`, backgroundColor: CHART_COLORS[1] }}
                />
              </div>
            </li>
          ))}
        </ul>
        {filteredData.length > fitCount && (
          <ShowAllButton total={filteredData.length} onClick={() => setIsModalOpen(true)} />
        )}
        <div className="mt-3 flex flex-shrink-0 items-center gap-4 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: CHART_COLORS[0] }} />New clients</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: CHART_COLORS[1] }} />Came back this month</span>
        </div>
      </div>

      <MarketingFunnelsDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        barberId={barberId}
        months={[month]}
        year={year}
        data={data}
      />
    </>
  )
}