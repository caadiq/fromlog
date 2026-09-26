import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

// Resolve named ingress peers, never trust an entire shared Docker subnet.
export function createProxyTrust(hosts, { resolve = lookup, onError = () => {} } = {}) {
  let addresses = new BlockList();
  let pending;
  const refresh = () => {
    if (pending) return pending;
    pending = (async () => {
      const records = await Promise.all(hosts.map(async host => {
        try {
          return await resolve(host, { all: true });
        } catch (error) {
          onError(host, error);
          return [];
        }
      }));
      const next = new BlockList();
      for (const { address } of records.flat()) {
        const family = isIP(address);
        if (family) next.addAddress(address, family === 6 ? 'ipv6' : 'ipv4');
      }
      // Replace, rather than retain, stale addresses after recreation/DNS failure.
      addresses = next;
    })().finally(() => { pending = null; });
    return pending;
  };
  const trustProxy = address => {
    const family = isIP(address);
    return !!family && addresses.check(address, family === 6 ? 'ipv6' : 'ipv4');
  };
  return { trustProxy, refresh };
}
