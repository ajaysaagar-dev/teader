export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initWebSocketServer } = await import('./server/ws-server');
      initWebSocketServer();
    } catch (err: any) {
      console.warn('[Realtime Server Auto-Init Note]:', err.message);
    }
  }
}
