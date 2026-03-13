import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const candidateId = url.searchParams.get('candidateId')
  const path = candidateId
    ? `/candidate/saved-jobs?candidateId=${encodeURIComponent(candidateId)}`
    : '/candidate/saved-jobs'

  const { response, payload } = await requestLaravel(path)
  return NextResponse.json(payload, { status: response.status })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { response, payload } = await requestLaravel('/candidate/saved-jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
