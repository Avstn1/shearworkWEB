/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

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

    console.log('Invoking login_summary edge function with body:', body);

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

    const { data, error } = await supabase.functions.invoke('login_summary', {
      body: bodyPayload
    });

    if (error) {
      console.error('Edge function invocation error:', error);
      let errorMessage = error.message || 'Failed to invoke login_summary';
      
      if (error.context) {
        try {
          const errorText = await error.context.text();
          console.error('Edge function error details:', errorText);
          errorMessage = errorText || errorMessage;
        } catch (e) {
          console.error('Could not read error context:', e);
        }
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Login summary generated successfully'
    });

  } catch (err: any) {
    console.error('Login summary API error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
