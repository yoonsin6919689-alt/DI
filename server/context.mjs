// Per-request context so the storage layer can build absolute signed URLs
// without threading the request through every call site.
import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage();

export function runWithOrigin(origin, fn) {
  return store.run({ origin }, fn);
}

export function currentOrigin() {
  return store.getStore()?.origin ?? '';
}
