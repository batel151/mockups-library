import { NextResponse } from 'next/server'
import { getPrototypeConnections, getFrames, getFigmaToken } from '@/lib/figma'

export interface FlowStep {
  nodeId: string;
  nodeName: string;
  nextNodeId: string | null;
}

export interface PrototypeFlow {
  name: string;
  startNodeId: string;
  steps: FlowStep[];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const fileKey = searchParams.get('fileKey')

    if (!fileKey) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      )
    }

    const token = await getFigmaToken()
    if (!token) {
      return NextResponse.json(
        { error: 'Figma access token not configured' },
        { status: 401 }
      )
    }

    // Get prototype connections
    const connections = await getPrototypeConnections(token, fileKey)
    
    // Get frames to map node IDs to names
    const frames = await getFrames(token, fileKey)
    const frameMap = new Map(frames.map(f => [f.id, f.name]))

    // Build flows from connections
    // A flow starts from a frame that has outgoing connections but no incoming ones,
    // or the first frame in the connection chain
    const flows: PrototypeFlow[] = []
    
    // Find all source nodes
    const sourceNodes = new Set(connections.map(c => c.sourceNodeId))
    const destNodes = new Set(connections.filter(c => c.destinationNodeId).map(c => c.destinationNodeId!))
    
    // Entry points are source nodes that aren't destinations
    const entryPoints = [...sourceNodes].filter(id => !destNodes.has(id))
    
    // If no clear entry points, use all sources
    const startNodes = entryPoints.length > 0 ? entryPoints : [...sourceNodes]

    for (const startId of startNodes) {
      const steps: FlowStep[] = []
      const visited = new Set<string>()
      let currentId: string | null = startId

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        const connection = connections.find(c => c.sourceNodeId === currentId)
        
        steps.push({
          nodeId: currentId,
          nodeName: frameMap.get(currentId) || connection?.sourceNodeName || currentId,
          nextNodeId: connection?.destinationNodeId || null,
        })

        currentId = connection?.destinationNodeId || null
      }

      if (steps.length > 0) {
        flows.push({
          name: `Flow from ${steps[0].nodeName}`,
          startNodeId: startId,
          steps,
        })
      }
    }

    return NextResponse.json({ connections, flows, frames })
  } catch (error) {
    console.error('Error fetching prototype:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch prototype'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


