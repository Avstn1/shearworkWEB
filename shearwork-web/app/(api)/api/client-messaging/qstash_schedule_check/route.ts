import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId');
  const messageId = searchParams.get('messageId');
  const type = searchParams.get('type'); // Optional: if provided, only fetch that type

  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    
    if (!qstashToken) {
      return NextResponse.json(
        { error: 'QStash token not configured' },
        { status: 500 }
      );
    }

    // If specific ID requested, fetch that one thing
    if (scheduleId) {
      const response = await fetch(`https://qstash.upstash.io/v2/schedules/${scheduleId}`, {
        headers: { 'Authorization': `Bearer ${qstashToken}` }
      });
      const data = await response.json();
      return NextResponse.json({ success: true, schedules: data });
    }

    if (messageId) {
      const response = await fetch(`https://qstash.upstash.io/v2/messages/${messageId}`, {
        headers: { 'Authorization': `Bearer ${qstashToken}` }
      });
      const data = await response.json();
      return NextResponse.json({ success: true, messages: data });
    }

    // Fetch all types
    const endpoints = [
      { key: 'schedules', url: 'https://qstash.upstash.io/v2/schedules' },
      { key: 'events', url: 'https://qstash.upstash.io/v2/events' },
      { key: 'dlq', url: 'https://qstash.upstash.io/v2/dlq' },
    ];

    const results: any = {};

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: { 'Authorization': `Bearer ${qstashToken}` }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Handle nested structures
          if (endpoint.key === 'events' && data.events) {
            results[endpoint.key] = data.events;
          } else if (endpoint.key === 'dlq' && data.messages) {
            results[endpoint.key] = data.messages;
          } else {
            results[endpoint.key] = data;
          }
          
          console.log(`QStash ${endpoint.key}:`, {
            status: response.status,
            count: Array.isArray(results[endpoint.key]) ? results[endpoint.key].length : 'N/A',
          });
        } else {
          results[endpoint.key] = [];
          console.log(`QStash ${endpoint.key} failed:`, response.status);
        }
      } catch (err) {
        results[endpoint.key] = [];
        console.error(`Error fetching ${endpoint.key}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('Error fetching QStash data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE a specific schedule or message
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get('scheduleId');
  const messageId = searchParams.get('messageId');
  const type = searchParams.get('type') || 'schedules'; // 'schedules' or 'messages'

  if (!scheduleId && !messageId) {
    return NextResponse.json(
      { error: 'scheduleId or messageId is required' },
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

    const id = scheduleId || messageId;
    const endpoint = type === 'messages' ? 'messages' : 'schedules';
    
    const response = await fetch(
      `https://qstash.upstash.io/v2/${endpoint}/${id}`,
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
        { error: `Failed to delete ${type}`, details: error },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type} deleted successfully`
    });

  } catch (error) {
    console.error(`Error deleting QStash ${type}:`, error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}