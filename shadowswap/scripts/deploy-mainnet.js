/**
 * Deploy Tongo instances on Starknet Mainnet
 * Usage: PRIVATE_KEY=0x... node scripts/deploy-mainnet.js
 */
const { RpcProvider, Account, hash } = require("starknet");

const RPC_URL = "https://starknet-rpc.publicnode.com";
const ACCOUNT_ADDRESS = "0x013221b418c779b5fbeab1dc0c08fc47e268bc0c2bd5cba6572cb7189ff5bf1e";
const TONGO_CLASS_HASH = "0x00582609087e5aeb75dc25284cf954e2cee6974568d1b5636052a9d36eec672a";

const TOKENS = {
  ETH: {
    erc20: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    rate_low: "0x2BA7DEF3000", // 3000000000000
    rate_high: "0x0",
    bit_size: "0x28", // 40
  },
  USDC: {
    erc20: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
    rate_low: "0x2710", // 10000
    rate_high: "0x0",
    bit_size: "0x28",
  },
  STRK: {
    erc20: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    rate_low: "0xB1A2BC2EC50000", // 50000000000000000
    rate_high: "0x0",
    bit_size: "0x28",
  },
};

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) { console.error("Set PRIVATE_KEY env var"); process.exit(1); }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({ provider, address: ACCOUNT_ADDRESS, signer: privateKey });
  console.log("Account:", ACCOUNT_ADDRESS);

  const deployed = {};

  for (const [symbol, token] of Object.entries(TOKENS)) {
    console.log(`\n=== Deploying Tongo ${symbol} ===`);

    // Raw constructor calldata: owner, ERC20, rate(u256: low,high), bit_size(u32), auditor_key(Option::None = 0)
    const constructorCalldata = [
      ACCOUNT_ADDRESS,       // owner
      token.erc20,           // ERC20
      token.rate_low,        // rate.low
      token.rate_high,       // rate.high
      token.bit_size,        // bit_size
      "0x1",                 // Option::None for auditor_key (None is variant index 1)
    ];

    // Unique salt per token
    const salt = "0x" + Buffer.from(symbol + "_shadowswap_v1").toString("hex");

    try {
      const deployResult = await account.deployContract({
        classHash: TONGO_CLASS_HASH,
        constructorCalldata,
        salt,
      });

      console.log(`  TX: ${deployResult.transaction_hash}`);
      console.log(`  Waiting for confirmation...`);
      await provider.waitForTransaction(deployResult.transaction_hash);

      const address = deployResult.contract_address;
      console.log(`  Tongo ${symbol}: ${address}`);
      deployed[symbol] = { tongo: address, erc20: token.erc20 };
    } catch (err) {
      console.error(`  FAILED:`, err.message ? err.message.slice(0, 500) : err);
    }
  }

  console.log("\n\n=== RESULTS ===");
  console.log(JSON.stringify(deployed, null, 2));

  require("fs").writeFileSync(
    "c:/Users/Asus/Desktop/STARKPrivacy/shadowswap/scripts/mainnet-addresses.json",
    JSON.stringify(deployed, null, 2)
  );
  console.log("Saved to scripts/mainnet-addresses.json");
}

main().catch(console.error);
