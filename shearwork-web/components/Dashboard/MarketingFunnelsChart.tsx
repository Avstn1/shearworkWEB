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

const COLORS = ['#E8EDC7', '#9AC8CD', '#B19470', '#748E63', '#F1EEDC']

export interface MarketingFunnel {
  source: string
  new_clients: number
  returning_clients: number
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

  useEffect(() => {
    const fetchData = async () => {
      const { data: funnels, error } = await supabase
        .from('marketing_funnels')
        .select('source, new_clients, returning_clients, retention, avg_ticket')
        .eq('user_id', barberId)
        .eq('report_month', month)
        .eq('report_year', year)

      if (error) {
        console.error('Error fetching marketing funnels:', error)
        return
      }

      let filtered = (funnels as MarketingFunnel[]).filter(
        (f) =>
          f.source &&
          f.source !== 'Unknown' &&
          f.source !== 'Returning Client'
      )

      filtered.sort(
        (a, b) =>
          (b.new_clients || 0) + (b.returning_clients || 0) -
          ((a.new_clients || 0) + (a.returning_clients || 0))
      )

      const topSources = filtered.slice(0, topN)
      const otherSources = filtered.slice(topN)
      if (otherSources.length > 0) {
        const other = otherSources.reduce(
          (acc, f) => {
            acc.new_clients += f.new_clients || 0
            acc.returning_clients += f.returning_clients || 0
            acc.retention += f.retention || 0
            acc.avg_ticket += f.avg_ticket || 0
            return acc
          },
          {
            source: 'Other',
            new_clients: 0,
            returning_clients: 0,
            retention: 0,
            avg_ticket: 0,
          } as MarketingFunnel
        )
        other.retention = otherSources.length
          ? other.retention / otherSources.length
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

  // Adjust label font and bar size dynamically
  const labelFontSize = data.length > 10 ? 8 : 12
  const barSize = data.length > 15 ? 10 : 20

  return (
    <div
      className="p-4 rounded-lg shadow-md border flex flex-col flex-1"
      style={{
        borderColor: 'var(--card-revenue-border)',
        background: 'var(--card-revenue-bg)',
        minHeight: '400px',
        maxHeight: '500px',
      }}
    >
      <h2 className="text-[#E8EDC7] text-xl font-semibold mb-4">
        📣 Marketing Funnels
      </h2>

      <div className="flex-1 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
            barCategoryGap={data.length > 10 ? '30%' : '15%'}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />

            <XAxis type="number" stroke="#E8EDC7" />
            <YAxis
              type="category"
              dataKey="source"
              stroke="#E8EDC7"
              width={40}
              style={{ fontSize: labelFontSize }}
            />

            <Tooltip
              formatter={(value: any, name: string) =>
                name === 'Retention'
                  ? [`${Number(value).toFixed(2) * 10}%`, name]
                  : [value, name]
              }
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
              wrapperStyle={{ color: '#E8EDC7', paddingTop: '10px' }}
            />

            <YAxis
              type="category"
              axisLine={false}  
              tick={false}      
              width={0}      
              
            />

            <Bar
              dataKey="new_clients"
              name="New Clients"
              fill={COLORS[1]}
              radius={[8, 8, 0, 0]}
              barSize={barSize}
            >
              {/* Show source name inside the bar */}
              <LabelList
                dataKey="source"
                position="insideLeft"
                style={{ fill: '#204219ff', fontSize: labelFontSize, fontWeight: 'bold' }}
              />

              {/* Show new_clients value on the right */}
              <LabelList
                dataKey="new_clients"
                position="right"
                style={{ fill: '#E8EDC7', fontSize: labelFontSize, fontWeight: 'bold' }}
              />
            </Bar>

            <Bar
              dataKey="returning_clients"
              name="Returning Clients"
              fill={COLORS[3]}
              radius={[8, 8, 0, 0]}
              barSize={barSize}
            >
              {/* Show returning_clients value on the right */}
              <LabelList
                dataKey="returning_clients"
                position="right"
                style={{ fill: '#E8EDC7', fontSize: labelFontSize, fontWeight: 'bold' }}
              />
            </Bar>

            <Bar
              dataKey={(entry) => entry.retention / 10}
              name="Retention"
              fill={COLORS[2]}
              radius={[8, 8, 0, 0]}
              barSize={barSize}
            >
              {/* Show retention % value on the right */}
              <LabelList
                dataKey="retention"
                position="right"
                formatter={(val: any) =>
                  val !== undefined && val !== null ? `${Number(val).toFixed(2)}%` : ''
                }
                style={{ fill: '#E8EDC7', fontSize: 8, fontWeight: 'bold' }}
              />
            </Bar>

          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}