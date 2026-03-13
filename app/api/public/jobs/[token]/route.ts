import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { response, payload } = await requestLaravel(`/public/jobs/${token}`)

  return NextResponse.json(payload, { status: response.status })
}
