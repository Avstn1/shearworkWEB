import { edgeFunctionRoute } from '@/lib/api/edgeFunctionRoute'

export const POST = edgeFunctionRoute('nav_summary', { summaryPayload: true })
