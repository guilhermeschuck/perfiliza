import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const url = new URL(request.url)
  const candidateId = url.searchParams.get('candidateId')
  const path = candidateId
    ? `/candidate/saved-jobs/${jobId}?candidateId=${encodeURIComponent(candidateId)}`
    : `/candidate/saved-jobs/${jobId}`

  const { response, payload } = await requestLaravel(path, {
    method: 'DELETE',
  })

  return NextResponse.json(payload, { status: response.status })
}
