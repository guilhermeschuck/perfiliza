import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const role = url.searchParams.get('role')
  const userId = url.searchParams.get('userId')

  const path = `/settings?role=${encodeURIComponent(role ?? '')}&userId=${encodeURIComponent(userId ?? '')}`
  const { response, payload } = await requestLaravel(path)

  return NextResponse.json(payload, { status: response.status })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { response, payload } = await requestLaravel('/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
