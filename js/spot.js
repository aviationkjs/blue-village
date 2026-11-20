// Spot-the-difference: make a changed copy of the village. Pure logic.
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const G = node ? require('./grid.js') : root.BV.Grid;
  const D = node ? require('./decorate.js') : root.BV.Decorate;

  const cellsOf = it => { const c = []; for (let x = it.x; x < it.x + it.w; x++) for (let z = it.z; z < it.z + it.d; z++) c.push([x, z]); return c; };
  const KIND_WORD = it => it.kind === 'house' ? '집' : it.kind === 'model' ? '건물' : ({ tree: '나무', roundTree: '나무', bush: '덤불', lamp: '가로등', fence: '울타리' }[it.ref] || '꾸미기');
  // 이/가 by whether the last syllable has a final consonant
  const iga = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c % 28 ? '이' : '가'); };
  const ADDS =['tree', 'roundTree', 'bush', 'lamp', 'fence'];

  function makeDiffs(v, count = 5, seed = 1, houseCount = 50) {
    const rand = D.rng(seed);
    const pick = a => a[Math.floor(rand() * a.length)];
    const b = G.deserialize(G.serialize(v));
    const used = new Set(); // cells (plus a 1-cell margin) already holding a difference
    const diffs = [];
    const clear = cells => cells.every(([x, z]) => !used.has(x + ',' + z));
    const claim = cells => cells.forEach(([x, z]) => { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) used.add((x + dx) + ',' + (z + dz)); });
    const things = () => b.items.filter(i => i.kind !== 'road');
    const add = (d, it) => { const cells = cellsOf(it); claim(cells); diffs.push({ ...d, cells, x: it.x, z: it.z, w: it.w, d: it.d }); };

    const ops = {
      remove() {
        const it = pick(things().filter(i => clear(cellsOf(i)))); if (!it) return false;
        G.remove(b, it.id); add({ type: 'remove', ids: [it.id], label: iga(KIND_WORD(it)) + ' 사라졌어요' }, it); return true;
      },
      add() {
        for (let n = 0; n < 40; n++) {
          const x = Math.floor(rand() * b.size), z = Math.floor(rand() * b.size);
          if (!clear([[x, z]]) || G.itemAt(b, x, z)) continue;
          const ref = pick(ADDS);
          const id = G.place(b, { kind: 'deco', ref, x, z, rot: Math.floor(rand() * 2) });
          if (!id) continue;
          const it = b.items.find(i => i.id === id);
          add({ type: 'add', ids: [id], label: iga(KIND_WORD(it)) + ' 생겼어요' }, it); return true;
        }
        return false;
      },
      rotate() {
        const it = pick(things().filter(i => (i.kind === 'house' || i.kind === 'model' || i.ref === 'fence') && clear(cellsOf(i)))); if (!it) return false;
        const r0 = it.rot;
        if (!G.rotate(b, it.id)) return false;
        if (it.kind !== 'deco' && !G.rotate(b, it.id)) { /* keep the 90° turn */ }
        if (it.rot === r0) return false;
        add({ type: 'rotate', ids: [it.id], label: iga(KIND_WORD(it)) + ' 돌아갔어요' }, it); return true;
      },
      swap() {
        const it = pick(things().filter(i => i.kind === 'house' && clear(cellsOf(i)))); if (!it) return false;
        let ref = it.ref;
        while (ref === it.ref) ref = String(Math.floor(rand() * houseCount));
        it.ref = ref;
        add({ type: 'swap', ids: [it.id], label: '다른 집으로 바뀌었어요' }, it); return true;
      },
      recolor() {
        const cand = things().filter(i => (i.kind === 'house' || i.kind === 'model') && clear(cellsOf(i)));
        const it = pick(cand.filter(i => i.paint).length ? cand.filter(i => i.paint) : cand); if (!it) return false;
        const p = it.paint = { ...(it.paint || {}) };
        const keys = Object.keys(p);
        const k = keys.length ? pick(keys) : '0';
        let c = p[k];
        while (c === p[k]) c = Math.floor(rand() * 8);
        p[k] = c;
        add({ type: 'recolor', ids: [it.id], label: '색이 바뀌었어요' }, it); return true;
      },
      swapDeco() {
        const it = pick(things().filter(i => (i.ref === 'tree' || i.ref === 'roundTree') && clear(cellsOf(i)))); if (!it) return false;
        it.ref = it.ref === 'tree' ? 'roundTree' : 'tree';
        add({ type: 'swapDeco', ids: [it.id], label: '나무 모양이 바뀌었어요' }, it); return true;
      },
    };
    const names = ['remove', 'remove', 'add', 'add', 'rotate', 'swap', 'swap', 'swapDeco'];
    if (v.items.some(i => i.paint)) names.push('recolor', 'recolor');
    for (let tries = 0; tries < 200 && diffs.length < count; tries++) ops[pick(names)]();
    return { village: b, diffs };
  }

  // Which difference (if any) a tap landed on: exact item first, then within one cell.
  function hit(diffs, itemId, cell) {
    if (itemId != null) { const d = diffs.find(x => x.ids.includes(itemId)); if (d) return d; }
    if (cell) {
      const d = diffs.find(x => x.cells.some(([cx, cz]) => Math.abs(cx - cell[0]) <= 1 && Math.abs(cz - cell[1]) <= 1));
      if (d) return d;
    }
    return null;
  }

  const api = { makeDiffs, hit };
  if (node) module.exports = api;
  else root.BV.Spot = api;
})(this);
