import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'OTP verification endpoint' }, { status: 200 });
}