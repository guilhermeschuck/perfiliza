import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const body = await request.json()
  const { response, payload } = await requestLaravel(`/admin/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const { response, payload } = await requestLaravel(`/admin/jobs/${jobId}`, {
    method: 'DELETE',
  })

  return NextResponse.json(payload, { status: response.status })
}
