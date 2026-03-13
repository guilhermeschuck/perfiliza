import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { response, payload } = await requestLaravel('/admin/analyses/ia-metrics')

  return NextResponse.json(payload, { status: response.status })
}
