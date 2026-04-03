import Stripe from 'stripe';

export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY is not set in Cloudflare Pages environment variables." }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Initialize Stripe with the Fetch client, which is required for Cloudflare Workers/Pages
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const body = await request.json();
    const { priceId, userId, successUrl, cancelUrl } = body;

    if (!priceId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing priceId or userId' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: { userId: userId }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Stripe error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
