// =============================================================================
// ShadowSwap :: SealedOrderbook
// =============================================================================
// A sealed-bid limit order book where both price and amount are submitted as
// ElGamal ciphertexts.  No on-chain observer can determine the price or size
// of any order until the designated matcher (admin / keeper) decrypts and
// matches compatible orders off-chain, then submits the settlement proof.
//
// Order lifecycle:
//   OPEN  -->  FILLED     (matched by keeper)
//         -->  CANCELLED  (cancelled by owner)
//
// Matching is performed by an admin/keeper who holds the matching key.  In a
// production system the keeper would submit a ZK proof that the match is
// valid (buy price >= sell price, amounts balance, etc.).
// =============================================================================

use starknet::ContractAddress;

// ---------------------------------------------------------------------------
// Tongo interface (for encrypted transfers on settlement).
// ---------------------------------------------------------------------------
#[starknet::interface]
trait ITongoEncryption<TContractState> {
    fn confidential_transfer(
        ref self: TContractState,
        to: ContractAddress,
        ct_amount_L: felt252,
        ct_amount_R: felt252,
    );
    fn rollover(ref self: TContractState);
}

// ---------------------------------------------------------------------------
// Public interface.
// ---------------------------------------------------------------------------
#[starknet::interface]
trait ISealedOrderbook<TContractState> {
    /// Place a new sealed order.
    ///
    /// * `side`              - 0 = BUY, 1 = SELL
    /// * `ct_price_L/R`      - ElGamal ciphertext of the limit price.
    /// * `ct_amount_L/R`     - ElGamal ciphertext of the order amount.
    ///
    /// Returns the order id.
    fn place_order(
        ref self: TContractState,
        side: u8,
        ct_price_L: felt252,
        ct_price_R: felt252,
        ct_amount_L: felt252,
        ct_amount_R: felt252,
    ) -> u64;

    /// Cancel an open order.  Only the order owner may cancel.
    fn cancel_order(ref self: TContractState, order_id: u64);

    /// Match a buy order with a sell order.  Only the admin/keeper may call.
    ///
    /// The keeper provides the encrypted settlement amounts that will be
    /// transferred between the two parties.  A ZK proof that the match is
    /// valid would accompany this in production.
    fn match_orders(
        ref self: TContractState,
        buy_order_id: u64,
        sell_order_id: u64,
        ct_settlement_L: felt252,
        ct_settlement_R: felt252,
    );

    // -- View functions ------------------------------------------------------

    /// Get core fields for an order.
    /// Returns (owner, side, status, timestamp).
    fn get_order_info(self: @TContractState, order_id: u64) -> (ContractAddress, u8, u8, u64);

    /// Get the encrypted price for an order (L, R).
    fn get_order_price(self: @TContractState, order_id: u64) -> (felt252, felt252);

    /// Get the encrypted amount for an order (L, R).
    fn get_order_amount(self: @TContractState, order_id: u64) -> (felt252, felt252);

    /// Total number of orders ever created.
    fn get_order_count(self: @TContractState) -> u64;

    /// Admin address.
    fn get_admin(self: @TContractState) -> ContractAddress;
}

