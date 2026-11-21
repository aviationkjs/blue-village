// Wires the village state, the scene and the on-screen controls together.
(function () {
  // An update can leave an old page (index.html) cached next to this newer script. Then the
  // buttons this script expects are missing: fetch the page fresh once instead of hanging.
  if (['bSlots', 'wallDlg', 'photoDlg', 'palette', 'drawer', 'bPaint'].some(id => !document.getElementById(id))) {
    let tried = false; try { tried = sessionStorage.getItem('bv-mismatch') === '1'; sessionStorage.setItem('bv-mismatch', '1'); } catch (e) { tried = true; }
    const go = () => { location.replace(location.pathname + '?v=' + Date.now()); };
    if (!tried && window.caches) caches.keys().then(k => Promise.all(k.map(n => caches.delete(n)))).then(go, go);
    else if (!tried) go();
    else {
      const el = document.getElementById('loading');
      if (el) el.textContent = '새 버전을 받는 중이에요. 잠시 뒤 앱을 닫았다 다시 열어 주세요.';
    }
    return;
  }
  try { sessionStorage.removeItem('bv-mismatch'); } catch (e) { /* ignore */ }
  const { Grid: G, Roads: R, Decorate: D, Spot, Cats, Sheet, Models, Scene } = window.BV;
  // statues need photo.js; if an old cached page did not load it, the game still starts without them
  const Statues = window.BV.Statues || { list: () => [], get: () => null, add: () => null };
  // villages: one storage key per village; the first village keeps the original key
  const SLOTS = 'bv-slots', CUR = 'bv-slot-cur';
  const keyOf = id => id === 'v1' ? 'bv-village-v1' : 'bv-village-' + id;
  const $ = id => document.getElementById(id);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: play without saving */ } },
  };
  // Korean particles by final consonant
  const hasFinal = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c % 28 !== 0; };
  const eul = w => w + (hasFinal(w) ? '을' : '를');

  function exampleVillage() {
    const v = G.create(24); // laid out on the old board, then moved to the centre of the big one
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
    return G.grow(v);
  }

  let houses = [];
  (function migrate() {
    let a; try { a = JSON.parse(store.get(SLOTS) || 'null'); } catch (e) { a = null; }
    if (!Array.isArray(a) || !a.length) store.set(SLOTS, JSON.stringify([{ id: 'v1', name: '내 마을', t: Date.now() }]));
  })();
  let curSlot = store.get(CUR) || 'v1';
  if (!JSON.parse(store.get(SLOTS) || '[]').some(x => x.id === curSlot)) curSlot = (JSON.parse(store.get(SLOTS) || '[]')[0] || { id: 'v1' }).id;
  let curKey = keyOf(curSlot);
  let v = G.deserialize(store.get(curKey) || '') || exampleVillage();
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
  const TILE_NAMES = { road: '길', water: '개울', rail: '기찻길', mono: '모노레일' };
  const nameOf = it => it.kind === 'statue' ? '동상' : it.kind === 'house' ? '집 ' + (+it.ref + 1) : it.kind === 'model' ? Models.NAMES[it.ref] : it.kind === 'road' ? (TILE_NAMES[it.ref] || '길') : (Models.DECO_NAMES[it.ref] || '꾸미기');
  const selItem = () => v.items.find(i => i.id === st.sel) || null;

  let toastTimer;
  function toast(msg, good) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show'); t.classList.toggle('good', !!good);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function changed(popId) {
    store.set(curKey, G.serialize(v)); touchSlot();
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
      text.append(strong(TILE_NAMES[st.tile] || '길'), ' 칸을 누르거나 끌어서 깔아요');
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
    water: svgIcon('<path d="M6 26c8-6 14 6 22 0s14 6 22 0 8-2 8-2v18H6z" fill="#bcd7ff"/><path d="M12 34c5-3 8 3 13 0M34 38c5-3 8 3 13 0" stroke-width="2.5"/>'),
    mono: svgIcon('<path d="M18 50V28M46 50V28" stroke-width="4"/><rect x="6" y="22" width="52" height="7" rx="2" fill="#dbe7fd"/><rect x="14" y="10" width="36" height="12" rx="6" fill="#4dabf7"/><path d="M20 15h24" stroke="#fff" stroke-width="2.5"/>'),
    rail: svgIcon('<rect x="8" y="22" width="48" height="20" rx="3" fill="#dfe5f1"/><path d="M14 20v24M24 20v24M34 20v24M44 20v24" stroke="#c9a27a" stroke-width="4"/><path d="M8 27h48M8 37h48"/>'),
    camera: svgIcon('<rect x="8" y="18" width="48" height="34" rx="6" fill="#fff"/><circle cx="32" cy="35" r="10"/><path d="M22 18l4-6h12l4 6"/><path d="M44 12l4 4M44 16l4-4" stroke-width="2"/>'),
    erase: svgIcon('<path d="M14 44l18-24 16 12-12 16H20z" fill="#fff"/><path d="M22 34l12 9M12 52h40"/>'),
  };
  const thumb = (kind, ref) => thumbs[kind + ':' + ref] || (thumbs[kind + ':' + ref] = scene.thumbnail(kind, ref));
  function cardsFor(cat) {
    const c = Cats.CATS.find(x => x.id === cat) || Cats.CATS[0];
    const out = [];
    (c.houses || []).forEach(i => out.push({ kind: 'house', ref: String(i), name: '집 ' + (i + 1), img: houses[i] ? houses[i].thumb : thumb('house', String(i)) }));
    if (c.statues) {
      out.push({ kind: 'photo', ref: 'photo', name: '사진으로', img: ICONS.camera });
      Statues.list().forEach(([id, rec]) => out.push({ kind: 'statue', ref: id, name: '동상', img: rec.preview }));
    }
    (c.models || []).forEach(r => out.push({ kind: 'model', ref: r, name: Models.NAMES[r], img: thumb('model', r) }));
    (c.deco || []).forEach(r => out.push(TILE_NAMES[r] ? { kind: 'road', ref: r, name: TILE_NAMES[r], img: ICONS[r] }
      : r === 'erase' ? { kind: 'erase', ref: 'erase', name: '지우개', img: ICONS.erase }
        : { kind: 'deco', ref: r, name: Models.DECO_NAMES[r], img: thumb('deco', r) }));
    return out;
  }
  function renderTabs() {
    const box = $('tabs'); box.replaceChildren();
    Cats.CATS.forEach(c => {
      const n = (c.houses || []).length + (c.models || []).length + (c.deco || []).length + (c.statues ? Statues.list().length : 0);
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
      (st.mode === 'paint' && c.kind === 'road' && c.ref === st.tile) || (st.mode === 'erase' && c.kind === 'erase');
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
      if (c.kind !== 'statue') { box.append(pick); return; }
      const wrap = document.createElement('div'); wrap.className = 'pick-wrap';
      const del = document.createElement('button'); del.type = 'button'; del.className = 'pick-del'; del.textContent = '×';
      del.setAttribute('aria-label', '이 동상 지우기'); del.title = '이 동상 지우기';
      del.addEventListener('click', e => {
        e.stopPropagation();
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '지울까요?'; setTimeout(() => { if (del.isConnected) { del.dataset.armed = ''; del.textContent = '×'; } }, 2500); return; }
        deleteStatue(c.ref);
      });
      wrap.append(pick, del); box.append(wrap);
    });
  }

  // removes the picture and every statue made from it, here (undoable) and in the other saved villages
  function deleteStatue(id) {
    const here = v.items.filter(i => i.kind === 'statue' && i.ref === id).length;
    if (here) h.commit(() => { v.items = v.items.filter(i => !(i.kind === 'statue' && i.ref === id)); });
    let elsewhere = 0;
    slotList().forEach(s => {
      if (s.id === curSlot) return;
      const o = G.deserialize(store.get(keyOf(s.id)) || ''); if (!o) return;
      const n = o.items.length; o.items = o.items.filter(i => !(i.kind === 'statue' && i.ref === id));
      if (o.items.length !== n) { elsewhere += n - o.items.length; store.set(keyOf(s.id), G.serialize(o)); }
    });
    Statues.remove(id);
    if (st.spec && st.spec.kind === 'statue' && st.spec.ref === id) cancel();
    changed(); renderTabs(); renderCards();
    toast('동상을 지웠어요' + (here + elsewhere ? ` · 마을에 세운 ${here + elsewhere}개도 함께 지웠어요` : ''));
  }
  function chooseCard(c) {
    const same = isActive(c);
    select(null, true);
    if (same) { cancel(); return; }
    if (c.kind === 'photo') { cancel(); openPhoto(); return; }
    if (c.kind === 'road') { st.tile = c.ref; setMode('paint'); }
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
      v.items.filter(i => R.isRoad(i)).forEach(r => { r.paint = { 0: Models.code(15, 4) }; });
      v.ground = Models.code(4, 1);
    });
    changed(); $('menuPop').hidden = true;
    toast('🌈 마을을 무지개로 칠했어요 · 마음에 안 들면 되돌리기', true);
  }

  function tap(cx, cy) {
    // appreciate view: a tap makes the building hop and do its own thing (bell, sails, lights...)
    if (st.viewing) {
      let id = scene.pickItemId(cx, cy);
      const cell = scene.pickCell(cx, cy);
      if (!id && cell) { const it = G.itemAt(v, cell[0], cell[1]); id = it && it.kind !== 'road' ? it.id : null; }
      if (id) scene.react(id); else if (scene.life) scene.life.tap(cell);
      return;
    }
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
    if (st.mode === 'paint') { if (G.place(v, { kind: 'road', ref: st.tile || 'road', x: cell[0], z: cell[1], rot: 0 })) scene.sync(v); }
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
  // ---------- sky: time of day, season, weather (one popover under the moon/sun button)
  const SKY = 'bv-sky';
  const sky = { night: 0, season: 'summer', weather: 'clear' };
  try { Object.assign(sky, JSON.parse(store.get(SKY) || '{}')); } catch (e) { /* defaults */ }
  const SEASONS = [['spring', '봄'], ['summer', '여름'], ['autumn', '가을'], ['winter', '겨울']];
  const WEATHERS = [['clear', '맑음'], ['rain', '비'], ['snow', '눈'], ['rainbow', '무지개'], ['auto', '자동']];
  let shownWeather = null;
  function showWeather(w) { if (w !== shownWeather) { shownWeather = w; scene.setWeather(w); } }
  function applySky() {
    st.nightTarget = sky.night ? 1 : 0;
    $('bNight').setAttribute('aria-pressed', String(!!sky.night));
    const lbl = '하늘 · ' + (sky.night ? '밤' : '낮');
    $('bNight').querySelector('.lbl').textContent = sky.night ? '밤' : '낮';
    $('bNight').setAttribute('aria-label', lbl); $('bNight').title = lbl;
    scene.setSeason(sky.season);
    if (spot.a) { spot.a.setSeason(sky.season); spot.b.setSeason(sky.season); }
    showWeather(sky.weather === 'auto' ? (st.viewing ? autoW.now : 'clear') : sky.weather);
    store.set(SKY, JSON.stringify(sky));
    renderSky();
  }
  function renderSky() {
    const box = $('skyPop'); box.replaceChildren();
    const row = (title, list, cur, fn) => {
      const r = document.createElement('div'); r.className = 'sky-row';
      const t = document.createElement('span'); t.textContent = title; r.append(t);
      list.forEach(([id, name]) => { const b = btn(name, () => fn(id)); b.setAttribute('aria-pressed', String(cur === id)); r.append(b); });
      box.append(r);
    };
    row('시간', [[0, '낮'], [1, '밤']], sky.night ? 1 : 0, id => { sky.night = id; applySky(); });
    row('계절', SEASONS, sky.season, id => { sky.season = id; applySky(); });
    row('날씨', WEATHERS, sky.weather, id => { sky.weather = id; applySky(); if (id === 'auto') toast('감상 모드에서 날씨가 저절로 바뀌어요'); });
  }
  // automatic weather while appreciating: changes every 15 seconds
  const autoW = { now: 'clear', t: 0, order: ['clear', 'rain', 'clear', 'rainbow', 'clear', 'snow'], i: 0 };
  $('bNight').addEventListener('click', () => {
    const p = $('skyPop'); p.hidden = !p.hidden;
    $('bNight').setAttribute('aria-expanded', String(!p.hidden));
  });
  document.addEventListener('pointerdown', e => { const p = $('skyPop'); if (!p.hidden && !e.target.closest('#skyPop, #bNight')) p.hidden = true; });
  // ---------- music for the appreciate view ("시골 마을의 노을", looped)
  const MUSIC_KEY = 'bv-music-v1', MUSIC_SRC = 'assets/music.mp3', MUSIC_VOL = 0.6;
  const music = { el: new Audio(), on: store.get(MUSIC_KEY) !== 'off', fade: 0 };
  music.el.loop = true; music.el.preload = 'auto'; music.el.volume = 0;
  // load it as a blob up front so the tap on [감상] can start it at once (also offline via the app cache)
  fetch(MUSIC_SRC).then(r => (r.ok ? r.blob() : Promise.reject(r.status)))
    .then(b => { if (!music.el.src) music.el.src = URL.createObjectURL(b); })
    .catch(() => { /* falls back to streaming the file when played */ });
  function fadeTo(target, ms, done) {
    clearInterval(music.fade);
    const from = music.el.volume, t0 = performance.now();
    music.fade = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      music.el.volume = from + (target - from) * k;
      if (k >= 1) { clearInterval(music.fade); if (done) done(); }
    }, 40);
  }
  function musicPlay() {
    if (!music.on) return;
    if (!music.el.src) music.el.src = MUSIC_SRC;
    const p = music.el.play();
    if (p) p.catch(() => toast('음악을 틀지 못했어요. [음악 켜기]를 눌러 주세요'));
    fadeTo(MUSIC_VOL, 1500);
  }
  function musicStop() { fadeTo(0, 700, () => music.el.pause()); }
  function renderMusicBtn() {
    const b = $('bMusic');
    b.textContent = music.on ? '음악 끄기' : '음악 켜기';
    b.setAttribute('aria-pressed', String(music.on));
  }
  $('bMusic').addEventListener('click', () => {
    music.on = !music.on;
    store.set(MUSIC_KEY, music.on ? 'on' : 'off');
    renderMusicBtn();
    if (music.on) musicPlay(); else musicStop();
  });
  document.addEventListener('visibilitychange', () => {
    if (!st.viewing || !music.on) return;
    if (document.hidden) music.el.pause(); else music.el.play().catch(() => {});
  });
  renderMusicBtn();

  // ---------- nature sounds (water, birds, crickets) and tap sounds in the appreciate view
  const SFX_KEY = 'bv-sfx-v1', Sound = window.BV.Sound;
  let sfxOn = store.get(SFX_KEY) !== 'off';
  if (Sound) Sound.setEnabled(sfxOn);
  const WATERY = ['pond', 'fountain', 'waterfall', 'waterwheel', 'footbath'];
  const soundInfo = () => ({ water: scene.tiles('water').size + v.items.filter(i => i.kind === 'model' && WATERY.includes(i.ref)).length * 3, night: scene.night });
  function renderSfxBtn() { const b = $('bSfx'); if (!b) return; b.textContent = sfxOn ? '자연 소리 끄기' : '자연 소리 켜기'; b.setAttribute('aria-pressed', String(sfxOn)); }
  if ($('bSfx')) $('bSfx').addEventListener('click', () => {
    sfxOn = !sfxOn; store.set(SFX_KEY, sfxOn ? 'on' : 'off'); renderSfxBtn();
    if (!Sound) return;
    Sound.setEnabled(sfxOn);
    if (sfxOn && st.viewing) Sound.start(soundInfo);
  });
  renderSfxBtn();

  function enterView() {
    cancel(); select(null);
    st.viewing = true; st.phase = st.nightTarget ? 0.5 : 0;
    document.body.classList.add('appreciate'); fitInsets();
    scene.grid.visible = false;
    scene.controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scene.startCars();
    musicPlay();
    if (Sound && sfxOn) Sound.start(soundInfo);
  }
  function exitView() {
    if (!st.viewing) return;
    st.viewing = false;
    document.body.classList.remove('appreciate'); fitInsets();
    scene.grid.visible = true; scene.controls.autoRotate = false; scene.stopCars();
    musicStop();
    if (Sound) Sound.stop();
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


  // ================= village list (several saved villages) =================
  function slotList() { try { const a = JSON.parse(store.get(SLOTS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveSlots(a) { store.set(SLOTS, JSON.stringify(a)); }
  function touchSlot() {
    const a = slotList(); const s = a.find(x => x.id === curSlot);
    if (s) { s.t = Date.now(); saveSlots(a); }
  }
  function slotThumb() {
    try { return scene.capture(240, 170, { type: 'image/jpeg', quality: 0.7, fov: 30 }); } catch (e) { return ''; }
  }
  function saveThumb() {
    const a = slotList(); const s = a.find(x => x.id === curSlot);
    if (s) { s.thumb = slotThumb(); s.t = Date.now(); saveSlots(a); }
  }
  function loadInto(o) {
    v.items = o.items; v.nextId = o.nextId; v.size = o.size;
    if (o.floor) v.floor = o.floor; else delete v.floor;
    if (o.ground !== undefined) v.ground = o.ground; else delete v.ground;
  }
  function openSlot(id) {
    if (id === curSlot) { closeDlg('slotDlg'); return; }
    saveThumb();
    const o = G.deserialize(store.get(keyOf(id)) || '') || G.create();
    exitView(); cancel(); select(null);
    loadInto(o); h.reset();
    curSlot = id; curKey = keyOf(id); store.set(CUR, id);
    wasRainbow = null; changed(); renderHint();
    closeDlg('slotDlg');
    const s = slotList().find(x => x.id === id);
    toast(`'${s ? s.name : '마을'}'을 열었어요`);
  }
  function newSlot(kind) {
    const a = slotList();
    if (a.length >= 12) { toast('마을은 12개까지 저장할 수 있어요. 안 쓰는 마을을 지워 주세요'); return; }
    const id = 'm' + Date.now().toString(36);
    const o = kind === 'example' ? exampleVillage() : kind === 'copy' ? G.deserialize(G.serialize(v)) : G.create();
    const base = kind === 'copy' ? ((a.find(x => x.id === curSlot) || {}).name || '마을') + ' 복사' : kind === 'example' ? '예시 마을' : '새 마을';
    store.set(keyOf(id), G.serialize(o));
    a.push({ id, name: base + ' ' + (a.length + 1), t: Date.now() });
    saveSlots(a);
    openSlot(id);
  }
  function renderSlots() {
    const box = $('slotList'); box.replaceChildren();
    const a = slotList().sort((x, y) => (y.t || 0) - (x.t || 0));
    a.forEach(s => {
      const row = document.createElement('div'); row.className = 'slot' + (s.id === curSlot ? ' is-cur' : '');
      const img = document.createElement('img'); img.alt = ''; if (s.thumb) img.src = s.thumb;
      const mid = document.createElement('div'); mid.className = 'slot-mid';
      const nm = document.createElement('input'); nm.type = 'text'; nm.value = s.name; nm.maxLength = 20; nm.setAttribute('aria-label', '마을 이름');
      nm.addEventListener('change', () => { const b = slotList(); const t = b.find(x => x.id === s.id); if (t) { t.name = nm.value.trim() || t.name; saveSlots(b); } });
      const when = document.createElement('small');
      when.textContent = (s.id === curSlot ? '지금 마을 · ' : '') + (s.t ? new Date(s.t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
      mid.append(nm, when);
      const acts = document.createElement('div'); acts.className = 'slot-acts';
      if (s.id !== curSlot) acts.append(btn('열기', () => openSlot(s.id), 'primary'));
      const del = btn('지우기', () => {
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = '정말?'; setTimeout(() => { del.dataset.armed = ''; del.textContent = '지우기'; }, 2500); return; }
        const b = slotList().filter(x => x.id !== s.id); saveSlots(b);
        try { localStorage.removeItem(keyOf(s.id)); } catch (e) { /* ignore */ }
        renderSlots(); toast(`'${s.name}'을 지웠어요`);
      }, 'danger');
      if (s.id !== curSlot) acts.append(del);
      row.append(img, mid, acts); box.append(row);
    });
  }
  $('bSlots').addEventListener('click', () => { pop.hidden = true; saveThumb(); renderSlots(); openDlg('slotDlg'); });
  $('slotNew').addEventListener('click', () => newSlot('empty'));
  $('slotExample').addEventListener('click', () => newSlot('example'));
  $('slotCopy').addEventListener('click', () => newSlot('copy'));

  // ================= wallpaper =================
  const wall = { night: false, land: false, url: '', elev: undefined };
  function wallSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let w = Math.round(Math.min(screen.width, screen.height) * dpr), hh = Math.round(Math.max(screen.width, screen.height) * dpr);
    const k = Math.min(1, 2400 / hh); w = Math.round(w * k); hh = Math.round(hh * k);
    return wall.land ? [hh, w] : [w, hh];
  }
  function renderWall() {
    const [w, hh] = wallSize();
    wall.url = scene.capture(w, hh, { night: wall.night ? 1 : 0, elev: wall.elev });
    document.querySelectorAll('#wallAngle button').forEach(b => b.setAttribute('aria-pressed', String(String(wall.elev) === b.dataset.elev)));
    $('wallImg').src = wall.url;
    $('wallInfo').textContent = `${w} × ${hh} · ` + (wall.elev === undefined ? '지금 보이는 각도 그대로예요' : `${wall.elev}°: ${wall.elev === 0 ? '땅에서 정면으로' : wall.elev === 90 ? '하늘에서 내려다보기' : '비스듬히 위에서'} (방향은 지금 화면 기준)`);
    $('wallDay').setAttribute('aria-pressed', String(!wall.night)); $('wallNight').setAttribute('aria-pressed', String(wall.night));
    $('wallPort').setAttribute('aria-pressed', String(!wall.land)); $('wallLand').setAttribute('aria-pressed', String(wall.land));
  }
  const fileName = () => (painted() ? '무지개마을' : '파란선마을') + '-배경화면-' + new Date().toISOString().slice(0, 10) + '.png';
  async function wallBlob() { return (await fetch(wall.url)).blob(); }
  $('bWall').addEventListener('click', () => {
    pop.hidden = true; exitView(); cancel(); select(null);
    wall.night = scene.night > 0.5; openDlg('wallDlg'); renderWall();
  });
  document.querySelectorAll('#wallAngle button').forEach(b => b.addEventListener('click', () => { wall.elev = b.dataset.elev === 'undefined' ? undefined : +b.dataset.elev; renderWall(); }));
  $('wallDay').addEventListener('click', () => { wall.night = false; renderWall(); });
  $('wallNight').addEventListener('click', () => { wall.night = true; renderWall(); });
  $('wallPort').addEventListener('click', () => { wall.land = false; renderWall(); });
  $('wallLand').addEventListener('click', () => { wall.land = true; renderWall(); });
  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  $('wallSave').addEventListener('click', () => {
    if (framed) { toast('이 화면에서는 저장이 막혀 있어요. 휴대폰에 설치한 앱에서 저장해 주세요'); return; }
    try {
      const a = document.createElement('a'); a.href = wall.url; a.download = fileName();
      document.body.append(a); a.click(); a.remove();
      toast('사진을 저장했어요 · 갤러리에서 배경화면으로 설정하세요');
    } catch (e) { toast('여기서는 저장이 막혀 있어요. 이미지를 길게 눌러 저장해 보세요'); }
  });
  $('wallShare').addEventListener('click', async () => {
    try {
      const file = new File([await wallBlob()], fileName(), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: '마을 배경화면' });
      else toast('공유를 쓸 수 없어요. 저장 버튼을 눌러 주세요');
    } catch (e) { /* closed the share sheet */ }
  });
  $('wallShare').hidden = !(navigator.canShare && window.File);

  // ================= photo statue =================
  let photoImg = null, photoArt = null;
  function renderPhoto() {
    if (!photoImg) return;
    photoArt = BV.Photo.toLineArt(photoImg, +$('photoDetail').value / 100);
    const cv = $('photoPrev'); cv.width = photoArt.w; cv.height = photoArt.h;
    cv.getContext('2d').drawImage(photoArt.preview, 0, 0);
    $('photoMake').disabled = false;
  }
  function openPhoto() { photoImg = null; photoArt = null; $('photoMake').disabled = true; $('photoPrev').width = 0; $('photoFile').value = ''; openDlg('photoDlg'); }
  $('photoFile').addEventListener('change', () => {
    const f = $('photoFile').files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { photoImg = im; renderPhoto(); URL.revokeObjectURL(url); };
    im.onerror = () => toast('이 사진은 열 수 없어요. 다른 사진을 골라 주세요');
    im.src = url;
  });
  $('photoDetail').addEventListener('input', () => { clearTimeout(renderPhoto.t); renderPhoto.t = setTimeout(renderPhoto, 120); });
  $('photoMake').addEventListener('click', () => {
    if (!photoArt) return;
    const small = document.createElement('canvas'); const k = 96 / Math.max(photoArt.w, photoArt.h);
    small.width = Math.round(photoArt.w * k); small.height = Math.round(photoArt.h * k);
    small.getContext('2d').drawImage(photoArt.preview, 0, 0, small.width, small.height);
    const id = Statues.add({ mask: photoArt.mask.toDataURL('image/png'), preview: small.toDataURL('image/png'), w: photoArt.w, h: photoArt.h });
    if (!id) { toast('저장 공간이 모자라요. 안 쓰는 동상이나 마을을 지워 주세요'); return; }
    closeDlg('photoDlg');
    st.cat = 'statue'; renderTabs(); renderCards();
    st.spec = { kind: 'statue', ref: id, rot: 0 }; setMode('place');
    toast('동상을 만들었어요 · 놓을 칸을 누르세요', true);
  });

  // ================= dialogs =================
  function openDlg(id) { $(id).hidden = false; }
  function closeDlg(id) { $(id).hidden = true; }
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDlg(b.dataset.close)));


  // ================= colouring templates (칠하기 도안) =================
  const DOAN = 'bv-doan';
  const dz = { a: null, b: null, i: 0, vA: null, vB: null, groups: [], pal: [], cur: 0, mistakes: 0, hints: 0, open: false, labels: [] };
  const doanStars = () => { try { return JSON.parse(store.get(DOAN) || '{}') || {}; } catch (e) { return {}; } };
  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  function renderDoanList() {
    const box = $('doanList'); box.replaceChildren();
    const got = doanStars();
    BV.Doan.LEVELS.forEach((L, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'doan-card' + (got[i] ? ' done' : '');
      const n = document.createElement('b'); n.textContent = i + 1;
      const nm = document.createElement('span'); nm.textContent = L.name;
      const st2 = document.createElement('small'); st2.textContent = starText(got[i] || 0);
      b.append(n, nm, st2); b.addEventListener('click', () => { closeDlg('doanDlg'); startDoan(i); });
      box.append(b);
    });
    const total = Object.values(got).reduce((a, x) => a + x, 0);
    $('doanTotal').textContent = `모은 별 ${total} / ${BV.Doan.LEVELS.length * 3}`;
  }
  $('bDoan').addEventListener('click', () => { pop.hidden = true; renderDoanList(); openDlg('doanDlg'); });

  function setupDoan() {
    dz.a = Scene.create($('doanA'), { grid: false });
    dz.b = Scene.create($('doanB'), { grid: false });
    let lock = false;
    [[dz.a, dz.b], [dz.b, dz.a]].forEach(([x, y]) => {
      x.controls.enableDamping = false;
      x.controls.addEventListener('change', () => { if (lock) return; lock = true; copyCam(x, y); lock = false; });
    });
    const cv = $('doanB'); let d = null;
    cv.addEventListener('pointerdown', e => { d = { x: e.clientX, y: e.clientY, id: e.pointerId, multi: d && d.id !== e.pointerId }; });
    cv.addEventListener('pointerup', e => { if (d && !d.multi && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) doanTap(e.clientX, e.clientY); d = null; });
    dz.b.onFrame = placeLabels;
    window.addEventListener('resize', () => { if (dz.open) { dz.a.resize(); dz.b.resize(); } });
  }
  // a group = all surfaces of one kind (walls, roofs/leaves, windows) on one building, or every road cell
  function buildGroups() {
    const L = BV.Doan.LEVELS[dz.i];
    dz.groups = []; dz.pal = [];
    const addPal = c => { if (!dz.pal.includes(c)) dz.pal.push(c); };
    dz.vB.items.forEach(it => {
      if (it.tpl === undefined) return;
      const o = L.items[it.tpl];
      const parts = dz.b.paintParts(it.id);
      [['fill', o.w], ['soft', o.s], ['win', o.n]].forEach(([base, col]) => {
        if (col === undefined) return;
        const idx = parts.filter(p => p.base === base).map(p => p.idx);
        if (!idx.length) return;
        addPal(col);
        dz.groups.push({ key: it.id + ':' + base, id: it.id, base, idx, target: col, cur: undefined, center: dz.b.partCenter(it.id, base) });
      });
    });
    if (L.road !== null && L.road !== undefined && L.roads.length) {
      addPal(L.road);
      const mid = L.roads[Math.floor(L.roads.length / 2)];
      dz.groups.push({ key: 'road', base: 'road', target: L.road, cur: undefined, center: new THREE.Vector3(mid[0] + 0.5 - dz.vB.size / 2, 0.05, mid[1] + 0.5 - dz.vB.size / 2) });
    }
  }
  function paintGroup(v2, g, c) {
    if (g.base === 'road') { v2.items.forEach(r => { if (r.kind === 'road') r.paint = { 0: c }; }); return; }
    const it = v2.items.find(x => x.id === g.id); if (!it) return;
    const p = { ...(it.paint || {}) }; g.idx.forEach(i => { p[i] = c; }); it.paint = p;
  }
  function fitDoanCam() {
    const its = dz.vA.items; const H2 = dz.vA.size / 2;
    let x0 = 99, x1 = -99, z0 = 99, z1 = -99;
    its.forEach(it => { x0 = Math.min(x0, it.x); x1 = Math.max(x1, it.x + it.w); z0 = Math.min(z0, it.z); z1 = Math.max(z1, it.z + it.d); });
    const cx = (x0 + x1) / 2 - H2, cz = (z0 + z1) / 2 - H2, span = Math.max(x1 - x0, z1 - z0, 6);
    const t = new THREE.Vector3(cx, 0.6, cz);
    dz.a.controls.target.copy(t);
    dz.a.camera.position.set(cx + span * 0.55, span * 0.62 + 2.2, cz + span * 0.72);
    dz.a.controls.update(); copyCam(dz.a, dz.b);
  }
  function startDoan(i) {
    exitView(); cancel(); select(null);
    dz.i = i; dz.mistakes = 0; dz.hints = 0; dz.cur = 0;
    $('doan').hidden = false; dz.open = true;
    scene.paused = true;
    if (!dz.a) setupDoan();
    dz.a.paused = dz.b.paused = false;
    dz.a.setNight(0);
    dz.a.resize(); dz.b.resize();
    dz.vA = BV.Doan.village(i); dz.vB = BV.Doan.village(i);
    dz.a.sync(dz.vA); dz.b.sync(dz.vB);
    dz.a.clearMarkers(); dz.b.clearMarkers();
    buildGroups();
    dz.groups.forEach(g => paintGroup(dz.vA, g, g.target));
    dz.a.sync(dz.vA);
    fitDoanCam();
    const L = BV.Doan.LEVELS[i];
    $('doanTitle').textContent = `도안 ${i + 1} · ${L.name}`;
    $('doanDone').hidden = true;
    makeLabels(); renderDoanPal(); renderDoanProgress();
  }
  function closeDoan() {
    $('doan').hidden = true; dz.open = false;
    dz.a.paused = dz.b.paused = true;
    scene.paused = false; scene.setNight(scene.night);
  }
  $('doanExit').addEventListener('click', closeDoan);
  $('doanList2').addEventListener('click', () => { closeDoan(); renderDoanList(); openDlg('doanDlg'); });
  $('doanAgain').addEventListener('click', () => startDoan(dz.i));
  $('doanNext').addEventListener('click', () => startDoan((dz.i + 1) % BV.Doan.LEVELS.length));

  function renderDoanPal() {
    const box = $('doanPal'); box.replaceChildren();
    box.classList.toggle('many', dz.pal.length > 8);
    dz.pal.forEach((c, n) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dsw';
      b.style.setProperty('--c', hexCss(c));
      b.style.color = new THREE.Color(Models.colorHex(c)).getHSL({}).l > 0.6 ? '#1d3f86' : '#fff';
      b.textContent = n + 1; b.setAttribute('aria-label', `${n + 1}번 ${Models.colorName(c)}`);
      b.setAttribute('aria-pressed', String(dz.cur === n));
      const left = dz.groups.some(g => g.target === c && g.cur !== c);
      b.classList.toggle('finished', !left);
      b.addEventListener('click', () => { dz.cur = n; renderDoanPal(); doanMsg(); });
      box.append(b);
    });
    doanMsg();
  }
  function doanMsg(text) {
    const c = dz.pal[dz.cur];
    $('doanMsg').textContent = text || `${dz.cur + 1}번 ${Models.colorName(c)} · 흐린 ${dz.cur + 1}이 적힌 면을 눌러요`;
  }
  function renderDoanProgress() {
    const ok = dz.groups.filter(g => g.cur === g.target).length, total = dz.groups.length;
    $('doanCount').textContent = `맞은 면 ${ok} / ${total}`;
    const pct = total ? Math.round(ok / total * 100) : 0;
    $('doanBar').style.width = pct + '%'; $('doanPct').textContent = pct + '%';
    $('doanStars').textContent = starText(doanStars()[dz.i] || 0);
    if (total && ok === total) finishDoan();
  }
  // number tags on surfaces still to colour; positions follow the camera every frame
  function makeLabels() {
    const box = $('doanLabels'); box.replaceChildren();
    dz.labels = dz.groups.map(g => {
      const el = document.createElement('span'); el.className = 'doan-lbl';
      el.textContent = dz.pal.indexOf(g.target) + 1; box.append(el);
      return { g, el };
    });
  }
  const tmpV = new THREE.Vector3();
  function placeLabels() {
    if (!dz.open) return;
    const cv = $('doanB'), w = cv.clientWidth, h = cv.clientHeight;
    dz.labels.forEach(({ g, el }) => {
      if (g.cur === g.target) { el.hidden = true; return; }
      tmpV.copy(g.center).project(dz.b.camera);
      const out = tmpV.z > 1 || Math.abs(tmpV.x) > 1.05 || Math.abs(tmpV.y) > 1.05;
      el.hidden = out;
      if (!out) { el.style.left = ((tmpV.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - tmpV.y) / 2 * h) + 'px'; }
      el.classList.toggle('now', dz.pal.indexOf(g.target) === dz.cur);
      el.classList.toggle('wrong', g.cur !== undefined && g.cur !== g.target);
    });
  }
  function doanTap(cx, cy) {
    if (!dz.groups.length || !$('doanDone').hidden) return;
    let g = null;
    const part = dz.b.pickPart(cx, cy);
    if (part) {
      const it = dz.vB.items.find(x => x.id === part.itemId);
      g = dz.groups.find(x => x.key === part.itemId + ':' + part.base);
      if (!g && it) { doanMsg('이 면은 칠하지 않아도 돼요'); return; }
    } else {
      const cell = dz.b.pickCell(cx, cy);
      const it = cell && G.itemAt(dz.vB, cell[0], cell[1]);
      if (it && it.kind === 'road') g = dz.groups.find(x => x.key === 'road');
    }
    if (!g) return;
    const c = dz.pal[dz.cur];
    if (g.cur === c) return;
    g.cur = c;
    paintGroup(dz.vB, g, c);
    dz.b.sync(dz.vB, g.id);
    if (c !== g.target) {
      dz.mistakes++;
      doanMsg(`앗, 여기는 ${dz.pal.indexOf(g.target) + 1}번 색이에요. 다시 칠할 수 있어요`);
      if (navigator.vibrate) try { navigator.vibrate([30, 40, 30]); } catch (e) { /* ignore */ }
    } else doanMsg();
    renderDoanPal(); renderDoanProgress();
  }
  $('doanHint').addEventListener('click', () => {
    if (!dz.open) return;
    const g = dz.groups.find(x => x.cur !== x.target); if (!g) return;
    dz.hints++;
    dz.cur = dz.pal.indexOf(g.target); renderDoanPal();
    const it = g.id ? dz.vB.items.find(x => x.id === g.id) : null;
    const area = it || (() => { const r = BV.Doan.LEVELS[dz.i].roads; const m = r[Math.floor(r.length / 2)]; return { x: m[0], z: m[1], w: 1, d: 1 }; })();
    dz.b.addMarker(area, 0xf2a516, 2.2); dz.a.addMarker(area, 0xf2a516, 2.2);
    doanMsg(`노란 동그라미 쪽을 ${dz.cur + 1}번 색으로 칠해 보세요`);
  });
  function finishDoan() {
    const stars = 1 + (dz.mistakes <= 3 ? 1 : 0) + (dz.hints === 0 ? 1 : 0);
    const all = doanStars(); const best = Math.max(all[dz.i] || 0, stars); all[dz.i] = best; store.set(DOAN, JSON.stringify(all));
    $('doanStars').textContent = starText(best);
    $('doanDoneStars').textContent = starText(stars);
    $('doanDoneText').textContent = `틀린 색 ${dz.mistakes}번 · 힌트 ${dz.hints}번` + (stars === 3 ? ' · 완벽해요!' : stars === 2 ? ' · 힌트 없이 하면 별 3개' : ' · 틀린 색 3번 이하면 별이 하나 더');
    $('doanNext').hidden = dz.i === BV.Doan.LEVELS.length - 1;
    $('doanDone').hidden = false;
    doanMsg('다 칠했어요!');
  }

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
    spot.a.setSeason(sky.season); spot.b.setSeason(sky.season);
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
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const open = document.querySelector('.dlg:not([hidden])');
    if (open) { if (e.key === 'Escape') open.hidden = true; return; }
    if (dz.open) { if (e.key === 'Escape') closeDoan(); return; }
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
    scene = Scene.create(canvas);    if (window.BV.Life) scene.life = window.BV.Life.create(scene);    scene.onFrame = (dt) => {
      let target = st.nightTarget;
      if (st.viewing) { st.phase = (st.phase + dt / 60) % 1; target = 0.5 - 0.5 * Math.cos(st.phase * Math.PI * 2); }
      if (sky.weather === 'auto') {
        if (st.viewing) { autoW.t += dt; if (autoW.t > 15) { autoW.t = 0; autoW.i = (autoW.i + 1) % autoW.order.length; autoW.now = autoW.order[autoW.i]; } showWeather(autoW.now); }
        else showWeather('clear');
      }
      const n = scene.night;
      if (Math.abs(n - target) > 0.002) {
        const next = st.viewing ? target : n + (target - n) * Math.min(1, dt * 2.5);
        scene.setNight(next);
        document.body.classList.toggle('night', next > 0.5);
      }
    };
    changed(); renderHint(); renderTabs(); renderCards();
    applySky();
    fitInsets();
    $('loading').remove();
  }
  // card pictures come from the drawing sheet; the game still works if it fails to load
  const img = new Image();
  img.onload = () => { try { houses = Sheet.load(img, 5, 10); } catch (e) { houses = []; } start(); };
  img.onerror = () => { houses = []; start(); };
  img.src = 'assets/sheet1.webp';
})();
