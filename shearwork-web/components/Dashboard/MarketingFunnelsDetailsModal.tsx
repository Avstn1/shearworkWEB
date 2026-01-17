'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, ChevronUp, TrendingUp, Users, Percent, DollarSign } from 'lucide-react'
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          >
            <div className="bg-gradient-to-br from-[#1a1f1b] to-[#2e3b2b] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl w-full h-[85vh] sm:h-[80vh] max-w-3xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#748E63]/30 to-[#9AC8CD]/30 border-b border-white/10 p-3 sm:p-4 flex items-center justify-between flex-shrink-0">
                <div className="min-w-0 flex-1 pr-2">
                  <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-[#E8EDC7] to-[#9AC8CD] bg-clip-text text-transparent">
                    📣 Marketing Funnels Details
                  </h2>
                  <p className="text-[10px] sm:text-xs text-[#E8EDC7]/70 mt-0.5">
                    {monthsDisplay} {year} • {detailedData.length} source{detailedData.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 sm:w-5 sm:h-5 text-[#E8EDC7]" />
                </button>
              </div>

              {/* Content - Fixed Height with Hidden Scrollbar */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scroll-container">
                <div className="p-3 sm:p-4">
                  {detailedData.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-[#E8EDC7] opacity-70 text-sm">No data available</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailedData.map((funnel, idx) => (
                        <div 
                          key={funnel.source}
                          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg overflow-hidden hover:border-[#9AC8CD]/30 transition-colors"
                        >
                          {/* Source Header */}
                          <button
                            onClick={() => toggleSource(funnel.source)}
                            className="w-full p-2.5 sm:p-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[#748E63] to-[#9AC8CD] flex items-center justify-center text-[#2a3612ff] font-bold text-xs">
                                {idx + 1}
                              </div>
                              <h3 className="text-[#E8EDC7] text-sm sm:text-base font-semibold">
                                {funnel.source}
                              </h3>
                            </div>
                            {expandedSource === funnel.source ? (
                              <ChevronUp className="w-4 h-4 text-[#E8EDC7]/70 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-[#E8EDC7]/70 flex-shrink-0" />
                            )}
                          </button>

                          {/* Stats Grid */}
                          <div className="px-2.5 sm:px-3 pb-2 sm:pb-2.5">
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className="bg-gradient-to-br from-[#9AC8CD]/10 to-[#9AC8CD]/5 border border-[#9AC8CD]/20 p-1.5 rounded">
                                <div className="flex items-center gap-0.5 mb-1">
                                  <Users className="w-2.5 h-2.5 text-[#9AC8CD]" />
                                  <p className="text-[#9AC8CD] text-[12px] font-semibold">New</p>
                                </div>
                                <p className="text-[#E8EDC7] text-base sm:text-lg font-bold">{funnel.new_clients}</p>
                              </div>
                              
                              <div className="bg-gradient-to-br from-[#748E63]/10 to-[#748E63]/5 border border-[#748E63]/20 p-1.5 rounded">
                                <div className="flex items-center gap-0.5 mb-1">
                                  <TrendingUp className="w-2.5 h-2.5 text-[#748E63]" />
                                  <p className="text-[#748E63] text-[12px] font-semibold">Returned</p>
                                </div>
                                <p className="text-[#E8EDC7] text-base sm:text-lg font-bold">{funnel.new_clients_retained}</p>
                              </div>
                              
                              <div className="bg-gradient-to-br from-[#B19470]/10 to-[#B19470]/5 border border-[#B19470]/20 p-1.5 rounded">
                                <div className="flex items-center gap-0.5 mb-1">
                                  <Percent className="w-2.5 h-2.5 text-[#B19470]" />
                                  <p className="text-[#B19470] text-[12px] font-semibold">Retention</p>
                                </div>
                                <p className="text-[#E8EDC7] text-base sm:text-lg font-bold">
                                  {funnel.retention.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            
                            {/* Average Ticket on separate row */}
                            <div className="mt-1.5">
                              <div className="bg-gradient-to-br from-[#F1EEDC]/10 to-[#F1EEDC]/5 border border-[#F1EEDC]/20 p-1.5 rounded">
                                <div className="flex items-center gap-0.5 mb-1">
                                  <DollarSign className="w-2.5 h-2.5 text-[#F1EEDC]" />
                                  <p className="text-[#F1EEDC] text-[12px] font-semibold">Average Ticket</p>
                                </div>
                                <p className="text-[#E8EDC7] text-base sm:text-lg font-bold">
                                  ${funnel.avg_ticket.toFixed(0)}
                                </p>
                              </div>
                            </div>
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
                                <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3 border-t border-white/10 pt-2.5 sm:pt-3">
                                  <h4 className="text-[#E8EDC7] text-[10px] sm:text-xs font-semibold mb-2 flex items-center gap-1.5">
                                    <Users className="w-3 h-3" />
                                    New Clients ({funnel.client_names?.length || 0}):
                                  </h4>
                                  {funnel.client_names && funnel.client_names.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                      {funnel.client_names.map((client, idx) => {
                                        const hasSecondVisitInTimeline = client.second_visit && isDateInTimeline(client.second_visit)
                                        
                                        return (
                                          <div 
                                            key={idx}
                                            className="bg-gradient-to-r from-white/5 to-white/10 border border-white/10 p-1.5 rounded hover:border-[#9AC8CD]/30 transition-colors"
                                          >
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[#E8EDC7] text-[12px] capitalize font-medium truncate">
                                                {client.client_name}
                                              </span>
                                              <div className="flex items-center gap-1.5 text-[9px]">
                                                <div className="flex items-center gap-0.5">
                                                  <span className="text-[#E8EDC7]/50 font-semibold">1st:</span>
                                                  <span className="text-[#E8EDC7] bg-[#9AC8CD]/20 px-1 py-0.5 rounded whitespace-nowrap">
                                                    {new Date(client.first_visit + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                  <span className="text-[#E8EDC7]/50 font-semibold">2nd:</span>
                                                  <span className={`px-1 py-0.5 rounded text-[8px] ${hasSecondVisitInTimeline ? 'text-[#E8EDC7] bg-[#748E63]/20' : 'text-[#E8EDC7]/40 bg-white/5'}`}>
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
                                    <p className="text-[#E8EDC7] opacity-50 text-xs">No client data available</p>
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
              <div className="p-2.5 sm:p-3 border-t border-white/10 bg-black/20 flex flex-col sm:flex-row justify-between items-center gap-2 flex-shrink-0">
                <p className="text-[10px] sm:text-[12px] text-[#E8EDC7]/50 text-center sm:text-left">
                  Click on any source to view client details
                </p>
                <button
                  onClick={onClose}
                  className="px-4 sm:px-5 py-1.5 bg-gradient-to-r from-[#748E63] to-[#9AC8CD] hover:from-[#9AC8CD] hover:to-[#748E63] text-[#2a3612ff] rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 text-xs sm:text-sm w-full sm:w-auto"
                >
                  Close
                </button>
              </div>

              {/* Hide scrollbar styles */}
              <style jsx>{`
                .custom-scroll-container {
                  scrollbar-width: none;
                  -ms-overflow-style: none;
                }
                .custom-scroll-container::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null
} 