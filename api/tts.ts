import type { IncomingMessage, ServerResponse } from 'http';
import { handleTtsNodeRequest } from './_ttsCore.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  await handleTtsNodeRequest(req, res);
}
