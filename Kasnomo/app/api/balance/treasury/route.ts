/**
 * GET /api/balance/treasury endpoint
 * Returns the current treasury wallet balance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTreasuryBalance } from '@/lib/kaspa/transaction';

export async function GET(request: NextRequest) {
  try {
    const balance = await getTreasuryBalance();
    
    return NextResponse.json({
      success: true,
      balance: balance,
      address: process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS
    });
  } catch (error: any) {
    console.error('[Treasury] Error fetching balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch treasury balance' },
      { status: 500 }
    );
  }
}
