import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { imageUrlToBase64 } from "./imageUtils";

export interface CabinetSpecs {
  type: 'base' | 'upper' | 'tall';
  style: string;
  material: string;
  color: string;
  hardware: string;
  location: string;
  width: string;
  height: string;
  depth: string;
  enabled?: boolean;
}

export interface RoomMeasurements {
  length: string;
  width: string;
  height: string;
  unit: 'ft' | 'm';
}

export const DEFAULT_MASTER_PROMPT = "Analyze the provided room photo and the cabinet reference photos. Create a highly detailed, photorealistic image-to-image editing prompt that instructs an AI to replace the existing cabinets in the room with the ones shown in the reference photos. The prompt should specify details about lighting, shadows, scale, material texture, and placement to ensure a seamless integration. At the end of the prompt, include these instructions: Keep the fridge, stove, freezer, and kitchen sink in their exact original spots and maintain their original design. Strictly maintain the original height and layout of the upper cabinets; do not extend them to the ceiling even if the reference photo shows ceiling-height cabinets. Maintain the exact floor rug pattern, floor planks, wall outlets, window details, and ceiling surfaces without alteration. Strictly maintain the exact count and position of all items currently present on the countertops. Additionally, if the upper cabinets do not extend to the ceiling, you must also preserve any items currently resting on top of them. Do strictly not introduce any new bags, clutter, wall decor, floor items, ceiling fixtures, or loose items to any surface. Only if there is existing pendant lighting in the original photo, update its style to match the new aesthetic; do not add new hanging lights if none exist, and do not alter or replace the hood fan, ventilation, or any functional appliances. Change the wall paint and kitchen backsplash tiles to reflect the aesthetic.";

export const DEFAULT_EXTEND_PROMPT = `Analyze the provided room photo and the cabinet reference photos. Create a highly detailed, photorealistic image-to-image editing prompt that instructs an AI to replace the existing cabinets in the room with the ones shown in the reference photos. The prompt should specify details about lighting, shadows, scale, material texture, and placement to ensure a seamless integration. At the end of the prompt, include these instructions: Keep the fridge, stove, freezer, and kitchen sink in their exact original spots and maintain their original design.

Strictly clear any objects from the empty space directly above the cabinetry. All upper cabinetry must now be extended upward to the full height of the ceiling. Use a minimalist, ultra-thin flat scribe filler to transition the cabinet doors to the ceiling surface, ensuring cabinet doors must meet the ceiling surface flush, eliminating any bulkheads, empty space, or shadowy gaps.

Maintain the exact floor rug pattern, floor planks, wall outlets, window details, and ceiling surfaces without alteration. Strictly maintain the exact count and position of all items currently present on the countertops. Do strictly not introduce any new bags, clutter, wall decor, floor items, ceiling fixtures, or loose items to any surface. Only if there is existing pendant lighting in the original photo, update its style to match the new aesthetic; do not add new hanging lights if none exist, and do not alter or replace the hood fan, ventilation, or any functional appliances. Change the wall paint and kitchen backsplash tiles to reflect the aesthetic.`;

export const DEFAULT_STAGE_PROMPT = " AMENDMENT - OVERRIDE SURFACE & DESIGN RULES: Disregard the previous instructions to maintain the exact count of items on countertops and the original design of the appliances. Strictly remove all small clutter, loose papers, and generic household items from all surfaces (including the window sill and top surfaces of cabinetry) so they are spotless and polished. In their place, professionally stage the kitchen: add a designer wood cutting board leaning against the backsplash, a bowl of fresh organic fruit, and a high-end espresso machine. Maintain the exact footprint of the stove, hood, fridge, and sink, but replace the physical units with high-end, professional-grade stainless steel versions. Apply 'golden hour' lighting to create a warm, inviting glow.";

export const generateReplacementPrompt = async (
  roomImage: string,
  cabinetImages: string[],
  extendToCeiling: boolean = false,
  stageRoom: boolean = false,
  customPrompts?: {
    master?: string;
    extend?: string;
    stage?: string;
  },
  userId?: string
): Promise<string> => {
  // Convert URLs to base64 client-side (always)
  const roomBase64 = await imageUrlToBase64(roomImage);
  const cabinetBase64s = await Promise.all(cabinetImages.map(img => imageUrlToBase64(img)));

  if (import.meta.env.DEV) {
    return generateReplacementPromptDirect(roomBase64, cabinetBase64s, extendToCeiling, stageRoom, customPrompts);
  }

  const response = await fetch('/api/generate-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roomImage: roomBase64, cabinetImages: cabinetBase64s, extendToCeiling, stageRoom, customPrompts }),
  });
  const data = await response.json() as { prompt?: string; error?: string };
  if (!response.ok) throw new Error(data.error || 'Failed to generate prompt');
  return data.prompt || 'Failed to generate prompt.';
};

export const generateDesignImage = async (
  roomImage: string,
  cabinetImages: string[],
  prompt: string,
  userId?: string
): Promise<string | null> => {
  // Convert URLs to base64 client-side (always)
  const roomBase64 = await imageUrlToBase64(roomImage);
  const cabinetBase64s = await Promise.all(cabinetImages.map(img => imageUrlToBase64(img)));

  if (import.meta.env.DEV) {
    return generateDesignImageDirect(roomBase64, cabinetBase64s, prompt);
  }

  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, roomImage: roomBase64, cabinetImages: cabinetBase64s, prompt }),
  });
  const data = await response.json() as { image?: string | null; error?: string };
  if (!response.ok) throw new Error(data.error || 'Failed to generate image');
  return data.image ?? null;
};

// ---- Direct Gemini calls (dev only) ----

function getAI() {
  return new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
}

function toImagePart(base64: string) {
  return {
    inlineData: {
      mimeType: "image/jpeg" as const,
      data: base64.includes(',') ? base64.split(',')[1] : base64,
    },
  };
}

async function generateReplacementPromptDirect(
  roomBase64: string,
  cabinetBase64s: string[],
  extendToCeiling: boolean,
  stageRoom: boolean,
  customPrompts?: { master?: string; extend?: string; stage?: string }
): Promise<string> {
  const ai = getAI();

  const masterPrompt = customPrompts?.master || DEFAULT_MASTER_PROMPT;
  const extendReplacement = customPrompts?.extend || DEFAULT_EXTEND_PROMPT;
  const stageAmendment = customPrompts?.stage || DEFAULT_STAGE_PROMPT;

  let basePrompt = extendToCeiling ? extendReplacement : masterPrompt;
  if (stageRoom) basePrompt += stageAmendment;
  basePrompt += " Otherwise, keep everything else exactly the same. Do not add anything else. Return ONLY the final prompt text, no preamble or explanation.";

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: {
      parts: [
        toImagePart(roomBase64),
        ...cabinetBase64s.map(toImagePart),
        { text: basePrompt },
      ],
    },
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  return response.text || "Failed to generate prompt.";
}

async function generateDesignImageDirect(
  roomBase64: string,
  cabinetBase64s: string[],
  prompt: string
): Promise<string | null> {
  const ai = getAI();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        toImagePart(roomBase64),
        ...cabinetBase64s.map(toImagePart),
        {
          text: `Based on the provided room image and cabinet references, generate a high-quality, photorealistic visualization of the room with the new cabinets installed. Use this specific prompt as guidance: ${prompt}`,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }

  return null;
}
