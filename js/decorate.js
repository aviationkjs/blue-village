// The "decorate" button: trees, bushes, lamps and fences around buildings.
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const G = node ? require('./grid.js') : root.BV.Grid;
  const R = node ? require('./roads.js') : root.BV.Roads;

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function plan(v, seed) {
    const rand = rng(seed);
    const occ = R.occupancy(v);
    const taken = new Set(occ.keys());
    const buildings = v.items.filter(R.isBuilding);
    buildings.forEach(b => { const [x, z] = G.frontCell(b); taken.add(x + ',' + z); });
    const isRoad = (x, z) => { const it = occ.get(x + ',' + z); return it && it.kind === 'road'; };
    const inside = (x, z) => x >= 0 && z >= 0 && x < v.size && z < v.size;
    const out = [];
    const put = (ref, x, z, rot = 0) => { taken.add(x + ',' + z); out.push({ kind: 'deco', ref, x, z, rot }); };

    // ring of cells 1-2 away from each building
    const ring = [];
    buildings.forEach(b => {
      for (let x = b.x - 2; x < b.x + b.w + 2; x++) for (let z = b.z - 2; z < b.z + b.d + 2; z++) {
        if (!inside(x, z)) continue;
        const dist = Math.max(b.x - x, x - (b.x + b.w - 1), b.z - z, z - (b.z + b.d - 1));
        if (dist >= 1) ring.push([x, z, dist]);
      }
    });
    for (let i = ring.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ring[i], ring[j]] = [ring[j], ring[i]]; }

    ring.forEach(([x, z, dist]) => {
      if (taken.has(x + ',' + z) || rand() > 0.32) return;
      const nearRoad = R.DIRS.some(([dx, dz]) => isRoad(x + dx, z + dz));
      const r = rand();
      if (nearRoad) { if (r < 0.45) put('lamp', x, z); return; }
      if (dist === 1 && r < 0.22) put('bush', x, z);
      else if (dist === 1 && r < 0.36) put('fence', x, z, Math.floor(rand() * 2));
      else if (r < 0.7) put('tree', x, z);
      else put('roundTree', x, z);
    });

    // a few trees along the edge of the map
    for (let n = 0; n < 14; n++) {
      const edge = Math.floor(rand() * 4), t = Math.floor(rand() * v.size), depth = Math.floor(rand() * 2);
      const [x, z] = [[t, depth], [v.size - 1 - depth, t], [t, v.size - 1 - depth], [depth, t]][edge];
      if (!taken.has(x + ',' + z)) put(rand() < 0.6 ? 'tree' : 'roundTree', x, z);
    }
    return out;
  }

  const api = { plan, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BV.Decorate = api;
})(this);
