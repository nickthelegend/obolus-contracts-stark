/**
 * API Route: Leaderboard
 * GET /api/bets/leaderboard?limit=10
 * 
 * Returns top winners ranked by total profit
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10');

        // Use a raw SQL query via a Supabase RPC or manual aggregation
        // We'll do it with a simple select + client-side aggregation for flexibility
        const { data, error } = await supabase
            .from('bet_history')
            .select('wallet_address, amount, payout, won');

        if (error) {
            console.error('Supabase leaderboard error:', error);
            return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
        }

        // Aggregate per wallet
        const walletStats: Record<string, {
            wallet_address: string;
            total_bets: number;
            wins: number;
            losses: number;
            total_wagered: number;
            total_payout: number;
            net_profit: number;
        }> = {};

        (data || []).forEach((row: any) => {
            const addr = row.wallet_address;
            if (!walletStats[addr]) {
                walletStats[addr] = {
                    wallet_address: addr,
                    total_bets: 0,
                    wins: 0,
                    losses: 0,
                    total_wagered: 0,
                    total_payout: 0,
                    net_profit: 0,
                };
            }
            walletStats[addr].total_bets += 1;
            walletStats[addr].total_wagered += parseFloat(row.amount) || 0;
            if (row.won) {
                walletStats[addr].wins += 1;
                walletStats[addr].total_payout += parseFloat(row.payout) || 0;
            } else {
                walletStats[addr].losses += 1;
            }
        });

        // Calculate net profit and sort
        const leaderboard = Object.values(walletStats)
            .map(s => ({
                ...s,
                net_profit: s.total_payout - s.total_wagered,
                win_rate: s.total_bets > 0 ? ((s.wins / s.total_bets) * 100) : 0,
            }))
            .sort((a, b) => b.net_profit - a.net_profit)
            .slice(0, limit);

        return NextResponse.json({ leaderboard });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
