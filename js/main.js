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
  const st = { color: 106, hue: 0, tone: 6, dropper: false, mode: 'idle', spec: null, sel: null, cat: Cats.CATS[0].id, viewing: false, nightTarget: 0, phase: 0 };
  let scene;

  const painted = () => v.items.some(i => i.paint) || !!v.floor || v.ground !== undefined;
  let wasRainbow = null;
  function updateTitle() {
    const r = painted();
    const name = r ? '무지개 마을' : '파란 선 마을';
    const h1 = document.querySelector('h1');
    h1.textContent = name; h1.classList.toggle('rainbow-text', r);
    document.title = name;
    if (wasRainbow === false && r) toast('🌈 무지개 마을이 되었어요!', true);
    wasRainbow = r;
  }
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
    updateTitle();
  }

  // ---------- hint strip
  function btn(label, fn, cls) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.addEventListener('click', fn); return b; }
  function renderHint() {
    const el = $('hint'); el.replaceChildren(); el.classList.remove('idle');
    const text = document.createElement('span'); el.append(text);
    const it = selItem();
    const strong = s => { const b = document.createElement('b'); b.textContent = s; return b; };
    if (st.mode === 'place') {
      text.append(strong(nameOf(st.spec)), ' 칸을 눌러 놓으세요');
      if (st.spec.kind !== 'road') el.append(btn('돌리기', rotateAction));
      el.append(btn('그만', cancel));
    } else if (st.mode === 'color') {
      if (st.dropper) text.append(strong('스포이드'), ' 색을 집을 곳을 누르세요');
      else {
        const dot = document.createElement('i'); dot.className = 'dot'; dot.style.background = st.color < 0 ? '#fff' : hexCss(st.color);
        text.append(dot, strong(st.color < 0 ? '지우기' : Models.colorName(st.color)), ' 누르기·끌기·길게');
      }
      el.append(btn('🌈 자동', rainbowAll), btn('그만', cancel));
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
      el.classList.add('idle'); // phones hide this strip to keep the board free
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
      const b = btn(c.name, () => { st.cat = c.id; setFold(false); renderTabs(); renderCards(); $('cards').scrollLeft = 0; });
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
    document.body.classList.toggle('coloring', m === 'color');
    if (m !== 'color') st.dropper = false;
    $('bPaint').setAttribute('aria-pressed', String(m === 'color'));
    if (m === 'color') renderPalette();
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

  // ---------- colour paint: buildings (one surface at a time), roads, floor cells, the round land
  const RECENT = 'bv-recent-colors';
  let recent = [];
  try { recent = JSON.parse(store.get(RECENT) || '[]').filter(Models.validColor).slice(0, 6); } catch (e) { recent = []; }
  const hexCss = c => '#' + Models.colorHex(c).toString(16).padStart(6, '0');
  const ERASER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20l-4-4 10-10 6 6-8 8z"/><path d="M8 20h12M10 10l6 6"/></svg>';
  const DROPPER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4l6 6M17 7l-9.5 9.5L5 19l-1 1M15 5l4 4"/><path d="M12 9l3 3"/></svg>';
  function useColor(c) {
    st.color = c; st.dropper = false;
    if (c >= 100) { st.hue = Math.floor((c - 100) / 16); st.tone = (c - 100) % 16; }
    renderPalette(); renderHint();
  }
  function remember(c) {
    if (c < 0 || recent[0] === c) return;
    recent = [c, ...recent.filter(x => x !== c)].slice(0, 6);
    store.set(RECENT, JSON.stringify(recent));
    renderPalette();
  }
  function iconBtn(svg, label, on, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mini';
    b.innerHTML = svg; b.setAttribute('aria-label', label); b.title = label; b.setAttribute('aria-pressed', String(on));
    b.addEventListener('click', fn); return b;
  }
  function renderPalette() {
    const box = $('palette'); box.replaceChildren();
    const strip = (label, list) => {
      const row = document.createElement('div'); row.className = 'strip'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', label);
      list.forEach(([c, name, on, fn]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'seg';
        b.style.setProperty('--c', hexCss(c)); b.setAttribute('aria-label', name); b.title = name; b.setAttribute('aria-pressed', String(on));
        b.addEventListener('click', fn); row.append(b);
      });
      box.append(row);
    };
    strip('색상 16가지', Array.from({ length: 16 }, (_, hu) => [Models.code(hu, hu === 15 ? 8 : 6), Models.HUE_NAMES[hu], st.color >= 100 && st.hue === hu, () => { st.hue = hu; useColor(Models.code(hu, st.tone)); }]));
    strip('밝기 16단계', Array.from({ length: 16 }, (_, t) => { const c = Models.code(st.hue, t); return [c, Models.colorName(c), st.color === c, () => useColor(c)]; }));
    const row = document.createElement('div'); row.className = 'tools-row';
    const cur = document.createElement('span'); cur.className = 'cur' + (st.color < 0 ? ' white' : ''); cur.title = '지금 색';
    cur.style.setProperty('--c', st.color < 0 ? '#ffffff' : hexCss(st.color));
    row.append(cur);
    recent.forEach(c => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sw';
      b.style.setProperty('--c', hexCss(c)); b.setAttribute('aria-label', '최근 색 ' + Models.colorName(c)); b.title = '최근 색';
      b.addEventListener('click', () => useColor(c)); row.append(b);
    });
    const grow = document.createElement('span'); grow.className = 'grow'; row.append(grow);
    row.append(iconBtn(ERASER, '지우기 (하얗게)', st.color < 0 && !st.dropper, () => useColor(-1)),
      iconBtn(DROPPER, '스포이드 (칠한 색 집기)', st.dropper, () => { st.dropper = !st.dropper; renderPalette(); renderHint(); }));
    box.append(row);
  }
  function setPaint(it, idxs, ci) {
    const p = { ...(it.paint || {}) };
    idxs.forEach(i => { if (ci < 0) delete p[i]; else p[i] = ci; });
    if (Object.keys(p).length) it.paint = p; else delete it.paint;
  }
  function setFloor(k, c) {
    v.floor = { ...(v.floor || {}) };
    if (c < 0) delete v.floor[k]; else v.floor[k] = c;
    if (!Object.keys(v.floor).length) delete v.floor;
  }
  function surfaceAt(cx, cy) {
    const part = scene.pickPart(cx, cy);
    if (part) { const it = v.items.find(i => i.id === part.itemId); if (it) return { type: 'part', it, idx: part.idx, base: part.base }; }
    const cell = scene.pickCell(cx, cy);
    if (cell) {
      const it = G.itemAt(v, cell[0], cell[1]);
      if (it && it.kind === 'road') return { type: 'road', it, cell };
      return { type: 'floor', cell, under: it };
    }
    return scene.hitsGround(cx, cy) ? { type: 'ground' } : null;
  }
  const codeAt = s => s.type === 'part' ? (s.it.paint || {})[s.idx] : s.type === 'road' ? (s.it.paint || {})[0]
    : s.type === 'floor' ? (v.floor || {})[s.cell.join()] : v.ground;
  function paintSurface(s, c) {
    if (s.type === 'part') setPaint(s.it, [s.idx], c);
    else if (s.type === 'road') setPaint(s.it, [0], c);
    else if (s.type === 'floor') setFloor(s.cell.join(), c);
    else if (c < 0) delete v.ground; else v.ground = c;
  }
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function connectedRoads(cell) {
    const roads = new Map(v.items.filter(i => i.kind === 'road').map(r => [r.x + ',' + r.z, r]));
    const seen = new Set([cell.join()]), q = [cell], out = [];
    while (q.length) {
      const [x, z] = q.pop(); out.push(roads.get(x + ',' + z));
      N4.forEach(([dx, dz]) => { const k = (x + dx) + ',' + (z + dz); if (roads.has(k) && !seen.has(k)) { seen.add(k); q.push([x + dx, z + dz]); } });
    }
    return out;
  }
  // same-colour floor area, bounded by roads (like the lines of a colouring book); buildings sit on top of it
  function floodFloor(cell, orig) {
    const roads = new Set(v.items.filter(i => i.kind === 'road').map(r => r.x + ',' + r.z));
    const f = v.floor || {};
    const seen = new Set([cell.join()]), q = [cell];
    while (q.length) {
      const [x, z] = q.pop();
      N4.forEach(([dx, dz]) => {
        const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
        if (nx < 0 || nz < 0 || nx >= v.size || nz >= v.size || seen.has(k) || roads.has(k) || f[k] !== orig) return;
        seen.add(k); q.push([nx, nz]);
      });
    }
    return [...seen];
  }
  function paintTap(cx, cy, whole) {
    const s = surfaceAt(cx, cy);
    if (!s) { toast('건물, 길, 바닥을 눌러 칠해요'); return; }
    if (st.dropper) {
      const c = codeAt(s);
      useColor(c === undefined ? -1 : c);
      toast(c === undefined ? '칠하지 않은 곳이라 지우기를 골랐어요' : Models.colorName(c) + ' 색을 집었어요');
      return;
    }
    const c = st.color;
    if (!whole || s.type === 'ground') { h.commit(() => paintSurface(s, c)); changed(); }
    else if (s.type === 'part') {
      // walls and roofs/leaves take the colour; windows stay light so the house still reads
      const parts = scene.paintParts(s.it.id).filter(p => p.base !== 'win' || c < 0).map(p => p.idx);
      h.commit(() => setPaint(s.it, parts, c));
      changed(s.it.id);
      toast(c < 0 ? eul(nameOf(s.it)) + ' 하얗게 되돌렸어요' : nameOf(s.it) + ' 통째로 칠했어요');
    } else if (s.type === 'road') {
      const net = connectedRoads(s.cell);
      h.commit(() => net.forEach(r => setPaint(r, [0], c))); changed();
      toast(`이어진 길 ${net.length}칸을 칠했어요`);
    } else {
      const cells = floodFloor(s.cell, codeAt(s));
      h.commit(() => cells.forEach(k => setFloor(k, c))); changed();
      toast(`바닥 ${cells.length}칸을 한 번에 칠했어요`);
    }
    remember(c);
  }
  // rainbow stripes across the village: buildings in bands, roofs one step on, leaves green,
  // floor in pale rainbow bands, roads light grey, the round land soft green
  function rainbowAll() {
    const things = v.items.filter(i => i.kind !== 'road');
    const n = Models.PALETTE.length;
    const diag = it => (it.x + it.w / 2) - (it.z + it.d / 2);
    const lo = things.length ? Math.min(...things.map(diag)) : 0, hi = things.length ? Math.max(...things.map(diag)) : 1;
    const BAND_HUES = [0, 1, 3, 5, 8, 9, 11, 13];
    h.commit(() => {
      things.forEach(it => {
        const parts = scene.paintParts(it.id); if (!parts.length) return;
        const band = Math.min(n - 1, Math.floor((diag(it) - lo) / (hi - lo + 1e-6) * n));
        const p = {};
        parts.forEach(({ idx, base }) => {
          if (base === 'win') return;
          if (it.kind === 'deco') { if (base === 'soft') p[idx] = (idx + it.id) % 2 ? 3 : 4; return; }
          p[idx] = base === 'soft' ? (band + 1) % n : band;
        });
        if (Object.keys(p).length) it.paint = p; else delete it.paint;
      });
      const f = {};
      for (let x = 0; x < v.size; x++) for (let z = 0; z < v.size; z++) {
        const band = Math.min(7, Math.floor((x - z + v.size) / (v.size * 2) * 8));
        f[x + ',' + z] = Models.code(BAND_HUES[band], 1);
      }
      v.floor = f;
      v.items.filter(i => i.kind === 'road').forEach(r => { r.paint = { 0: Models.code(15, 4) }; });
      v.ground = Models.code(4, 1);
    });
    changed(); $('menuPop').hidden = true;
    toast('🌈 마을을 무지개로 칠했어요 · 마음에 안 들면 되돌리기', true);
  }

  function tap(cx, cy) {
    if (st.mode === 'color') { paintTap(cx, cy, false); return; }
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
  let longT = null, longDone = false, cstroke = null;
  // colour mode: a drag that starts on the floor or a road paints cells instead of turning the camera
  // (capture phase, so it runs before the camera controls see the press)
  canvas.addEventListener('pointerdown', e => {
    if (st.mode !== 'color' || st.dropper || !e.isPrimary) return;
    const s = surfaceAt(e.clientX, e.clientY);
    if (s && (s.type === 'floor' || s.type === 'road')) {
      scene.controls.enableRotate = false;
      cstroke = { before: G.serialize(v), done: new Set(), active: false };
    }
  }, true);
  function colorAt(cx, cy) {
    const cell = scene.pickCell(cx, cy); if (!cell) return;
    const k = cell.join(); if (cstroke.done.has(k)) return; cstroke.done.add(k);
    const it = G.itemAt(v, cell[0], cell[1]);
    if (it && it.kind === 'road') setPaint(it, [0], st.color);
    else if (!it) setFloor(k, st.color);
    else return;
    scene.sync(v);
  }
  function endColorStroke() {
    if (!cstroke) return false;
    const was = cstroke; cstroke = null;
    scene.controls.enableRotate = true;
    if (!was.active) return false;
    h.record(was.before); changed(); remember(st.color);
    return true;
  }
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, multi: down && down.id !== e.pointerId };
    clearTimeout(longT); longDone = false;
    if (down.multi) { endColorStroke(); return; }
    if (st.mode === 'color') {
      const d0 = down;
      longT = setTimeout(() => {
        if (down !== d0 || d0.moved) return;
        longDone = true; if (cstroke) { cstroke = null; scene.controls.enableRotate = true; }
        paintTap(d0.x, d0.y, true);
        if (navigator.vibrate) try { navigator.vibrate(20); } catch (err) { /* ignore */ }
      }, 520);
    }
    if ((st.mode === 'paint' || st.mode === 'erase') && e.isPrimary) {
      stroke = { before: G.serialize(v), done: new Set() };
      canvas.setPointerCapture(e.pointerId);
      paintAt(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 7) down.moved = true;
    if (cstroke && down && down.moved) {
      if (!cstroke.active) { cstroke.active = true; clearTimeout(longT); colorAt(down.x, down.y); }
      colorAt(e.clientX, e.clientY); return;
    }
    if (stroke) { paintAt(e.clientX, e.clientY); return; }
    if (e.pointerType === 'mouse' && (st.mode === 'place' || st.mode === 'move')) updateGhost(scene.pickCell(e.clientX, e.clientY));
  });
  canvas.addEventListener('pointerup', e => {
    clearTimeout(longT);
    if (endColorStroke()) { down = null; return; }
    if (stroke) { h.record(stroke.before); stroke = null; changed(); return; }
    if (longDone) { longDone = false; down = null; return; }
    if (down && !down.multi && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7) tap(e.clientX, e.clientY);
    down = null;
  });
  canvas.addEventListener('contextmenu', e => { if (st.mode === 'color') e.preventDefault(); });
  canvas.addEventListener('pointercancel', () => { clearTimeout(longT); endColorStroke(); if (stroke) { h.record(stroke.before); stroke = null; changed(); } down = null; });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && st.mode === 'place') scene.setGhost(null); });

  // ---------- fold the card row (phones: gives the board most of the screen)
  const FOLD = 'bv-fold';
  function setFold(f) {
    $('drawer').classList.toggle('folded', f);
    $('bFold').setAttribute('aria-expanded', String(!f));
    const l = f ? '카드 펼치기' : '카드 접기';
    $('bFold').setAttribute('aria-label', l); $('bFold').title = l;
    store.set(FOLD, f ? '1' : '0');
  }
  $('bFold').addEventListener('click', () => setFold(!$('drawer').classList.contains('folded')));
  setFold(store.get(FOLD) === '1');

  // keep the board centred in the space the bars leave free
  function fitInsets() {
    if (!scene) return;
    const top = document.body.classList.contains('appreciate') ? 0 : document.querySelector('header').getBoundingClientRect().bottom;
    const b = document.querySelector('.bottom');
    const bottom = document.body.classList.contains('appreciate') ? 0 : window.innerHeight - b.getBoundingClientRect().top;
    scene.setInsets(top, bottom);
  }
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(fitInsets);
    ro.observe(document.querySelector('header')); ro.observe(document.querySelector('.bottom'));
  }
  window.addEventListener('resize', fitInsets);

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
    const lbl = st.nightTarget ? '낮' : '밤';
    $('bNight').querySelector('.lbl').textContent = lbl;
    $('bNight').setAttribute('aria-label', lbl); $('bNight').title = lbl;
  });
  function enterView() {
    cancel(); select(null);
    st.viewing = true; st.phase = st.nightTarget ? 0.5 : 0;
    document.body.classList.add('appreciate'); fitInsets();
    scene.grid.visible = false;
    scene.controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scene.startCars();
  }
  function exitView() {
    if (!st.viewing) return;
    st.viewing = false;
    document.body.classList.remove('appreciate'); fitInsets();
    scene.grid.visible = true; scene.controls.autoRotate = false; scene.stopCars();
  }
  $('bView').addEventListener('click', enterView);
  $('bPaint').addEventListener('click', () => { if (st.mode === 'color') cancel(); else { select(null, true); st.spec = null; setMode('color'); } });
  $('bRainbow').addEventListener('click', rainbowAll);
  $('bUnpaint').addEventListener('click', () => {
    $('menuPop').hidden = true;
    if (!painted()) { toast('칠한 색이 없어요'); return; }
    h.commit(() => { v.items.forEach(i => { delete i.paint; }); delete v.floor; delete v.ground; }); changed();
    toast('색을 모두 지웠어요 · 되돌리기로 살릴 수 있어요');
  });
  $('exitView').addEventListener('click', exitView);

  const pop = $('menuPop');
  $('bMenu').addEventListener('click', () => { pop.hidden = !pop.hidden; $('bMenu').setAttribute('aria-expanded', String(!pop.hidden)); });
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('.menu')) { pop.hidden = true; $('bMenu').setAttribute('aria-expanded', 'false'); } });
  $('bNew').addEventListener('click', () => {
    h.commit(() => { v.items = []; delete v.floor; delete v.ground; }); select(null); changed(); pop.hidden = true;
    toast('새 마을을 시작했어요 · 되돌리기로 되살릴 수 있어요');
  });
  $('bExample').addEventListener('click', () => {
    const ex = exampleVillage();
    h.commit(() => { v.items = ex.items; v.nextId = ex.nextId; delete v.floor; delete v.ground; }); select(null); changed(); pop.hidden = true;
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
    const w = document.createElement('span'); w.className = 'lbl-s'; w.textContent = '찾은 곳 ';
    el.append(w, `${spot.found.size} / ${total}`);
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
    fitInsets();
    $('loading').remove();
  }
  // card pictures come from the drawing sheet; the game still works if it fails to load
  const img = new Image();
  img.onload = () => { try { houses = Sheet.load(img, 5, 10); } catch (e) { houses = []; } start(); };
  img.onerror = () => { houses = []; start(); };
  img.src = 'assets/sheet1.webp';
})();
