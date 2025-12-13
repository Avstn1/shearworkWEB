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
    const { prompt } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const systemPrompt = `You are an expert SMS marketing copywriter specializing in barbershop and salon businesses.

                          Your task is to generate professional, engaging SMS marketing messages for barbers.

                          Requirements:
                          1. Message length: EXACTLY 180-220 characters (not words - characters!)
                          2. Use proper formatting with line breaks for readability
                          3. Include relevant placeholders in square brackets like:
                            - [barber_name] - The barber's name
                            - [shop_name] - The barbershop name
                            - [phone_number] - Contact phone number
                            - [website] - Website URL
                            - [discount] - Discount percentage or amount
                            - [service] - Specific service name
                          4. Keep the tone professional yet friendly
                          5. Include a clear call-to-action
                          6. Make it appropriate for SMS (no emojis unless specifically requested)
                          7. Use proper spacing and line breaks (\n) for visual clarity but don't overdo it.
                          `

    const userPrompt = `Generate an SMS marketing message for a barber based on this request: ${prompt}
                        Remember: 180-220 characters total, include relevant placeholders in [square brackets], and format with line breaks for readability. 
                        THE LIMIT IS 220 CHARACTERS. DO NOT EXCEED THIS LIMIT.`

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