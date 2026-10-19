// Builds a low-poly person from a small avatar config (see assets/avatar-options.json).
// The figure faces -z, the same direction the player walks.
(function () {
  const T = window.THREE;
  let OPT = null;
  const KEYS = ['body','skin','hairStyle','hairColor','pattern','shirt','shirt2','pants','shoes','hat','glasses'];
  const LIST = { shirt2: 'shirt' };
  const mat = (o) => new T.MeshLambertMaterial(o);
  const box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);
  const put = (obj, x, y, z, parent) => { obj.position.set(x, y, z); parent.add(obj); return obj; };

  async function load() { if (!OPT) OPT = await (await fetch('assets/avatar-options.json')).json(); return OPT; }

  function random() {
    const c = { v: 1 };
    for (const k of KEYS) c[k] = Math.floor(Math.random() * OPT[LIST[k] || k].length);
    return c;
  }

  function shirtMaterial(kind, c1, c2) {
    if (kind === 0) return mat({ color: c1 });
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); g.fillStyle = c1; g.fillRect(0, 0, 128, 128);
    if (kind === 3) { g.fillStyle = c2; for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 16); }
    else {
      const gr = g.createRadialGradient(64, 64, 2, 64, 64, 90);
      if (kind === 1) [[0, c2], [.35, c1], [.7, c2], [1, c1]].forEach(([s, col]) => gr.addColorStop(s, col));
      else ['#ff3b3b','#ff9f1c','#ffe066','#3ddc84','#3b8bff','#a855f7'].forEach((col, i, a) => gr.addColorStop(i / (a.length - 1), col));
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    return mat({ map: new T.CanvasTexture(c) });
  }

  function unclSamTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#1b3a8a'; g.fillRect(0, 0, 256, 50); g.fillStyle = '#fff';
    for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(8 + (i % 11) * 23 + (i > 10 ? 11 : 0), 12 + (i > 10 ? 24 : 0), 3, 0, 7); g.fill(); }
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#fff' : '#c8202c'; g.fillRect(i * 16, 50, 16, 78); }
    return new T.CanvasTexture(c);
  }

  function build(cfg) {
    const o = OPT, W = o.body[cfg.body].w;
    const skin = mat({ color: o.skin[cfg.skin] }), pants = mat({ color: o.pants[cfg.pants] }), shoe = mat({ color: o.shoes[cfg.shoes] });
    const shirt = shirtMaterial(cfg.pattern, o.shirt[cfg.shirt], o.shirt[cfg.shirt2]);
    const g = new T.Group();
    put(box(.46 * W, .62, .26 * W, shirt), 0, 1.12, 0, g);
    put(box(.44 * W, .2, .25 * W, pants), 0, .82, 0, g);
    put(box(.1, .08, .1, skin), 0, 1.46, 0, g);
    const head = new T.Group(); head.position.set(0, 1.58, 0); g.add(head);
    put(new T.Mesh(new T.SphereGeometry(.15, 14, 12), skin), 0, 0, 0, head);
    for (const x of [-.055, .055]) put(new T.Mesh(new T.SphereGeometry(.018, 8, 6), mat({ color: 0x111111 })), x, .02, -.14, head);
    const limb = (x, y, up, low, len, w) => {
      const p = new T.Group(); p.position.set(x, y, 0); g.add(p);
      put(box(w, len * .5, w, up), 0, -len * .25, 0, p); put(box(w * .9, len * .5, w * .9, low), 0, -len * .75, 0, p); return p;
    };
    const legL = limb(-.11 * W, .72, pants, pants, .72, .17 * W), legR = limb(.11 * W, .72, pants, pants, .72, .17 * W);
    put(box(.17 * W, .1, .3, shoe), 0, -.7, -.05, legL); put(box(.17 * W, .1, .3, shoe), 0, -.7, -.05, legR);
    const armL = limb(-.3 * W, 1.4, shirt, skin, .6, .12), armR = limb(.3 * W, 1.4, shirt, skin, .6, .12);

    const hc = mat({ color: o.hairColor[cfg.hairColor] }), cap = () => new T.Mesh(new T.SphereGeometry(.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * .55), hc);
    switch (cfg.hairStyle) {
      case 1: put(cap(), 0, .01, .01, head); break;
      case 2: put(cap(), 0, .01, .01, head); put(box(.3, .34, .08, hc), 0, -.1, .12, head); break;
      case 3: put(new T.Mesh(new T.SphereGeometry(.24, 14, 12), hc), 0, .06, .03, head); break;
      case 4: put(box(.04, .12, .26, hc), 0, .17, 0, head); break;
      case 5: put(cap(), 0, .01, .01, head); put(new T.Mesh(new T.SphereGeometry(.07, 10, 8), hc), 0, .19, .1, head); break;
    }
    switch (cfg.hat) {
      case 1: { const m = mat({ color: o.shirt[cfg.shirt2] });
        put(new T.Mesh(new T.SphereGeometry(.17, 14, 10, 0, Math.PI * 2, 0, Math.PI * .5), m), 0, .03, 0, head); put(box(.22, .02, .18, m), 0, .06, -.2, head); break; }
      case 2: { put(new T.Mesh(new T.CylinderGeometry(.12, .14, .3, 16), mat({ map: unclSamTexture() })), 0, .26, 0, head);
        put(new T.Mesh(new T.CylinderGeometry(.24, .24, .02, 18), mat({ color: 0xc8202c })), 0, .11, 0, head); break; }
      case 3: { const ring = new T.Mesh(new T.TorusGeometry(.16, .02, 6, 18), mat({ color: 0x2e7d32 })); ring.rotation.x = Math.PI / 2; put(ring, 0, .1, 0, head);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(new T.Mesh(new T.SphereGeometry(.04, 8, 6), mat({ color: i % 3 ? 0xd01a2a : 0xff6b8a })), Math.cos(a) * .16, .11, Math.sin(a) * .16, head); } break; }
      case 4: put(new T.Mesh(new T.CylinderGeometry(.13, .17, .13, 14), mat({ color: 0xc9b37c })), 0, .12, 0, head);
        put(new T.Mesh(new T.CylinderGeometry(.26, .26, .015, 18), mat({ color: 0xc9b37c })), 0, .06, 0, head); break;
    }
    const dark = mat({ color: 0x111111 });
    if (cfg.glasses === 1) { for (const x of [-.06, .06]) put(new T.Mesh(new T.TorusGeometry(.045, .007, 6, 14), dark), x, .02, -.152, head); put(box(.05, .008, .008, dark), 0, .025, -.152, head); }
    if (cfg.glasses === 2) { for (const x of [-.065, .065]) put(box(.1, .05, .015, dark), x, .02, -.153, head); put(box(.3, .012, .01, dark), 0, .035, -.15, head); }
    g.userData = { legL, legR, armL, armR };
    return g;
  }

  // speed: 0 idle, 1 walk, ~1.5 sprint. sit: true = seated pose.
  function animate(g, t, speed, sit) {
    const u = g.userData; if (!u.legL) return;
    g.position.y = 0; g.rotation.z = 0;
    if (sit) { u.legL.rotation.x = u.legR.rotation.x = 1.45; u.armL.rotation.x = u.armR.rotation.x = .5; return; }
    const s = speed ? Math.sin(t * 9 * speed) * .7 : 0;
    u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * .8; u.armR.rotation.x = s * .8;
  }

  // Emotes: 0 wave, 1 dance, 2 cheer, 3 clap, 4 point. t = seconds since the emote started.
  function emote(g, t, id, sit) {
    const u = g.userData; if (!u.legL) return;
    animate(g, 0, 0, sit);
    switch (id) {
      case 0: u.armR.rotation.x = 2.9; u.armR.rotation.z = Math.sin(t * 10) * .45; break;
      case 1: { const s = Math.sin(t * 6); u.armL.rotation.x = 2.2 * Math.max(0, s); u.armR.rotation.x = 2.2 * Math.max(0, -s);
        if (!sit) { u.legL.rotation.x = s * .5; u.legR.rotation.x = -s * .5; g.position.y = Math.abs(s) * .07; } g.rotation.z = s * .06; break; }
      case 2: u.armL.rotation.x = u.armR.rotation.x = 2.9; u.armL.rotation.z = -.25; u.armR.rotation.z = .25; if (!sit) g.position.y = Math.abs(Math.sin(t * 7)) * .14; break;
      case 3: { const c = .12 + .22 * Math.max(0, Math.sin(t * 14)); u.armL.rotation.x = u.armR.rotation.x = 1.4; u.armL.rotation.z = c; u.armR.rotation.z = -c; break; }
      case 4: u.armR.rotation.x = 1.5; break;
    }
  }

  window.TheLotAvatar = { load, build, animate, emote, random, get options() { return OPT; } };
})();
