import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { response, payload } = await requestLaravel('/admin/token-pricing')
  return NextResponse.json(payload, { status: response.status })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { response, payload } = await requestLaravel('/admin/token-pricing', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
