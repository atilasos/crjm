import { serve } from "bun";
import path from "path";
import { existsSync } from "fs";

const port = parseInt(process.env.PORT || "3001");
const distDir = path.join(process.cwd(), "dist");

const server = serve({
    port,
    async fetch(req) {
        const url = new URL(req.url);
        let filePath = path.join(distDir, url.pathname);

        // Default to index.html for SPA
        if (url.pathname === "/" || !existsSync(filePath)) {
            filePath = path.join(distDir, "index.html");
        }

        return new Response(Bun.file(filePath));
    },
});

console.log(`🚀 Serving dist at ${server.url}`);
