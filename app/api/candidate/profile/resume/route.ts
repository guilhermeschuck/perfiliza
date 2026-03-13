import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const candidateId = url.searchParams.get('candidateId')
  const path = candidateId
    ? `/candidate/profile/resume?candidateId=${encodeURIComponent(candidateId)}`
    : '/candidate/profile/resume'

  const { response, payload } = await requestLaravel(path)
  return NextResponse.json(payload, { status: response.status })
}

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const { response, payload } = await requestLaravel('/candidate/profile/resume', {
    method: 'POST',
    body: formData,
  })

  return NextResponse.json(payload, { status: response.status })
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const candidateId = url.searchParams.get('candidateId')
  const path = candidateId
    ? `/candidate/profile/resume?candidateId=${encodeURIComponent(candidateId)}`
    : '/candidate/profile/resume'

  const { response, payload } = await requestLaravel(path, {
    method: 'DELETE',
  })

  return NextResponse.json(payload, { status: response.status })
}
