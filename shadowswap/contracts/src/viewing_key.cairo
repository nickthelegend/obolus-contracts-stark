// =============================================================================
// ShadowSwap :: ViewingKey
// =============================================================================
// Viewing key management for regulatory compliance and selective disclosure.
//
// In the Tongo/ElGamal model every user has a secret decryption key.  To allow
// a third party (auditor, regulator, compliance officer) to read their
// encrypted balances and transaction history, a user can derive a *viewing
// key* -- typically the decryption key re-encrypted under the auditor's
// public key -- and register it on-chain.
//
// This contract stores the mapping:
//     (owner, auditor) --> encrypted_viewing_key  (felt252 pair: L, R)
//
// The encrypted viewing key is itself an ElGamal ciphertext so that only the
// designated auditor can decrypt it.
//
// Access control:
//   - Only the owner can grant or revoke a viewing key for themselves.
//   - Any auditor can read a key that has been granted to them.
// =============================================================================

use starknet::ContractAddress;

// ---------------------------------------------------------------------------
// Public interface.
// ---------------------------------------------------------------------------
#[starknet::interface]
trait IViewingKey<TContractState> {
    /// Grant an encrypted viewing key to `auditor`.
    /// The ciphertext (ct_key_L, ct_key_R) should be the owner's decryption
    /// key re-encrypted under the auditor's public key.
    fn grant_viewing_key(
        ref self: TContractState,
        auditor: ContractAddress,
        ct_key_L: felt252,
        ct_key_R: felt252,
    );

    /// Revoke a previously granted viewing key for `auditor`.
    fn revoke_viewing_key(ref self: TContractState, auditor: ContractAddress);

    /// Retrieve the encrypted viewing key granted by `owner` to `auditor`.
    /// Returns (ct_key_L, ct_key_R, is_active).
    fn get_viewing_key(
        self: @TContractState, owner: ContractAddress, auditor: ContractAddress,
    ) -> (felt252, felt252, bool);

    /// Check whether `owner` has an active viewing key for `auditor`.
    fn has_viewing_key(
        self: @TContractState, owner: ContractAddress, auditor: ContractAddress,
    ) -> bool;

    /// Return the contract admin.
    fn get_admin(self: @TContractState) -> ContractAddress;

    /// Return the total number of grants ever issued (for indexing).
    fn get_total_grants(self: @TContractState) -> u64;
}

