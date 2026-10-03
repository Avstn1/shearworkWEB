import { edgeFunctionRoute } from '@/lib/api/edgeFunctionRoute'

export const POST = edgeFunctionRoute('monthlyReport_summary', { summaryPayload: true })
