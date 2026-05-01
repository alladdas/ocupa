import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  const { userId, email } = await request.json() as { userId: string; email: string }

  if (!userId || !email) {
    return NextResponse.json({ error: 'userId and email are required' }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!, quantity: 1 }],
    customer_email: email,
    metadata: { user_id: userId },
    success_url: 'https://ocupa.vercel.app/?upgraded=true',
    cancel_url: 'https://ocupa.vercel.app/pricing',
  })

  return NextResponse.json({ url: session.url })
}
