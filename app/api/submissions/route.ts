import { NextRequest, NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? ''
  const body = contentType.includes('multipart/form-data')
    ? await request.formData()
    : JSON.stringify(await request.json())

  const { response, payload } = await requestLaravel('/submissions', {
    method: 'POST',
    body,
  })

  return NextResponse.json(payload, { status: response.status })
}
