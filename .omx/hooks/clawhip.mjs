import { createClawhipOmxClient } from './lib/clawhip-sdk.mjs';

const clientPromise = createClawhipOmxClient();

// Map native OMX hook events to clawhip contract normalized_event
const OMX_EVENT_MAP = {
  'session-start':    'started',
  'session-end':      'finished',
  'session-idle':     null,          // skip — not meaningful for Discord
  'turn-complete':    null,          // skip — too noisy
  'task-complete':    'finished',
  'task-failed':      'failed',
  'task-blocked':     'blocked',
  'pr-created':       'pr-created',
  'test-started':     'test-started',
  'test-finished':    'test-finished',
  'test-failed':      'test-failed',
  'handoff-needed':   'handoff-needed',
  'retry-needed':     'retry-needed',
};

export async function onHookEvent(event, sdk) {
  const client = await clientPromise;
  const sessionState = await sdk.omx.session.read();

  // Resolve normalized_event: prefer explicit context field, then map from event type
  const rawEvent = event?.event ?? event?.context?.normalized_event ?? '';
  const mappedEvent = event?.context?.normalized_event ?? OMX_EVENT_MAP[rawEvent];

  // Skip events that map to null (too noisy or irrelevant)
  if (!mappedEvent) {
    await sdk.log.info('clawhip OMX hook skipped unmapped event', {
      event: rawEvent,
    });
    return { ok: true, skipped: true, reason: 'unmapped_event', event: rawEvent };
  }

  const result = await client.emitFromHookEvent(
    {
      ...event,
      context: {
        ...(event?.context ?? {}),
        normalized_event: mappedEvent,
        ...(sessionState?.session_id && !event?.session_id ? { session_id: sessionState.session_id } : {}),
        ...(sessionState?.cwd && !event?.context?.worktree_path ? { worktree_path: sessionState.cwd } : {}),
        agent_name: 'omx',
        repo_name: 'crjm',
      },
    },
    {},
  );

  if (result?.skipped) {
    await sdk.log.info('clawhip OMX hook skipped', {
      event: rawEvent,
      mapped: mappedEvent,
      reason: result.reason,
    });
  }

  return result;
}
