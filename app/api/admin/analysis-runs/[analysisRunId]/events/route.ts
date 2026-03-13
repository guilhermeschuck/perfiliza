import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ analysisRunId: string }> },
) {
  const { analysisRunId } = await params
  const { response, payload } = await requestLaravel(`/admin/analysis-runs/${analysisRunId}/events`)

  return NextResponse.json(payload, { status: response.status })
}
