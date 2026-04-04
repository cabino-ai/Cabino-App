import Stripe from 'stripe';

interface Env {
  ASSETS: Fetcher;
  STRIPE_SECRET_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/create-checkout-session' && request.method === 'POST') {
      return handleCreateCheckoutSession(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

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

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
