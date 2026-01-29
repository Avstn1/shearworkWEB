/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';

interface RequestBody {
  targetDate?: string; 
  startDate?: string;
  endDate?: string;
  summaryType?: string;
  isoWeek?: string;
  isoWeekStart?: string;
  isoWeekEnd?: string;
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await req.json();
    const summaryType = body.summaryType || "hourly";

    console.log('📤 Invoking finance_summary edge function with body:', JSON.stringify(body, null, 2));

    // Build payload for edge function
    const bodyPayload: any = { summaryType };

    if (body.targetDate) bodyPayload.targetDate = body.targetDate;
    if (body.startDate && body.endDate) {
      bodyPayload.startDate = body.startDate;
      bodyPayload.endDate = body.endDate;
    }
    if (body.isoWeek) bodyPayload.isoWeek = body.isoWeek;
    if (body.isoWeekStart && body.isoWeekEnd) {
      bodyPayload.isoWeekStart = body.isoWeekStart;
      bodyPayload.isoWeekEnd = body.isoWeekEnd;
    }

    const { data, error } = await supabase.functions.invoke('finance_summary', {
      body: bodyPayload
    });

    if (error) {
      console.error('❌ Edge function invocation error:', error);
      
      // Handle different error types
      if (error instanceof FunctionsHttpError) {
        // Function returned an error (4xx/5xx status)
        try {
          const errorMessage = await error.context.json();
          console.error('📋 Function error details:', errorMessage);
          return NextResponse.json(
            { success: false, error: errorMessage.error || 'Function execution failed', details: errorMessage },
            { status: error.context.status || 500 }
          );
        } catch (jsonError) {
          const errorText = await error.context.text();
          console.error('📋 Function error text:', errorText);
          return NextResponse.json(
            { success: false, error: errorText || error.message },
            { status: error.context.status || 500 }
          );
        }
      } else if (error instanceof FunctionsRelayError) {
        // Network issue between client and Supabase
        console.error('🌐 Relay error:', error.message);
        return NextResponse.json(
          { success: false, error: `Network error: ${error.message}` },
          { status: 503 }
        );
      } else if (error instanceof FunctionsFetchError) {
        // Function couldn't be reached
        console.error('🔌 Fetch error:', error.message);
        return NextResponse.json(
          { success: false, error: `Function unreachable: ${error.message}` },
          { status: 503 }
        );
      } else {
        // Generic error
        return NextResponse.json(
          { success: false, error: error.message || 'Failed to invoke finance_summary' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Finance summary generated successfully'
    });

  } catch (err: any) {
    console.error('💥 Finance summary API error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}