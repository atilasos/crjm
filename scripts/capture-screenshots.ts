/**
 * Screenshot Capture Script for CRJM Documentation
 *
 * Usage:
 *   bun run screenshots              # Capture from GitHub Pages
 *   bun run screenshots:local        # Capture from localhost:3000
 *
 * Requirements:
 *   - Playwright installed: bun add -d playwright
 *   - Chromium browser: bunx playwright install chromium
 */

import { chromium, type Page } from "playwright";
import { mkdir } from "fs/promises";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "https://atilasos.github.io/crjm";
const OUTPUT_DIR = join(import.meta.dir, "..", "docs", "screenshots");

interface ScreenshotConfig {
  name: string;
  description: string;
  viewport?: { width: number; height: number };
  setup: (page: Page) => Promise<void>;
  delay?: number;
}

const screenshots: ScreenshotConfig[] = [
  // Homepage
  {
    name: "homepage",
    description: "Homepage with game selection",
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
    },
    delay: 1000,
  },

  // Gatos & Cães
  {
    name: "gatos-caes",
    description: "Gatos & Cães game board",
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.click('text="Gatos & Cães"');
      await page.waitForTimeout(500);
    },
    delay: 500,
  },

  // Dominório
  {
    name: "dominorio",
    description: "Dominório game board",
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.click('text="Dominório"');
      await page.waitForTimeout(500);
    },
    delay: 500,
  },

  // Quelhas
  {
    name: "quelhas",
    description: "Quelhas game board (MISÈRE)",
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.click('text="Quelhas"');
      await page.waitForTimeout(500);
    },
    delay: 500,
  },

  // Produto
  {
    name: "produto",
    description: "Produto hexagonal game board",
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.click('text="Produto"');
      await page.waitForTimeout(500);
    },
    delay: 500,
  },

  // Atari Go
  {
    name: "atari-go",
    description: "Atari Go game board",
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.click('text="Atari Go"');
      await page.waitForTimeout(500);
    },
    delay: 500,
  },

  // Nex
  {
    name: "nex",
    description: "Nex connection game board",
    viewport: { width: 1280, height: 900 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.click('text="Nex"');
      await page.waitForTimeout(500);
    },
    delay: 500,
  },

  // Tournament mode
  {
    name: "campeonato",
    description: "Tournament mode interface",
    viewport: { width: 1280, height: 800 },
    setup: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      // Match partial text since it includes emoji
      await page.click('text=/Modo Campeonato/i');
      await page.waitForTimeout(500);
    },
    delay: 500,
  },
];

async function captureScreenshots() {
  console.log(`\nCapturing screenshots from: ${BASE_URL}`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2, // Retina quality
    locale: "pt-PT",
  });

  const page = await context.newPage();

  let successCount = 0;
  let failCount = 0;

  for (const config of screenshots) {
    const outputPath = join(OUTPUT_DIR, `${config.name}.png`);

    try {
      console.log(`Capturing: ${config.name} (${config.description})...`);

      // Set viewport if specified
      if (config.viewport) {
        await page.setViewportSize(config.viewport);
      }

      // Run setup (navigation + clicks)
      await config.setup(page);

      // Additional delay for animations/rendering
      if (config.delay) {
        await page.waitForTimeout(config.delay);
      }

      // Capture screenshot
      await page.screenshot({
        path: outputPath,
        fullPage: false,
      });

      console.log(`  ✓ Saved: ${config.name}.png`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed: ${config.name}`);
      console.error(`    ${error instanceof Error ? error.message : error}`);
      failCount++;
    }
  }

  await browser.close();

  console.log(`\nDone! ${successCount} captured, ${failCount} failed.`);
  console.log(`Screenshots saved to: ${OUTPUT_DIR}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

// Run the script
captureScreenshots().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
