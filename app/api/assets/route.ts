import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET all assets with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const oem = searchParams.get('oem') || ''
    const screenType = searchParams.get('screenType') || ''
    const assetType = searchParams.get('assetType') || ''

    const assets = await prisma.asset.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
            ]
          } : {},
          oem ? { oem } : {},
          screenType ? { screenType } : {},
          assetType ? { assetType } : {},
        ]
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(assets)
  } catch (error) {
    console.error('Error fetching assets:', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

// POST create new asset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, filename, url, oem, screenType, assetType, description, format, size } = body

    const asset = await prisma.asset.create({
      data: {
        name,
        filename,
        url,
        oem,
        screenType,
        assetType: assetType || 'Mockup',
        description,
        format,
        size,
      }
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('Error creating asset:', error)
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }
}

