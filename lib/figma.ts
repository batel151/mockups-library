/**
 * Figma API Client for the Mockups Library App
 * OPTIMIZED: Single API call to get all file data
 */

const FIGMA_API_BASE = 'https://api.figma.com/v1';

// Simple in-memory cache to avoid repeated API calls
const fileCache = new Map<string, { data: FigmaFileData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface FigmaPage {
  id: string;
  name: string;
}

export interface FigmaFrame {
  id: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface FigmaFileDetails {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  pages: FigmaPage[];
}

export interface PrototypeConnection {
  sourceNodeId: string;
  sourceNodeName: string;
  destinationNodeId: string | null;
  trigger: string;
}

export interface FigmaExportResult {
  nodeId: string;
  imageUrl: string;
}

// Combined file data from a single API call
export interface FigmaFileData {
  details: FigmaFileDetails;
  frames: FigmaFrame[];
  connections: PrototypeConnection[];
}

class FigmaApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'FigmaApiError';
    this.status = status;
  }
}

export async function getFigmaToken(): Promise<string | null> {
  return process.env.FIGMA_ACCESS_TOKEN || null;
}

async function figmaFetch<T>(endpoint: string, token: string): Promise<T> {
  const response = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new FigmaApiError(`Figma API error: ${error}`, response.status);
  }

  return response.json();
}

/**
 * Get ALL file data in a SINGLE API call
 * This replaces getFileDetails, getFrames, and getPrototypeConnections
 */
export async function getFileData(
  token: string,
  fileKey: string,
  useCache: boolean = true
): Promise<FigmaFileData> {
  // Check cache first
  if (useCache) {
    const cached = fileCache.get(fileKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[figma] Using cached file data');
      return cached.data;
    }
  }

  console.log('[figma] Fetching file data (single API call)...');

  interface FigmaNode {
    id: string;
    name: string;
    type: string;
    absoluteBoundingBox?: {
      width: number;
      height: number;
    };
    transitionNodeID?: string;
    reactions?: Array<{
      trigger: { type: string };
      action: { type: string; destinationId?: string };
    }>;
    children?: FigmaNode[];
  }

  interface FigmaApiResponse {
    name: string;
    lastModified: string;
    thumbnailUrl: string;
    document: {
      children: FigmaNode[];
    };
  }

  // Single API call with depth=2 to get pages and their direct children (frames)
  const data = await figmaFetch<FigmaApiResponse>(`/files/${fileKey}?depth=2`, token);

  // Extract file details
  const details: FigmaFileDetails = {
    name: data.name,
    lastModified: data.lastModified,
    thumbnailUrl: data.thumbnailUrl,
    pages: data.document.children
      .filter((child) => child.type === 'CANVAS')
      .map((page) => ({
        id: page.id,
        name: page.name,
      })),
  };

  // Extract frames (direct children of pages)
  const frames: FigmaFrame[] = [];
  const connections: PrototypeConnection[] = [];

  const extractFramesAndConnections = (node: FigmaNode, depth: number) => {
    // Get top-level frames (direct children of pages, depth=1)
    if (node.type === 'FRAME' && depth === 1) {
      frames.push({
        id: node.id,
        name: node.name,
        type: node.type,
        width: node.absoluteBoundingBox?.width,
        height: node.absoluteBoundingBox?.height,
      });
    }

    // Extract prototype connections
    if (node.reactions) {
      for (const reaction of node.reactions) {
        if (reaction.action?.destinationId) {
          connections.push({
            sourceNodeId: node.id,
            sourceNodeName: node.name,
            destinationNodeId: reaction.action.destinationId,
            trigger: reaction.trigger?.type || 'ON_CLICK',
          });
        }
      }
    }

    // Legacy transition support
    if (node.transitionNodeID) {
      connections.push({
        sourceNodeId: node.id,
        sourceNodeName: node.name,
        destinationNodeId: node.transitionNodeID,
        trigger: 'ON_CLICK',
      });
    }

    if (node.children) {
      for (const child of node.children) {
        extractFramesAndConnections(child, depth + 1);
      }
    }
  };

  for (const page of data.document.children) {
    extractFramesAndConnections(page, 0);
  }

  const fileData: FigmaFileData = { details, frames, connections };

  // Cache the result
  fileCache.set(fileKey, { data: fileData, timestamp: Date.now() });

  console.log(`[figma] Got ${frames.length} frames, ${connections.length} connections`);
  return fileData;
}

/**
 * Get file details (uses cached data from getFileData)
 */
export async function getFileDetails(token: string, fileKey: string): Promise<FigmaFileDetails> {
  const fileData = await getFileData(token, fileKey);
  return fileData.details;
}

/**
 * Get all frames from a file (uses cached data from getFileData)
 */
export async function getFrames(
  token: string,
  fileKey: string,
  pageId?: string
): Promise<FigmaFrame[]> {
  const fileData = await getFileData(token, fileKey);
  
  if (pageId) {
    // Filter frames by page - for now return all frames
    // In a full implementation, we'd track which page each frame belongs to
    return fileData.frames;
  }
  
  return fileData.frames;
}

/**
 * Get prototype connections (uses cached data from getFileData)
 */
export async function getPrototypeConnections(
  token: string,
  fileKey: string
): Promise<PrototypeConnection[]> {
  const fileData = await getFileData(token, fileKey);
  return fileData.connections;
}

/**
 * Export frames as images - this is a separate API endpoint
 * Optimized to batch multiple frames in one call
 */
export async function exportFrames(
  token: string,
  fileKey: string,
  nodeIds: string[],
  format: 'png' | 'jpg' | 'svg' = 'png',
  scale: number = 1
): Promise<FigmaExportResult[]> {
  if (nodeIds.length === 0) return [];
  
  const ids = nodeIds.join(',');
  const data = await figmaFetch<{ images: Record<string, string> }>(
    `/images/${fileKey}?ids=${ids}&format=${format}&scale=${scale}`,
    token
  );

  return Object.entries(data.images).map(([nodeId, imageUrl]) => ({
    nodeId,
    imageUrl,
  }));
}

/**
 * Get thumbnails for frames
 */
export async function getFrameThumbnails(
  token: string,
  fileKey: string,
  nodeIds: string[]
): Promise<FigmaExportResult[]> {
  return exportFrames(token, fileKey, nodeIds, 'png', 0.5);
}

/**
 * Download an image from a URL and return as buffer
 */
export async function downloadImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parse Figma file key from URL
 */
export function parseFileKeyFromUrl(url: string): string | null {
  const match = url.match(/figma\.com\/(file|design|proto|board)\/([a-zA-Z0-9]+)/);
  return match ? match[2] : null;
}

/**
 * Clear the file cache
 */
export function clearFileCache(fileKey?: string) {
  if (fileKey) {
    fileCache.delete(fileKey);
  } else {
    fileCache.clear();
  }
}
