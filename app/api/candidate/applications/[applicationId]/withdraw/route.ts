import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await params
  const body = await request.json()

  const { response, payload } = await requestLaravel(`/candidate/applications/${applicationId}/withdraw`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return NextResponse.json(payload, { status: response.status })
}
