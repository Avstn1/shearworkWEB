import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId');

  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    
    if (!qstashToken) {
      return NextResponse.json(
        { error: 'QStash token not configured' },
        { status: 500 }
      );
    }

    let url = 'https://qstash.upstash.io/v2/schedules';
    
    // If scheduleId provided, get specific schedule details
    if (scheduleId) {
      url = `${url}/${scheduleId}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${qstashToken}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to fetch schedules', details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      schedules: data
    });

  } catch (error) {
    console.error('Error fetching QStash schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE a specific schedule
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId');

  if (!scheduleId) {
    return NextResponse.json(
      { error: 'scheduleId is required' },
      { status: 400 }
    );
  }

  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    
    if (!qstashToken) {
      return NextResponse.json(
        { error: 'QStash token not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://qstash.upstash.io/v2/schedules/${scheduleId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${qstashToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: 'Failed to delete schedule', details: error },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting QStash schedule:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}