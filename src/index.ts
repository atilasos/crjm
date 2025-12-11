import { serve } from "bun";
import index from "./index.html";

const port = parseInt(process.env.PORT || "3000");

const server = serve({
  port,
  routes: {
    // Serve index.html for all routes (SPA)
    "/*": index,
  },
  // Note: HMR is handled by `bun --hot` flag, not here
  // Setting both causes conflicts and WebSocket errors
  development: process.env.NODE_ENV !== "production" && {
    console: true,
  },
});

console.log(`🎮 Jogos Matemáticos a correr em ${server.url}`);
