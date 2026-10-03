import { edgeFunctionRoute } from '@/lib/api/edgeFunctionRoute'

export const POST = edgeFunctionRoute('finance_summary', { summaryPayload: true })
