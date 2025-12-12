/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { openai } from '@/lib/openaiClient'

export async function POST(req: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(req)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const body = await req.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Validate minimum message length
    if (message.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Message must be at least 100 characters' },
        { status: 400 }
      )
    }

    // Validate message length (SMS limit is 240 characters)
    if (message.length > 240) {
      return NextResponse.json(
        { success: false, error: 'Message exceeds 240 character SMS limit' },
        { status: 400 }
      )
    }

    const promptTemplate = `Your goal is to verify whether this message is appropriate as a barber's marketing message. Make sure that it is not harmful or out of scope. This message will be sent as an SMS.

Your response format:
- If ACCEPTED: Reply with "ACCEPTED | Your message has been verified and accepted"
- If DENIED: Reply with "DENIED | [concise and specific reason for denial]"

Be specific but very concise about why a message is denied (e.g., inappropriate tone, off-topic, unprofessional language, harmful content, etc.)

Message: ${message}`

    // Call OpenAI to validate the message
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a content moderator for barbershop marketing messages. Evaluate whether the message is appropriate, professional, and safe for SMS marketing to clients. Provide specific reasons for denial.',
        },
        { role: 'user', content: promptTemplate },
      ],
    })

    const aiResponse = response.choices?.[0]?.message?.content?.trim() || ''

    // Parse the AI response
    // Expected format: "ACCEPTED | Your message has been verified and accepted" or "DENIED | Reason here"
    const parts = aiResponse.split('|').map(p => p.trim())
    const status = parts[0]?.toUpperCase() || 'DENIED'
    const reason = parts[1] || 'No reason provided'

    const isApproved = status === 'ACCEPTED'

    return NextResponse.json({
      success: true,
      approved: isApproved,
      status,
      reason,
      message: aiResponse,
    })

  } catch (err: any) {
    console.error('❌ Message validation error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}