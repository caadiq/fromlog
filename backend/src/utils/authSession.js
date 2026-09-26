import { createHash } from 'node:crypto';

function bearerToken(request) {
  const parts = request.headers.authorization?.split(' ');
  return parts?.length === 2 && /^Bearer$/i.test(parts[0]) ? parts[1] : '';
}

export function hasCanonicalAuthSignature(request) {
  const parts = bearerToken(request).split('.');
  if (parts.length !== 3) return false;
  const signature = parts[2];
  // The verifier accepts equivalent base64 spellings. Keep the original digest
  // identity (including legacy tokens/revocations), but accept only signer output.
  return /^[A-Za-z0-9_-]+$/.test(signature)
    && Buffer.from(signature, 'base64url').toString('base64url') === signature;
}

export function authTokenHash(request) {
  return createHash('sha256').update(bearerToken(request)).digest('hex');
}
