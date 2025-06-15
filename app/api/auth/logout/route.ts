import { NextResponse } from 'next/server';
import { removeTokenCookie } from '@/app/utils/jwt';

export async function POST() {
  try {
    await removeTokenCookie();
    return NextResponse.json({ message: 'Logged out successfully' }, { status: 200 });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
} 