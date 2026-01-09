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

      // Fetch marketing funnels data for retention metrics
      const { data: funnels } = await supabase
        .from('marketing_funnels')
        .select('source, new_clients, new_clients_retained, retention, avg_ticket')
        .eq('user_id', barberId)
        .in('report_month', months)
        .eq('report_year', year)

      // Create a map of retention data by source
      const retentionMap = new Map<string, { retention: number, avg_ticket: number, new_clients_retained: number }>()
      
      funnels?.forEach(funnel => {
        const existing = retentionMap.get(funnel.source)
        if (existing) {
          // Average the retention and avg_ticket across months
          const totalClients = existing.new_clients_retained + (funnel.new_clients_retained || 0)
          existing.new_clients_retained = totalClients
          existing.avg_ticket = ((existing.avg_ticket + funnel.avg_ticket) / 2)
          existing.retention = ((existing.retention + funnel.retention) / 2)
        } else {
          retentionMap.set(funnel.source, {
            retention: funnel.retention || 0,
            avg_ticket: funnel.avg_ticket || 0,
            new_clients_retained: funnel.new_clients_retained || 0
          })
        }
      })

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

      // Build final data
      const funnelData: FunnelWithClients[] = []

      for (const [source, clientList] of sourceMap.entries()) {
        const retentionData = retentionMap.get(source)
        
        // Sort client names by first visit date
        const sortedClientNames = clientList.sort((a, b) => {
          const dateA = new Date(a.first_visit + 'T00:00:00')
          const dateB = new Date(b.first_visit + 'T00:00:00')
          return dateA.getTime() - dateB.getTime()
        })

        funnelData.push({
          source,
          new_clients: clientList.length,
          returning_clients: 0,
          new_clients_retained: retentionData?.new_clients_retained || 0,
          retention: retentionData?.retention || 0,
          avg_ticket: retentionData?.avg_ticket || 0,
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
                                      {funnel.client_names.map((client, idx) => (
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
                                                <span className={`px-1 py-0.5 rounded whitespace-nowrap ${client.second_visit ? 'text-[#E8EDC7] bg-[#748E63]/20' : 'text-[#E8EDC7]/40 bg-white/5'}`}>
                                                  {client.second_visit 
                                                    ? new Date(client.second_visit + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                                    : 'N/A'
                                                  }
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
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