'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, ChevronUp, TrendingUp, Users, Percent, DollarSign } from 'lucide-react'
import { EmptyState } from '@/components/ui/AppKit'
import { supabase } from '@/utils/supabaseClient'

interface MarketingFunnel {
  source: string
  new_clients: number
  returning_clients: number
  new_clients_retained: number
  retention: number
  avg_ticket: number
  timeframe?: string
}

interface MarketingFunnelsDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  barberId: string
  months: string[]
  year: number
  data: MarketingFunnel[]
}

interface ClientDetail {
  client_name: string
  first_visit: string
  second_visit: string | null
}

interface FunnelWithClients extends MarketingFunnel {
  client_names?: ClientDetail[]
}

export default function MarketingFunnelsDetailsModal({
  isOpen,
  onClose,
  barberId,
  months,
  year,
  data,
}: MarketingFunnelsDetailsModalProps) {
  const [detailedData, setDetailedData] = useState<FunnelWithClients[]>([])
  const [expandedSource, setExpandedSource] = useState<string | null>(null)

  // Convert month names to numbers
  const getMonthNumber = (monthName: string): number => {
    const monthMap: { [key: string]: number } = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4,
      'May': 5, 'June': 6, 'July': 7, 'August': 8,
      'September': 9, 'October': 10, 'November': 11, 'December': 12
    }
    return monthMap[monthName] || 1
  }

  // Determine timeline type and message
  const getTimelineInfo = () => {
    if (months.length === 1) {
      return {
        type: 'month',
        message: `No other visits for the month of ${months[0]}`
      }
    }
    
    // Check if it's a quarter
    const monthNumbers = months.map(m => getMonthNumber(m)).sort((a, b) => a - b)
    const quarters = [
      [1, 2, 3], // Q1
      [4, 5, 6], // Q2
      [7, 8, 9], // Q3
      [10, 11, 12] // Q4
    ]
    
    for (let i = 0; i < quarters.length; i++) {
      if (JSON.stringify(monthNumbers) === JSON.stringify(quarters[i])) {
        return {
          type: 'quarter',
          message: `No other visits for Q${i + 1} of ${year}`
        }
      }
    }
    
    // Check if it's a full year
    if (months.length === 12) {
      return {
        type: 'year',
        message: `No other visits for ${year}`
      }
    }
    
    // Custom range
    return {
      type: 'custom',
      message: `No other visits for selected period`
    }
  }

  const timelineInfo = getTimelineInfo()

  // Check if a date falls within the timeline
  const isDateInTimeline = (dateString: string): boolean => {
    if (!dateString) return false
    
    const date = new Date(dateString + 'T00:00:00')
    const dateMonth = date.getMonth() + 1
    const dateYear = date.getFullYear()
    
    if (dateYear !== year) return false
    
    const monthNumbers = months.map(m => getMonthNumber(m))
    return monthNumbers.includes(dateMonth)
  }

  useEffect(() => {
    if (!isOpen) return

    const fetchDetailedData = async () => {
      const monthNumbers = months.map(m => getMonthNumber(m))

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
        return
      }

      // Filter clients whose first_appt is in the selected months
      const filteredClients = clients?.filter(client => {
        if (!client.first_appt) return false
        const apptMonth = new Date(client.first_appt + 'T00:00:00').getMonth() + 1
        return monthNumbers.includes(apptMonth)
      }) || []

      // Group clients by source
      const sourceMap = new Map<string, ClientDetail[]>()

      filteredClients.forEach(client => {
        const source = client.first_source || 'Unknown'
        if (!sourceMap.has(source)) {
          sourceMap.set(source, [])
        }
        
        sourceMap.get(source)!.push({
          client_name: `${client.first_name} ${client.last_name}`,
          first_visit: client.first_appt!,
          second_visit: client.second_appt
        })
      })

      // Build final data with timeline-based retention
      const funnelData: FunnelWithClients[] = []

      for (const [source, clientList] of sourceMap.entries()) {
        // Calculate retention based on timeline
        const clientsWithSecondVisitInTimeline = clientList.filter(client => 
          client.second_visit && isDateInTimeline(client.second_visit)
        ).length
        
        const newClients = clientList.length
        const retention = newClients > 0 ? (clientsWithSecondVisitInTimeline / newClients) * 100 : 0
        
        // Calculate average ticket from FIRST appointments for all new clients in this source
        let avgTicket = 0
        
        if (clientList.length > 0) {
          // Get client_ids and their first appointment dates
          const clientAppointmentData = clientList
            .map(c => {
              const originalClient = filteredClients.find(fc => 
                `${fc.first_name} ${fc.last_name}`.toLowerCase() === c.client_name.toLowerCase()
              )
              return originalClient ? {
                client_id: originalClient.client_id,
                first_appt: originalClient.first_appt
              } : null
            })
            .filter(Boolean) as Array<{ client_id: string; first_appt: string }>
          
          if (clientAppointmentData.length > 0) {
            // Fetch first appointments for these clients
            const clientIds = clientAppointmentData.map(c => c.client_id)
            
            const { data: appointments } = await supabase
              .from('acuity_appointments')
              .select('client_id, appointment_date, revenue')
              .eq('user_id', barberId)
              .in('client_id', clientIds)
            
            if (appointments && appointments.length > 0) {
              // Match appointments to first_appt dates and get revenue
              const firstAppointmentRevenues: number[] = []
              
              clientAppointmentData.forEach(clientData => {
                const firstAppt = appointments.find(appt => 
                  appt.client_id === clientData.client_id && 
                  appt.appointment_date === clientData.first_appt
                )
                
                if (firstAppt && firstAppt.revenue) {
                  firstAppointmentRevenues.push(Number(firstAppt.revenue))
                }
              })
              
              if (firstAppointmentRevenues.length > 0) {
                const totalRevenue = firstAppointmentRevenues.reduce((sum, rev) => sum + rev, 0)
                avgTicket = totalRevenue / firstAppointmentRevenues.length
              }
            }
          }
        }
        
        // Sort client names: clients with second_visit first, then by first_visit date
        const sortedClientNames = clientList.sort((a, b) => {
          // Prioritize clients with second_visit in timeline
          const aHasSecondInTimeline = a.second_visit && isDateInTimeline(a.second_visit) ? 1 : 0
          const bHasSecondInTimeline = b.second_visit && isDateInTimeline(b.second_visit) ? 1 : 0
          
          if (bHasSecondInTimeline !== aHasSecondInTimeline) {
            return bHasSecondInTimeline - aHasSecondInTimeline // Clients with second_visit in timeline come first
          }
          
          // If both have or don't have second_visit in timeline, sort by first_visit
          const dateA = new Date(a.first_visit + 'T00:00:00')
          const dateB = new Date(b.first_visit + 'T00:00:00')
          return dateA.getTime() - dateB.getTime()
        })

        funnelData.push({
          source,
          new_clients: newClients,
          returning_clients: 0,
          new_clients_retained: clientsWithSecondVisitInTimeline,
          retention: retention,
          avg_ticket: avgTicket,
          client_names: sortedClientNames
        })
      }

      // Sort by total new clients
      funnelData.sort((a, b) => b.new_clients - a.new_clients)

      setDetailedData(funnelData)
    }

    fetchDetailedData()
  }, [isOpen, barberId, months, year])

  const toggleSource = (source: string) => {
    setExpandedSource(prev => prev === source ? null : source)
  }

  // Format months display
  const monthsDisplay = months.length === 1 
    ? months[0] 
    : months.length === 2 
    ? `${months[0]} & ${months[1]}`
    : `${months[0]} - ${months[months.length - 1]}`

  if (!isOpen) return null

  const metric = (Icon: typeof Users, label: string, value: React.ReactNode) => (
    <div className="rounded-md border border-white/[0.07] bg-canvas/60 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-500" strokeWidth={1.75} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</p>
      </div>
      <p className="mt-1 text-base font-semibold tabular-nums text-ivory sm:text-lg">{value}</p>
    </div>
  )

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="modal-backdrop z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center p-4"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Marketing Funnels Details"
              className="modal-surface pointer-events-auto flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden sm:h-[80vh]"
            >
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-ivory sm:text-lg">Marketing Funnels Details</h2>
                  <p className="mt-0.5 text-xs text-muted sm:text-[13px]">
                    {monthsDisplay} {year} · {detailedData.length} source{detailedData.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm px-1.5">
                  <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="p-3 sm:p-4">
                  {detailedData.length === 0 ? (
                    <EmptyState icon={Users} title="No data available" />
                  ) : (
                    <div className="space-y-2">
                      {detailedData.map((funnel, idx) => (
                        <div
                          key={funnel.source}
                          className="overflow-hidden rounded-lg border border-white/[0.07] bg-raised transition-colors hover:border-white/[0.12]"
                        >
                          {/* Source Header */}
                          <button
                            type="button"
                            onClick={() => toggleSource(funnel.source)}
                            aria-expanded={expandedSource === funnel.source}
                            className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-white/[0.02]"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-xs font-semibold tabular-nums text-gray-300">
                                {idx + 1}
                              </span>
                              <h3 className="text-sm font-semibold text-ivory sm:text-[15px]">{funnel.source}</h3>
                            </div>
                            {expandedSource === funnel.source ? (
                              <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} />
                            ) : (
                              <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} />
                            )}
                          </button>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4">
                            {metric(Users, 'New', funnel.new_clients)}
                            {metric(TrendingUp, 'Returned', funnel.new_clients_retained)}
                            {metric(Percent, 'Retention', `${funnel.retention.toFixed(1)}%`)}
                            {metric(DollarSign, 'Average Ticket', `$${funnel.avg_ticket.toFixed(0)}`)}
                          </div>

                          {/* Client Names List */}
                          <AnimatePresence>
                            {expandedSource === funnel.source && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-white/[0.07] px-3 pb-3 pt-3">
                                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                                    <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                                    New Clients ({funnel.client_names?.length || 0})
                                  </h4>
                                  {funnel.client_names && funnel.client_names.length > 0 ? (
                                    <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                                      {funnel.client_names.map((client, idx) => {
                                        const hasSecondVisitInTimeline = client.second_visit && isDateInTimeline(client.second_visit)

                                        return (
                                          <div
                                            key={idx}
                                            className="rounded-md border border-white/[0.07] bg-canvas/60 px-2.5 py-2"
                                          >
                                            <div className="flex flex-col gap-1.5">
                                              <span className="truncate text-[13px] font-medium capitalize text-ivory">
                                                {client.client_name}
                                              </span>
                                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                <div className="flex items-center gap-1">
                                                  <span className="text-gray-500">1st</span>
                                                  <span className="badge badge-info tabular-nums">
                                                    {new Date(client.first_visit + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <span className="text-gray-500">2nd</span>
                                                  <span className={`badge tabular-nums ${hasSecondVisitInTimeline ? 'badge-sage' : 'text-gray-500'}`}>
                                                    {hasSecondVisitInTimeline
                                                      ? new Date(client.second_visit! + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                      : timelineInfo.message
                                                    }
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-500">No client data available</p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex shrink-0 flex-col items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3 sm:flex-row sm:px-5">
                <p className="text-center text-xs text-gray-500 sm:text-left">
                  Click on any source to view client details
                </p>
                <button type="button" onClick={onClose} className="btn btn-primary btn-sm w-full sm:w-auto">
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null
} 