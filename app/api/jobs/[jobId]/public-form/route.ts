import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const body = await request.json()
  const { response, payload } = await requestLaravel(`/jobs/${jobId}/public-form`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
