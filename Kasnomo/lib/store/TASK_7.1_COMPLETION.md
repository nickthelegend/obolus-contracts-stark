# Task 7.1 Completion: Create balanceSlice with state and actions

## Summary

Successfully created the `balanceSlice` for managing house balance state in the Zustand store. The slice follows the same patterns as existing slices (walletSlice, gameSlice, historySlice) and integrates seamlessly with the main store.

## Implementation Details

### Files Created

1. **lib/store/balanceSlice.ts**
   - Created new balance slice with state and actions
   - Follows StateCreator pattern from Zustand
   - Includes comprehensive JSDoc comments

### Files Modified

1. **lib/store/index.ts**
   - Imported BalanceState and createBalanceSlice
   - Added BalanceState to OverflowStore type
   - Integrated balanceSlice into store creation
   - Added fetchBalance call in initializeStore when wallet is connected
   - Updated event handlers to refresh house balance after bet placement and settlement
   - Added selectors: useHouseBalance, useIsLoadingBalance
   - Added useBalanceActions hook for accessing balance actions

## State Structure

```typescript
interface BalanceState {
  // State
  houseBalance: number;      // Current house balance in FLOW
  isLoading: boolean;        // Loading state for async operations
  error: string | null;      // Error message if operation fails

  // Actions
  fetchBalance: (address: string) => Promise<void>;
  setBalance: (balance: number) => void;
  updateBalance: (amount: number, operation: 'add' | 'subtract') => void;
  depositFunds: (address: string, amount: number, txHash: string) => Promise<void>;
  withdrawFunds: (address: string, amount: number, txHash: string) => Promise<void>;
  clearError: () => void;
}
```

## Actions Implemented

### 1. fetchBalance(address: string)
- Fetches house balance from GET /api/balance/[address]
- Sets loading state during fetch
- Updates houseBalance on success
- Sets error message on failure
- Called automatically on store initialization if wallet is connected

### 2. setBalance(balance: number)
- Directly sets the house balance
- Used by event listeners and after successful operations
- No API calls, just state update

### 3. updateBalance(amount: number, operation: 'add' | 'subtract')
- Updates balance by adding or subtracting an amount
- Used for optimistic updates before API confirmation
- Prevents negative balance (Math.max(0, ...))
- Operation parameter: 'add' or 'subtract'

### 4. depositFunds(address: string, amount: number, txHash: string)
- Processes deposit after blockchain transaction completes
- Calls POST /api/balance/deposit endpoint
- Updates houseBalance with newBalance from response
- Sets loading state and handles errors
- Throws error on failure for caller to handle

### 5. withdrawFunds(address: string, amount: number, txHash: string)
- Processes withdrawal after blockchain transaction completes
- Calls POST /api/balance/withdraw endpoint
- Updates houseBalance with newBalance from response
- Sets loading state and handles errors
- Throws error on failure for caller to handle

### 6. clearError()
- Clears the error message
- Simple state update

## Integration with Store

### Store Initialization
- fetchBalance is called automatically when wallet is connected during store initialization
- Ensures house balance is loaded on app start if user is already authenticated

### Event Handlers
- BetPlaced event handler now refreshes house balance after bet placement
- RoundSettled event handler now refreshes house balance after round settlement
- Ensures UI stays in sync with backend balance changes

### Selectors
```typescript
// State selectors
export const useHouseBalance = () => useOverflowStore(state => state.houseBalance);
export const useIsLoadingBalance = () => useOverflowStore(state => state.isLoading);

// Actions selector
export const useBalanceActions = () => useOverflowStore(state => ({
  fetchBalance: state.fetchBalance,
  setBalance: state.setBalance,
  updateBalance: state.updateBalance,
  depositFunds: state.depositFunds,
  withdrawFunds: state.withdrawFunds,
  clearError: state.clearError
}));
```

## Usage Examples

### In a React Component

```typescript
import { useHouseBalance, useIsLoadingBalance, useBalanceActions } from '@/lib/store';

function BalanceDisplay() {
  const houseBalance = useHouseBalance();
  const isLoading = useIsLoadingBalance();
  const { fetchBalance } = useBalanceActions();
  const address = useWalletAddress();

  const handleRefresh = () => {
    if (address) {
      fetchBalance(address);
    }
  };

  return (
    <div>
      <p>House Balance: {houseBalance.toFixed(4)} FLOW</p>
      {isLoading && <p>Loading...</p>}
      <button onClick={handleRefresh}>Refresh</button>
    </div>
  );
}
```

### Deposit Flow

```typescript
import { useBalanceActions, useWalletAddress } from '@/lib/store';
import * as fcl from '@onflow/fcl';

async function handleDeposit(amount: number) {
  const { depositFunds } = useBalanceActions();
  const address = useWalletAddress();

  // 1. Execute blockchain transaction
  const txId = await fcl.mutate({
    cadence: depositTransaction,
    args: (arg, t) => [arg(amount.toString(), t.UFix64)],
    limit: 9999
  });

  // 2. Wait for transaction to seal
  const tx = await fcl.tx(txId).onceSealed();

  // 3. Update database and local state
  if (tx.statusCode === 0) {
    await depositFunds(address, amount, txId);
  }
}
```

### Optimistic Updates

```typescript
import { useBalanceActions } from '@/lib/store';

async function placeBet(betAmount: number) {
  const { updateBalance, fetchBalance } = useBalanceActions();
  const address = useWalletAddress();

  // Optimistically update UI
  updateBalance(betAmount, 'subtract');

  try {
    // Place bet via API
    await fetch('/api/balance/bet', {
      method: 'POST',
      body: JSON.stringify({ userAddress: address, betAmount, ... })
    });
  } catch (error) {
    // Revert optimistic update on error
    if (address) {
      await fetchBalance(address);
    }
  }
}
```

## Requirements Satisfied

✅ **Requirement 2.1**: Track User Balances
- State maintains houseBalance for current user
- fetchBalance queries balance from API
- Balance updates reflected in real-time

## Testing Recommendations

The following tests should be written in task 7.2:

1. **fetchBalance action**
   - Test successful balance fetch
   - Test error handling
   - Test loading state transitions

2. **setBalance action**
   - Test direct balance update

3. **updateBalance action**
   - Test adding to balance
   - Test subtracting from balance
   - Test negative balance prevention

4. **depositFunds action**
   - Test successful deposit processing
   - Test error handling
   - Test loading state

5. **withdrawFunds action**
   - Test successful withdrawal processing
   - Test error handling
   - Test loading state

6. **Store integration**
   - Test balance fetch on initialization
   - Test balance refresh after bet events
   - Test balance refresh after settlement events

## Next Steps

- Task 7.2: Write unit tests for balance slice
- Task 8.1: Create BalanceDisplay component using these selectors
- Task 9.1: Create DepositModal component using depositFunds action
- Task 10.1: Create WithdrawModal component using withdrawFunds action

## Notes

- The slice follows the same patterns as walletSlice and gameSlice for consistency
- Error handling is comprehensive with try-catch blocks and error state
- Loading states are managed for better UX
- The slice is fully integrated with the existing store architecture
- TypeScript diagnostics show no errors
- All actions are properly typed and documented
