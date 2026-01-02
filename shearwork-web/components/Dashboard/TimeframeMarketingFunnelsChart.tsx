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

import UnderConstructionWrapper from '@/components/Wrappers/UnderConstructionWrapper';


const COLORS = ['#E8EDC7', '#9AC8CD', '#B19470', '#748E63', '#F1EEDC']

export interface MarketingFunnel {
  source: string
  new_clients: number
  returning_clients: number
  retention: number
  timeframe: string
  [key: string]: string | number | undefined
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

  useEffect(() => {
    if (!barberId || !year) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Determine which months to query based on timeframe
        const monthsToQuery = timeframe === 'year' 
          ? ALL_MONTHS 
          : MONTHS_BY_QUARTER[timeframe as Exclude<Timeframe, 'year'>]

        const { data: funnels, error } = await supabase
          .from('marketing_funnels')
          .select('source, new_clients, returning_clients, retention')
          .eq('user_id', barberId)
          .eq('report_year', year)
          .in('report_month', monthsToQuery)
          .neq('source', 'Returning Client')
          .neq('source', 'No Source')

        if (error) {
          console.error('Error fetching marketing funnels:', error)
          setData([])
          return
        }

        // Aggregate data by source
        const aggregated = funnels.reduce((acc, row) => {
          const source = row.source
          if (!acc[source]) {
            acc[source] = {
              source,
              new_clients: 0,
              returning_clients: 0,
              retention: 0,
              timeframe,
              count: 0, // for averaging retention
            }
          }
          acc[source].new_clients += row.new_clients || 0
          acc[source].returning_clients += row.returning_clients || 0
          acc[source].retention += row.retention || 0
          acc[source].count += 1
          return acc
        }, {} as Record<string, MarketingFunnel & { count: number }>)

        // Calculate average retention and remove count
        const result = Object.values(aggregated).map(item => {
          const { count, ...rest } = item
          return {
            ...rest,
            retention: count > 0 ? rest.retention / count : 0,
          }
        })

        console.log(barberId, year, timeframe)
        console.log(JSON.stringify(result))

        setData(result)

      } catch (err) {
        console.error('Error preparing timeframe marketing funnels:', err)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [barberId, year, timeframe])

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
        <h2 className="text-[#E8EDC7] text-xl font-semibold mb-4">
          📣 {timeframeLabel(timeframe, year)}
        </h2>

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
                formatter={(value: any, name: string) => {
                  if (name === 'Retention')
                    return [`${Number(value).toFixed(2)}%`, name]
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

              {/* Returning Clients Bar */}
              <Bar
                dataKey="returning_clients"
                name="Returning Clients"
                fill={COLORS[3]}
                radius={[8, 8, 0, 0]}
              >
                <LabelList
                  dataKey="returning_clients"
                  position="top"
                  style={{ fill: '#E8EDC7', fontSize: 12, fontWeight: 'bold' }}
                  dy={-15}
                />
              </Bar>

              {/* Retention Bar (2 decimals) */}
              <Bar
                dataKey="retention"
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
    </UnderConstructionWrapper>
  )
}