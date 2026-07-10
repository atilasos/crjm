#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm, mkdir, copyFile, cp } from "fs/promises";
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

// Copy directory recursively if exists
async function copyDirIfExists(srcDir: string, destDir: string): Promise<void> {
  if (!existsSync(srcDir)) return;
  await mkdir(destDir, { recursive: true });
  await cp(srcDir, destDir, { recursive: true, force: true });
}

// Build a standalone worker bundle (no splitting) for static hosting
async function buildWorker(entry: string, outdir: string): Promise<void> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir,
    target: "browser",
    format: "esm",
    splitting: false,
    minify: true,
    sourcemap: "linked",
  });

  if (!result.success) {
    const errors = result.logs?.filter(l => l.level === "error").map(l => l.message).join("\n");
    throw new Error(errors || "Worker build failed");
  }
}

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
// WASM Build for Quelhas AI
// ============================================================================

async function buildQuelhasWasm(): Promise<WasmBuildResult> {
  const workspaceRoot = path.join(process.cwd(), "wasm", "quelhas");
  const wasmCratePath = path.join(workspaceRoot, "quelhas-wasm");
  const wasmOutputPath = path.join(process.cwd(), "src", "games", "quelhas", "ai", "wasm", "pkg");

  if (!existsSync(path.join(wasmCratePath, "Cargo.toml"))) {
    return {
      success: false,
      message: "Rust crate not found at wasm/quelhas/quelhas-wasm/",
    };
  }

  const cargoCheck = Bun.spawn(["which", "cargo"], { stdout: "pipe", stderr: "pipe" });
  await cargoCheck.exited;
  if (cargoCheck.exitCode !== 0) {
    return {
      success: false,
      message: "Cargo not found. Install Rust toolchain to compile WASM. AI will use TypeScript fallback.",
    };
  }

  const targetCheck = Bun.spawn(["rustup", "target", "list", "--installed"], { stdout: "pipe", stderr: "pipe" });
  const targetOutput = await new Response(targetCheck.stdout).text();
  await targetCheck.exited;

  if (!targetOutput.includes("wasm32-unknown-unknown")) {
    console.log("📦 Installing wasm32-unknown-unknown target...");
    const installTarget = Bun.spawn(["rustup", "target", "add", "wasm32-unknown-unknown"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installTarget.exited;
    if (installTarget.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm32-unknown-unknown target" };
    }
  }

  const wbCheck = Bun.spawn(["which", "wasm-bindgen"], { stdout: "pipe", stderr: "pipe" });
  await wbCheck.exited;
  if (wbCheck.exitCode !== 0) {
    console.log("📦 Installing wasm-bindgen-cli...");
    const installWb = Bun.spawn(["cargo", "install", "wasm-bindgen-cli"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installWb.exited;
    if (installWb.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm-bindgen-cli" };
    }
  }

  console.log("🦀 Building Quelhas AI WASM...");
  const cargoBuild = Bun.spawn(["cargo", "build", "-p", "quelhas_wasm", "--release", "--target", "wasm32-unknown-unknown"], {
    cwd: workspaceRoot,
    stdout: "inherit",
    stderr: "inherit",
  });
  await cargoBuild.exited;
  if (cargoBuild.exitCode !== 0) {
    return { success: false, message: "Cargo build failed" };
  }

  const wasmFile = path.join(
    workspaceRoot,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "quelhas_wasm.wasm"
  );
  if (!existsSync(wasmFile)) {
    return { success: false, message: "WASM file not found after build" };
  }

  await mkdir(wasmOutputPath, { recursive: true });

  console.log("🔗 Running wasm-bindgen (Quelhas)...");
  const wasmBindgen = Bun.spawn(
    [
      "wasm-bindgen",
      wasmFile,
      "--out-dir",
      wasmOutputPath,
      "--target",
      "web",
      "--omit-default-module-path",
    ],
    { stdout: "inherit", stderr: "inherit" }
  );
  await wasmBindgen.exited;
  if (wasmBindgen.exitCode !== 0) {
    return { success: false, message: "wasm-bindgen failed" };
  }

  return { success: true, message: "Quelhas WASM built successfully" };
}

// ============================================================================
// WASM Build for Produto AI
// ============================================================================

async function buildProdutoWasm(): Promise<WasmBuildResult> {
  const wasmCratePath = path.join(process.cwd(), "wasm", "produto_ai");
  const wasmOutputPath = path.join(process.cwd(), "src", "games", "produto", "ai", "wasm", "pkg");

  if (!existsSync(path.join(wasmCratePath, "Cargo.toml"))) {
    return { success: false, message: "Rust crate not found at wasm/produto_ai/" };
  }

  const cargoCheck = Bun.spawn(["which", "cargo"], { stdout: "pipe", stderr: "pipe" });
  await cargoCheck.exited;
  if (cargoCheck.exitCode !== 0) {
    return {
      success: false,
      message: "Cargo not found. Install Rust toolchain to compile WASM. AI will use fallback.",
    };
  }

  const targetCheck = Bun.spawn(["rustup", "target", "list", "--installed"], { stdout: "pipe", stderr: "pipe" });
  const targetOutput = await new Response(targetCheck.stdout).text();
  await targetCheck.exited;

  if (!targetOutput.includes("wasm32-unknown-unknown")) {
    console.log("📦 Installing wasm32-unknown-unknown target...");
    const installTarget = Bun.spawn(["rustup", "target", "add", "wasm32-unknown-unknown"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installTarget.exited;
    if (installTarget.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm32-unknown-unknown target" };
    }
  }

  const wbCheck = Bun.spawn(["which", "wasm-bindgen"], { stdout: "pipe", stderr: "pipe" });
  await wbCheck.exited;
  if (wbCheck.exitCode !== 0) {
    console.log("📦 Installing wasm-bindgen-cli...");
    const installWb = Bun.spawn(["cargo", "install", "wasm-bindgen-cli"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installWb.exited;
    if (installWb.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm-bindgen-cli" };
    }
  }

  console.log("🦀 Building Produto AI WASM...");
  const cargoBuild = Bun.spawn(["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"], {
    cwd: wasmCratePath,
    stdout: "inherit",
    stderr: "inherit",
  });
  await cargoBuild.exited;
  if (cargoBuild.exitCode !== 0) {
    return { success: false, message: "Cargo build failed" };
  }

  const wasmFile = path.join(
    wasmCratePath,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "produto_ai.wasm"
  );
  if (!existsSync(wasmFile)) {
    return { success: false, message: "WASM file not found after build" };
  }

  await mkdir(wasmOutputPath, { recursive: true });

  console.log("🔗 Running wasm-bindgen (Produto)...");
  const wasmBindgen = Bun.spawn(
    ["wasm-bindgen", wasmFile, "--out-dir", wasmOutputPath, "--target", "web", "--omit-default-module-path"],
    { stdout: "inherit", stderr: "inherit" }
  );
  await wasmBindgen.exited;
  if (wasmBindgen.exitCode !== 0) {
    return { success: false, message: "wasm-bindgen failed" };
  }

  return { success: true, message: "Produto WASM built successfully" };
}

// ============================================================================
// WASM Build for Atari Go AI
// ============================================================================

async function buildAtariGoWasm(): Promise<WasmBuildResult> {
  const wasmCratePath = path.join(process.cwd(), "wasm", "atari_go_ai");
  const wasmOutputPath = path.join(process.cwd(), "src", "games", "atari-go", "ai", "wasm", "pkg");

  if (!existsSync(path.join(wasmCratePath, "Cargo.toml"))) {
    return { success: false, message: "Rust crate not found at wasm/atari_go_ai/" };
  }

  const cargoCheck = Bun.spawn(["which", "cargo"], { stdout: "pipe", stderr: "pipe" });
  await cargoCheck.exited;
  if (cargoCheck.exitCode !== 0) {
    return {
      success: false,
      message: "Cargo not found. Install Rust toolchain to compile WASM. AI will use fallback.",
    };
  }

  const targetCheck = Bun.spawn(["rustup", "target", "list", "--installed"], { stdout: "pipe", stderr: "pipe" });
  const targetOutput = await new Response(targetCheck.stdout).text();
  await targetCheck.exited;

  if (!targetOutput.includes("wasm32-unknown-unknown")) {
    console.log("📦 Installing wasm32-unknown-unknown target...");
    const installTarget = Bun.spawn(["rustup", "target", "add", "wasm32-unknown-unknown"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installTarget.exited;
    if (installTarget.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm32-unknown-unknown target" };
    }
  }

  const wbCheck = Bun.spawn(["which", "wasm-bindgen"], { stdout: "pipe", stderr: "pipe" });
  await wbCheck.exited;
  if (wbCheck.exitCode !== 0) {
    console.log("📦 Installing wasm-bindgen-cli...");
    const installWb = Bun.spawn(["cargo", "install", "wasm-bindgen-cli"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installWb.exited;
    if (installWb.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm-bindgen-cli" };
    }
  }

  console.log("🦀 Building Atari Go AI WASM...");
  const cargoBuild = Bun.spawn(["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"], {
    cwd: wasmCratePath,
    stdout: "inherit",
    stderr: "inherit",
  });
  await cargoBuild.exited;
  if (cargoBuild.exitCode !== 0) {
    return { success: false, message: "Cargo build failed" };
  }

  const wasmFile = path.join(
    wasmCratePath,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "atari_go_ai.wasm"
  );
  if (!existsSync(wasmFile)) {
    return { success: false, message: "WASM file not found after build" };
  }

  await mkdir(wasmOutputPath, { recursive: true });

  console.log("🔗 Running wasm-bindgen (Atari Go)...");
  const wasmBindgen = Bun.spawn(
    ["wasm-bindgen", wasmFile, "--out-dir", wasmOutputPath, "--target", "web", "--omit-default-module-path"],
    { stdout: "inherit", stderr: "inherit" }
  );
  await wasmBindgen.exited;
  if (wasmBindgen.exitCode !== 0) {
    return { success: false, message: "wasm-bindgen failed" };
  }

  return { success: true, message: "Atari Go WASM built successfully" };
}

// ============================================================================
// WASM Build for Nex AI
// ============================================================================

async function buildNexWasm(): Promise<WasmBuildResult> {
  const wasmCratePath = path.join(process.cwd(), "wasm", "nex_ai");
  const wasmOutputPath = path.join(process.cwd(), "src", "games", "nex", "ai", "wasm", "pkg");

  if (!existsSync(path.join(wasmCratePath, "Cargo.toml"))) {
    return { success: false, message: "Rust crate not found at wasm/nex_ai/" };
  }

  const cargoCheck = Bun.spawn(["which", "cargo"], { stdout: "pipe", stderr: "pipe" });
  await cargoCheck.exited;
  if (cargoCheck.exitCode !== 0) {
    return {
      success: false,
      message: "Cargo not found. Install Rust toolchain to compile WASM. AI will use fallback.",
    };
  }

  const targetCheck = Bun.spawn(["rustup", "target", "list", "--installed"], { stdout: "pipe", stderr: "pipe" });
  const targetOutput = await new Response(targetCheck.stdout).text();
  await targetCheck.exited;

  if (!targetOutput.includes("wasm32-unknown-unknown")) {
    console.log("📦 Installing wasm32-unknown-unknown target...");
    const installTarget = Bun.spawn(["rustup", "target", "add", "wasm32-unknown-unknown"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installTarget.exited;
    if (installTarget.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm32-unknown-unknown target" };
    }
  }

  const wbCheck = Bun.spawn(["which", "wasm-bindgen"], { stdout: "pipe", stderr: "pipe" });
  await wbCheck.exited;
  if (wbCheck.exitCode !== 0) {
    console.log("📦 Installing wasm-bindgen-cli...");
    const installWb = Bun.spawn(["cargo", "install", "wasm-bindgen-cli"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    await installWb.exited;
    if (installWb.exitCode !== 0) {
      return { success: false, message: "Failed to install wasm-bindgen-cli" };
    }
  }

  console.log("🦀 Building Nex AI WASM...");
  const cargoBuild = Bun.spawn(["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"], {
    cwd: wasmCratePath,
    stdout: "inherit",
    stderr: "inherit",
  });
  await cargoBuild.exited;
  if (cargoBuild.exitCode !== 0) {
    return { success: false, message: "Cargo build failed" };
  }

  const wasmFile = path.join(wasmCratePath, "target", "wasm32-unknown-unknown", "release", "nex_ai.wasm");
  if (!existsSync(wasmFile)) {
    return { success: false, message: "WASM file not found after build" };
  }

  await mkdir(wasmOutputPath, { recursive: true });

  console.log("🔗 Running wasm-bindgen (Nex)...");
  const wasmBindgen = Bun.spawn(
    ["wasm-bindgen", wasmFile, "--out-dir", wasmOutputPath, "--target", "web", "--omit-default-module-path"],
    { stdout: "inherit", stderr: "inherit" }
  );
  await wasmBindgen.exited;
  if (wasmBindgen.exitCode !== 0) {
    return { success: false, message: "wasm-bindgen failed" };
  }

  return { success: true, message: "Nex WASM built successfully" };
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
  const wasmResults = [
    await buildDominorioWasm(),
    await buildQuelhasWasm(),
    await buildProdutoWasm(),
    await buildAtariGoWasm(),
    await buildNexWasm(),
  ];
  for (const wasmResult of wasmResults) {
    if (wasmResult.success) {
      console.log(`✅ ${wasmResult.message}\n`);
    } else {
      console.log(`⚠️  ${wasmResult.message}\n`);
      console.log("   Continuing with TypeScript fallback for AI...\n");
    }
  }
} else {
  console.log("⏭️  Skipping WASM build (--skip-wasm flag)\n");
}

if (existsSync(outdir)) {
  console.log(`🗑️ Cleaning previous build at ${outdir}`);
  await rm(outdir, { recursive: true, force: true });
}

const start = performance.now();

// Build principal (index.html)
const mainEntrypoint = path.resolve("src", "index.html");
console.log(`📄 Building main app (index.html)\n`);

const mainResult = await Bun.build({
  entrypoints: [mainEntrypoint],
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

if (!mainResult.success) {
  console.error("❌ Main build failed:");
  mainResult.logs.forEach(log => console.error(log));
  process.exit(1);
}

// Build admin spectator (separado para evitar conflitos)
const adminEntrypoint = path.resolve("src", "admin", "spectator.html");
if (existsSync(adminEntrypoint)) {
  console.log(`📄 Building admin spectator page\n`);

  const adminResult = await Bun.build({
    entrypoints: [adminEntrypoint],
    outdir: path.join(outdir, "admin"),
    plugins: [plugin],
    minify: true,
    target: "browser",
    sourcemap: "linked",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
    ...cliConfig,
  });

  if (!adminResult.success) {
    console.error("⚠️ Admin spectator build failed:");
    adminResult.logs.forEach(log => console.error(log));
  }
}

const end = performance.now();

const outputTable = mainResult.outputs.map(output => ({
  File: path.relative(process.cwd(), output.path),
  Type: output.kind,
  Size: formatFileSize(output.size),
}));

console.table(outputTable);
const buildTime = (end - start).toFixed(2);

await copyFile(
  path.join(process.cwd(), 'src', 'runtime-config.js'),
  path.join(outdir, 'runtime-config.js'),
);

console.log(`\n✅ Build completed in ${buildTime}ms\n`);

// ============================================================================
// Extra outputs: AI workers + WASM pkg copies (for GitHub Pages)
// ============================================================================

try {
  const aiGatosCaesOut = path.join(outdir, "ai", "gatos-caes");
  await mkdir(aiGatosCaesOut, { recursive: true });
  await buildWorker(
    path.join(process.cwd(), "src", "games", "gatos-caes", "ai", "gatos-caes.worker.ts"),
    aiGatosCaesOut,
  );
} catch (e) {
  console.log(`⚠️  Failed to build Gatos & Cães worker asset: ${e instanceof Error ? e.message : String(e)}\n`);
}

try {
  const aiDominorioOut = path.join(outdir, "ai", "dominorio");
  await mkdir(aiDominorioOut, { recursive: true });

  // Build Dominório worker bundle to dist/ai/dominorio/dominorio.worker.js
  await buildWorker(path.join(process.cwd(), "src", "games", "dominorio", "ai", "dominorio.worker.ts"), aiDominorioOut);

  // Copy WASM pkg to dist/ai/dominorio/wasm/pkg (worker imports "./wasm/pkg/...")
  await copyDirIfExists(
    path.join(process.cwd(), "src", "games", "dominorio", "ai", "wasm", "pkg"),
    path.join(aiDominorioOut, "wasm", "pkg")
  );
} catch (e) {
  console.log(`⚠️  Failed to build/copy Dominório worker assets: ${e instanceof Error ? e.message : String(e)}\n`);
}

try {
  const aiQuelhasOut = path.join(outdir, "ai", "quelhas");
  await mkdir(aiQuelhasOut, { recursive: true });

  // Build Quelhas worker bundle to dist/ai/quelhas/quelhas.worker.js
  await buildWorker(path.join(process.cwd(), "src", "games", "quelhas", "ai", "quelhas.worker.ts"), aiQuelhasOut);

  // Copy WASM pkg to dist/ai/quelhas/wasm/pkg (worker imports "./wasm/pkg/...")
  await copyDirIfExists(
    path.join(process.cwd(), "src", "games", "quelhas", "ai", "wasm", "pkg"),
    path.join(aiQuelhasOut, "wasm", "pkg")
  );
} catch (e) {
  console.log(`⚠️  Failed to build/copy Quelhas worker assets: ${e instanceof Error ? e.message : String(e)}\n`);
}

try {
  const aiProdutoOut = path.join(outdir, "ai", "produto");
  await mkdir(aiProdutoOut, { recursive: true });

  // Build Produto worker bundle to dist/ai/produto/produto.worker.js
  await buildWorker(path.join(process.cwd(), "src", "games", "produto", "ai", "produto.worker.ts"), aiProdutoOut);

  // Copy WASM pkg to dist/ai/produto/wasm/pkg (worker imports "./wasm/pkg/...")
  await copyDirIfExists(
    path.join(process.cwd(), "src", "games", "produto", "ai", "wasm", "pkg"),
    path.join(aiProdutoOut, "wasm", "pkg")
  );
} catch (e) {
  console.log(`⚠️  Failed to build/copy Produto worker assets: ${e instanceof Error ? e.message : String(e)}\n`);
}

try {
  const aiAtariGoOut = path.join(outdir, "ai", "atari-go");
  await mkdir(aiAtariGoOut, { recursive: true });

  // Build Atari Go worker bundle to dist/ai/atari-go/atari-go.worker.js
  await buildWorker(path.join(process.cwd(), "src", "games", "atari-go", "ai", "atari-go.worker.ts"), aiAtariGoOut);

  // Copy WASM pkg to dist/ai/atari-go/wasm/pkg (worker imports "./wasm/pkg/...")
  await copyDirIfExists(
    path.join(process.cwd(), "src", "games", "atari-go", "ai", "wasm", "pkg"),
    path.join(aiAtariGoOut, "wasm", "pkg")
  );
} catch (e) {
  console.log(`⚠️  Failed to build/copy Atari Go worker assets: ${e instanceof Error ? e.message : String(e)}\n`);
}

try {
  const aiNexOut = path.join(outdir, "ai", "nex");
  await mkdir(aiNexOut, { recursive: true });

  // Build Nex worker bundle to dist/ai/nex/nex.worker.js
  await buildWorker(path.join(process.cwd(), "src", "games", "nex", "ai", "nex.worker.ts"), aiNexOut);

  // Copy WASM pkg to dist/ai/nex/wasm/pkg (worker imports "./wasm/pkg/...")
  await copyDirIfExists(
    path.join(process.cwd(), "src", "games", "nex", "ai", "wasm", "pkg"),
    path.join(aiNexOut, "wasm", "pkg")
  );
} catch (e) {
  console.log(`⚠️  Failed to build/copy Nex worker assets: ${e instanceof Error ? e.message : String(e)}\n`);
}
