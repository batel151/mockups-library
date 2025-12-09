/**
 * Simple Flow Generator - No External AI Required
 * Generates video flow based on Figma prototype connections
 */

export interface FrameInfo {
  id: string;
  name: string;
}

export interface PrototypeConnection {
  sourceNodeId: string;
  sourceNodeName: string;
  destinationNodeId: string | null;
  trigger: string;
}

export interface FlowFrame {
  id: string;
  name: string;
  duration: number; // seconds
  transition: 'cut' | 'fade' | 'slow_fade';
}

export interface GeneratedFlow {
  frames: FlowFrame[];
  totalDuration: number;
}

export interface FlowSettings {
  duration: number; // seconds per frame
  transition: 'cut' | 'fade' | 'slow_fade';
}

/**
 * Generate a video flow from Figma prototype connections
 * Orders frames based on prototype flow, applies user settings
 */
export function generateFlowFromPrototype(
  frames: FrameInfo[],
  connections: PrototypeConnection[],
  settings: FlowSettings
): GeneratedFlow {
  const { duration, transition } = settings;
  
  // If no connections, just use all frames in order
  if (connections.length === 0) {
    return {
      frames: frames.map(f => ({
        id: f.id,
        name: f.name,
        duration,
        transition,
      })),
      totalDuration: frames.length * duration,
    };
  }

  // Build the flow sequence from prototype connections
  const orderedFrames: FlowFrame[] = [];
  const visitedIds = new Set<string>();
  const frameMap = new Map(frames.map(f => [f.id, f]));

  // Find entry points (frames that have outgoing connections but no incoming)
  const sourceIds = new Set(connections.map(c => c.sourceNodeId));
  const destIds = new Set(connections.filter(c => c.destinationNodeId).map(c => c.destinationNodeId!));
  const entryPoints = [...sourceIds].filter(id => !destIds.has(id));

  // If no clear entry point, use the first source
  const startId = entryPoints[0] || connections[0]?.sourceNodeId;

  if (startId) {
    // Follow the prototype flow
    let currentId: string | null = startId;

    while (currentId && !visitedIds.has(currentId)) {
      visitedIds.add(currentId);
      
      const frame = frameMap.get(currentId);
      if (frame) {
        orderedFrames.push({
          id: frame.id,
          name: frame.name,
          duration,
          transition,
        });
      }

      // Find next frame in the flow
      const connection = connections.find(c => c.sourceNodeId === currentId);
      currentId = connection?.destinationNodeId || null;
    }
  }

  // If we didn't find any frames through connections, use all frames
  if (orderedFrames.length === 0) {
    return {
      frames: frames.map(f => ({
        id: f.id,
        name: f.name,
        duration,
        transition,
      })),
      totalDuration: frames.length * duration,
    };
  }

  return {
    frames: orderedFrames,
    totalDuration: orderedFrames.length * duration,
  };
}

/**
 * Generate a simple flow using all frames in order
 */
export function generateSimpleFlow(
  frames: FrameInfo[],
  settings: FlowSettings
): GeneratedFlow {
  const { duration, transition } = settings;
  
  return {
    frames: frames.map(f => ({
      id: f.id,
      name: f.name,
      duration,
      transition,
    })),
    totalDuration: frames.length * duration,
  };
}


