'use client'

import React, { useEffect, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'
import { supabase } from '@/utils/supabaseClient'

import MarketingFunnelsDetailsModal from './MarketingFunnelsDetailsModal';
import UnderConstructionWrapper from '@/components/Wrappers/UnderConstructionWrapper';


const COLORS = ['#E8EDC7', '#9AC8CD', '#B19470', '#748E63', '#F1EEDC']

export interface MarketingFunnel {
  source: string
  new_clients: number
  returning_clients: number
  new_clients_retained: number
  retention: number
  retention_height?: number
  avg_ticket: number
  timeframe: string
}

type Timeframe = 'year' | 'Q1' | 'Q2' | 'Q3' | 'Q4'

interface TimeframeMarketingFunnelsChartProps {
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
  if (timeframe === 'year') return `Marketing Funnels (${year})`
  switch (timeframe) {
    case 'Q1': return `Marketing Funnels (Q1 • Jan-Mar ${year})`
    case 'Q2': return `Marketing Funnels (Q2 • Apr-Jun ${year})`
    case 'Q3': return `Marketing Funnels (Q3 • Jul-Sep ${year})`
    case 'Q4': return `Marketing Funnels (Q4 • Oct-Dec ${year})`
  }
}

export default function TimeframeMarketingFunnelsChart({
  barberId,
  year,
  timeframe,
}: TimeframeMarketingFunnelsChartProps) {
  const [data, setData] = useState<MarketingFunnel[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

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
  const isDateInTimeline = (dateString: string, months: string[], yearNum: number): boolean => {
    if (!dateString) return false
    
    const date = new Date(dateString + 'T00:00:00')
    const dateMonth = date.getMonth() + 1
    const dateYear = date.getFullYear()
    
    if (dateYear !== yearNum) return false
    
    const monthNumbers = months.map(m => getMonthNumber(m))
    return monthNumbers.includes(dateMonth)
  }
  
  useEffect(() => {
    if (!barberId || !year) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Determine which months to query based on timeframe
        const monthsToQuery = timeframe === 'year' 
          ? ALL_MONTHS 
          : MONTHS_BY_QUARTER[timeframe as Exclude<Timeframe, 'year'>]

        const monthNumbers = monthsToQuery.map(m => getMonthNumber(m))

        // Fetch clients who had their first appointment in the selected months/year
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
          setData([])
          setLoading(false)
          return
        }

        // Filter clients whose first_appt is in the selected months
        const filteredClients = clients?.filter(client => {
          if (!client.first_appt) return false
          const apptMonth = new Date(client.first_appt + 'T00:00:00').getMonth() + 1
          return monthNumbers.includes(apptMonth)
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
              timeframe,
            })
          }
          
          const funnel = sourceMap.get(source)!
          funnel.new_clients += 1
          
          // Check if client returned within the same timeframe
          if (client.second_appt && isDateInTimeline(client.second_appt, monthsToQuery, year)) {
            funnel.new_clients_retained += 1
          }
        })

        // Calculate retention for each source
        const result = Array.from(sourceMap.values()).map(funnel => ({
          ...funnel,
          retention: funnel.new_clients > 0 
            ? (funnel.new_clients_retained / funnel.new_clients) * 100 
            : 0
        }))

        // Find max new_clients to scale retention bars
        const maxNewClients = Math.max(...result.map(f => f.new_clients), 1)

        // Add retention_height field: retention percentage scaled to max new_clients
        const resultWithRetentionHeight = result.map(funnel => ({
          ...funnel,
          retention_height: (funnel.retention / 100) * maxNewClients
        }))

        // Sort by new clients descending
        resultWithRetentionHeight.sort((a, b) => b.new_clients - a.new_clients)

        setData(resultWithRetentionHeight)

      } catch (err) {
        console.error('Error preparing timeframe marketing funnels:', err)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [barberId, year, timeframe])

  const monthsForModal = timeframe === 'year' 
    ? ALL_MONTHS 
    : MONTHS_BY_QUARTER[timeframe as Exclude<Timeframe, 'year'>]

  if (loading) {
    return (
      <div
        className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[400px]"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
        }}
      >
        <p className="text-[#E8EDC7] opacity-70">Loading marketing funnels...</p>
      </div>
    )
  }

  if (data.length === 0)
    return (
      <div
        className="p-4 rounded-lg shadow-md border flex items-center justify-center min-h-[400px]"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
        }}
      >
        <p className="text-[#E8EDC7] opacity-70">No data to see here yet!</p>
      </div>
    )

  return (
    <UnderConstructionWrapper>
      <div
        className="p-4 rounded-lg shadow-md border flex flex-col flex-1"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
          minHeight: '400px',
          maxHeight: '440px',
          overflow: 'visible',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#E8EDC7] text-xl font-semibold mb-4">
          📣 {timeframeLabel(timeframe, year)}
        </h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#748E63] hover:bg-[#9AC8CD] text-[#2a3612ff] hover:text-[#E8EDC7] rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg transform hover:scale-105 flex items-center gap-2"
          >
            <span>Details</span>
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-visible">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 20, left: 0, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />

              <XAxis
                dataKey="source"
                stroke="#E8EDC7"
                angle={-35}
                textAnchor="end"
                interval={0}
                height={60}
                style={{ fontSize: '12px' }}
              />
              <YAxis stroke="#E8EDC7" />

              <Tooltip
                formatter={(value: any, name: string, props: any) => {
                  if (name === 'Retention') {
                    // Show the actual retention percentage in tooltip
                    const item = props.payload
                    return [`${item.retention.toFixed(2)}%`, name]
                  }
                  if (name === 'New Clients Retained') {
                    return [value, name]
                  }
                  return [value, name]
                }}
                contentStyle={{
                  backgroundColor: '#2b2b2b',
                  border: '1px solid #E8EDC7',
                  borderRadius: '8px',
                  color: '#E8EDC7',
                }}
                itemStyle={{ color: '#E8EDC7' }}
                labelStyle={{ color: '#E8EDC7' }}
              />

              <Legend
                formatter={(value) =>
                  value === 'Retention' ? 'Retention (%)' : value
                }
                iconType="circle"
                wrapperStyle={{
                  color: '#E8EDC7',
                  paddingTop: '10px',
                }}
              />

              {/* New Clients Bar */}
              <Bar
                dataKey="new_clients"
                name="New Clients"
                fill={COLORS[1]}
                radius={[8, 8, 0, 0]}
              >
                <LabelList
                  dataKey="new_clients"
                  position="top"
                  style={{ fill: '#E8EDC7', fontSize: 12, fontWeight: 'bold' }}
                />
              </Bar>

              {/* New Clients Retained Bar */}
              <Bar
                dataKey="new_clients_retained"
                name="New Clients Retained"
                fill={COLORS[3]}
                radius={[8, 8, 0, 0]}
              >
                <LabelList
                  dataKey="new_clients_retained"
                  position="top"
                  style={{ fill: '#E8EDC7', fontSize: 12, fontWeight: 'bold' }}
                  dy={-15}
                />
              </Bar>

              {/* Retention Bar - height scaled to new_clients */}
              <Bar
                dataKey="retention_height"
                name="Retention"
                fill={COLORS[2]}
                radius={[8, 8, 0, 0]}
              >
              <LabelList
                dataKey="retention"
                position="top"
                content={(props) => {
                  const { x, y, value } = props;

                  if (x == null || y == null || value == null) return null;

                  return (
                    <text
                      x={Number(x)}
                      y={Number(y) - 5}
                      fill="#E8EDC7"
                      fontSize={10}
                      fontWeight="bold"
                    >
                      {`${Number(value).toFixed(2)}%`}
                    </text>
                  );
                }}
              />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <MarketingFunnelsDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        barberId={barberId}
        months={monthsForModal} 
        year={year}
        data={data}
      />
    </UnderConstructionWrapper>
  )
}