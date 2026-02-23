/**
 * Declare + Deploy ShadowSwap contracts on Starknet Mainnet
 * Usage: PRIVATE_KEY=0x... node scripts/deploy-shadowswap.js
 */
const { RpcProvider, Account, json } = require("starknet");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://starknet-rpc.publicnode.com";
const ACCOUNT_ADDRESS = "0x013221b418c779b5fbeab1dc0c08fc47e268bc0c2bd5cba6572cb7189ff5bf1e";

// Tongo addresses just deployed
const TONGO = {
  ETH: "0x16e725480f29ff810cff2df54228b7b130984ec3e03fec6dfcdfa757838cec1",
  USDC: "0x38bc52475211bc46b6454dca6966003d38b4c2ba49e6c5295342bdd6f9eb715",
  STRK: "0x7cd6c0942292823cf6674c64c8ebceff35556cf02f8c0a7bd7d9a8d722b961c",
};

const CONTRACTS_DIR = path.join(__dirname, "..", "contracts", "target", "dev");

const CONTRACTS = [
  {
    name: "ViewingKey",
    file: "shadowswap_ViewingKey.contract_class.json",
    constructorCalldata: [ACCOUNT_ADDRESS], // admin
  },
  {
    name: "SealedOrderbook",
    file: "shadowswap_SealedOrderbook.contract_class.json",
    constructorCalldata: [ACCOUNT_ADDRESS, TONGO.ETH, TONGO.USDC], // admin, tongo_base, tongo_quote
  },
  {
    name: "ShadowPool",
    file: "shadowswap_ShadowPool.contract_class.json",
    constructorCalldata: [ACCOUNT_ADDRESS, TONGO.ETH, TONGO.USDC], // admin, tongo_a, tongo_b
  },
  {
    name: "ConfidentialToken",
    file: "shadowswap_ConfidentialToken.contract_class.json",
    constructorCalldata: [
      ACCOUNT_ADDRESS, // owner
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7", // underlying ETH
      TONGO.ETH, // tongo_contract
    ],
  },
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) { console.error("Set PRIVATE_KEY"); process.exit(1); }

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account({ provider, address: ACCOUNT_ADDRESS, signer: privateKey });

  const results = {};

  for (const contract of CONTRACTS) {
    console.log(`\n=== ${contract.name} ===`);
    const sierraPath = path.join(CONTRACTS_DIR, contract.file);

    if (!fs.existsSync(sierraPath)) {
      console.log(`  File not found: ${sierraPath}`);
      continue;
    }

    const sierra = json.parse(fs.readFileSync(sierraPath, "utf8"));
    const casmPath = sierraPath.replace(".contract_class.json", ".compiled_contract_class.json");
    const casm = json.parse(fs.readFileSync(casmPath, "utf8"));

    // Step 1: Declare
    console.log("  Declaring...");
    let classHash;
    try {
      const declareResult = await account.declare({ contract: sierra, casm });
      classHash = declareResult.class_hash;
      console.log(`  Class hash: ${classHash}`);
      console.log(`  Waiting for declare TX...`);
      await provider.waitForTransaction(declareResult.transaction_hash);
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes("already declared") || msg.includes("CLASS_ALREADY_DECLARED")) {
        console.log("  Already declared, computing hash...");
        const { hash: hashModule } = require("starknet");
        classHash = hashModule.computeSierraContractClassHash(sierra);
        console.log(`  Class hash: ${classHash}`);
      } else {
        console.error(`  Declare failed:`, msg.slice(0, 500));
        continue;
      }
    }

    // Step 2: Deploy
    console.log("  Deploying...");
    try {
      const salt = "0x" + Buffer.from(contract.name + "_v1").toString("hex");
      const deployResult = await account.deployContract({
        classHash,
        constructorCalldata: contract.constructorCalldata,
        salt,
      });
      console.log(`  TX: ${deployResult.transaction_hash}`);
      console.log(`  Waiting...`);
      await provider.waitForTransaction(deployResult.transaction_hash);
      console.log(`  ${contract.name}: ${deployResult.contract_address}`);
      results[contract.name] = deployResult.contract_address;
    } catch (err) {
      console.error(`  Deploy failed:`, (err.message || String(err)).slice(0, 400));
    }
  }

  console.log("\n\n=== SHADOWSWAP CONTRACTS ===");
  console.log(JSON.stringify(results, null, 2));

  // Merge with tongo addresses
  const addresses = JSON.parse(fs.readFileSync(path.join(__dirname, "mainnet-addresses.json"), "utf8"));
  addresses.shadowswap = results;
  fs.writeFileSync(path.join(__dirname, "mainnet-addresses.json"), JSON.stringify(addresses, null, 2));
  console.log("Updated mainnet-addresses.json");
}

main().catch(console.error);
