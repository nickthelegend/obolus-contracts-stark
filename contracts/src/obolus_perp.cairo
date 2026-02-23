use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct Position {
    pub owner: ContractAddress,
    pub size: i128,          // positive = long, negative = short
    pub entry_price: u128,   // scaled by 1e6
    pub collateral: u128,    // USDC scaled by 1e6
    pub last_funding: u64,   // timestamp
    pub is_open: bool,
}

#[starknet::interface]
pub trait IObolusPerpTrait<TContractState> {
    // Collateral management
    fn deposit_collateral(ref self: TContractState, amount: u128);
    fn withdraw_collateral(ref self: TContractState, amount: u128);
    
    // Trading
    fn open_position(
        ref self: TContractState, 
        size: i128,          // positive = long, negative = short
        leverage: u128,      // e.g. 10 = 10x
        collateral: u128,    // USDC amount
    );
    fn close_position(ref self: TContractState, position_id: u64);
    fn liquidate_position(ref self: TContractState, position_id: u64);
    
    // Views
    fn get_position(self: @TContractState, position_id: u64) -> Position;
    fn get_mark_price(self: @TContractState, asset: ContractAddress) -> u128; // Dummy asset for now
    fn get_price_by_id(self: @TContractState, asset_id: felt252) -> u128;
    fn is_liquidatable(self: @TContractState, position_id: u64) -> bool;
    fn get_pnl(self: @TContractState, position_id: u64) -> i128;
    fn get_collateral_balance(self: @TContractState, owner: ContractAddress) -> u128;
}

#[starknet::contract]
mod ObolusPerp {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use super::{Position, IObolusPerpTrait};
    use core::integer::BoundedInt;
    use core::num::traits::Zero;
    
    // Interface for Oracle
    #[starknet::interface]
    trait IOracle<T> {
        fn get_price(self: @T, asset_id: felt252) -> u128;
    }

