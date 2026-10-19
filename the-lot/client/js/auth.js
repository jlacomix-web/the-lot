// Sign-in / sign-up / password reset screens and the avatar creator. Talks to the server's /api.
(async () => {
  const AV = window.TheLotAvatar, doc = document;
  const $ = (tag, attrs = {}, ...kids) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const c of kids.flat()) e.append(c);
    return e;
  };
  const api = async (method, path, data) => {
    const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(data || {}), credentials: 'same-origin' });
    let j = {}; try { j = await r.json(); } catch { /* no body */ }
    if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { status: r.status, code: j.code });
    return j;
  };
  await AV.load();
  const root = $('div', { id: 'auth' }); doc.body.append(root);
  const show = (...nodes) => { root.className = ''; root.replaceChildren(...nodes); };
  const msgEl = () => $('div', { class: 'msg' });
  const setMsg = (el, text, ok) => { el.textContent = text || ''; el.className = 'msg ' + (text ? (ok ? 'ok' : 'err') : ''); };
  const card = (title, text, ...kids) => $('div', { class: 'card' }, $('h2', {}, title), $('p', { class: 'sub' }, text), ...kids);
  const inp = (label, type, auto) => { const input = $('input', { type, autocomplete: auto }); return { input, nodes: [$('label', {}, label), input] }; };
  let user = null;

  function authCard(mode, note) {
    const m = msgEl(), email = inp('Email', 'email', 'email'), name = inp('Display name (shown to other players)', 'text', 'nickname'),
      pw = inp('Password', 'password', mode === 'up' ? 'new-password' : 'current-password');
    if (note) setMsg(m, note, true);
    const tabs = $('div', { class: 'tabs' },
      $('button', { type: 'button', class: 'btn' + (mode === 'in' ? '' : ' alt'), onclick: () => authCard('in') }, 'Sign in'),
      $('button', { type: 'button', class: 'btn' + (mode === 'up' ? '' : ' alt'), onclick: () => authCard('up') }, 'Create account'));
    const go = $('button', { class: 'btn wide', type: 'submit' }, mode === 'in' ? 'Sign in' : 'Create account');
    const form = $('form', {}, ...email.nodes, ...(mode === 'up' ? name.nodes : []), ...pw.nodes,
      ...(mode === 'up' ? [$('div', { class: 'hint' }, 'Use at least 10 characters.')] : []), go, m,
      ...(mode === 'in' ? [$('button', { type: 'button', class: 'linkbtn', onclick: forgot }, 'Forgot your password?')] : []));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); go.disabled = true; setMsg(m, '');
      try {
        if (mode === 'in') { user = (await api('POST', '/api/login', { email: email.input.value, password: pw.input.value })).user; proceed(); return; }
        const r = await api('POST', '/api/signup', { email: email.input.value, displayName: name.input.value, password: pw.input.value });
        if (r.needsVerification) { show(card('Check your email', "If that address can be used, we've sent a confirmation link. Open it, then sign in.", $('button', { class: 'btn wide', onclick: () => authCard('in') }, 'Back to sign in'))); return; }
        user = (await api('POST', '/api/login', { email: email.input.value, password: pw.input.value })).user; proceed();
      } catch (err) { setMsg(m, err.message); }
      go.disabled = false;
    });
    show($('div', { class: 'card' }, $('h2', {}, 'THE LOT'), $('p', { class: 'sub' }, 'Radio City Music Hall Edition · sign in to play'), tabs, form));
  }

  function forgot() {
    const m = msgEl(), email = inp('Email', 'email', 'email'), go = $('button', { class: 'btn wide', type: 'submit' }, 'Email me a reset link');
    const form = $('form', {}, ...email.nodes, go, m, $('button', { type: 'button', class: 'linkbtn', onclick: () => authCard('in') }, 'Back to sign in'));
    form.addEventListener('submit', async (e) => { e.preventDefault(); go.disabled = true;
      try { await api('POST', '/api/password-reset/request', { email: email.input.value }); setMsg(m, "If an account exists for that email, we've sent a reset link.", true); } catch (err) { setMsg(m, err.message); }
      go.disabled = false; });
    show($('div', { class: 'card' }, $('h2', {}, 'Reset password'), $('p', { class: 'sub' }, "We'll email you a link."), form));
  }

  function resetForm(token) {
    const m = msgEl(), pw = inp('New password (10+ characters)', 'password', 'new-password'), go = $('button', { class: 'btn wide', type: 'submit' }, 'Set new password');
    const form = $('form', {}, ...pw.nodes, go, m);
    form.addEventListener('submit', async (e) => { e.preventDefault(); go.disabled = true;
      try { await api('POST', '/api/password-reset/confirm', { token, password: pw.input.value }); authCard('in', 'Password updated. Sign in with your new password.'); return; } catch (err) { setMsg(m, err.message); }
      go.disabled = false; });
    show($('div', { class: 'card' }, $('h2', {}, 'Choose a new password'), $('p', { class: 'sub' }, 'You will be signed out everywhere else.'), form));
  }

  // ---- avatar creator with a live 3D preview ----
  function makePreview(canvas) {
    const T = window.THREE, ren = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }), sc = new T.Scene(), cam = new T.PerspectiveCamera(35, 1, .1, 50);
    sc.add(new T.HemisphereLight(0xdde6ff, 0x40384a, 1.1)); const d = new T.DirectionalLight(0xfff0dd, .7); d.position.set(2, 4, -3); sc.add(d);
    cam.position.set(0, 1.05, -4.3); cam.lookAt(0, .9, 0);
    let av = null, rot = 0, drag = false, alive = true;
    canvas.addEventListener('pointerdown', () => { drag = true; }); addEventListener('pointerup', () => { drag = false; });
    addEventListener('pointermove', (e) => { if (drag) rot += e.movementX * .01; });
    (function loop() {
      if (!alive) return; requestAnimationFrame(loop);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && (canvas.width !== w || canvas.height !== h)) { ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      if (!drag) rot += .008; if (av) av.rotation.y = rot; ren.render(sc, cam);
    })();
    return { set(cfg) { if (av) sc.remove(av); av = AV.build(cfg); sc.add(av); }, dispose() { alive = false; ren.dispose(); } };
  }

  function creator(editing) {
    const cfg = Object.assign({}, user.avatar || AV.random()), O = AV.options;
    const canvas = $('canvas'), opts = $('div', { class: 'opts' }), m = msgEl(), pv = makePreview(canvas), syncs = [];
    const sync = () => syncs.forEach((f) => f());
    function row(key, title, list, kind) {
      const box = $('div', { class: kind === 'sw' ? 'sw' : 'chips' });
      list.forEach((v, i) => {
        const b = $('button', { type: 'button', title: String(v) }, kind === 'sw' ? '' : String(v));
        if (kind === 'sw') b.style.background = v;
        b.addEventListener('click', () => { cfg[key] = i; sync(); pv.set(cfg); }); box.append(b);
      });
      opts.append($('div', { class: 'row' }, $('div', { class: 't' }, title), box));
      syncs.push(() => [...box.children].forEach((b, i) => b.classList.toggle('on', cfg[key] === i)));
    }
    row('body', 'Build', O.body.map((b) => b.name), 'chips'); row('skin', 'Skin tone', O.skin, 'sw');
    row('hairStyle', 'Hair', O.hairStyle, 'chips'); row('hairColor', 'Hair color', O.hairColor, 'sw');
    row('pattern', 'Shirt style', O.pattern, 'chips'); row('shirt', 'Shirt color', O.shirt, 'sw'); row('shirt2', 'Pattern color', O.shirt, 'sw');
    row('pants', 'Pants', O.pants, 'sw'); row('shoes', 'Shoes', O.shoes, 'sw'); row('hat', 'Hat', O.hat, 'chips'); row('glasses', 'Glasses', O.glasses, 'chips');
    const save = $('button', { class: 'btn', onclick: async () => {
      save.disabled = true; setMsg(m, '');
      try { user.avatar = (await api('PUT', '/api/avatar', cfg)).avatar; pv.dispose(); ready(); } catch (err) { setMsg(m, err.message); save.disabled = false; }
    } }, editing ? 'Save avatar' : 'Save & continue');
    const btns = $('div', { class: 'btnrow' }, $('button', { class: 'btn alt', onclick: () => { Object.assign(cfg, AV.random()); sync(); pv.set(cfg); } }, 'Randomize'),
      ...(editing ? [$('button', { class: 'btn alt', onclick: () => { pv.dispose(); ready(); } }, 'Cancel')] : []), save);
    show($('div', { class: 'card wide-card' }, $('h2', {}, editing ? 'Edit your avatar' : 'Create your avatar'), $('p', { class: 'sub' }, 'Other players will see you like this. Drag the preview to turn it.'),
      $('div', { class: 'creator' }, $('div', { class: 'view' }, canvas), $('div', { class: 'optswrap' }, opts, btns, m))));
    sync(); pv.set(cfg);
  }

  function ready() {
    window.THELOT_USER = user; doc.body.classList.remove('auth-pending'); root.className = 'hide';
    if (window.THELOT_SETAVATAR) window.THELOT_SETAVATAR(user.avatar);
    let acct = doc.getElementById('acct');
    if (!acct) { acct = $('div', { id: 'acct' }); doc.getElementById('go').parentElement.append(acct); }
    acct.replaceChildren('Signed in as ', $('b', {}, user.displayName), ' · ',
      $('button', { class: 'linkbtn', onclick: () => { doc.body.classList.add('auth-pending'); creator(true); } }, 'Edit avatar'), ' · ',
      $('button', { class: 'linkbtn', onclick: async () => { try { await api('POST', '/api/logout'); } catch { /* ignore */ } location.reload(); } }, 'Sign out'));
  }
  const proceed = () => (user.avatar ? ready() : creator(false));

  // ---- boot ----
  const qs = new URLSearchParams(location.search);
  const clean = () => history.replaceState(null, '', location.pathname);
  if (qs.get('verify')) {
    clean();
    try { await api('POST', '/api/verify', { token: qs.get('verify') }); authCard('in', 'Email confirmed. You can sign in now.'); }
    catch (e) { show(card('Link problem', e.message, $('button', { class: 'btn wide', onclick: () => authCard('in') }, 'Go to sign in'))); }
    return;
  }
  if (qs.get('reset')) { const t = qs.get('reset'); clean(); resetForm(t); return; }
  try { user = (await api('GET', '/api/me')).user; proceed(); }
  catch (e) {
    if (e.status === 401) authCard('in');
    else show(card("Can't reach the server", 'Check your connection and try again.', $('button', { class: 'btn wide', onclick: () => location.reload() }, 'Retry')));
  }
})();
