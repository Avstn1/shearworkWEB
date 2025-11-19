'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface ReportToOpen {
  id: string
  type: string
}

interface AppContextType {
  reportToOpen: ReportToOpen | null
  setReportToOpen: (report: ReportToOpen | null) => void
  openReport: (reportId: string, reportType: string) => void
  refreshTrigger: number  // ADD THIS
  triggerRefresh: () => void  // ADD THIS
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [reportToOpen, setReportToOpen] = useState<ReportToOpen | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)  // ADD THIS

  const openReport = (reportId: string, reportType: string) => {
    setReportToOpen({ id: reportId, type: reportType })
  }

  const triggerRefresh = () => {  // ADD THIS
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <AppContext.Provider value={{ 
      reportToOpen, 
      setReportToOpen, 
      openReport,
      refreshTrigger,  // ADD THIS
      triggerRefresh  // ADD THIS
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}