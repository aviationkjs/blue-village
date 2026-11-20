// Road shapes and the "connect the roads" button. Pure logic.
(function (root) {
  const G = typeof module !== 'undefined' && module.exports ? require('./grid.js') : root.BV.Grid;
  const DIRS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]; // N E S W

  function occupancy(v) {
    const m = new Map();
    v.items.forEach(it => {
      for (let x = it.x; x < it.x + it.w; x++) for (let z = it.z; z < it.z + it.d; z++) m.set(x + ',' + z, it);
    });
    return m;
  }

  // tiles share kind 'road'; ref tells them apart: 'road' (old saves may have none), 'water' (creek), 'rail'
  const tileRef = it => (it && it.kind === 'road' ? (it.ref || 'road') : null);
  const isRoad = it => tileRef(it) === 'road';

  function mask(v, x, z, occ = occupancy(v), ref = 'road') {
    let m = 0;
    DIRS.forEach(([dx, dz, bit]) => { if (tileRef(occ.get((x + dx) + ',' + (z + dz))) === ref) m |= bit; });
    return m;
  }

  const isBuilding = it => it.kind === 'house' || it.kind === 'model';

  function autoConnect(v) {
    const occ = occupancy(v);
    const inside = (x, z) => x >= 0 && z >= 0 && x < v.size && z < v.size;
    const free = (x, z) => { const it = occ.get(x + ',' + z); return inside(x, z) && (!it || isRoad(it)); };
    const net = new Set();
    occ.forEach((it, k) => { if (isRoad(it)) net.add(k); });
    const added = [];
    const add = (x, z) => { const k = x + ',' + z; if (!occ.has(k) && !net.has(k)) added.push([x, z]); net.add(k); };

    const fronts = v.items.filter(isBuilding).sort((a, b) => a.id - b.id)
      .map(G.frontCell).filter(([x, z]) => free(x, z));
    if (!fronts.length) return [];
    if (!net.size) add(fronts[0][0], fronts[0][1]);

    fronts.forEach(([fx, fz]) => {
      const start = fx + ',' + fz;
      if (net.has(start)) return;
      const prev = new Map([[start, null]]);
      const q = [[fx, fz]];
      let hit = null;
      while (q.length && !hit) {
        const [x, z] = q.shift();
        for (const [dx, dz] of DIRS) {
          const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
          if (prev.has(k) || !free(nx, nz)) continue;
          prev.set(k, x + ',' + z);
          if (net.has(k)) { hit = k; break; }
          q.push([nx, nz]);
        }
      }
      if (!hit) return; // nothing reachable from this front: leave it alone
      for (let k = prev.get(hit); k; k = prev.get(k)) { const [x, z] = k.split(',').map(Number); add(x, z); }
    });
    return added;
  }

  const api = { DIRS, occupancy, mask, autoConnect, isBuilding, tileRef, isRoad };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BV.Roads = api;
})(this);
