import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/client';
import { ethers } from 'ethers';
import { sendKaspaTransaction } from '@/lib/kaspa/transaction';

interface WithdrawRequest {
  userAddress: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: WithdrawRequest = await request.json();
    const { userAddress, amount } = body;

    // Validate required fields
    if (!userAddress || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, amount' },
        { status: 400 }
      );
    }

    // Validate address (strictly Kaspa and EVM)
    const isKAS = userAddress.startsWith('kaspa:') || userAddress.startsWith('kaspatest:');
    const isEVM = ethers.isAddress(userAddress);

    if (!isKAS && !isEVM) {
      return NextResponse.json(
        { error: 'Invalid wallet address format (Kaspa or EVM required)' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Withdrawal amount must be greater than zero' },
        { status: 400 }
      );
    }

    // 1. Get house balance from Supabase and validate
    const { data: userData, error: userError } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_address', userAddress)
      .single();

    if (userError || !userData) {
      console.error('User not found in withdrawal:', userError);
      return NextResponse.json({ error: 'User balance record not found' }, { status: 404 });
    }

    const currentBalance = parseFloat(userData.balance);
    if (currentBalance < amount) {
      return NextResponse.json({ error: 'Insufficient house balance' }, { status: 400 });
    }

    // 2. Apply 2% Treasury Fee
    const feePercent = 0.02;
    const feeAmount = amount * feePercent;
    const netWithdrawAmount = amount - feeAmount;

    console.log(`[Withdraw] Request: Total=${amount} KAS, Fee=${feeAmount} KAS, Net=${netWithdrawAmount} KAS`);

    // 3. Send the actual on-chain transaction
    let txHash: string;

    if (isKAS) {
      console.log(`[Withdraw] Sending ${netWithdrawAmount} KAS to ${userAddress} via REST API...`);

      const txResult = await sendKaspaTransaction(userAddress, netWithdrawAmount);

      if (!txResult.success || !txResult.txHash) {
        console.error('[Withdraw] ❌ On-chain transaction failed:', txResult.error);
        return NextResponse.json(
          { error: `Withdrawal transaction failed: ${txResult.error || 'Unknown error'}` },
          { status: 500 }
        );
      }

      txHash = txResult.txHash;
      console.log(`[Withdraw] ✅ On-chain transaction successful: ${txHash}`);

    } else {
      return NextResponse.json(
        { error: 'EVM withdrawals not yet implemented' },
        { status: 501 }
      );
    }

    // 4. Update Supabase balance (only after successful on-chain tx)
    const newBalance = currentBalance - amount;

    const { error: updateError } = await supabase
      .from('user_balances')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_address', userAddress);

    if (updateError) {
      console.error('[Withdraw] Database error:', updateError);
      // NOTE: The on-chain tx already succeeded. We should still return success
      // but flag the DB error for manual reconciliation.
      console.error('[Withdraw] ⚠️ CRITICAL: On-chain tx succeeded but DB update failed!');
      console.error(`[Withdraw] TX: ${txHash}, User: ${userAddress}, Amount: ${amount}`);
    }

    // 5. Insert audit log entry
    await supabase
      .from('balance_audit_log')
      .insert({
        user_address: userAddress,
        operation_type: 'withdrawal',
        amount: amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        transaction_hash: txHash
      });

    console.log(`[Withdraw] ✅ Withdrawal complete: User balance updated to ${newBalance} KAS`);

    return NextResponse.json({
      success: true,
      txHash: txHash,
      newBalance: newBalance,
      netAmount: netWithdrawAmount,
      fee: feeAmount,
      status: 'confirmed',
      message: 'Withdrawal completed successfully.'
    });
  } catch (error: any) {
    console.error('[Withdraw] ❌ Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