    #[storage]
    struct Storage {
        positions: LegacyMap<u64, Position>,
        position_count: u64,
        owner_position: LegacyMap<ContractAddress, u64>,
        collateral_balance: LegacyMap<ContractAddress, u128>,
        operator: ContractAddress,
        oracle: ContractAddress,
        collateral_token: ContractAddress,
        initial_margin_ratio: u128,      // e.g. 1000 = 10% (basis points)
        maintenance_margin_ratio: u128,  // e.g. 500 = 5%
        liquidation_penalty: u128,       // e.g. 200 = 2%
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        PositionOpened: PositionOpened,
        PositionClosed: PositionClosed,
        PositionLiquidated: PositionLiquidated,
        CollateralDeposited: CollateralDeposited,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionOpened {
        #[key]
        owner: ContractAddress,
        position_id: u64,
        size: i128,
        entry_price: u128,
        collateral: u128,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionClosed {
        #[key]
        owner: ContractAddress,
        position_id: u64,
        pnl: i128,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionLiquidated {
        #[key]
        owner: ContractAddress,
        position_id: u64,
        liquidator: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CollateralDeposited {
        #[key]
        owner: ContractAddress,
        amount: u128,
    }

    const PRICE_SCALE: u128 = 1000000; // 1e6

    #[constructor]
    fn constructor(
        ref self: ContractState,
        operator: ContractAddress,
        oracle: ContractAddress,
        collateral_token: ContractAddress,
    ) {
        self.operator.write(operator);
        self.oracle.write(oracle);
        self.collateral_token.write(collateral_token);
        self.initial_margin_ratio.write(1000); // 10%
        self.maintenance_margin_ratio.write(500); // 5%
        self.liquidation_penalty.write(200); // 2%
    }

    #[abi(embed_v0)]
    impl ObolusPerpImpl of IObolusPerpTrait<ContractState> {
        fn deposit_collateral(ref self: ContractState, amount: u128) {
            let caller = get_caller_address();
            let current = self.collateral_balance.read(caller);
            self.collateral_balance.write(caller, current + amount);
            self.emit(CollateralDeposited { owner: caller, amount });
        }

        fn withdraw_collateral(ref self: ContractState, amount: u128) {
            let caller = get_caller_address();
            let current = self.collateral_balance.read(caller);
            assert(current >= amount, 'Insufficient collateral');
            self.collateral_balance.write(caller, current - amount);
        }

        fn open_position(
            ref self: ContractState, 
            size: i128, 
            leverage: u128, 
            collateral: u128
        ) {
            assert(size != 0, 'Size cannot be zero');
            assert(collateral > 0, 'Collateral cannot be zero');
            
            let caller = get_caller_address();
            let user_balance = self.collateral_balance.read(caller);
            assert(user_balance >= collateral, 'Insufficient balance');

            // Default asset for now 'ETH-USD'
            let mark_price = IOracleDispatcher { contract_address: self.oracle.read() }.get_price('ETH-USD');
            
            // Calculate required margin = abs(size) * mark_price / leverage
            let abs_size = if size < 0 { (-size).try_into().unwrap() } else { size.try_into().unwrap() };
            let position_value = (abs_size * mark_price) / PRICE_SCALE;
            let required_margin = position_value / leverage;
            
            assert(collateral >= required_margin, 'Insufficient margin');

            // Deduct from balance and lock in position
            self.collateral_balance.write(caller, user_balance - collateral);

            let position_id = self.position_count.read() + 1;
            let position = Position {
                owner: caller,
                size,
                entry_price: mark_price,
                collateral,
                last_funding: get_block_timestamp(),
                is_open: true,
            };

            self.positions.write(position_id, position);
            self.position_count.write(position_id);
            self.owner_position.write(caller, position_id);

            self.emit(PositionOpened {
                owner: caller,
                position_id,
                size,
                entry_price: mark_price,
                collateral
            });
        }

        fn close_position(ref self: ContractState, position_id: u64) {
            let mut position = self.positions.read(position_id);
            assert(position.is_open, 'Position not open');
            
            let caller = get_caller_address();
            assert(position.owner == caller, 'Not owner');

            let mark_price = IOracleDispatcher { contract_address: self.oracle.read() }.get_price('ETH-USD');
            let pnl = self._calculate_pnl(@position, mark_price);
            
            // Return collateral + pnl
            let refund = if pnl >= 0 {
                position.collateral + pnl.try_into().unwrap()
            } else {
                let abs_pnl: u128 = (-pnl).try_into().unwrap();
                if abs_pnl >= position.collateral { 0 } else { position.collateral - abs_pnl }
            };

            let current_balance = self.collateral_balance.read(caller);
            self.collateral_balance.write(caller, current_balance + refund);

            position.is_open = false;
            self.positions.write(position_id, position);
            self.owner_position.write(caller, 0);

            self.emit(PositionClosed { owner: caller, position_id, pnl });
        }

        fn liquidate_position(ref self: ContractState, position_id: u64) {
            assert(self.is_liquidatable(position_id), 'Not liquidatable');
            
            let mut position = self.positions.read(position_id);
            let liquidator = get_caller_address();
            
            // Penalty calculation
            let penalty = (position.collateral * self.liquidation_penalty.read()) / 10000;
            
            // Pay liquidator
            let liquidator_balance = self.collateral_balance.read(liquidator);
            self.collateral_balance.write(liquidator, liquidator_balance + penalty);
            
            // Return remaining to owner (if any)
            let remaining = position.collateral - penalty;
            let owner_balance = self.collateral_balance.read(position.owner);
            self.collateral_balance.write(position.owner, owner_balance + remaining);

            position.is_open = false;
            self.positions.write(position_id, position);
            self.owner_position.write(position.owner, 0);

            self.emit(PositionLiquidated { owner: position.owner, position_id, liquidator });
        }

        fn get_position(self: @ContractState, position_id: u64) -> Position {
            self.positions.read(position_id)
        }

        fn get_mark_price(self: @ContractState, asset: ContractAddress) -> u128 {
            IOracleDispatcher { contract_address: self.oracle.read() }.get_price('ETH-USD')
        }

        fn get_price_by_id(self: @ContractState, asset_id: felt252) -> u128 {
            IOracleDispatcher { contract_address: self.oracle.read() }.get_price(asset_id)
        }

        fn is_liquidatable(self: @ContractState, position_id: u64) -> bool {
            let position = self.positions.read(position_id);
            if !position.is_open { return false; }
            
            let mark_price = IOracleDispatcher { contract_address: self.oracle.read() }.get_price('ETH-USD');
            let pnl = self._calculate_pnl(@position, mark_price);
            
            let account_value = if pnl >= 0 {
                (position.collateral.into() + pnl)
            } else {
                (position.collateral.into() + pnl)
            };

            let abs_size = if position.size < 0 { (-position.size).try_into().unwrap() } else { position.size.try_into().unwrap() };
            let maintenance_margin = (abs_size * mark_price * self.maintenance_margin_ratio.read()) / (10000 * PRICE_SCALE);
            
            account_value < maintenance_margin.into()
        }

        fn get_pnl(self: @ContractState, position_id: u64) -> i128 {
            let position = self.positions.read(position_id);
            if !position.is_open { return 0; }
            let mark_price = IOracleDispatcher { contract_address: self.oracle.read() }.get_price('ETH-USD');
            self._calculate_pnl(@position, mark_price)
        }

        fn get_collateral_balance(self: @ContractState, owner: ContractAddress) -> u128 {
            self.collateral_balance.read(owner)
        }
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn _calculate_pnl(self: @ContractState, position: @Position, mark_price: u128) -> i128 {
            let entry_price = *position.entry_price;
            let size = *position.size;
            
            if size > 0 {
                // Long: (mark - entry) * size / scale
                let diff = if mark_price >= entry_price {
                    let d: i128 = (mark_price - entry_price).into();
                    d * size / PRICE_SCALE.into()
                } else {
                    let d: i128 = (entry_price - mark_price).into();
                    -(d * size / PRICE_SCALE.into())
                };
                diff
            } else {
                // Short: (entry - mark) * abs(size) / scale
                let abs_size = -size;
                let diff = if entry_price >= mark_price {
                    let d: i128 = (entry_price - mark_price).into();
                    d * abs_size / PRICE_SCALE.into()
                } else {
                    let d: i128 = (mark_price - entry_price).into();
                    -(d * abs_size / PRICE_SCALE.into())
                };
                diff
            }
        }
    }
}
