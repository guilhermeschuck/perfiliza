import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const candidateId = url.searchParams.get('candidateId')
  const path = candidateId
    ? `/candidate/notifications?candidateId=${encodeURIComponent(candidateId)}`
    : '/candidate/notifications'

  const { response, payload } = await requestLaravel(path)

  return NextResponse.json(payload, { status: response.status })
}