// ===========================================================================
// Contract implementation
// ===========================================================================
#[starknet::contract]
mod ViewingKey {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess,
        Map, StoragePathEntry,
    };

    // -----------------------------------------------------------------------
    // Storage
    // -----------------------------------------------------------------------
    // We need a two-level map: (owner, auditor) -> value.
    // In Cairo 2.x we model this with nested Map types:
    //   Map<ContractAddress, Map<ContractAddress, T>>
    // -----------------------------------------------------------------------
    #[storage]
    struct Storage {
        /// Contract admin (deployer).
        admin: ContractAddress,

        /// (owner, auditor) -> encrypted viewing key L component.
        vk_ct_L: Map<ContractAddress, Map<ContractAddress, felt252>>,
        /// (owner, auditor) -> encrypted viewing key R component.
        vk_ct_R: Map<ContractAddress, Map<ContractAddress, felt252>>,
        /// (owner, auditor) -> whether the key is currently active.
        vk_active: Map<ContractAddress, Map<ContractAddress, bool>>,

        /// Total number of grant events (monotonically increasing).
        total_grants: u64,
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ViewingKeyGranted: ViewingKeyGranted,
        ViewingKeyRevoked: ViewingKeyRevoked,
    }

    /// Emitted when an owner grants a viewing key to an auditor.
    #[derive(Drop, starknet::Event)]
    struct ViewingKeyGranted {
        #[key]
        owner: ContractAddress,
        #[key]
        auditor: ContractAddress,
        ct_key_L: felt252,
        ct_key_R: felt252,
        timestamp: u64,
    }

    /// Emitted when an owner revokes a viewing key.
    #[derive(Drop, starknet::Event)]
    struct ViewingKeyRevoked {
        #[key]
        owner: ContractAddress,
        #[key]
        auditor: ContractAddress,
        timestamp: u64,
    }

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------
    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
        self.total_grants.write(0);
    }

    // -----------------------------------------------------------------------
    // External / public functions
    // -----------------------------------------------------------------------
    #[abi(embed_v0)]
    impl ViewingKeyImpl of super::IViewingKey<ContractState> {
        // -------------------------------------------------------------------
        // grant_viewing_key()
        // -------------------------------------------------------------------
        // The caller (owner) encrypts their Tongo decryption key under the
        // auditor's public key and stores the resulting ciphertext on-chain.
        // This allows the auditor to later decrypt the owner's encrypted
        // balances and transfers for compliance review.
        // -------------------------------------------------------------------
        fn grant_viewing_key(
            ref self: ContractState,
            auditor: ContractAddress,
            ct_key_L: felt252,
            ct_key_R: felt252,
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Store the encrypted viewing key.
            self.vk_ct_L.entry(caller).entry(auditor).write(ct_key_L);
            self.vk_ct_R.entry(caller).entry(auditor).write(ct_key_R);
            self.vk_active.entry(caller).entry(auditor).write(true);

            // Increment grant counter.
            let count = self.total_grants.read();
            self.total_grants.write(count + 1);

            self.emit(ViewingKeyGranted {
                owner: caller,
                auditor,
                ct_key_L,
                ct_key_R,
                timestamp,
            });
        }

        // -------------------------------------------------------------------
        // revoke_viewing_key()
        // -------------------------------------------------------------------
        // The owner deactivates the viewing key.  The ciphertext is zeroed
        // out so the auditor can no longer retrieve it.  Note that the
        // auditor may have already copied the key off-chain; revocation
        // only prevents future on-chain retrieval.  For stronger revocation
        // the owner would rotate their Tongo encryption key.
        // -------------------------------------------------------------------
        fn revoke_viewing_key(ref self: ContractState, auditor: ContractAddress) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            // Ensure there is an active key to revoke.
            let is_active = self.vk_active.entry(caller).entry(auditor).read();
            assert(is_active, 'ViewingKey: no active key');

            // Clear the stored ciphertext and mark inactive.
            self.vk_ct_L.entry(caller).entry(auditor).write(0);
            self.vk_ct_R.entry(caller).entry(auditor).write(0);
            self.vk_active.entry(caller).entry(auditor).write(false);

            self.emit(ViewingKeyRevoked { owner: caller, auditor, timestamp });
        }

        // -------------------------------------------------------------------
        // get_viewing_key()
        // -------------------------------------------------------------------
        // Returns the encrypted viewing key and its active status.
        // In a stricter design we could restrict this to only the auditor
        // themselves, but since the key is encrypted under the auditor's
        // public key, anyone reading it gains no information.
        // -------------------------------------------------------------------
        fn get_viewing_key(
            self: @ContractState, owner: ContractAddress, auditor: ContractAddress,
        ) -> (felt252, felt252, bool) {
            let ct_L = self.vk_ct_L.entry(owner).entry(auditor).read();
            let ct_R = self.vk_ct_R.entry(owner).entry(auditor).read();
            let active = self.vk_active.entry(owner).entry(auditor).read();
            (ct_L, ct_R, active)
        }

        // -------------------------------------------------------------------
        // has_viewing_key()
        // -------------------------------------------------------------------
        fn has_viewing_key(
            self: @ContractState, owner: ContractAddress, auditor: ContractAddress,
        ) -> bool {
            self.vk_active.entry(owner).entry(auditor).read()
        }

        // -------------------------------------------------------------------
        // View helpers
        // -------------------------------------------------------------------

        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_total_grants(self: @ContractState) -> u64 {
            self.total_grants.read()
        }
    }
}
