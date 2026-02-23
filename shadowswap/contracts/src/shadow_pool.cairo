// =============================================================================
// ShadowSwap :: ShadowPool
// =============================================================================
// A constant-product (x * y = k) AMM pool that operates entirely on
// ElGamal-encrypted balances via the Tongo protocol.
//
// Key design decisions:
//   - Reserves are stored as encrypted ciphertexts (L, R) so that on-chain
//     observers cannot learn the pool depth.
//   - Swaps and liquidity operations delegate to the Tongo contracts for the
//     two tokens in the pair, keeping all value transfer in the encrypted
//     domain.
//   - An admin (pool creator) initialises the pair and can perform
//     administrative functions.
//   - In a production system the constant-product invariant would be verified
//     via a ZK proof submitted alongside each swap.  The proof is omitted
//     here for clarity but the expected interface is documented.
// =============================================================================

use starknet::ContractAddress;

// ---------------------------------------------------------------------------
// Tongo interface (same subset used in confidential_token).
// ---------------------------------------------------------------------------
#[starknet::interface]
trait ITongoEncryption<TContractState> {
    fn fund(ref self: TContractState, recipient: ContractAddress, amount: u256);
    fn withdraw(ref self: TContractState, recipient: ContractAddress, amount: u256);
    fn confidential_transfer(
        ref self: TContractState,
        to: ContractAddress,
        ct_amount_L: felt252,
        ct_amount_R: felt252,
    );
    fn rollover(ref self: TContractState);
}

// ---------------------------------------------------------------------------
// Public interface of the ShadowPool.
// ---------------------------------------------------------------------------
#[starknet::interface]
trait IShadowPool<TContractState> {
    /// Deposit encrypted amounts of both tokens to add liquidity.
    /// The caller sends ciphertexts for the amounts of token_a and token_b.
    fn add_liquidity(
        ref self: TContractState,
        ct_amount_a_L: felt252,
        ct_amount_a_R: felt252,
        ct_amount_b_L: felt252,
        ct_amount_b_R: felt252,
    );

    /// Remove liquidity by specifying encrypted amounts to withdraw.
    fn remove_liquidity(
        ref self: TContractState,
        ct_amount_a_L: felt252,
        ct_amount_a_R: felt252,
        ct_amount_b_L: felt252,
        ct_amount_b_R: felt252,
    );

    /// Swap an encrypted amount of one token for the other.
    ///
    /// * `is_token_a` - true  => selling token_a for token_b
    ///                  false => selling token_b for token_a
    /// * `ct_in_*`    - ElGamal ciphertext of the input amount.
    /// * `ct_out_*`   - ElGamal ciphertext of the expected output amount.
    ///
    /// In production a ZK proof of the constant-product invariant would
    /// accompany this call.  The proof is not modelled here.
    fn swap(
        ref self: TContractState,
        is_token_a: bool,
        ct_in_L: felt252,
        ct_in_R: felt252,
        ct_out_L: felt252,
        ct_out_R: felt252,
    );

    // -- View functions ------------------------------------------------------

    /// Encrypted reserves for token A (L, R).
    fn get_reserve_a(self: @TContractState) -> (felt252, felt252);

    /// Encrypted reserves for token B (L, R).
    fn get_reserve_b(self: @TContractState) -> (felt252, felt252);

    /// Tongo contract address for token A.
    fn get_tongo_a(self: @TContractState) -> ContractAddress;

    /// Tongo contract address for token B.
    fn get_tongo_b(self: @TContractState) -> ContractAddress;

    /// Pool administrator.
    fn get_admin(self: @TContractState) -> ContractAddress;

    /// Total number of swaps executed.
    fn get_swap_count(self: @TContractState) -> u64;
}

// ===========================================================================
// Contract implementation
// ===========================================================================
#[starknet::contract]
mod ShadowPool {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{ITongoEncryptionDispatcher, ITongoEncryptionDispatcherTrait};

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------
    #[storage]
    struct Storage {
        /// Pool creator / admin.
        admin: ContractAddress,

        /// Tongo encryption contract for token A.
        tongo_a: ContractAddress,
        /// Tongo encryption contract for token B.
        tongo_b: ContractAddress,

        // Encrypted reserves for token A (ElGamal ciphertext components).
        reserve_a_L: felt252,
        reserve_a_R: felt252,

        // Encrypted reserves for token B.
        reserve_b_L: felt252,
        reserve_b_R: felt252,

        /// Whether the pool has been initialised with first liquidity.
        is_initialised: bool,

        /// Running count of swaps (useful for analytics / indexing).
        swap_count: u64,

