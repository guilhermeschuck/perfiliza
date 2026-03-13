import { NextResponse } from 'next/server'
import { requestLaravel } from '@/lib/backend-proxy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { response, payload } = await requestLaravel('/admin/companies')

  return NextResponse.json(payload, { status: response.status })
}
