#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm, mkdir, copyFile } from "fs/promises";
import path from "path";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🏗️  Bun Build Script

Usage: bun run build.ts [options]

Common Options:
  --outdir <path>          Output directory (default: "dist")
  --minify                 Enable minification (or --minify.whitespace, --minify.syntax, etc)
  --sourcemap <type>      Sourcemap type: none|linked|inline|external
  --target <target>        Build target: browser|bun|node
  --format <format>        Output format: esm|cjs|iife
  --splitting              Enable code splitting
  --packages <type>        Package handling: bundle|external
  --public-path <path>     Public path for assets
  --env <mode>             Environment handling: inline|disable|prefix*
  --conditions <list>      Package.json export conditions (comma separated)
  --external <list>        External packages (comma separated)
  --banner <text>          Add banner text to output
  --footer <text>          Add footer text to output
  --define <obj>           Define global constants (e.g. --define.VERSION=1.0.0)
  --skip-wasm              Skip WASM compilation (use if Rust toolchain not installed)
  --help, -h               Show this help message

Example:
  bun run build.ts --outdir=dist --minify --sourcemap=linked --external=react,react-dom
`);
  process.exit(0);
}

const toCamelCase = (str: string): string => str.replace(/-([a-z])/g, g => g[1].toUpperCase());

const parseValue = (value: string): any => {
  if (value === "true") return true;
  if (value === "false") return false;

  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  if (value.includes(",")) return value.split(",").map(v => v.trim());

  return value;
};

function parseArgs(): Partial<Bun.BuildConfig> & { skipWasm?: boolean } {
  const config: Partial<Bun.BuildConfig> & { skipWasm?: boolean } = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (!arg.startsWith("--")) continue;

    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    if (!arg.includes("=") && (i === args.length - 1 || args[i + 1]?.startsWith("--"))) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2) as [string, string];
    } else {
      key = arg.slice(2);
      value = args[++i] ?? "";
    }

    key = toCamelCase(key);

    if (key.includes(".")) {
      const [parentKey, childKey] = key.split(".");
      config[parentKey] = config[parentKey] || {};
      config[parentKey][childKey] = parseValue(value);
    } else {
      config[key] = parseValue(value);
    }
  }

  return config;
}

const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

// ============================================================================
// WASM Build for Dominório AI
// ============================================================================

interface WasmBuildResult {
  success: boolean;
  message: string;
}

async function buildDominorioWasm(): Promise<WasmBuildResult> {
  const wasmCratePath = path.join(process.cwd(), "wasm", "dominorio_ai");
  const wasmOutputPath = path.join(process.cwd(), "src", "games", "dominorio", "ai", "wasm", "pkg");
  
  // Check if Cargo.toml exists
  if (!existsSync(path.join(wasmCratePath, "Cargo.toml"))) {
    return { 
      success: false, 
      message: "Rust crate not found at wasm/dominorio_ai/" 
    };
  }
  
  // Check if cargo is available
  const cargoCheck = Bun.spawn(["which", "cargo"], { stdout: "pipe", stderr: "pipe" });
  await cargoCheck.exited;
  
  if (cargoCheck.exitCode !== 0) {
    return { 
      success: false, 
      message: "Cargo not found. Install Rust toolchain to compile WASM. AI will use TypeScript fallback." 
    };
  }
  
  // Check if wasm32 target is installed
  const targetCheck = Bun.spawn(
    ["rustup", "target", "list", "--installed"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const targetOutput = await new Response(targetCheck.stdout).text();
  await targetCheck.exited;
  
  if (!targetOutput.includes("wasm32-unknown-unknown")) {
    console.log("📦 Installing wasm32-unknown-unknown target...");
    const installTarget = Bun.spawn(
      ["rustup", "target", "add", "wasm32-unknown-unknown"],
      { stdout: "inherit", stderr: "inherit" }
    );
    await installTarget.exited;
    
    if (installTarget.exitCode !== 0) {
      return { 
        success: false, 
        message: "Failed to install wasm32-unknown-unknown target" 
      };
    }
  }
  
  // Check if wasm-bindgen-cli is installed
  const wbCheck = Bun.spawn(["which", "wasm-bindgen"], { stdout: "pipe", stderr: "pipe" });
  await wbCheck.exited;
  
  if (wbCheck.exitCode !== 0) {
    console.log("📦 Installing wasm-bindgen-cli...");
    const installWb = Bun.spawn(
      ["cargo", "install", "wasm-bindgen-cli"],
      { stdout: "inherit", stderr: "inherit" }
    );
    await installWb.exited;
    
    if (installWb.exitCode !== 0) {
      return { 
        success: false, 
        message: "Failed to install wasm-bindgen-cli" 
      };
    }
  }
  
  // Build the WASM
  console.log("🦀 Building Dominório AI WASM...");
  const cargoBuild = Bun.spawn(
    ["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"],
    { 
      cwd: wasmCratePath,
      stdout: "inherit", 
      stderr: "inherit" 
    }
  );
  await cargoBuild.exited;
  
  if (cargoBuild.exitCode !== 0) {
    return { 
      success: false, 
      message: "Cargo build failed" 
    };
  }
  
  // Run wasm-bindgen
  const wasmFile = path.join(wasmCratePath, "target", "wasm32-unknown-unknown", "release", "dominorio_ai.wasm");
  
  if (!existsSync(wasmFile)) {
    return { 
      success: false, 
      message: "WASM file not found after build" 
    };
  }
  
  // Create output directory
  await mkdir(wasmOutputPath, { recursive: true });
  
  console.log("🔗 Running wasm-bindgen...");
  const wasmBindgen = Bun.spawn(
    [
      "wasm-bindgen",
      wasmFile,
      "--out-dir", wasmOutputPath,
      "--target", "web",
      "--omit-default-module-path"
    ],
    { 
      stdout: "inherit", 
      stderr: "inherit" 
    }
  );
  await wasmBindgen.exited;
  
  if (wasmBindgen.exitCode !== 0) {
    return { 
      success: false, 
      message: "wasm-bindgen failed" 
    };
  }
  
  return { 
    success: true, 
    message: "WASM built successfully" 
  };
}

// ============================================================================
// Main Build
// ============================================================================

console.log("\n🚀 Starting build process...\n");

const cliConfig = parseArgs();
const skipWasm = cliConfig.skipWasm || false;
delete cliConfig.skipWasm;

const outdir = cliConfig.outdir || path.join(process.cwd(), "dist");

// Build WASM first (if not skipped)
if (!skipWasm) {
  const wasmResult = await buildDominorioWasm();
  if (wasmResult.success) {
    console.log(`✅ ${wasmResult.message}\n`);
  } else {
    console.log(`⚠️  ${wasmResult.message}\n`);
    console.log("   Continuing with TypeScript fallback for AI...\n");
  }
} else {
  console.log("⏭️  Skipping WASM build (--skip-wasm flag)\n");
}

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`);
  await rm(outdir, { recursive: true, force: true });
}

const start = performance.now();

const entrypoints = [...new Bun.Glob("**.html").scanSync("src")]
  .map(a => path.resolve("src", a))
  .filter(dir => !dir.includes("node_modules"));
console.log(`📄 Found ${entrypoints.length} HTML ${entrypoints.length === 1 ? "file" : "files"} to process\n`);

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [plugin],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  ...cliConfig,
});

const end = performance.now();

const outputTable = result.outputs.map(output => ({
  File: path.relative(process.cwd(), output.path),
  Type: output.kind,
  Size: formatFileSize(output.size),
}));

console.table(outputTable);
const buildTime = (end - start).toFixed(2);

console.log(`\n✅ Build completed in ${buildTime}ms\n`);