// ===========================================================================
// Contract implementation
// ===========================================================================
#[starknet::contract]
mod SealedOrderbook {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StoragePathEntry,
    };
    use super::{ITongoEncryptionDispatcher, ITongoEncryptionDispatcherTrait};

    // -----------------------------------------------------------------------
    // Constants for order side and status.
    // Using u8 rather than an enum keeps storage and the ABI simple.
    // -----------------------------------------------------------------------
    const SIDE_BUY: u8 = 0;
    const SIDE_SELL: u8 = 1;

    const STATUS_OPEN: u8 = 0;
    const STATUS_FILLED: u8 = 1;
    const STATUS_CANCELLED: u8 = 2;

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------
    // Orders are stored in a set of parallel maps keyed by order_id (u64).
    // This avoids the need for a custom struct in storage which would require
    // a Store derive; individual felt252/u8/u64 fields are natively storable.
    // -----------------------------------------------------------------------
    #[storage]
    struct Storage {
        /// Admin / keeper who can match orders.
        admin: ContractAddress,

        /// Tongo encryption contract for the base token.
        tongo_base: ContractAddress,
        /// Tongo encryption contract for the quote token.
        tongo_quote: ContractAddress,

        /// Auto-incrementing order counter (next order_id to assign).
        next_order_id: u64,

        // -- Per-order fields (keyed by order_id) ----------------------------
        order_owner: Map<u64, ContractAddress>,
        order_side: Map<u64, u8>,
        order_status: Map<u64, u8>,
        order_timestamp: Map<u64, u64>,

        // Encrypted price (ElGamal ciphertext).
        order_ct_price_L: Map<u64, felt252>,
        order_ct_price_R: Map<u64, felt252>,

        // Encrypted amount (ElGamal ciphertext).
        order_ct_amount_L: Map<u64, felt252>,
        order_ct_amount_R: Map<u64, felt252>,
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        OrderPlaced: OrderPlaced,
        OrderCancelled: OrderCancelled,
        OrdersMatched: OrdersMatched,
    }

    #[derive(Drop, starknet::Event)]
    struct OrderPlaced {
        #[key]
        order_id: u64,
        #[key]
        owner: ContractAddress,
        side: u8,
        ct_price_L: felt252,
        ct_price_R: felt252,
        ct_amount_L: felt252,
        ct_amount_R: felt252,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct OrderCancelled {
        #[key]
        order_id: u64,
        #[key]
        owner: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct OrdersMatched {
        #[key]
        buy_order_id: u64,
        #[key]
        sell_order_id: u64,
        ct_settlement_L: felt252,
        ct_settlement_R: felt252,
        timestamp: u64,
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        tongo_base: ContractAddress,
        tongo_quote: ContractAddress,
    ) {
        self.admin.write(admin);
        self.tongo_base.write(tongo_base);
        self.tongo_quote.write(tongo_quote);
        self.next_order_id.write(0);
    }

    // -----------------------------------------------------------------------
    // External / public functions
    // -----------------------------------------------------------------------
    #[abi(embed_v0)]
    impl SealedOrderbookImpl of super::ISealedOrderbook<ContractState> {
        // -------------------------------------------------------------------
        // place_order()
        // -------------------------------------------------------------------
        fn place_order(
            ref self: ContractState,
            side: u8,
            ct_price_L: felt252,
            ct_price_R: felt252,
            ct_amount_L: felt252,
            ct_amount_R: felt252,
        ) -> u64 {
            // Validate side.
            assert(side == SIDE_BUY || side == SIDE_SELL, 'Orderbook: invalid side');

            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Assign order id and increment counter.
            let order_id = self.next_order_id.read();
            self.next_order_id.write(order_id + 1);

            // Persist order fields.
            self.order_owner.entry(order_id).write(caller);
            self.order_side.entry(order_id).write(side);
            self.order_status.entry(order_id).write(STATUS_OPEN);
            self.order_timestamp.entry(order_id).write(timestamp);
            self.order_ct_price_L.entry(order_id).write(ct_price_L);
            self.order_ct_price_R.entry(order_id).write(ct_price_R);
            self.order_ct_amount_L.entry(order_id).write(ct_amount_L);
            self.order_ct_amount_R.entry(order_id).write(ct_amount_R);

            // Escrow: the placer transfers the encrypted amount into the
            // orderbook contract.  For a BUY order this is quote token; for
            // a SELL order this is base token.
            let pool_address = starknet::get_contract_address();
            if side == SIDE_BUY {
                let tongo_quote = ITongoEncryptionDispatcher {
                    contract_address: self.tongo_quote.read(),
                };
                tongo_quote.confidential_transfer(pool_address, ct_amount_L, ct_amount_R);
            } else {
                let tongo_base = ITongoEncryptionDispatcher {
                    contract_address: self.tongo_base.read(),
                };
                tongo_base.confidential_transfer(pool_address, ct_amount_L, ct_amount_R);
            }

            self.emit(OrderPlaced {
                order_id,
                owner: caller,
                side,
                ct_price_L,
                ct_price_R,
                ct_amount_L,
                ct_amount_R,
                timestamp,
            });

            order_id
        }

        // -------------------------------------------------------------------
        // cancel_order()
        // -------------------------------------------------------------------
        fn cancel_order(ref self: ContractState, order_id: u64) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Ensure order exists.
            assert(order_id < self.next_order_id.read(), 'Orderbook: invalid order_id');

            // Only the owner can cancel.
            let owner = self.order_owner.entry(order_id).read();
            assert(caller == owner, 'Orderbook: not order owner');

            // Must still be open.
            let status = self.order_status.entry(order_id).read();
            assert(status == STATUS_OPEN, 'Orderbook: order not open');

            // Mark cancelled.
            self.order_status.entry(order_id).write(STATUS_CANCELLED);

            // Return the escrowed encrypted amount to the owner.
            let side = self.order_side.entry(order_id).read();
            let ct_amount_L = self.order_ct_amount_L.entry(order_id).read();
            let ct_amount_R = self.order_ct_amount_R.entry(order_id).read();

            if side == SIDE_BUY {
                let tongo_quote = ITongoEncryptionDispatcher {
                    contract_address: self.tongo_quote.read(),
                };
                tongo_quote.confidential_transfer(owner, ct_amount_L, ct_amount_R);
            } else {
                let tongo_base = ITongoEncryptionDispatcher {
                    contract_address: self.tongo_base.read(),
                };
                tongo_base.confidential_transfer(owner, ct_amount_L, ct_amount_R);
            }

            self.emit(OrderCancelled { order_id, owner, timestamp });
        }

        // -------------------------------------------------------------------
        // match_orders()
        // -------------------------------------------------------------------
        // The admin/keeper matches a buy order with a sell order.
        //
        // Settlement logic (simplified):
        //   - The buy order's escrowed quote tokens go to the seller.
        //   - The sell order's escrowed base tokens go to the buyer.
        //
        // In production the keeper would submit a ZK proof demonstrating:
        //   1. buy_price >= sell_price  (price compatibility)
        //   2. Amounts and settlement are consistent.
        // -------------------------------------------------------------------
        fn match_orders(
            ref self: ContractState,
            buy_order_id: u64,
            sell_order_id: u64,
            ct_settlement_L: felt252,
            ct_settlement_R: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Only admin may match.
            assert(caller == self.admin.read(), 'Orderbook: caller not admin');

            // Validate order ids.
            let total_orders = self.next_order_id.read();
            assert(buy_order_id < total_orders, 'Orderbook: bad buy_order_id');
            assert(sell_order_id < total_orders, 'Orderbook: bad sell_order_id');

            // Verify sides.
            assert(
                self.order_side.entry(buy_order_id).read() == SIDE_BUY,
                'Orderbook: not a buy order',
            );
            assert(
                self.order_side.entry(sell_order_id).read() == SIDE_SELL,
                'Orderbook: not a sell order',
            );

            // Both must be open.
            assert(
                self.order_status.entry(buy_order_id).read() == STATUS_OPEN,
                'Orderbook: buy not open',
            );
            assert(
                self.order_status.entry(sell_order_id).read() == STATUS_OPEN,
                'Orderbook: sell not open',
            );

            // Mark both as filled.
            self.order_status.entry(buy_order_id).write(STATUS_FILLED);
            self.order_status.entry(sell_order_id).write(STATUS_FILLED);

            let buyer = self.order_owner.entry(buy_order_id).read();
            let seller = self.order_owner.entry(sell_order_id).read();

            // Settlement: send base tokens (seller's escrow) to the buyer.
            let sell_ct_amount_L = self.order_ct_amount_L.entry(sell_order_id).read();
            let sell_ct_amount_R = self.order_ct_amount_R.entry(sell_order_id).read();
            let tongo_base = ITongoEncryptionDispatcher {
                contract_address: self.tongo_base.read(),
            };
            tongo_base.confidential_transfer(buyer, sell_ct_amount_L, sell_ct_amount_R);

            // Settlement: send quote tokens (buyer's escrow) to the seller.
            let buy_ct_amount_L = self.order_ct_amount_L.entry(buy_order_id).read();
            let buy_ct_amount_R = self.order_ct_amount_R.entry(buy_order_id).read();
            let tongo_quote = ITongoEncryptionDispatcher {
                contract_address: self.tongo_quote.read(),
            };
            tongo_quote.confidential_transfer(seller, buy_ct_amount_L, buy_ct_amount_R);

            self.emit(OrdersMatched {
                buy_order_id,
                sell_order_id,
                ct_settlement_L,
                ct_settlement_R,
                timestamp,
            });
        }

        // -------------------------------------------------------------------
        // View helpers
        // -------------------------------------------------------------------

        fn get_order_info(
            self: @ContractState, order_id: u64,
        ) -> (ContractAddress, u8, u8, u64) {
            (
                self.order_owner.entry(order_id).read(),
                self.order_side.entry(order_id).read(),
                self.order_status.entry(order_id).read(),
                self.order_timestamp.entry(order_id).read(),
            )
        }

        fn get_order_price(self: @ContractState, order_id: u64) -> (felt252, felt252) {
            (
                self.order_ct_price_L.entry(order_id).read(),
                self.order_ct_price_R.entry(order_id).read(),
            )
        }

        fn get_order_amount(self: @ContractState, order_id: u64) -> (felt252, felt252) {
            (
                self.order_ct_amount_L.entry(order_id).read(),
                self.order_ct_amount_R.entry(order_id).read(),
            )
        }

        fn get_order_count(self: @ContractState) -> u64 {
            self.next_order_id.read()
        }

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }
}
