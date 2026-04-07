import { serve } from 'bun';
import index from './index.html';
import { handleAppRequest } from './server/learner-core/http';

const port = parseInt(process.env.PORT || '3000', 10);

const server = serve({
  port,
  routes: {
    '/api/*': false,
    '/*': index,
  },
  fetch(request, server) {
    return handleAppRequest(request, server) as Promise<Response>;
  },
  development: process.env.NODE_ENV !== 'production' && {
    console: true,
  },
});

console.log(`🎮 Jogos Matemáticos a correr em ${server.url}`);
