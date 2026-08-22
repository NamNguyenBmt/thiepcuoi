import { NextResponse } from 'next/server';
import { currentUser, publicUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  return NextResponse.json({ user: publicUser(user) });
}
