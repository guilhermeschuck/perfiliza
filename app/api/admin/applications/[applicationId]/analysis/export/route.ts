import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> },
) {
  const { applicationId } = await params
  const { response, payload } = await requestLaravel(`/admin/applications/${applicationId}/analysis/export`)

  return NextResponse.json(payload, { status: response.status })
}
