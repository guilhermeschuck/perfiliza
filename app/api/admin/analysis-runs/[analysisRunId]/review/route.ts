import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisRunId: string }> },
) {
  const { analysisRunId } = await params
  const { response, payload } = await requestLaravel(`/admin/analysis-runs/${analysisRunId}/review`)

  return NextResponse.json(payload, { status: response.status })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ analysisRunId: string }> },
) {
  const { analysisRunId } = await params
  const body = await request.json()

  const { response, payload } = await requestLaravel(`/admin/analysis-runs/${analysisRunId}/review`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
