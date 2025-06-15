import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function generateToken(user: any) {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string };
  } catch (error) {
    return null;
  }
}

export async function setTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

export async function getTokenFromCookie() {
  const cookieStore = await cookies();
  return cookieStore.get('token')?.value;
}

export async function removeTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('token');
}

export function signToken(payload: any): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
} 