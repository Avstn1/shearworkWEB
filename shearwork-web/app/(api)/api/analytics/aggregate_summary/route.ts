import { edgeFunctionRoute } from '@/lib/api/edgeFunctionRoute'

export const POST = edgeFunctionRoute('aggregate_summary', { summaryPayload: true })