        /// Running count of liquidity events.
        liquidity_event_count: u64,
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LiquidityAdded: LiquidityAdded,
        LiquidityRemoved: LiquidityRemoved,
        Swapped: Swapped,
        PoolInitialised: PoolInitialised,
    }

    /// Emitted when liquidity is added to the pool.
    #[derive(Drop, starknet::Event)]
    struct LiquidityAdded {
        #[key]
        provider: ContractAddress,
        ct_amount_a_L: felt252,
        ct_amount_a_R: felt252,
        ct_amount_b_L: felt252,
        ct_amount_b_R: felt252,
        timestamp: u64,
    }

    /// Emitted when liquidity is removed from the pool.
    #[derive(Drop, starknet::Event)]
    struct LiquidityRemoved {
        #[key]
        provider: ContractAddress,
        ct_amount_a_L: felt252,
        ct_amount_a_R: felt252,
        ct_amount_b_L: felt252,
        ct_amount_b_R: felt252,
        timestamp: u64,
    }

    /// Emitted on every swap.
    #[derive(Drop, starknet::Event)]
    struct Swapped {
        #[key]
        trader: ContractAddress,
        is_token_a: bool,
        ct_in_L: felt252,
        ct_in_R: felt252,
        ct_out_L: felt252,
        ct_out_R: felt252,
        timestamp: u64,
    }

