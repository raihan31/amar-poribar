/** Registers the service worker in production builds only. The build id busts the SW cache version. */
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const v = encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? "0");
  void navigator.serviceWorker.register(`/sw.js?v=${v}`).catch(() => {});
}
