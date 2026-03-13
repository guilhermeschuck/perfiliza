import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; leadId: string }> },
) {
  const { jobId, leadId } = await params
  const { response, payload } = await requestLaravel(`/jobs/${jobId}/leads/${leadId}/submit`, {
    method: 'POST',
  })

  return NextResponse.json(payload, { status: response.status })
}
