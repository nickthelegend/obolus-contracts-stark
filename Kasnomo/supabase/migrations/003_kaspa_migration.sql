-- Migration: 003_kaspa_migration
-- Description: Create tables for Kaspa network balance and bet history tracking

-- 1. Create user_kaspa_balances table
CREATE TABLE IF NOT EXISTS user_kaspa_balances (
    user_address TEXT PRIMARY KEY,
    balance NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for clarity
COMMENT ON TABLE user_kaspa_balances IS 'Stores KAS balances for Kaspa wallet addresses';
COMMENT ON COLUMN user_kaspa_balances.user_address IS 'Kaspa wallet address (kaspa:...)';

-- 2. Create kaspa_bet_history table
CREATE TABLE IF NOT EXISTS kaspa_bet_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    asset TEXT NOT NULL DEFAULT 'KAS',
    direction TEXT NOT NULL CHECK (direction IN ('UP', 'DOWN')),
    amount NUMERIC(20, 8) NOT NULL CHECK (amount > 0),
    payout NUMERIC(20, 8) DEFAULT 0,
    won BOOLEAN DEFAULT FALSE,
    mode TEXT NOT NULL DEFAULT 'LIVE', -- LIVE or DEMO
    network TEXT NOT NULL DEFAULT 'KASPA_TESTNET',
    transaction_id TEXT, -- Kaspa transaction hash
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_kaspa_bet_history_wallet ON kaspa_bet_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_kaspa_bet_history_resolved ON kaspa_bet_history(resolved_at DESC);

-- Add comment
COMMENT ON TABLE kaspa_bet_history IS 'Stores betting history for Kaspa network transactions';

-- 3. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create trigger for user_kaspa_balances
DROP TRIGGER IF EXISTS update_user_kaspa_balances_updated_at ON user_kaspa_balances;
CREATE TRIGGER update_user_kaspa_balances_updated_at
    BEFORE UPDATE ON user_kaspa_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE user_kaspa_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE kaspa_bet_history ENABLE ROW LEVEL SECURITY;

-- 6. Create policies (Public read/write for now, or Restricted to user)
-- For a demo application, we might allow public access to their own records via custom auth or just address matching
CREATE POLICY "Public Read Kaspa Balances" ON user_kaspa_balances FOR SELECT USING (true);
CREATE POLICY "Public Write Kaspa Balances" ON user_kaspa_balances FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Kaspa Balances" ON user_kaspa_balances FOR UPDATE USING (true);

CREATE POLICY "Public Read Kaspa Bets" ON kaspa_bet_history FOR SELECT USING (true);
CREATE POLICY "Public Write Kaspa Bets" ON kaspa_bet_history FOR INSERT WITH CHECK (true);
