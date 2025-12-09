/**
 * Claude API Client for AI-powered video flow generation
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export interface FrameInfo {
  id: string;
  name: string;
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

/**
 * Generate a video flow plan using Claude AI
 */
export async function generateFlowWithAI(
  frames: FrameInfo[],
  userDescription: string
): Promise<GeneratedFlow> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  // Build the frame list for the prompt
  const frameList = frames
    .map((f, i) => `${i + 1}. "${f.name}" (id: ${f.id})`)
    .join('\n');

  const prompt = `You are helping create a video from Figma prototype frames. Your task is to interpret the user's description and create a flow plan.

Available frames in the Figma file:
${frameList}

User's description of how the video should play:
"${userDescription}"

Based on the description, create a JSON flow plan that specifies:
- Which frames to include and in what order
- How long each frame should be shown (duration in seconds)
- What transition to use before each frame

Rules:
- Only use frames from the available list above
- Use the exact frame IDs provided
- Duration should be between 0.5 and 10 seconds
- Transitions: "cut" (instant switch), "fade" (0.5s crossfade), "slow_fade" (1s crossfade)
- If the user mentions specific timing, use it. Otherwise, use reasonable defaults (2-3 seconds per frame)
- If the user mentions specific transitions, use them. Otherwise, default to "fade"
- Include all relevant frames based on the description
- If the description is vague, use the prototype's natural flow order

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "frames": [
    { "id": "frame_id_here", "name": "Frame Name", "duration": 2, "transition": "fade" }
  ]
}`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('No response from Claude');
    }

    // Parse the JSON response
    let flowPlan: { frames: FlowFrame[] };
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        flowPlan = JSON.parse(jsonMatch[0]);
      } else {
        flowPlan = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', content);
      throw new Error('Failed to parse AI response. Please try again.');
    }

    // Validate the response
    if (!flowPlan.frames || !Array.isArray(flowPlan.frames) || flowPlan.frames.length === 0) {
      throw new Error('AI generated an invalid flow plan');
    }

    // Validate each frame exists in the original list
    const validFrameIds = new Set(frames.map(f => f.id));
    const validatedFrames = flowPlan.frames.filter(f => validFrameIds.has(f.id));

    if (validatedFrames.length === 0) {
      // Fallback: use all frames in order with default settings
      return {
        frames: frames.map(f => ({
          id: f.id,
          name: f.name,
          duration: 2,
          transition: 'fade' as const,
        })),
        totalDuration: frames.length * 2,
      };
    }

    // Calculate total duration
    const totalDuration = validatedFrames.reduce((sum, f) => sum + f.duration, 0);

    return {
      frames: validatedFrames,
      totalDuration,
    };
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

/**
 * Generate a simple flow without AI (fallback)
 */
export function generateSimpleFlow(frames: FrameInfo[]): GeneratedFlow {
  const flowFrames: FlowFrame[] = frames.map(f => ({
    id: f.id,
    name: f.name,
    duration: 2,
    transition: 'fade',
  }));

  return {
    frames: flowFrames,
    totalDuration: frames.length * 2,
  };
}


