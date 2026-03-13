import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId')
  const path = companyId
    ? `/company/reports/hiring-time?companyId=${encodeURIComponent(companyId)}`
    : '/company/reports/hiring-time'

  const { response, payload } = await requestLaravel(path)
  return NextResponse.json(payload, { status: response.status })
}
