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

const COLORS = ['#E8EDC7', '#9AC8CD', '#B19470', '#748E63', '#F1EEDC']

export interface MarketingFunnel {
  source: string
  new_clients: number
  returning_clients: number
  new_clients_retained: number
  retention: number
  avg_ticket: number
  timeframe?: string
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

        // Calculate retention and avg_ticket for each source
        const funnelData = Array.from(sourceMap.values())
        
        for (const funnel of funnelData) {
          // Calculate retention
          funnel.retention = funnel.new_clients > 0 
            ? (funnel.new_clients_retained / funnel.new_clients) * 100 
            : 0

          // Calculate average ticket from FIRST appointments for all new clients in this source
          const sourceClients = filteredClients.filter(c => c.first_source === funnel.source)
          
          if (sourceClients.length > 0) {
            const clientIds = sourceClients.map(c => c.client_id)
            
            const { data: appointments } = await supabase
              .from('acuity_appointments')
              .select('client_id, appointment_date, revenue')
              .eq('user_id', barberId)
              .in('client_id', clientIds)
            
            if (appointments && appointments.length > 0) {
              const firstAppointmentRevenues: number[] = []
              
              sourceClients.forEach(client => {
                const firstAppt = appointments.find(appt => 
                  appt.client_id === client.client_id && 
                  appt.appointment_date === client.first_appt
                )
                
                if (firstAppt && firstAppt.revenue) {
                  firstAppointmentRevenues.push(Number(firstAppt.revenue))
                }
              })
              
              if (firstAppointmentRevenues.length > 0) {
                const totalRevenue = firstAppointmentRevenues.reduce((sum, rev) => sum + rev, 0)
                funnel.avg_ticket = totalRevenue / firstAppointmentRevenues.length
              }
            }
          }
        }

        // Sort by new clients descending
        funnelData.sort((a, b) => b.new_clients - a.new_clients)

        setData(funnelData)

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
            📣 {timeframeLabel(timeframe, year)}
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
                    
                    if (!entry) return null;
                    
                    const maxNewClients = Math.max(...filteredData.map(d => d.new_clients));
                    const percentage = (entry.new_clients / maxNewClients) * 100;
                    
                    if (percentage > 70) {
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

                <LabelList
                  dataKey="source"
                  content={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const entry = filteredData[index];
                    
                    if (!entry) return null;
                    
                    const maxNewClients = Math.max(...filteredData.map(d => d.new_clients));
                    const percentage = (entry.new_clients / maxNewClients) * 100;
                    
                    if (percentage > 70) {
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
                <LabelList
                  dataKey="new_clients_retained"
                  content={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const entry = filteredData[index];
                    
                    if (!entry) return null;
                    
                    const maxClients = Math.max(
                      ...filteredData.map(d => Math.max(d.new_clients, d.new_clients_retained))
                    );
                    const percentage = (entry.new_clients_retained / maxClients) * 100;
                    
                    if (percentage > 70) {
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
                <LabelList
                  dataKey="retention"
                  content={(props: any) => {
                    const { x, y, width, height, value, index } = props;
                    const entry = filteredData[index];
                    
                    if (!entry) return null;
                    
                    const percentage = entry.retention;
                    
                    if (percentage > 70) {
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
        months={monthsForModal} 
        year={year}
        data={data}
      />
    </>
  )
}