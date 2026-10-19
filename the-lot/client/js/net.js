// Live connection to the game server (/ws). Reconnects with backoff; stops if you sign in elsewhere.
(function () {
  const handlers = {};
  let ws = null, tries = 0, opened = false, stopped = false;
  const emit = (type, m) => { const h = handlers[type]; if (h) h(m); };
  function open() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    emit('status', tries ? 'reconnecting' : 'connecting');
    ws.onopen = () => { tries = 0; opened = true; emit('status', 'online'); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m && m.type) emit(m.type, m); };
    ws.onclose = (ev) => {
      ws = null;
      if (stopped) return;
      if (ev.code === 4000) { stopped = true; emit('status', 'elsewhere'); return; }
      if (ev.code === 4001 || ev.code === 4003) { stopped = true; emit('status', ev.code === 4001 ? 'banned' : 'kicked'); return; }
      tries++;
      if (!opened && tries >= 3) { // never connected: probably signed out
        fetch('/api/me', { credentials: 'same-origin' }).then((r) => { if (r.status === 401) location.reload(); }).catch(() => {});
        stopped = true; emit('status', 'offline'); return;
      }
      emit('status', 'reconnecting');
      setTimeout(open, Math.min(8000, 500 * 2 ** tries));
    };
    ws.onerror = () => {};
  }
  window.TheLotNet = {
    on(type, fn) { handlers[type] = fn; },
    connect() { if (!ws && !stopped) open(); },
    send(obj) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } return false; },
    ready: () => !!ws && ws.readyState === 1,
  };
})();
