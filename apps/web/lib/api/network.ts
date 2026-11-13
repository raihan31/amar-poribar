/** Tiny store: true after an API fetch failed at the network level, false once any response arrives. */
let failed = false;
const listeners = new Set<() => void>();

function set(v: boolean) {
  if (failed === v) return;
  failed = v;
  listeners.forEach((l) => l());
}

export const notifyNetworkError = () => set(true);
export const notifyNetworkOk = () => set(false);
export const getNetworkFailed = () => failed;
export function subscribeNetwork(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
