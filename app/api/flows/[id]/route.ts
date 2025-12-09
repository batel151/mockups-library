import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/flows/[id] - Get flow details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    const flow = await prisma.flow.findUnique({
      where: { id },
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

    if (!flow) {
      return NextResponse.json(
        { error: 'Flow not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ flow })
  } catch (error) {
    console.error('Error fetching flow:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flow' },
      { status: 500 }
    )
  }
}

// PUT /api/flows/[id] - Update flow
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, frames } = body

    // Delete existing frames and create new ones
    await prisma.flowFrame.deleteMany({
      where: { flowId: id },
    })

    const flow = await prisma.flow.update({
      where: { id },
      data: {
        name,
        description: description || null,
        frames: frames ? {
          create: frames.map((frame: { assetId: string; delay?: number }, index: number) => ({
            assetId: frame.assetId,
            order: index,
            delay: frame.delay || 1000,
          })),
        } : undefined,
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

    return NextResponse.json({ flow })
  } catch (error) {
    console.error('Error updating flow:', error)
    return NextResponse.json(
      { error: 'Failed to update flow' },
      { status: 500 }
    )
  }
}

// DELETE /api/flows/[id] - Delete flow
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params

    await prisma.flow.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting flow:', error)
    return NextResponse.json(
      { error: 'Failed to delete flow' },
      { status: 500 }
    )
  }
}

