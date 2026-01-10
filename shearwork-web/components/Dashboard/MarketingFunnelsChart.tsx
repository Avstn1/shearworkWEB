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
import MarketingFunnelsDetailsModal from './MarketingFunnelsDetailsModal';

const COLORS = ['#E8EDC7', '#9AC8CD', '#B19470', '#748E63', '#F1EEDC']

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
  const filteredData = data.filter(d => d.new_clients > 0)

  return (
    <>
      <div
        className="p-4 rounded-lg shadow-md border flex flex-col flex-1"
        style={{
          borderColor: 'var(--card-revenue-border)',
          background: 'var(--card-revenue-bg)',
          minHeight: '400px',
          maxHeight: '500px',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#E8EDC7] text-xl font-semibold">
            📣 Marketing Funnels
          </h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#748E63] hover:bg-[#9AC8CD] text-[#2a3612ff] hover:text-[#E8EDC7] rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg transform hover:scale-105 flex items-center gap-2"
          >
            <span>Details</span>
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={filteredData}
              margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
              barCategoryGap={filteredData.length > 10 ? '30%' : '15%'}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#3A3A3A" />

              <XAxis xAxisId="clients" type="number" stroke="#E8EDC7" hide domain={[0, (dataMax: number) => dataMax / 0.95]} />
              <XAxis xAxisId="retention" type="number" domain={[0, 100 / 0.95]} stroke="#E8EDC7" hide />
              
              <YAxis
                type="category"
                dataKey="source"
                stroke="#E8EDC7"
                width={60}   
                style={{ fontSize: labelFontSize }}
              />

              <Tooltip
                labelFormatter={(value, payload) => {
                  const row = payload?.[0]?.payload
                  return row?.source || ''
                }}
                formatter={(value: any, name: string) =>
                  name === 'Retention'
                    ? [`${(Number(value)).toFixed(2)}%`, name]
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
                xAxisId="clients"
                dataKey="new_clients"
                name="New Clients"
                fill={COLORS[1]}
                radius={[8, 8, 0, 0]}
                barSize={barSize}
              >
                <LabelList
                  dataKey="new_clients"
                  content={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const entry = filteredData[index];
                    
                    if (!entry) return null; // Safety check
                    
                    const maxNewClients = Math.max(...filteredData.map(d => d.new_clients));
                    const percentage = (entry.new_clients / maxNewClients) * 100;
                    
                    if (percentage > 70) {
                      // Position inside on the left, after the source text
                      return (
                        <text
                          x={x + 5}
                          y={y + height / 2}
                          fill="#2a3612ff"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value}
                        </text>
                      );
                    } else {
                      // Position outside on the right
                      return (
                        <text
                          x={x + width + 5}
                          y={y + height / 2}
                          fill="#E8EDC7"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value}
                        </text>
                      );
                    }
                  }}
                />

                {/* Show source name - conditionally positioned based on % of max */}
                <LabelList
                  dataKey="source"
                  content={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const entry = filteredData[index];
                    
                    if (!entry) return null; // Safety check
                    
                    const maxNewClients = Math.max(...filteredData.map(d => d.new_clients));
                    const percentage = (entry.new_clients / maxNewClients) * 100;
                    
                    if (percentage > 70) {
                      // Position inside on the left
                      return (
                        <text
                          x={x + 25}
                          y={y + height / 2}
                          fill="#2a3612ff"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value}
                        </text>
                      );
                    } else {
                      // Position outside on the right
                      return (
                        <text
                          x={x + width + 25}
                          y={y + height / 2}
                          fill="#E8EDC7"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value}
                        </text>
                      );
                    }
                  }}
                />
              </Bar>

              <Bar
                xAxisId="clients"
                dataKey="new_clients_retained"
                name="New Clients Retained"
                fill={COLORS[3]}
                radius={[8, 8, 0, 0]}
                barSize={barSize}
              >
                {/* Show new_clients_retained value - conditionally positioned based on % of max */}
                <LabelList
                  dataKey="new_clients_retained"
                  content={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const entry = filteredData[index];
                    
                    if (!entry) return null; // Safety check
                    
                    // Find max of both new and new_clients_retained for proper scaling
                    const maxClients = Math.max(
                      ...filteredData.map(d => Math.max(d.new_clients, d.new_clients_retained))
                    );
                    const percentage = (entry.new_clients_retained / maxClients) * 100;
                    
                    if (percentage > 70) {
                      // Position inside on the left
                      return (
                        <text
                          x={x + 5}
                          y={y + height / 2}
                          fill="#2a3612ff"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value}
                        </text>
                      );
                    } else {
                      // Position outside on the right
                      return (
                        <text
                          x={x + width + 5}
                          y={y + height / 2}
                          fill="#E8EDC7"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value}
                        </text>
                      );
                    }
                  }}
                />
              </Bar>

              <Bar
                xAxisId="retention"
                dataKey="retention"
                name="Retention"
                fill={COLORS[2]}
                radius={[8, 8, 0, 0]}
                barSize={barSize}
              >
                {/* Show retention % value - conditionally positioned based on percentage */}
                <LabelList
                  dataKey="retention"
                  content={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const entry = filteredData[index];
                    
                    if (!entry) return null; // Safety check
                    
                    const percentage = entry.retention; // retention is already a percentage
                    
                    if (percentage > 70) {
                      // Position inside on the left
                      return (
                        <text
                          x={x + 5}
                          y={y + height / 2}
                          fill="#2a3612ff"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value !== undefined && value !== null ? `${Number(value).toFixed(2)}%` : ''}
                        </text>
                      );
                    } else {
                      // Position outside on the right
                      return (
                        <text
                          x={x + width + 5}
                          y={y + height / 2}
                          fill="#E8EDC7"
                          fontSize={labelFontSize}
                          fontWeight="bold"
                          textAnchor="start"
                          dominantBaseline="middle"
                        >
                          {value !== undefined && value !== null ? `${Number(value).toFixed(2)}%` : ''}
                        </text>
                      );
                    }
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
        months={[month]}
        year={year}
        data={data}
      />
    </>
  )
}