import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const { notificationId } = await params
  const body = await request.json()

  const { response, payload } = await requestLaravel(`/candidate/notifications/${notificationId}/read`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
