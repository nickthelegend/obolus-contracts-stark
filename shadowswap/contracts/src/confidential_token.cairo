// =============================================================================
// ShadowSwap :: ConfidentialToken
// =============================================================================
// A wrapper contract around Tongo's ElGamal-encrypted token system.
//
// Architecture overview:
//   ERC-20 (plaintext) <--fund/withdraw--> Tongo (encrypted) <---> ShadowSwap
//
// Every user balance is stored as an ElGamal ciphertext (L, R) on Tongo.
// This contract provides a higher-level interface that delegates the actual
// encryption/decryption bookkeeping to the Tongo contract while tracking
// ownership and emitting ShadowSwap-specific events.
// =============================================================================

use starknet::ContractAddress;

// ---------------------------------------------------------------------------
// External interface of the Tongo encryption contract (subset we depend on).
// In production the full ABI would be imported from the Tongo package.
// ---------------------------------------------------------------------------
#[starknet::interface]
trait ITongoEncryption<TContractState> {
    /// Deposit `amount` of the underlying ERC-20 into Tongo, receiving an
    /// encrypted balance credited to `recipient`.
    fn fund(ref self: TContractState, recipient: ContractAddress, amount: u256);

    /// Burn the encrypted balance and release `amount` of the underlying
    /// ERC-20 back to `recipient`.  Caller must have previously decrypted
    /// and proven the amount via a ZK proof (handled inside Tongo).
    fn withdraw(ref self: TContractState, recipient: ContractAddress, amount: u256);

    /// Transfer an encrypted amount from the caller to `to`.
    /// (ct_amount_L, ct_amount_R) is the ElGamal ciphertext of the amount.
    fn confidential_transfer(
        ref self: TContractState,
        to: ContractAddress,
        ct_amount_L: felt252,
        ct_amount_R: felt252,
    );

    /// Consolidate any pending (received) encrypted balances into the
    /// caller's main encrypted balance.  Tongo uses a two-phase model so
    /// that senders cannot front-run recipients.
    fn rollover(ref self: TContractState);
}

// ---------------------------------------------------------------------------
// Minimal ERC-20 interface (approve + transferFrom used during fund).
// ---------------------------------------------------------------------------
#[starknet::interface]
trait IERC20<TContractState> {
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
}

// ---------------------------------------------------------------------------
// Public interface of this wrapper contract.
// ---------------------------------------------------------------------------
#[starknet::interface]
trait IConfidentialToken<TContractState> {
    /// Deposit ERC-20 tokens and convert them into an encrypted Tongo balance.
    fn fund(ref self: TContractState, amount: u256);

    /// Withdraw encrypted balance back to plaintext ERC-20 tokens.
    fn withdraw(ref self: TContractState, amount: u256);

    /// Transfer an encrypted amount to another user (ciphertext stays encrypted).
    fn confidential_transfer(
        ref self: TContractState,
        to: ContractAddress,
        ct_amount_L: felt252,
        ct_amount_R: felt252,
    );

    /// Consolidate pending encrypted balances into the caller's main balance.
    fn rollover(ref self: TContractState);

    // -- View functions ------------------------------------------------------

    /// Return the address of the underlying ERC-20 token.
    fn get_underlying_token(self: @TContractState) -> ContractAddress;

    /// Return the address of the Tongo encryption contract.
    fn get_tongo_contract(self: @TContractState) -> ContractAddress;

    /// Return the contract owner.
    fn get_owner(self: @TContractState) -> ContractAddress;
}

// ===========================================================================
// Contract implementation
// ===========================================================================
#[starknet::contract]
mod ConfidentialToken {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::{
        ITongoEncryptionDispatcher, ITongoEncryptionDispatcherTrait,
        IERC20Dispatcher, IERC20DispatcherTrait,
    };

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------
    #[storage]
    struct Storage {
        /// Contract owner / deployer.
        owner: ContractAddress,
        /// Address of the underlying ERC-20 token (e.g. USDC, ETH wrapper).
        underlying_token: ContractAddress,
        /// Address of the Tongo ElGamal encryption contract for this token.
        tongo_contract: ContractAddress,
        /// Running nonce used for unique event identification.
        nonce: u64,
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Funded: Funded,
        Withdrawn: Withdrawn,
        ConfidentialTransfer: ConfidentialTransfer,
        RolledOver: RolledOver,
    }

    /// Emitted when a user deposits ERC-20 tokens into the encrypted domain.
    #[derive(Drop, starknet::Event)]
    struct Funded {
        #[key]
        user: ContractAddress,
        amount: u256,
        timestamp: u64,
    }

    /// Emitted when a user withdraws encrypted balance back to ERC-20.
    #[derive(Drop, starknet::Event)]
    struct Withdrawn {
        #[key]
        user: ContractAddress,
        amount: u256,
        timestamp: u64,
    }

