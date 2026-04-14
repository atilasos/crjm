import { serve } from 'bun';
import path from 'node:path';
import index from './index.html';
import { handleAppRequest } from './server/learner-core/http';

const port = parseInt(process.env.PORT || '3000', 10);

const server = serve({
  port,
  routes: {
    '/api/*': false,
    '/ai/*': false,
    '/runtime-config.js': new Response('window.__CRJM_ENABLE_LEARNER_API__ = true;\n', {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
      },
    }),
    '/': index,
  },
  async fetch(request, server) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/ai/')) {
      const asset = Bun.file(path.join(process.cwd(), 'dist', url.pathname.slice(1)));
      if (await asset.exists()) {
        return new Response(asset);
      }
    }

    return handleAppRequest(request, server) as Promise<Response>;
  },
  development: process.env.NODE_ENV !== 'production' && {
    console: true,
  },
});

console.log(`🎮 Jogos Matemáticos a correr em ${server.url}`);
