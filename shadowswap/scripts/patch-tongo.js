/**
 * Patch Tongo SDK and SHE library to fix:
 * 1. BigInt type coercion issues in poseidonHashMany calls
 * 2. Broken require("../../src/utils") paths in dist/provers/ files
 *
 * Run automatically via "postinstall" in package.json.
 */
const fs = require("fs");
const path = require("path");

const tongoSdk = path.join(__dirname, "..", "node_modules", "@fatsolutions", "tongo-sdk");
const sheLib = path.join(__dirname, "..", "node_modules", "@fatsolutions", "she");

// --- Patch 1: BigInt coercion in poseidonHashMany ---
const bigintPatches = [
  {
    file: path.join(tongoSdk, "dist", "types.js"),
    search: `function compute_prefix(seq) {\n    return (0, starknet_1.poseidonHashMany)(seq);\n}`,
    replace: `function compute_prefix(seq) {\n    // Ensure all values are native bigint (fixes cross-version starknet.js type mismatches)\n    return (0, starknet_1.poseidonHashMany)(seq.map(function(v) { return typeof v === 'bigint' ? v : BigInt(v); }));\n}`,
  },
  {
    file: path.join(sheLib, "lib", "utils.js"),
    search: `return reduce_modulo_order((0, starknet_1.poseidonHashMany)(arr));`,
    replace: `// Ensure all values are native bigint (fixes cross-version type mismatches)\n    return reduce_modulo_order((0, starknet_1.poseidonHashMany)(arr.map(function(v) { return typeof v === 'bigint' ? v : BigInt(v); })));`,
  },
];

// --- Patch 2: Fix broken ../../src/utils imports in dist/provers/ ---
// The compiled JS files incorrectly reference the TS source path instead of the dist path.
const proverFiles = ["audit.js", "fund.js", "ragequit.js", "transfer.js", "withdraw.js"];
const importPatches = proverFiles.map((f) => ({
  file: path.join(tongoSdk, "dist", "provers", f),
  search: `require("../../src/utils")`,
  replace: `require("../utils")`,
}));

const allPatches = [...bigintPatches, ...importPatches];

let applied = 0;
for (const patch of allPatches) {
  try {
    const content = fs.readFileSync(patch.file, "utf8");
    if (content.includes(patch.search)) {
      fs.writeFileSync(patch.file, content.replace(patch.search, patch.replace), "utf8");
      console.log(`✓ Patched ${path.relative(process.cwd(), patch.file)}`);
      applied++;
    } else if (
      content.includes("Ensure all values are native bigint") ||
      content.includes('require("../utils")')
    ) {
      console.log(`○ Already patched ${path.relative(process.cwd(), patch.file)}`);
    } else {
      console.warn(`✗ Could not find patch target in ${path.relative(process.cwd(), patch.file)}`);
    }
  } catch (err) {
    console.warn(`✗ Failed to patch ${patch.file}:`, err.message);
  }
}
console.log(`Patch complete: ${applied} file(s) patched.`);
