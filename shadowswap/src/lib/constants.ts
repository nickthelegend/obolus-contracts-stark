export const NETWORKS = {
  mainnet: {
    name: "Starknet Mainnet",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://starknet-rpc.publicnode.com",
    explorerUrl: "https://starkscan.co",
    tokens: {
      ETH: {
        symbol: "ETH",
        name: "Ethereum",
        decimals: 18,
        erc20: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        tongo: "0x16e725480f29ff810cff2df54228b7b130984ec3e03fec6dfcdfa757838cec1",
        rate: 3000000000000n,
      },
      USDC: {
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        erc20: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
        tongo: "0x38bc52475211bc46b6454dca6966003d38b4c2ba49e6c5295342bdd6f9eb715",
        rate: 10000n,
      },
      STRK: {
        symbol: "STRK",
        name: "Starknet Token",
        decimals: 18,
        erc20: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        tongo: "0x7cd6c0942292823cf6674c64c8ebceff35556cf02f8c0a7bd7d9a8d722b961c",
        rate: 50000000000000000n,
      },
    },
  },
} as const;

export type TokenSymbol = "ETH" | "USDC" | "STRK";
export type TokenConfig = (typeof NETWORKS.mainnet.tokens)[TokenSymbol];

export const TONGO_CLASS_HASH = "0x00582609087e5aeb75dc25284cf954e2cee6974568d1b5636052a9d36eec672a";

// ShadowSwap contracts on mainnet
export const SHADOWSWAP_CONTRACTS = {
  ViewingKey: "0x741a71b89faf037e9a45580d6b9f3baf69eb0f1ab3df8b29d6030e0acc20376",
  SealedOrderbook: "0xd98ff31d79bd4b4911f7c3eee2d310e62ca11cebc455b29e5af258748b1701",
  ShadowPool: "0x73d77872649dfe9cb4264c3675db1bf8083bf738da5f2b0de06eb905b3949fc",
  ConfidentialToken: "0x27812a371d7ea2ed17f712ea186ab1d4ef2a89db543937e982e721a5bde9ef0",
} as const;

export const getNetwork = () => NETWORKS.mainnet;
export const getToken = (symbol: TokenSymbol) => NETWORKS.mainnet.tokens[symbol];
export const getExplorerTxUrl = (hash: string) => `${NETWORKS.mainnet.explorerUrl}/tx/${hash}`;
export const getExplorerContractUrl = (addr: string) => `${NETWORKS.mainnet.explorerUrl}/contract/${addr}`;
