import { handleAppRequest } from './http';

export async function handleLearnerApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const aliases = new Map<string, string>([
    ['/api/learner/commands/game-completed', '/api/learner/events/game-completed'],
    ['/api/learner/commands/review-completed', '/api/learner/events/review-completed'],
    ['/api/learner/commands/import-local-profile', '/api/learner/import-local-profile'],
  ]);
  const targetPath = aliases.get(url.pathname);
  const nextRequest = targetPath
    ? new Request(new URL(targetPath, url.origin), request)
    : request;
  return handleAppRequest(nextRequest, {} as never);
}
