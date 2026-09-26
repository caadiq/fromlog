import { createHash } from 'node:crypto';

export function authTokenHash(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  return createHash('sha256').update(token).digest('hex');
}
