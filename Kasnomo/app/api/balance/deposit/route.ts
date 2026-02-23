/**
 * POST /api/balance/deposit endpoint
 * 
 * Verifies a real Kaspa blockchain transaction and credits user balance
 * User must first send KAS to treasury address, then call this endpoint with txHash
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase/client';
import { ethers } from 'ethers';
import { getTransaction } from '@/lib/kaspa/rpc';

interface DepositRequest {
  userAddress: string;
  txHash: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DepositRequest = await request.json();
    const { userAddress, txHash } = body;

    if (!userAddress || !txHash) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, txHash' },
        { status: 400 }
      );
    }

    // Validate address format
    const isKaspaAddress = userAddress.startsWith('kaspa:') || userAddress.startsWith('kaspatest:');
    const isEVMAddress = ethers.isAddress(userAddress);

    if (!isKaspaAddress && !isEVMAddress) {
      return NextResponse.json(
        { error: 'Invalid wallet address format (Kaspa or EVM required)' },
        { status: 400 }
      );
    }

    console.log(`[Deposit] Verifying transaction ${txHash} for ${userAddress}`);

    // Check if transaction was already processed
    const { data: existingLog } = await supabase
      .from('balance_audit_log')
      .select('id')
      .eq('transaction_hash', txHash)
      .eq('operation_type', 'deposit')
      .single();

    if (existingLog) {
      console.log(`[Deposit] ⚠️ Transaction already processed: ${txHash}`);
      return NextResponse.json(
        { error: 'Transaction already processed' },
        { status: 400 }
      );
    }

    // Verify transaction on blockchain (only for Kaspa addresses)
    let amount = 0;

    if (isKaspaAddress) {
      console.log(`[Deposit] Verifying Kaspa blockchain transaction...`);

      const treasuryAddress = process.env.NEXT_PUBLIC_KASPA_TREASURY_ADDRESS;
      if (!treasuryAddress) {
        throw new Error('Treasury address not configured');
      }

      // Get transaction from blockchain (retry with delay — tx may not be indexed yet)
      let txInfo = await getTransaction(txHash);

      if (!txInfo) {
        console.log(`[Deposit] Transaction not found yet, retrying with delays...`);
        for (let attempt = 1; attempt <= 5; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3 seconds
          console.log(`[Deposit] Retry attempt ${attempt}/5 for tx ${txHash}`);
          txInfo = await getTransaction(txHash);
          if (txInfo) break;
        }
      }

      if (!txInfo) {
        return NextResponse.json(
          { error: 'Transaction not found on blockchain. It may still be processing — please try again in a few seconds.' },
          { status: 404 }
        );
      }

      // Find output to treasury address
      let depositAmountSompi = 0n;

      if (txInfo.outputs) {
        for (const output of txInfo.outputs) {
          // REST API uses snake_case field: script_public_key_address
          const outputAddress = output.script_public_key_address;
          if (outputAddress === treasuryAddress) {
            depositAmountSompi += BigInt(output.amount);
          }
        }
      }

      if (depositAmountSompi === 0n) {
        return NextResponse.json(
          { error: 'No deposit found to treasury address in this transaction' },
          { status: 400 }
        );
      }

      // Convert sompi to KAS (1 KAS = 100,000,000 sompi)
      amount = Number(depositAmountSompi) / 100_000_000;
      console.log(`[Deposit] ✅ Verified deposit: ${amount} KAS`);

    } else {
      return NextResponse.json(
        { error: 'EVM deposit verification not yet implemented' },
        { status: 501 }
      );
    }

    // Update user balance
    let newBalance = amount;

    const { data: existingData, error: fetchError } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_address', userAddress)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Deposit] Error fetching balance:', fetchError);
      return NextResponse.json(
        { error: 'Database error: ' + fetchError.message },
        { status: 500 }
      );
    }

    if (existingData) {
      newBalance = parseFloat(existingData.balance) + amount;
      const { error: updateError } = await supabase
        .from('user_balances')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_address', userAddress);

      if (updateError) {
        console.error('[Deposit] Error updating balance:', updateError);
        return NextResponse.json(
          { error: 'Database error: ' + updateError.message },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from('user_balances')
        .insert({
          user_address: userAddress,
          balance: newBalance,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Deposit] Error inserting balance:', insertError);
        return NextResponse.json(
          { error: 'Database error: ' + insertError.message },
          { status: 500 }
        );
      }
    }

    console.log(`[Deposit] ✅ Balance updated: ${existingData ? parseFloat(existingData.balance) : 0} -> ${newBalance} KAS`);

    await supabase
      .from('balance_audit_log')
      .insert({
        user_address: userAddress,
        operation_type: 'deposit',
        amount: amount,
        balance_before: existingData ? parseFloat(existingData.balance) : 0,
        balance_after: newBalance,
        transaction_hash: txHash
      });

    return NextResponse.json({
      success: true,
      newBalance: newBalance,
      amount: amount,
      txHash: txHash
    });

  } catch (error: any) {
    console.error('[Deposit] ❌ Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
