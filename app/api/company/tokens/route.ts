import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const companyId = url.searchParams.get('companyId')
  const limit = url.searchParams.get('limit')
  const params = new URLSearchParams()

  if (companyId) {
    params.set('companyId', companyId)
  }

  if (limit) {
    params.set('limit', limit)
  }

  const path = params.toString()
    ? `/company/tokens?${params.toString()}`
    : '/company/tokens'

  const { response, payload } = await requestLaravel(path)
  return NextResponse.json(payload, { status: response.status })
}
