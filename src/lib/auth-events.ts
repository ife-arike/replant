// Auth-event pubsub — KAN-87 SEC rework #4 (ruling 11015).
//
// Cross-endpoint 401 detection. When the Supabase fetch interceptor (in
// supabase.ts) sees a 401 from any project endpoint, it emits via emit401()
// here. AuthProvider subscribes via on401() at mount time and runs the
// ordered clear-and-route handler. This satisfies SEC ruling 10955's
// cross-reference: gateway 401s on any Supabase endpoint with a stale JWT
// must trigger the same clear-and-route as auth-status-check itself.

type Listener = () => void;

const listeners = new Set<Listener>();

export function on401(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emit401(): void {
  // Snapshot before iterating — listener may unsubscribe itself.
  for (const l of [...listeners]) {
    try {
      l();
    } catch {
      // Listener errors must not block other listeners.
    }
  }
}
