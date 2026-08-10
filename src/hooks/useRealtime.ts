import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Subscribe to Supabase Realtime `postgres_changes` for a table.
 * The frontend listens DIRECTLY to Supabase (no Socket.io / Express WebSockets):
 * when the Express API writes via Prisma, Postgres broadcasts the change and
 * Supabase pushes it to subscribed clients.
 *
 * NOTE: Realtime requires the table to be enabled under
 * Supabase Dashboard -> Database -> Replication -> Sources.
 */
export function useRealtime(
  table: string,
  onEvent: (payload: { eventType: RealtimeEvent; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => void,
  options?: { schema?: string; event?: RealtimeEvent }
) {
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel(`${table}-db-changes`)
      .on(
        'postgres_changes',
        {
          event: options?.event ?? '*',
          schema: options?.schema ?? 'public',
          table,
        },
        (payload) => {
          onEvent({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new as Record<string, unknown> | null,
            old: payload.old as Record<string, unknown> | null,
          });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [table, options?.event, options?.schema, onEvent]);
}
