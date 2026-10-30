// Persistent global connection to server WebSocket for real-time announcements & updates

let globalWs: WebSocket | null = null;
let reconnectTimer: number | undefined;

export function initGlobalSync(): () => void {
  let isTornDown = false;

  const connect = () => {
    if (isTornDown) return;
    if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      globalWs = ws;

      ws.onopen = () => {
        // Send a lightweight lobby subscribe so server tracks connection in socketMetaMap
        try {
          ws.send(
            JSON.stringify({
              type: 'lobby:subscribe',
              clientId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: 'Pengguna Monsta',
            })
          );
        } catch {
          // Ignore
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data && (data.type === 'global:update' || data.type === 'global:announcement')) {
            window.dispatchEvent(new CustomEvent('monsta:global_message', { detail: data }));
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        globalWs = null;
        if (!isTornDown) {
          reconnectTimer = window.setTimeout(connect, 4000);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // Ignore
        }
      };
    } catch {
      if (!isTornDown) {
        reconnectTimer = window.setTimeout(connect, 4000);
      }
    }
  };

  connect();

  return () => {
    isTornDown = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (globalWs) {
      try {
        globalWs.close();
      } catch {
        // Ignore
      }
      globalWs = null;
    }
  };
}
