// Village state: what sits on which cell. No rendering here.
(function (root) {
  const MODEL_FP = { cottage: [3, 2], greenhouse: [2, 2], tower: [3, 3], storeBox: [2, 2], tripleGable: [3, 2], castle: [3, 2] };

  function create(size = 24) { return { size, items: [], nextId: 1 }; }

  function footprint(kind, ref) {
    if (kind === 'house' || kind === 'statue') return [2, 2];
    if (kind === 'model') return (MODEL_FP[ref] || [2, 2]).slice();
    return [1, 1];
  }

  function sized(kind, ref, rot) {
    const [w, d] = footprint(kind, ref);
    return rot % 2 ? [d, w] : [w, d];
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
  }

  function canPlace(v, item, ignoreId) {
    if (item.x < 0 || item.z < 0 || item.x + item.w > v.size || item.z + item.d > v.size) return false;
    return !v.items.some(o => o.id !== ignoreId && overlaps(o, item));
  }

  function place(v, { kind, ref, x, z, rot = 0 }) {
    const [w, d] = sized(kind, ref, rot);
    const item = { id: v.nextId, kind, ref: String(ref), x, z, rot, w, d };
    if (!canPlace(v, item)) return null;
    v.items.push(item);
    v.nextId++;
    return item.id;
  }

  const find = (v, id) => v.items.find(i => i.id === id);

  function remove(v, id) {
    const n = v.items.length;
    v.items = v.items.filter(i => i.id !== id);
    return v.items.length !== n;
  }

  function move(v, id, x, z) {
    const it = find(v, id);
    if (!it) return false;
    const next = { ...it, x, z };
    if (!canPlace(v, next, id)) return false;
    it.x = x; it.z = z;
    return true;
  }

  function rotate(v, id) {
    const it = find(v, id);
    if (!it) return false;
    const rot = (it.rot + 1) % 4;
    const [w, d] = sized(it.kind, it.ref, rot);
    const next = { ...it, rot, w, d };
    if (!canPlace(v, next, id)) return false;
    Object.assign(it, { rot, w, d });
    return true;
  }

  function itemAt(v, x, z) {
    return v.items.find(i => x >= i.x && x < i.x + i.w && z >= i.z && z < i.z + i.d) || null;
  }

  // rot 0 faces +z, 1 faces +x, 2 faces -z, 3 faces -x
  function frontCell(it) {
    const cx = it.x + Math.floor(it.w / 2), cz = it.z + Math.floor(it.d / 2);
    switch (it.rot) {
      case 0: return [cx, it.z + it.d];
      case 1: return [it.x + it.w, cz];
      case 2: return [cx, it.z - 1];
      default: return [it.x - 1, cz];
    }
  }

  // floor: { "x,z": colour } painted cells; ground: colour of the round land around the board
  function serialize(v) {
    const o = { size: v.size, items: v.items, nextId: v.nextId };
    if (v.floor && Object.keys(v.floor).length) o.floor = v.floor;
    if (v.ground !== undefined) o.ground = v.ground;
    return JSON.stringify(o);
  }

  function deserialize(str) {
    try {
      const o = JSON.parse(str);
      if (!o || typeof o.size !== 'number' || !Array.isArray(o.items)) return null;
      const ok = o.items.every(i => i && typeof i.id === 'number' && typeof i.kind === 'string' &&
        [i.x, i.z, i.w, i.d, i.rot].every(n => Number.isInteger(n)));
      if (!ok) return null;
      // paint: { surfaceIndex: paletteIndex } — drop anything malformed rather than the whole village
      o.items.forEach(i => {
        if (i.paint === undefined) return;
        if (!i.paint || typeof i.paint !== 'object') { delete i.paint; return; }
        Object.keys(i.paint).forEach(k => { if (!Number.isInteger(i.paint[k]) || !/^\d+$/.test(k)) delete i.paint[k]; });
        if (!Object.keys(i.paint).length) delete i.paint;
      });
      const nextId = Math.max(o.nextId | 0, ...o.items.map(i => i.id + 1), 1);
      const out = { size: o.size, items: o.items, nextId };
      if (o.floor && typeof o.floor === 'object') {
        const f = {};
        Object.keys(o.floor).forEach(k => { if (/^\d+,\d+$/.test(k) && Number.isInteger(o.floor[k])) f[k] = o.floor[k]; });
        if (Object.keys(f).length) out.floor = f;
      }
      if (Number.isInteger(o.ground)) out.ground = o.ground;
      return out;
    } catch (e) { return null; }
  }

  // Snapshot undo: the whole village is small, so a JSON copy per step is fine.
  class History {
    constructor(v, limit = 100) { this.v = v; this.past = []; this.future = []; this.limit = limit; }
    snap() { return serialize(this.v); }
    restore(s) {
      const o = JSON.parse(s); this.v.items = o.items; this.v.nextId = o.nextId; this.v.size = o.size;
      if (o.floor) this.v.floor = o.floor; else delete this.v.floor;
      if (o.ground !== undefined) this.v.ground = o.ground; else delete this.v.ground;
    }
    commit(fn) {
      const before = this.snap();
      const out = fn();
      if (this.snap() === before) return out;
      this.past.push(before);
      if (this.past.length > this.limit) this.past.shift();
      this.future = [];
      return out;
    }
    // for drag strokes: pass the snapshot taken when the stroke began
    record(before) {
      if (this.snap() === before) return false;
      this.past.push(before);
      if (this.past.length > this.limit) this.past.shift();
      this.future = [];
      return true;
    }
    undo() {
      if (!this.past.length) return false;
      this.future.push(this.snap());
      this.restore(this.past.pop());
      return true;
    }
    redo() {
      if (!this.future.length) return false;
      this.past.push(this.snap());
      this.restore(this.future.pop());
      return true;
    }
    reset() { this.past = []; this.future = []; }
  }

  const api = { MODEL_FP, create, footprint, sized, canPlace, place, remove, move, rotate, itemAt, frontCell, serialize, deserialize, History };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.BV = root.BV || {}; root.BV.Grid = api; }
})(this);
