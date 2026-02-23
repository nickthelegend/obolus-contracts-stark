import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 });
    }

    // Query user_balances table by user_address
    const { data, error } = await supabase
      .from('user_balances')
      .select('balance, updated_at')
      .eq('user_address', address)
      .single();

    // Handle database errors
    if (error) {
      // If user not found (PGRST116), return 0 balance
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          balance: 0,
          updatedAt: null,
          tier: 'free'
        });
      }

      // Log other database errors
      console.error(`Database error fetching balance for ${address}:`, error);
      return NextResponse.json(
        { error: 'Service temporarily unavailable: ' + error.message },
        { status: 503 }
      );
    }

    // Return balance and updated_at timestamp
    return NextResponse.json({
      balance: parseFloat(data.balance),
      updatedAt: data.updated_at,
      tier: 'free'
    });
  } catch (error: any) {
    // Handle unexpected errors
    console.error('Unexpected error in GET /api/balance/[address]:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
