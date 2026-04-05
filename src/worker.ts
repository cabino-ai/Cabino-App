import Stripe from 'stripe';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

interface Env {
  ASSETS: Fetcher;
  STRIPE_SECRET_KEY: string;
  GEMINI_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST') {
      if (url.pathname === '/api/create-checkout-session') {
        return handleCreateCheckoutSession(request, env);
      }
      if (url.pathname === '/api/generate-prompt') {
        return handleGeneratePrompt(request, env);
      }
      if (url.pathname === '/api/generate-image') {
        return handleGenerateImage(request, env);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

// ---- Stripe ----

async function handleCreateCheckoutSession(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'STRIPE_SECRET_KEY is not set' }, 500);
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const body = await request.json() as { priceId: string; userId: string; successUrl: string; cancelUrl: string };
    const { priceId, userId, successUrl, cancelUrl } = body;

    if (!priceId || !userId) {
      return json({ error: 'Missing priceId or userId' }, 400);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: { userId },
    });

    return json({ url: session.url }, 200);
  } catch (error: any) {
    console.error('Stripe error:', error);
    return json({ error: error.message }, 500);
  }
}

// ---- Gemini ----

function getAI(env: Env) {
  return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

async function handleGeneratePrompt(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY is not set' }, 500);

  try {
    const { roomImage, cabinetImages, extendToCeiling, stageRoom, customPrompts } =
      await request.json() as {
        roomImage: string;
        cabinetImages: string[];
        extendToCeiling: boolean;
        stageRoom: boolean;
        customPrompts?: { master?: string; extend?: string; stage?: string };
      };

    const ai = getAI(env);

    const { DEFAULT_MASTER_PROMPT, DEFAULT_EXTEND_PROMPT, DEFAULT_STAGE_PROMPT } = getDefaultPrompts();

    const masterPrompt = customPrompts?.master || DEFAULT_MASTER_PROMPT;
    const extendReplacement = customPrompts?.extend || DEFAULT_EXTEND_PROMPT;
    const stageAmendment = customPrompts?.stage || DEFAULT_STAGE_PROMPT;

    let basePrompt = extendToCeiling ? extendReplacement : masterPrompt;
    if (stageRoom) basePrompt += stageAmendment;
    basePrompt += ' Otherwise, keep everything else exactly the same. Do not add anything else. Return ONLY the final prompt text, no preamble or explanation.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          toImagePart(roomImage),
          ...cabinetImages.map(toImagePart),
          { text: basePrompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      },
    });

    return json({ prompt: response.text || 'Failed to generate prompt.' }, 200);
  } catch (error: any) {
    console.error('Gemini generate-prompt error:', error);
    return json({ error: error.message }, 500);
  }
}

async function handleGenerateImage(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY is not set' }, 500);

  try {
    const { roomImage, cabinetImages, prompt } =
      await request.json() as {
        roomImage: string;
        cabinetImages: string[];
        prompt: string;
      };

    const ai = getAI(env);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          toImagePart(roomImage),
          ...cabinetImages.map(toImagePart),
          {
            text: `Based on the provided room image and cabinet references, generate a high-quality, photorealistic visualization of the room with the new cabinets installed. Use this specific prompt as guidance: ${prompt}`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return json({ image: `data:image/png;base64,${part.inlineData.data}` }, 200);
      }
    }

    return json({ image: null }, 200);
  } catch (error: any) {
    console.error('Gemini generate-image error:', error);
    return json({ error: error.message }, 500);
  }
}

// Strips the "data:image/jpeg;base64," prefix and returns an inline image part
function toImagePart(base64: string) {
  return {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64.includes(',') ? base64.split(',')[1] : base64,
    },
  };
}

function getDefaultPrompts() {
  return {
    DEFAULT_MASTER_PROMPT: "Analyze the provided room photo and the cabinet reference photos. Create a highly detailed, photorealistic image-to-image editing prompt that instructs an AI to replace the existing cabinets in the room with the ones shown in the reference photos. The prompt should specify details about lighting, shadows, scale, material texture, and placement to ensure a seamless integration. At the end of the prompt, include these instructions: Keep the fridge, stove, freezer, and kitchen sink in their exact original spots and maintain their original design. Strictly maintain the original height and layout of the upper cabinets; do not extend them to the ceiling even if the reference photo shows ceiling-height cabinets. Maintain the exact floor rug pattern, floor planks, wall outlets, window details, and ceiling surfaces without alteration. Strictly maintain the exact count and position of all items currently present on the countertops. Additionally, if the upper cabinets do not extend to the ceiling, you must also preserve any items currently resting on top of them. Do strictly not introduce any new bags, clutter, wall decor, floor items, ceiling fixtures, or loose items to any surface. Only if there is existing pendant lighting in the original photo, update its style to match the new aesthetic; do not add new hanging lights if none exist, and do not alter or replace the hood fan, ventilation, or any functional appliances. Change the wall paint and kitchen backsplash tiles to reflect the aesthetic.",
    DEFAULT_EXTEND_PROMPT: `Analyze the provided room photo and the cabinet reference photos. Create a highly detailed, photorealistic image-to-image editing prompt that instructs an AI to replace the existing cabinets in the room with the ones shown in the reference photos. The prompt should specify details about lighting, shadows, scale, material texture, and placement to ensure a seamless integration. At the end of the prompt, include these instructions: Keep the fridge, stove, freezer, and kitchen sink in their exact original spots and maintain their original design.\n\nStrictly clear any objects from the empty space directly above the cabinetry. All upper cabinetry must now be extended upward to the full height of the ceiling. Use a minimalist, ultra-thin flat scribe filler to transition the cabinet doors to the ceiling surface, ensuring cabinet doors must meet the ceiling surface flush, eliminating any bulkheads, empty space, or shadowy gaps.\n\nMaintain the exact floor rug pattern, floor planks, wall outlets, window details, and ceiling surfaces without alteration. Strictly maintain the exact count and position of all items currently present on the countertops. Do strictly not introduce any new bags, clutter, wall decor, floor items, ceiling fixtures, or loose items to any surface. Only if there is existing pendant lighting in the original photo, update its style to match the new aesthetic; do not add new hanging lights if none exist, and do not alter or replace the hood fan, ventilation, or any functional appliances. Change the wall paint and kitchen backsplash tiles to reflect the aesthetic.`,
    DEFAULT_STAGE_PROMPT: " AMENDMENT - OVERRIDE SURFACE & DESIGN RULES: Disregard the previous instructions to maintain the exact count of items on countertops and the original design of the appliances. Strictly remove all small clutter, loose papers, and generic household items from all surfaces (including the window sill and top surfaces of cabinetry) so they are spotless and polished. In their place, professionally stage the kitchen: add a designer wood cutting board leaning against the backsplash, a bowl of fresh organic fruit, and a high-end espresso machine. Maintain the exact footprint of the stove, hood, fridge, and sink, but replace the physical units with high-end, professional-grade stainless steel versions. Apply 'golden hour' lighting to create a warm, inviting glow.",
  };
}

// ---- Helpers ----

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
