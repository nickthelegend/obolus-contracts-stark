use starknet::ContractAddress;

#[starknet::interface]
pub trait IObolusOracle<TContractState> {
    fn set_price(ref self: TContractState, asset_id: felt252, price: u128);
    fn get_price(self: @TContractState, asset_id: felt252) -> u128;
}

#[starknet::contract]
mod ObolusOracle {
    use starknet::{ContractAddress, get_caller_address};
    use super::IObolusOracle;

    #[storage]
    struct Storage {
        prices: LegacyMap<felt252, u128>,  // asset_id → price (scaled 1e6)
        operator: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, operator: ContractAddress) {
        self.operator.write(operator);
    }

    #[abi(embed_v0)]
    impl ObolusOracleImpl of IObolusOracle<ContractState> {
        fn set_price(ref self: ContractState, asset_id: felt252, price: u128) {
            let caller = get_caller_address();
            assert(caller == self.operator.read(), 'Only operator can set price');
            self.prices.write(asset_id, price);
        }

        fn get_price(self: @ContractState, asset_id: felt252) -> u128 {
            self.prices.read(asset_id)
        }
    }
}
