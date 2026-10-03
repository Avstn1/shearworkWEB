import { edgeFunctionRoute } from '@/lib/api/edgeFunctionRoute'

export const POST = edgeFunctionRoute('login_summary', { summaryPayload: true })
