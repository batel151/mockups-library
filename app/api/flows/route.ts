import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/flows - List all flows
export async function GET() {
  try {
    const flows = await prisma.flow.findMany({
      include: {
        frames: {
          include: {
            asset: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ flows })
  } catch (error) {
    console.error('Error fetching flows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flows' },
      { status: 500 }
    )
  }
}

// POST /api/flows - Create a new flow
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, figmaFileId, frames } = body

    if (!name || !frames || frames.length === 0) {
      return NextResponse.json(
        { error: 'Name and frames are required' },
        { status: 400 }
      )
    }

    const flow = await prisma.flow.create({
      data: {
        name,
        description: description || null,
        figmaFileId: figmaFileId || null,
        frames: {
          create: frames.map((frame: { assetId: string; delay?: number }, index: number) => ({
            assetId: frame.assetId,
            order: index,
            delay: frame.delay || 1000,
          })),
        },
      },
      include: {
        frames: {
          include: {
            asset: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    })

    return NextResponse.json({ flow }, { status: 201 })
  } catch (error) {
    console.error('Error creating flow:', error)
    return NextResponse.json(
      { error: 'Failed to create flow' },
      { status: 500 }
    )
  }
}