    /// Emitted once when the pool is first funded.
    #[derive(Drop, starknet::Event)]
    struct PoolInitialised {
        #[key]
        admin: ContractAddress,
        tongo_a: ContractAddress,
        tongo_b: ContractAddress,
        timestamp: u64,
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        tongo_a: ContractAddress,
        tongo_b: ContractAddress,
    ) {
        self.admin.write(admin);
        self.tongo_a.write(tongo_a);
        self.tongo_b.write(tongo_b);
        self.is_initialised.write(false);
        self.swap_count.write(0);
        self.liquidity_event_count.write(0);

        // Reserves start at zero (the additive identity for ElGamal, which
        // is the point at infinity, encoded as 0 for simplicity).
        self.reserve_a_L.write(0);
        self.reserve_a_R.write(0);
        self.reserve_b_L.write(0);
        self.reserve_b_R.write(0);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// Assert that the caller is the pool admin.
    fn assert_admin(self: @ContractState) {
        let caller = get_caller_address();
        assert(caller == self.admin.read(), 'ShadowPool: caller not admin');
    }

    // -----------------------------------------------------------------------
    // External / public functions
    // -----------------------------------------------------------------------
    #[abi(embed_v0)]
    impl ShadowPoolImpl of super::IShadowPool<ContractState> {
        // -------------------------------------------------------------------
        // add_liquidity()
        // -------------------------------------------------------------------
        // The liquidity provider transfers encrypted amounts of both tokens
        // into the pool.  The pool's encrypted reserves are updated by
        // homomorphically combining the new ciphertexts with the existing
        // reserves (in practice this is point addition on the elliptic curve;
        // here we store the new aggregate ciphertext supplied by the caller
        // after off-chain computation and ZK proof verification).
        // -------------------------------------------------------------------
        fn add_liquidity(
            ref self: ContractState,
            ct_amount_a_L: felt252,
            ct_amount_a_R: felt252,
            ct_amount_b_L: felt252,
            ct_amount_b_R: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let pool_address = starknet::get_contract_address();

            // Transfer encrypted token A from the caller to the pool.
            let tongo_a = ITongoEncryptionDispatcher {
                contract_address: self.tongo_a.read(),
            };
            tongo_a.confidential_transfer(pool_address, ct_amount_a_L, ct_amount_a_R);

            // Transfer encrypted token B from the caller to the pool.
            let tongo_b = ITongoEncryptionDispatcher {
                contract_address: self.tongo_b.read(),
            };
            tongo_b.confidential_transfer(pool_address, ct_amount_b_L, ct_amount_b_R);

            // Update the encrypted reserves.
            // NOTE: In a full implementation the new reserve ciphertext would
            // be computed via homomorphic addition (EC point addition) and
            // verified with a ZK proof.  Here we store the latest ciphertext
            // for demonstration purposes.
            self.reserve_a_L.write(ct_amount_a_L);
            self.reserve_a_R.write(ct_amount_a_R);
            self.reserve_b_L.write(ct_amount_b_L);
            self.reserve_b_R.write(ct_amount_b_R);

            // Mark pool as initialised on first deposit.
            if !self.is_initialised.read() {
                self.is_initialised.write(true);
                self.emit(PoolInitialised {
                    admin: self.admin.read(),
                    tongo_a: self.tongo_a.read(),
                    tongo_b: self.tongo_b.read(),
                    timestamp,
                });
            }

            let count = self.liquidity_event_count.read();
            self.liquidity_event_count.write(count + 1);

            self.emit(LiquidityAdded {
                provider: caller,
                ct_amount_a_L,
                ct_amount_a_R,
                ct_amount_b_L,
                ct_amount_b_R,
                timestamp,
            });
        }

        // -------------------------------------------------------------------
        // remove_liquidity()
        // -------------------------------------------------------------------
        // The provider specifies encrypted amounts to withdraw from each
        // side of the pool.  A ZK proof that the withdrawal maintains the
        // constant-product invariant (or a proportional share check) would
        // be required in production.
        // -------------------------------------------------------------------
        fn remove_liquidity(
            ref self: ContractState,
            ct_amount_a_L: felt252,
            ct_amount_a_R: felt252,
            ct_amount_b_L: felt252,
            ct_amount_b_R: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            assert(self.is_initialised.read(), 'ShadowPool: not initialised');

            // Transfer encrypted tokens from the pool back to the provider.
            let tongo_a = ITongoEncryptionDispatcher {
                contract_address: self.tongo_a.read(),
            };
            tongo_a.confidential_transfer(caller, ct_amount_a_L, ct_amount_a_R);

            let tongo_b = ITongoEncryptionDispatcher {
                contract_address: self.tongo_b.read(),
            };
            tongo_b.confidential_transfer(caller, ct_amount_b_L, ct_amount_b_R);

            // Update reserves (see note in add_liquidity about homomorphic ops).
            self.reserve_a_L.write(ct_amount_a_L);
            self.reserve_a_R.write(ct_amount_a_R);
            self.reserve_b_L.write(ct_amount_b_L);
            self.reserve_b_R.write(ct_amount_b_R);

            let count = self.liquidity_event_count.read();
            self.liquidity_event_count.write(count + 1);

            self.emit(LiquidityRemoved {
                provider: caller,
                ct_amount_a_L,
                ct_amount_a_R,
                ct_amount_b_L,
                ct_amount_b_R,
                timestamp,
            });
        }

        // -------------------------------------------------------------------
        // swap()
        // -------------------------------------------------------------------
        // Execute a swap in the encrypted domain.
        //
        // The caller provides:
        //   - the direction (is_token_a = selling A for B, or vice versa)
        //   - the encrypted input amount  (ct_in_L, ct_in_R)
        //   - the encrypted output amount (ct_out_L, ct_out_R)
        //
        // A ZK proof that:
        //   new_reserve_a * new_reserve_b >= old_reserve_a * old_reserve_b
        // holds under the encrypted values would be verified here in a
        // production deployment.
        // -------------------------------------------------------------------
        fn swap(
            ref self: ContractState,
            is_token_a: bool,
            ct_in_L: felt252,
            ct_in_R: felt252,
            ct_out_L: felt252,
            ct_out_R: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let pool_address = starknet::get_contract_address();

            assert(self.is_initialised.read(), 'ShadowPool: not initialised');

            let tongo_a = ITongoEncryptionDispatcher {
                contract_address: self.tongo_a.read(),
            };
            let tongo_b = ITongoEncryptionDispatcher {
                contract_address: self.tongo_b.read(),
            };

            if is_token_a {
                // Caller sends token A to the pool.
                tongo_a.confidential_transfer(pool_address, ct_in_L, ct_in_R);
                // Pool sends token B to the caller.
                tongo_b.confidential_transfer(caller, ct_out_L, ct_out_R);
            } else {
                // Caller sends token B to the pool.
                tongo_b.confidential_transfer(pool_address, ct_in_L, ct_in_R);
                // Pool sends token A to the caller.
                tongo_a.confidential_transfer(caller, ct_out_L, ct_out_R);
            }

            // Update swap counter.
            let count = self.swap_count.read();
            self.swap_count.write(count + 1);

            self.emit(Swapped {
                trader: caller,
                is_token_a,
                ct_in_L,
                ct_in_R,
                ct_out_L,
                ct_out_R,
                timestamp,
            });
        }

        // -------------------------------------------------------------------
        // View helpers
        // -------------------------------------------------------------------

        fn get_reserve_a(self: @ContractState) -> (felt252, felt252) {
            (self.reserve_a_L.read(), self.reserve_a_R.read())
        }

        fn get_reserve_b(self: @ContractState) -> (felt252, felt252) {
            (self.reserve_b_L.read(), self.reserve_b_R.read())
        }

        fn get_tongo_a(self: @ContractState) -> ContractAddress {
            self.tongo_a.read()
        }

        fn get_tongo_b(self: @ContractState) -> ContractAddress {
            self.tongo_b.read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_swap_count(self: @ContractState) -> u64 {
            self.swap_count.read()
        }
    }
}
