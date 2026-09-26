import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

// Only ordinary public unicast destinations may receive content-derived URLs.
const blockedV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blockedV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const blockedV6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
]) blockedV6.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  if (family === 6) return globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
  return false;
}

function checkedUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw new Error('Unsupported public URL');
  }
  url.hash = '';
  return url;
}

// Dependency injection is for isolated transport tests, never request parameters.
export function createPublicTextFetcher({ lookup = dnsLookup, request = (url, options, cb) => (
  url.protocol === 'https:' ? https : http
).request(url, options, cb) } = {}) {
  return async function fetchText(input, { timeoutMs = 8000, maxBytes = 2 * 1024 * 1024, maxRedirects = 4 } = {}) {
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(() => controller.abort(new Error('External response deadline exceeded')), timeoutMs);
    let abortListener;
    const aborted = new Promise((_, reject) => {
      abortListener = () => reject(signal.reason);
      signal.addEventListener('abort', abortListener, { once: true });
    });
    try {
      const work = async () => {
        let url = checkedUrl(input);
        for (let redirects = 0; ; redirects++) {
          signal.throwIfAborted();
          const hostname = url.hostname.replace(/^\[|\]$/g, '');
          const family = isIP(hostname);
          const addresses = family ? [{ address: hostname, family }] : await lookup(hostname, { all: true, verbatim: true });
          signal.throwIfAborted();
          if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
            throw new Error('Non-public destination rejected');
          }
          // Pin the checked address; do not let the socket resolve the host again.
          const address = addresses.find(item => item.family === 4) || addresses[0];
          const result = await new Promise((resolve, reject) => {
            const req = request(url, {
              method: 'GET', agent: false, signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fromis9-bot)', 'Accept-Encoding': 'identity' },
              lookup: (_host, options, cb) => options.all
                ? cb(null, [address]) : cb(null, address.address, address.family),
            }, res => {
              res.on('error', reject);
              const fail = message => { res.destroy(); reject(new Error(message)); };
              if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                const location = res.headers.location;
                res.destroy();
                if (!location || redirects >= maxRedirects) return reject(new Error('Invalid or excessive redirects'));
                try { resolve({ redirect: checkedUrl(new URL(location, url)) }); } catch (err) { reject(err); }
                return;
              }
              if (res.statusCode < 200 || res.statusCode >= 300) return fail('External response unsuccessful');
              // Node HTTP does not decompress bodies. Refuse unexpected compression.
              if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') return fail('Unexpected compressed response');
              if (Number(res.headers['content-length']) > maxBytes) return fail('External response too large');
              const chunks = [];
              let size = 0;
              res.on('data', chunk => {
                size += chunk.length;
                if (size > maxBytes) return fail('External response too large');
                chunks.push(chunk);
              });
              res.on('end', () => resolve({ url: url.href, text: Buffer.concat(chunks).toString('utf8') }));
            });
            req.on('error', reject);
            req.end();
          });
          if (!result.redirect) return result;
          url = result.redirect;
        }
      };
      return await Promise.race([work(), aborted]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abortListener);
    }
  };
}

export const fetchPublicText = createPublicTextFetcher();
