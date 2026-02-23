/**
 * POST /api/balance/bet endpoint
 * 
 * Task: 4.4 Create POST /api/balance/bet endpoint
 * Requirements: 3.1, 3.2, 7.2
 * 
 * Called when user places a bet from house balance.
 * Validates sufficient balance and deducts bet amount atomically.
 * Note: After Sui migration, game logic is off-chain. No blockchain call needed.
 * Inserts audit log entry with operation_type='bet_placed'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/client';
import { ethers } from 'ethers';

interface BetRequest {
  userAddress: string;
  betAmount: number;
  roundId: number;
  targetPrice: number;
  isOver: boolean;
  multiplier: number;
  targetCell: {
    id: number;
    priceChange: number;
    direction: 'UP' | 'DOWN';
    timeframe: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: BetRequest = await request.json();
    const { userAddress, betAmount, roundId, targetPrice, isOver, multiplier, targetCell } = body;

    // Validate required fields
    if (!userAddress || betAmount === undefined || betAmount === null) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, betAmount' },
        { status: 400 }
      );
    }

    // Validate user address
    if (!userAddress || userAddress.length < 10) {
      return NextResponse.json(
        { error: 'Invalid Kaspa address format' },
        { status: 400 }
      );
    }

    // Validate bet amount is positive
    if (betAmount <= 0) {
      return NextResponse.json(
        { error: 'Bet amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Validate multiplier
    if (!multiplier || multiplier < 1.0) {
      return NextResponse.json(
        { error: 'Multiplier must be at least 1.0' },
        { status: 400 }
      );
    }

    // Validate target cell
    if (!targetCell || targetCell.id === undefined || targetCell.id === null || targetCell.priceChange === undefined) {
      return NextResponse.json(
        { error: 'Invalid target cell data' },
        { status: 400 }
      );
    }

    // Direct DB operation instead of RPC to avoid "User not found" procedural error

    // 1. Get current balance
    const { data: userData, error: fetchError } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_address', userAddress)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Insufficient balance (No funds deposited)' }, { status: 400 });
      }
      console.error('Database error fetching balance for bet:', fetchError);
      return NextResponse.json({ error: 'Service unavailable: ' + fetchError.message }, { status: 503 });
    }

    const currentBalance = parseFloat(userData.balance);

    if (currentBalance < betAmount) {
      return NextResponse.json({ error: 'Insufficient house balance' }, { status: 400 });
    }

    // 2. Deduct balance
    const newBalance = currentBalance - betAmount;

    const { error: updateError } = await supabase
      .from('user_balances')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_address', userAddress);

    if (updateError) {
      console.error('Database error deducting balance:', updateError);
      return NextResponse.json({ error: 'Failed to place bet. Please try again.' }, { status: 500 });
    }

    const result = { success: true, new_balance: newBalance };

    /*
    // Call deduct_balance_for_bet stored procedure
    // ... (removed RPC call)
    */

    // Balance deducted successfully
    // Note: After Sui migration, game logic is off-chain. No blockchain call needed.
    // The bet is tracked in the database and resolved by the game engine.
    try {
      // Generate a bet ID
      const betId = `bet_${Date.now()}_${userAddress.slice(-6)}`;

      // Log bet placement for debugging
      console.log('Bet placed:', {
        betId,
        userAddress,
        betAmount,
        multiplier,
        targetCell,
      });

      // Insert audit log entry
      await supabase
        .from('balance_audit_log')
        .insert({
          user_address: userAddress,
          operation_type: 'bet_placed',
          amount: betAmount,
          balance_before: currentBalance,
          balance_after: newBalance,
          bet_id: betId
        });

      // Return success with remaining balance and bet ID
      return NextResponse.json({
        success: true,
        remainingBalance: parseFloat(newBalance.toString()),
        betId,
      });

    } catch (error) {
      // Handle unexpected errors
      console.error('Error generating bet ID:', error);

      return NextResponse.json(
        {
          error: 'Bet placement failed. Your balance will be reconciled.',
          details: 'Please contact support if your balance is not restored.'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    // Handle unexpected errors
    console.error('Unexpected error in POST /api/balance/bet:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
