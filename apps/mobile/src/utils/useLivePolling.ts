import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Runs `callback` immediately whenever the screen gains focus, then again
 * every `intervalMs` for as long as it stays focused - so an action taken
 * elsewhere (a leave approved, a ticket raised) shows up while the user is
 * sitting on the screen, not only when they navigate away and back. Stops
 * polling the instant the screen loses focus, so background tabs never poll.
 *
 * `callback` must be stable (wrap it in the caller's own `useCallback`) -
 * otherwise a new identity every render would restart the interval every
 * render instead of letting it tick.
 */
export function useLivePolling(callback: () => void, intervalMs = 15_000) {
  useFocusEffect(
    useCallback(() => {
      callback();
      const id = setInterval(callback, intervalMs);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callback, intervalMs]),
  );
}
