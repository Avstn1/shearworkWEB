/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { openai } from '@/lib/openaiClient'

export async function POST(req: Request) {
  try {
    // const { user, supabase } = await getAuthenticatedUser(req)
    // if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const body = await req.json()
    const { prompt } = body

    const maxMessageLength = 240 - (
      (body.profile?.full_name?.length || 0) + 
      (body.profile?.email?.length || 0) + 
      (body.profile?.phone?.length || 0) + 
      (body.profile?.booking_link?.length || 0)
    )

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const systemPrompt = `You are an expert SMS marketing copywriter specializing in barbering. There is no barbershop - you're writing for an individual barber.

                          Your task is to generate professional, engaging SMS marketing messages for barbers.

                          Requirements:
                          1. Message length: LESS THAN ${maxMessageLength} characters (not words - characters!). THIS IS A STRICT REQUIREMENT
                          2. Use proper formatting with line breaks for readability
                          4. Allow friendly and funny tones. No need to keep it professional as we're building a relationship with clients.
                          6. Make it appropriate for SMS (no emojis)
                          7. Use proper spacing and line breaks (\n) for visual clarity but don't overdo it.
                          8. Allow personal emails and phone numbers.
                          `

    const userPrompt = `Generate an SMS marketing message for a barber based on this request: ${prompt}.
                        These are the profile details of the barber requesting the message:
                        Full Name: ${body.profile?.full_name || 'N/A'}
                        Email: ${body.profile?.email || 'N/A'}
                        Phone: ${body.profile?.phone || 'N/A'}
                        Booking Link: ${body.profile?.booking_link || 'N/A'}

                        Remember: ${maxMessageLength} characters total, and format with line breaks for readability. 
                        THE LIMIT IS ${maxMessageLength} CHARACTERS. DO NOT EXCEED THIS LIMIT.`

    // Call OpenAI to generate the template
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        { 
          role: 'user', 
          content: userPrompt 
        },
      ],
    })

    const generatedMessage = response.choices?.[0]?.message?.content?.trim() || ''

    if (!generatedMessage) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate message template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: generatedMessage,
    })

  } catch (err: any) {
    console.error('❌ SMS template generation error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}