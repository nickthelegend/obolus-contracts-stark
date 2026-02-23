import { Account, ProviderInterface, CallData } from "starknet";

const OBOLUS_PERP_ADDRESS = process.env.NEXT_PUBLIC_PERP_CONTRACT || "";
const ORACLE_ADDRESS = process.env.NEXT_PUBLIC_ORACLE_CONTRACT || "";

export async function openPosition(
  account: Account,
  size: bigint,        // positive = long, negative = short
  leverage: number,    
  collateral: bigint,  // USDC in base units (e.g. 1000000 for 1 USDC)
) {
  return account.execute([
    {
      contractAddress: OBOLUS_PERP_ADDRESS,
      entrypoint: "deposit_collateral",
      calldata: CallData.compile([collateral.toString()])
    },
    {
      contractAddress: OBOLUS_PERP_ADDRESS,
      entrypoint: "open_position",
      calldata: CallData.compile([
        size.toString(), 
        leverage.toString(), 
        collateral.toString()
      ])
    }
  ]);
}

export async function closePosition(account: Account, positionId: number) {
  return account.execute([{
    contractAddress: OBOLUS_PERP_ADDRESS,
    entrypoint: "close_position",
    calldata: CallData.compile([positionId.toString()])
  }]);
}

export async function getPosition(provider: any, positionId: number) {
  return provider.callContract({
    contractAddress: OBOLUS_PERP_ADDRESS,
    entrypoint: "get_position",
    calldata: CallData.compile([positionId.toString()])
  });
}

export async function getMarkPrice(provider: any, assetId: string) {
  return provider.callContract({
    contractAddress: ORACLE_ADDRESS,
    entrypoint: "get_price",
    calldata: CallData.compile([assetId])
  });
}

export async function getPnL(provider: any, positionId: number): Promise<bigint> {
  const res = await provider.callContract({
    contractAddress: OBOLUS_PERP_ADDRESS,
    entrypoint: "get_pnl",
    calldata: CallData.compile([positionId.toString()])
  });
  return BigInt(res.result[0]);
}

export async function getCollateralBalance(provider: any, address: string): Promise<bigint> {
  const res = await provider.callContract({
    contractAddress: OBOLUS_PERP_ADDRESS,
    entrypoint: "get_collateral_balance",
    calldata: CallData.compile([address])
  });
  return BigInt(res.result[0]);
}

export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  isLong: boolean,
  maintenanceMarginRatio: number = 0.05
): number {
  if (isLong) {
    return entryPrice * (1 - 1/leverage + maintenanceMarginRatio);
  } else {
    return entryPrice * (1 + 1/leverage - maintenanceMarginRatio);
  }
}
