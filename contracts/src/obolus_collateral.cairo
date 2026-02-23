use starknet::ContractAddress;

#[starknet::interface]
pub trait IObolusCollateral<TContractState> {
    fn deposit(
        ref self: TContractState, 
        tongo_proof: Array<felt252>, 
        encrypted_amount: (felt252, felt252)
    );
    fn withdraw(
        ref self: TContractState, 
        amount: u128, 
        tongo_proof: Array<felt252>
    );
    fn get_balance(self: @TContractState, user: ContractAddress) -> u128;
}

#[starknet::contract]
mod ObolusCollateral {
    use starknet::{ContractAddress, get_caller_address};
    use super::IObolusCollateral;

    #[storage]
    struct Storage {
        balances: LegacyMap<ContractAddress, u128>,
        tongo_verifier: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, tongo_verifier: ContractAddress) {
        self.tongo_verifier.write(tongo_verifier);
    }

    #[abi(embed_v0)]
    impl ObolusCollateralImpl of IObolusCollateral<ContractState> {
        fn deposit(
            ref self: ContractState, 
            tongo_proof: Array<felt252>, 
            encrypted_amount: (felt252, felt252)
        ) {
            let caller = get_caller_address();
            // Simulation logic for Tongo:
            // In a real scenario, the proof verifies the encrypted amount matches a real deposit.
            // For the hackathon demo, we'll increment by a fixed amount or simulate success.
            let simulated_amount: u128 = 100000000; // 100 USDC (6 decimals)
            let current_balance = self.balances.read(caller);
            self.balances.write(caller, current_balance + simulated_amount);
        }

        fn withdraw(
            ref self: ContractState, 
            amount: u128, 
            tongo_proof: Array<felt252>
        ) {
            let caller = get_caller_address();
            let current_balance = self.balances.read(caller);
            assert(current_balance >= amount, 'Insufficient balance');
            self.balances.write(caller, current_balance - amount);
        }

        fn get_balance(self: @ContractState, user: ContractAddress) -> u128 {
            self.balances.read(user)
        }
    }
}
