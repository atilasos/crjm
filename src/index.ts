import { serve } from 'bun';
import path from 'node:path';
import index from './index.html';
import { handleAppRequest } from './server/learner-core/http';
import { getLearnerCoreConfig } from './server/learner-core/config';
import {
  ATARI_GO_AI_PROXY_PREFIX,
  createAtariGoAiProxy,
} from './server/atari-go-ai-proxy';

const port = parseInt(process.env.PORT || '3000', 10);
const atariGoAiBase = process.env.ATARI_GO_AI_URL || 'http://127.0.0.1:8100';
const quelhasAiBase = process.env.QUELHAS_AI_URL || 'http://127.0.0.1:8101';
const learnerCoreConfig = getLearnerCoreConfig();
const proxyAtariGoAi = createAtariGoAiProxy({
  upstreamBaseUrl: atariGoAiBase,
  sessionCookieName: learnerCoreConfig.sessionCookieName,
  sessionSecret: learnerCoreConfig.sessionSecret,
});
const QUELHAS_AI_PROXY_PREFIX = '/api/ai/quelhas';
const proxyQuelhasAi = createAtariGoAiProxy({
  upstreamBaseUrl: quelhasAiBase,
  prefix: QUELHAS_AI_PROXY_PREFIX,
  sessionCookieName: learnerCoreConfig.sessionCookieName,
  sessionSecret: learnerCoreConfig.sessionSecret,
});

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

    if (
      url.pathname === ATARI_GO_AI_PROXY_PREFIX ||
      url.pathname.startsWith(`${ATARI_GO_AI_PROXY_PREFIX}/`)
    ) {
      return proxyAtariGoAi(request, url);
    }

    if (
      url.pathname === QUELHAS_AI_PROXY_PREFIX ||
      url.pathname.startsWith(`${QUELHAS_AI_PROXY_PREFIX}/`)
    ) {
      return proxyQuelhasAi(request, url);
    }

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
