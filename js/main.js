// Wires the village state, the scene and the on-screen controls together.
(function () {
  const { Grid: G, Roads: R, Decorate: D, Spot, Cats, Sheet, Models, Scene } = window.BV;
  const KEY = 'bv-village-v1';
  const $ = id => document.getElementById(id);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: play without saving */ } },
  };
  // Korean particles by final consonant
  const hasFinal = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c % 28 !== 0; };
  const eul = w => w + (hasFinal(w) ? '을' : '를');

  function exampleVillage() {
    const v = G.create();
    const P = (kind, ref, x, z, rot) => G.place(v, { kind, ref: String(ref), x, z, rot });
    for (let x = 2; x <= 21; x++) P('road', 'road', x, 8, 0);
    [[0, 3], [10, 6], [23, 13], [6, 16]].forEach(([r, x]) => P('house', r, x, 6, 0));
    P('model', 'cottage', 9, 6, 0); P('model', 'greenhouse', 19, 6, 0);
    [[14, 3], [33, 6], [40, 13], [47, 19]].forEach(([r, x]) => P('house', r, x, 9, 2));
    P('model', 'tripleGable', 9, 9, 2); P('model', 'storeBox', 16, 9, 2);
    P('model', 'tower', 10, 15, 2); P('model', 'castle', 15, 16, 2);
    P('house', 44, 5, 15, 1); P('house', 23, 19, 15, 3); P('house', 37, 4, 19, 1);
    R.autoConnect(v).forEach(([x, z]) => P('road', 'road', x, z, 0));
    D.plan(v, 7).forEach(d => G.place(v, d));
    return v;
  }

  let houses = [];
  let v = G.deserialize(store.get(KEY) || '') || exampleVillage();
  const h = new G.History(v);

  // mode: idle | place | paint | erase | move
  const st = { mode: 'idle', spec: null, sel: null, cat: Cats.CATS[0].id, viewing: false, nightTarget: 0, phase: 0 };
  let scene;

  const nameOf = it => it.kind === 'house' ? '집 ' + (+it.ref + 1) : it.kind === 'model' ? Models.NAMES[it.ref] : it.kind === 'road' ? '길' : (Models.DECO_NAMES[it.ref] || '꾸미기');
  const selItem = () => v.items.find(i => i.id === st.sel) || null;

  let toastTimer;
  function toast(msg, good) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show'); t.classList.toggle('good', !!good);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function changed(popId) {
    store.set(KEY, G.serialize(v));
    if (st.sel && !selItem()) st.sel = null;
    scene.sync(v, popId);
    scene.setSelected(selItem());
    $('bUndo').disabled = !h.past.length;
    $('bRedo').disabled = !h.future.length;
  }

  // ---------- hint strip
  function btn(label, fn, cls) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', fn); return b; }
  function renderHint() {
    const el = $('hint'); el.replaceChildren();
    const text = document.createElement('span'); el.append(text);
    const it = selItem();
    const strong = s => { const b = document.createElement('b'); b.textContent = s; return b; };
    if (st.mode === 'place') {
      text.append(strong(nameOf(st.spec)), ' 칸을 눌러 놓으세요');
      if (st.spec.kind !== 'road') el.append(btn('돌리기', rotateAction));
      el.append(btn('그만', cancel));
    } else if (st.mode === 'paint') {
      text.append(strong('길'), ' 칸을 누르거나 끌어서 깔아요');
      el.append(btn('그만', cancel));
    } else if (st.mode === 'erase') {
      text.append(strong('지우개'), ' 누르거나 끌어서 지워요');
      el.append(btn('그만', cancel));
    } else if (st.mode === 'move' && it) {
      text.append(strong(nameOf(it)), ' 옮길 칸을 누르세요');
      el.append(btn('그만', () => { st.mode = 'idle'; scene.setGhost(null); renderHint(); }));
    } else if (it) {
      text.append(strong(nameOf(it)));
      if (it.kind !== 'road') el.append(btn('돌리기', rotateAction), btn('옮기기', startMove));
      el.append(btn('지우기', deleteSel, 'danger'), btn('닫기', () => select(null)));
    } else {
      text.textContent = '분류를 고르고 카드를 눌러 마을에 놓아 보세요. 놓인 건물을 누르면 고칠 수 있어요.';
    }
  }

  // ---------- drawer: category tabs, cards wrap instead of scrolling sideways
  const thumbs = {};
  function svgIcon(body) { return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#3f7fe8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`); }
  const ICONS = {
    road: svgIcon('<rect x="8" y="22" width="48" height="20" rx="3" fill="#d0defa"/><path d="M14 32h8M28 32h8M42 32h8"/>'),
    erase: svgIcon('<path d="M14 44l18-24 16 12-12 16H20z" fill="#fff"/><path d="M22 34l12 9M12 52h40"/>'),
  };
  const thumb = (kind, ref) => thumbs[kind + ':' + ref] || (thumbs[kind + ':' + ref] = scene.thumbnail(kind, ref));
  function cardsFor(cat) {
    const c = Cats.CATS.find(x => x.id === cat) || Cats.CATS[0];
    const out = [];
    (c.houses || []).forEach(i => out.push({ kind: 'house', ref: String(i), name: '집 ' + (i + 1), img: houses[i] ? houses[i].thumb : thumb('house', String(i)) }));
    (c.models || []).forEach(r => out.push({ kind: 'model', ref: r, name: Models.NAMES[r], img: thumb('model', r) }));
    (c.deco || []).forEach(r => out.push(r === 'road' ? { kind: 'road', ref: 'road', name: '길', img: ICONS.road }
      : r === 'erase' ? { kind: 'erase', ref: 'erase', name: '지우개', img: ICONS.erase }
        : { kind: 'deco', ref: r, name: Models.DECO_NAMES[r], img: thumb('deco', r) }));
    return out;
  }
  function renderTabs() {
    const box = $('tabs'); box.replaceChildren();
    Cats.CATS.forEach(c => {
      const n = (c.houses || []).length + (c.models || []).length + (c.deco || []).length;
      const b = btn(c.name, () => { st.cat = c.id; renderTabs(); renderCards(); });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-pressed', String(st.cat === c.id));
      b.setAttribute('aria-selected', String(st.cat === c.id));
      const s = document.createElement('small'); s.textContent = n; b.append(s);
      box.append(b);
    });
  }
  function isActive(c) {
    return (st.mode === 'place' && st.spec && st.spec.kind === c.kind && st.spec.ref === c.ref) ||
      (st.mode === 'paint' && c.kind === 'road') || (st.mode === 'erase' && c.kind === 'erase');
  }
  function renderCards() {
    const box = $('cards'); box.replaceChildren();
    cardsFor(st.cat).forEach(c => {
      const pick = document.createElement('button'); pick.type = 'button'; pick.className = 'pick';
      pick.setAttribute('aria-pressed', String(isActive(c)));
      const img = document.createElement('img'); img.alt = ''; img.src = c.img;
      const label = document.createElement('small'); label.textContent = c.name;
      pick.append(img, label);
      pick.addEventListener('click', () => chooseCard(c));
      box.append(pick);
    });
  }

  function chooseCard(c) {
    const same = isActive(c);
    select(null, true);
    if (same) { cancel(); return; }
    if (c.kind === 'road') setMode('paint');
    else if (c.kind === 'erase') setMode('erase');
    else { st.spec = { kind: c.kind, ref: c.ref, rot: 0 }; setMode('place'); }
  }

  function setMode(m) {
    st.mode = m;
    const painting = m === 'paint' || m === 'erase';
    document.body.classList.toggle('painting', painting);
    scene.controls.enableRotate = !painting;
    if (m !== 'place' && m !== 'move') scene.setGhost(null);
    renderHint(); renderCards();
  }
  function cancel() { st.spec = null; setMode('idle'); }

  function select(id, quiet) {
    st.sel = id;
    if (st.mode === 'move') { st.mode = 'idle'; scene.setGhost(null); }
    scene.setSelected(selItem());
    if (!quiet) renderHint();
  }

  // ---------- actions
  function centred(spec, cell) {
    const [w, d] = G.sized(spec.kind, spec.ref, spec.rot || 0);
    return { ...spec, w, d, x: cell[0] - Math.floor((w - 1) / 2), z: cell[1] - Math.floor((d - 1) / 2) };
  }
  let lastCell = null;
  function updateGhost(cell) {
    lastCell = cell;
    if (!cell) { scene.setGhost(null); return; }
    if (st.mode === 'place') {
      const g = centred(st.spec, cell);
      scene.setGhost({ ...g, ok: G.canPlace(v, g) });
    } else if (st.mode === 'move') {
      const it = selItem(); if (!it) return;
      const g = { ...it, x: cell[0] - Math.floor((it.w - 1) / 2), z: cell[1] - Math.floor((it.d - 1) / 2) };
      scene.setGhost({ ...g, ok: G.canPlace(v, g, it.id) });
    }
  }

  function rotateAction() {
    if (st.mode === 'place') { st.spec.rot = (st.spec.rot + 1) % 4; updateGhost(lastCell); return; }
    const it = selItem(); if (!it || it.kind === 'road') return;
    const ok = h.commit(() => G.rotate(v, it.id));
    if (!ok) toast('돌리면 옆 칸과 겹쳐서 돌릴 수 없어요');
    changed(it.id);
  }
  function startMove() { st.mode = 'move'; renderHint(); updateGhost(lastCell); }
  function deleteSel() {
    const it = selItem(); if (!it) return;
    h.commit(() => G.remove(v, it.id));
    st.sel = null; changed(); renderHint();
    toast(eul(nameOf(it)) + ' 지웠어요 · 되돌리기로 살릴 수 있어요');
  }

  function tap(cx, cy) {
    const cell = scene.pickCell(cx, cy);
    if (st.mode === 'place') {
      if (!cell) return;
      const g = centred(st.spec, cell);
      const id = h.commit(() => G.place(v, g));
      if (id) changed(id); else toast('여기엔 놓을 수 없어요. 파란 칸이 보이는 곳에 놓아 주세요');
      updateGhost(cell);
      return;
    }
    if (st.mode === 'move') {
      const it = selItem(); if (!it || !cell) return;
      const x = cell[0] - Math.floor((it.w - 1) / 2), z = cell[1] - Math.floor((it.d - 1) / 2);
      if (h.commit(() => G.move(v, it.id, x, z))) { st.mode = 'idle'; scene.setGhost(null); changed(it.id); renderHint(); }
      else toast('그 자리는 다른 것과 겹쳐요');
      return;
    }
    if (st.mode === 'idle') {
      let id = scene.pickItemId(cx, cy);
      if (!id && cell) { const it = G.itemAt(v, cell[0], cell[1]); id = it ? it.id : null; }
      select(id || null);
    }
  }

  // ---------- pointer: tap vs. drag, and paint strokes
  const canvas = $('scene');
  let down = null, stroke = null;
  function paintAt(cx, cy) {
    const cell = scene.pickCell(cx, cy); if (!cell) return;
    const k = cell.join(); if (stroke.done.has(k)) return; stroke.done.add(k);
    if (st.mode === 'paint') { if (G.place(v, { kind: 'road', ref: 'road', x: cell[0], z: cell[1], rot: 0 })) scene.sync(v); }
    else { const it = G.itemAt(v, cell[0], cell[1]); if (it) { G.remove(v, it.id); scene.sync(v); } }
  }
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, multi: down && down.id !== e.pointerId };
    if ((st.mode === 'paint' || st.mode === 'erase') && e.isPrimary) {
      stroke = { before: G.serialize(v), done: new Set() };
      canvas.setPointerCapture(e.pointerId);
      paintAt(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (stroke) { paintAt(e.clientX, e.clientY); return; }
    if (e.pointerType === 'mouse' && (st.mode === 'place' || st.mode === 'move')) updateGhost(scene.pickCell(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointerup', e => {
    if (stroke) { h.record(stroke.before); stroke = null; changed(); return; }
    if (down && !down.multi && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7) tap(e.clientX, e.clientY);
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { if (stroke) { h.record(stroke.before); stroke = null; changed(); } down = null; });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && st.mode === 'place') scene.setGhost(null); });

  // ---------- toolbar
  function undo() { if (h.undo()) { changed(); renderHint(); } }
  function redo() { if (h.redo()) { changed(); renderHint(); } }
  $('bUndo').addEventListener('click', undo);
  $('bRedo').addEventListener('click', redo);
  $('bRoads').addEventListener('click', () => {
    const cells = R.autoConnect(v);
    if (!cells.length) { toast('더 이을 길이 없어요. 건물 앞칸이 막혀 있으면 이을 수 없어요'); return; }
    h.commit(() => cells.forEach(([x, z]) => G.place(v, { kind: 'road', ref: 'road', x, z, rot: 0 })));
    changed(); toast(`길 ${cells.length}칸을 깔았어요`);
  });
  $('bDeco').addEventListener('click', () => {
    const plan = D.plan(v, (Date.now() & 0xffffff) + 1);
    if (!plan.length) { toast('꾸밀 빈자리가 없어요'); return; }
    h.commit(() => plan.forEach(d => G.place(v, d)));
    changed(); toast(`꾸미기 ${plan.length}개를 놓았어요 · 마음에 안 들면 되돌리기`);
  });
  $('bNight').addEventListener('click', () => {
    st.nightTarget = st.nightTarget ? 0 : 1;
    $('bNight').setAttribute('aria-pressed', String(!!st.nightTarget));
    $('bNight').textContent = st.nightTarget ? '낮' : '밤';
  });
  function enterView() {
    cancel(); select(null);
    st.viewing = true; st.phase = st.nightTarget ? 0.5 : 0;
    document.body.classList.add('appreciate');
    scene.grid.visible = false;
    scene.controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scene.startCars();
  }
  function exitView() {
    if (!st.viewing) return;
    st.viewing = false;
    document.body.classList.remove('appreciate');
    scene.grid.visible = true; scene.controls.autoRotate = false; scene.stopCars();
  }
  $('bView').addEventListener('click', enterView);
  $('exitView').addEventListener('click', exitView);

  const pop = $('menuPop');
  $('bMenu').addEventListener('click', () => { pop.hidden = !pop.hidden; $('bMenu').setAttribute('aria-expanded', String(!pop.hidden)); });
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('.menu')) { pop.hidden = true; $('bMenu').setAttribute('aria-expanded', 'false'); } });
  $('bNew').addEventListener('click', () => {
    h.commit(() => { v.items = []; }); select(null); changed(); pop.hidden = true;
    toast('새 마을을 시작했어요 · 되돌리기로 되살릴 수 있어요');
  });
  $('bExample').addEventListener('click', () => {
    const ex = exampleVillage();
    h.commit(() => { v.items = ex.items; v.nextId = ex.nextId; }); select(null); changed(); pop.hidden = true;
    toast('예시 마을을 다시 지었어요');
  });

  // ---------- spot the difference
  const spot = { a: null, b: null, round: null, found: new Set(), lastSeed: 0, open: false };
  function copyCam(from, to) {
    to.camera.position.copy(from.camera.position);
    to.controls.target.copy(from.controls.target);
    to.controls.update();
  }
  function setupSpot() {
    spot.a = Scene.create($('spotA'), { grid: false });
    spot.b = Scene.create($('spotB'), { grid: false });
    let lock = false;
    [[spot.a, spot.b], [spot.b, spot.a]].forEach(([x, y]) => {
      x.controls.enableDamping = false;
      x.controls.addEventListener('change', () => { if (lock) return; lock = true; copyCam(x, y); lock = false; });
    });
    [[spot.a, $('spotA')], [spot.b, $('spotB')]].forEach(([s, cv]) => {
      let d = null;
      cv.addEventListener('pointerdown', e => { d = { x: e.clientX, y: e.clientY, id: e.pointerId, multi: d && d.id !== e.pointerId }; });
      cv.addEventListener('pointerup', e => {
        if (d && !d.multi && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) spotTap(s, e.clientX, e.clientY);
        d = null;
      });
    });
  }
  function renderScore() {
    const el = $('spotScore'); el.replaceChildren();
    const total = spot.round.diffs.length;
    el.append(`찾은 곳 ${spot.found.size} / ${total}`);
    const dots = document.createElement('span'); dots.className = 'dots';
    spot.round.diffs.forEach(d => { const i = document.createElement('i'); if (spot.found.has(d)) i.className = 'on'; dots.append(i); });
    el.append(dots);
    $('spotNew').classList.toggle('primary', spot.found.size === total);
  }
  function newRound() {
    let seed;
    do { seed = 1 + Math.floor(Math.random() * 1e9); } while (seed === spot.lastSeed);
    spot.lastSeed = seed;
    spot.round = Spot.makeDiffs(v, 5, seed, houses.length || 50);
    spot.found = new Set();
    spot.a.sync(v); spot.b.sync(spot.round.village);
    spot.a.clearMarkers(); spot.b.clearMarkers();
    renderScore();
  }
  function spotTap(s, cx, cy) {
    const d = Spot.hit(spot.round.diffs, s.pickItemId(cx, cy), s.pickCell(cx, cy));
    if (!d) { toast('거기는 똑같아요'); return; }
    if (spot.found.has(d)) { toast('이미 찾은 곳이에요'); return; }
    spot.found.add(d);
    spot.a.addMarker(d); spot.b.addMarker(d);
    renderScore();
    if (spot.found.size === spot.round.diffs.length) toast('다 찾았어요! [새 문제]로 또 해 보세요', true);
    else toast(d.label, true);
  }
  function openSpot() {
    const n = v.items.filter(i => i.kind !== 'road').length;
    if (n < 6) { toast('마을을 조금 더 지어 주세요. 길 말고 6개 이상 있으면 할 수 있어요'); return; }
    exitView(); cancel(); select(null);
    $('spot').hidden = false; spot.open = true;
    scene.paused = true;
    if (!spot.a) setupSpot();
    spot.a.paused = spot.b.paused = false;
    spot.a.resize(); spot.b.resize();
    // start a little closer than the build view: each half is narrower
    const t = scene.controls.target, p = scene.camera.position.clone().sub(t).multiplyScalar(0.8).add(t);
    spot.a.camera.position.copy(p); spot.a.controls.target.copy(t); spot.a.controls.update();
    copyCam(spot.a, spot.b);
    newRound();
  }
  function closeSpot() {
    $('spot').hidden = true; spot.open = false;
    spot.a.paused = spot.b.paused = true;
    scene.paused = false;
  }
  $('bSpot').addEventListener('click', openSpot);
  $('spotNew').addEventListener('click', newRound);
  $('spotExit').addEventListener('click', closeSpot);
  $('spotHint').addEventListener('click', () => {
    const d = spot.round.diffs.find(x => !spot.found.has(x));
    if (!d) { toast('다 찾았어요! [새 문제]를 눌러 보세요'); return; }
    spot.a.addMarker(d, 0xf2a516, 1.6); spot.b.addMarker(d, 0xf2a516, 1.6);
    toast('노란 동그라미 근처를 잘 보세요');
  });
  window.addEventListener('resize', () => { if (spot.open) { spot.a.resize(); spot.b.resize(); } });

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (spot.open) { if (k === 'escape') closeSpot(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); }
    else if (k === 'r') rotateAction();
    else if (k === 'escape') { if (st.viewing) exitView(); else if (st.mode !== 'idle') cancel(); else select(null); }
    else if ((k === 'delete' || k === 'backspace') && st.sel) deleteSel();
  });

  // ---------- start
  function start() {
    scene = Scene.create(canvas);
    scene.onFrame = (dt) => {
      let target = st.nightTarget;
      if (st.viewing) { st.phase = (st.phase + dt / 60) % 1; target = 0.5 - 0.5 * Math.cos(st.phase * Math.PI * 2); }
      const n = scene.night;
      if (Math.abs(n - target) > 0.002) {
        const next = st.viewing ? target : n + (target - n) * Math.min(1, dt * 2.5);
        scene.setNight(next);
        document.body.classList.toggle('night', next > 0.5);
      }
    };
    changed(); renderHint(); renderTabs(); renderCards();
    $('loading').remove();
  }
  // card pictures come from the drawing sheet; the game still works if it fails to load
  const img = new Image();
  img.onload = () => { try { houses = Sheet.load(img, 5, 10); } catch (e) { houses = []; } start(); };
  img.onerror = () => { houses = []; start(); };
  img.src = 'assets/sheet1.webp';
})();
