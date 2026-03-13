import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const body = await request.formData()
  const { response, payload } = await requestLaravel(`/public/jobs/${token}/leads`, {
    method: 'POST',
    body,
  })

  return NextResponse.json(payload, { status: response.status })
}