    /// Emitted on every confidential (encrypted) transfer.
    /// The ciphertext components are logged so indexers can track activity
    /// without learning the plaintext amounts.
    #[derive(Drop, starknet::Event)]
    struct ConfidentialTransfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        ct_amount_L: felt252,
        ct_amount_R: felt252,
        timestamp: u64,
    }

    /// Emitted when a user consolidates pending balances.
    #[derive(Drop, starknet::Event)]
    struct RolledOver {
        #[key]
        user: ContractAddress,
        timestamp: u64,
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        underlying_token: ContractAddress,
        tongo_contract: ContractAddress,
    ) {
        self.owner.write(owner);
        self.underlying_token.write(underlying_token);
        self.tongo_contract.write(tongo_contract);
        self.nonce.write(0);
    }

    // -----------------------------------------------------------------------
    // External / public functions
    // -----------------------------------------------------------------------
    #[abi(embed_v0)]
    impl ConfidentialTokenImpl of super::IConfidentialToken<ContractState> {
        // -------------------------------------------------------------------
        // fund()
        // -------------------------------------------------------------------
        // 1. Transfer ERC-20 tokens from the caller to this contract.
        // 2. Approve the Tongo contract to spend them.
        // 3. Call Tongo.fund() which locks the tokens and credits an
        //    encrypted balance to the caller.
        // -------------------------------------------------------------------
        fn fund(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            let this_contract = starknet::get_contract_address();
            let timestamp = get_block_timestamp();

            // Pull ERC-20 tokens from the caller into this contract.
            let erc20 = IERC20Dispatcher {
                contract_address: self.underlying_token.read(),
            };
            erc20.transfer_from(caller, this_contract, amount);

            // Approve Tongo to spend the tokens on behalf of this contract.
            let tongo_addr = self.tongo_contract.read();
            erc20.approve(tongo_addr, amount);

            // Delegate to Tongo – the encrypted balance is credited to the caller.
            let tongo = ITongoEncryptionDispatcher { contract_address: tongo_addr };
            tongo.fund(caller, amount);

            // Increment nonce and emit event.
            let current_nonce = self.nonce.read();
            self.nonce.write(current_nonce + 1);

            self.emit(Funded { user: caller, amount, timestamp });
        }

        // -------------------------------------------------------------------
        // withdraw()
        // -------------------------------------------------------------------
        // The user must have already performed any required ZK proof of
        // decryption on the Tongo side.  This call releases plaintext ERC-20
        // tokens back to the caller.
        // -------------------------------------------------------------------
        fn withdraw(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let tongo = ITongoEncryptionDispatcher {
                contract_address: self.tongo_contract.read(),
            };
            tongo.withdraw(caller, amount);

            let current_nonce = self.nonce.read();
            self.nonce.write(current_nonce + 1);

            self.emit(Withdrawn { user: caller, amount, timestamp });
        }

        // -------------------------------------------------------------------
        // confidential_transfer()
        // -------------------------------------------------------------------
        // Transfer an ElGamal-encrypted amount to `to`.
        // (ct_amount_L, ct_amount_R) represents the ciphertext.
        // -------------------------------------------------------------------
        fn confidential_transfer(
            ref self: ContractState,
            to: ContractAddress,
            ct_amount_L: felt252,
            ct_amount_R: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let tongo = ITongoEncryptionDispatcher {
                contract_address: self.tongo_contract.read(),
            };
            tongo.confidential_transfer(to, ct_amount_L, ct_amount_R);

            let current_nonce = self.nonce.read();
            self.nonce.write(current_nonce + 1);

            self.emit(ConfidentialTransfer {
                from: caller,
                to,
                ct_amount_L,
                ct_amount_R,
                timestamp,
            });
        }

        // -------------------------------------------------------------------
        // rollover()
        // -------------------------------------------------------------------
        // Consolidate pending encrypted balances.  Tongo uses a two-phase
        // approach: incoming transfers land in a "pending" slot and must be
        // rolled over into the main balance before they can be spent.
        // -------------------------------------------------------------------
        fn rollover(ref self: ContractState) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            let tongo = ITongoEncryptionDispatcher {
                contract_address: self.tongo_contract.read(),
            };
            tongo.rollover();

            self.emit(RolledOver { user: caller, timestamp });
        }

        // -------------------------------------------------------------------
        // View helpers
        // -------------------------------------------------------------------
        fn get_underlying_token(self: @ContractState) -> ContractAddress {
            self.underlying_token.read()
        }

        fn get_tongo_contract(self: @ContractState) -> ContractAddress {
            self.tongo_contract.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }
}
