import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { response, payload } = await requestLaravel('/company/tokens/consume', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
