// Colouring templates ("칠하기 도안"), made at random each time.
// generate(seed, level) → { name, level, items: [{ k, r, x, z, rot, w, s, n }], roads: [[x, z]], road }
//   k kind, r ref, w wall colour (fill surfaces), s roof/leaf colour (soft), n window colour; road: colour of every road cell or null.
//   Colour codes: 100 + hue*16 + tone (tone 0 light .. 15 dark), see models3d.js.
// village(L) → a fresh village for that template (no paint); each item keeps its template index in tpl.
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const G = node ? require('./grid.js') : root.BV.Grid;
  const D = node ? require('./decorate.js') : root.BV.Decorate;

  const c = (hue, tone) => 100 + hue * 16 + tone;
  // colour schemes that go well together: walls, roofs, leaves, roads, windows
  const SCHEMES = [
    { name: '노을빛', walls: [c(2, 2), c(1, 2), c(13, 2), c(3, 2)], roofs: [c(0, 6), c(1, 7), c(14, 7), c(2, 8)], leaf: [c(5, 6), c(4, 7)], road: [c(2, 4), c(15, 4)], win: [c(3, 4), c(8, 3)] },
    { name: '바닷가', walls: [c(8, 2), c(7, 2), c(9, 1), c(15, 1)], roofs: [c(9, 7), c(10, 7), c(6, 7), c(8, 8)], leaf: [c(6, 6), c(5, 6)], road: [c(7, 4), c(15, 5)], win: [c(3, 3), c(1, 3)] },
    { name: '숲속', walls: [c(4, 2), c(2, 3), c(5, 2), c(15, 1)], roofs: [c(5, 8), c(0, 8), c(2, 10), c(6, 9)], leaf: [c(5, 7), c(4, 8)], road: [c(2, 6), c(15, 6)], win: [c(3, 4), c(4, 3)] },
    { name: '파스텔', walls: [c(13, 2), c(11, 2), c(8, 2), c(3, 2)], roofs: [c(13, 5), c(11, 5), c(8, 5), c(1, 5)], leaf: [c(4, 5), c(5, 5)], road: [c(15, 3), c(13, 3)], win: [c(3, 3), c(7, 3)] },
    { name: '무지개', walls: [c(0, 3), c(1, 3), c(3, 3), c(5, 3), c(8, 3), c(11, 3)], roofs: [c(9, 7), c(0, 7), c(11, 7), c(5, 8)], leaf: [c(5, 6), c(4, 6)], road: [c(15, 4), c(8, 4)], win: [c(3, 4), c(13, 3)] },
    { name: '겨울', walls: [c(15, 0), c(8, 1), c(9, 1), c(11, 1)], roofs: [c(9, 8), c(10, 9), c(15, 8), c(0, 7)], leaf: [c(6, 8), c(5, 9)], road: [c(15, 5), c(8, 5)], win: [c(3, 3), c(2, 3)] },
  ];
  const LEVEL = {
    easy: { size: 10, blds: [3, 4], nW: 1, nR: 1, win: 0, road: 0, special: 0, rides: 0, deco: [2, 3], label: '쉬움' },
    normal: { size: 14, blds: [5, 6], nW: 2, nR: 1, win: 0, road: 0.5, special: 0.7, rides: 0, deco: [3, 5], label: '보통' },
    hard: { size: 18, blds: [7, 9], nW: 3, nR: 2, win: 0.7, road: 0.85, special: 1, rides: 0.6, deco: [4, 7], label: '어려움' },
  };
  const SPECIAL = ['windmill', 'lighthouse', 'clockTower', 'church', 'treehouse', 'pavilion', 'bakery', 'flowerShop', 'cafe', 'bookstore', 'postOffice', 'greenhouse', 'library', 'market'];
  const RIDES = ['carousel', 'swingRide', 'dropTower', 'obsTower', 'bigWheel', 'ferrisWheel', 'viking'];
  const DECO = ['tree', 'roundTree', 'bush', 'cherry', 'fruitTree', 'flowers', 'sunflowers', 'bench'];
  const LEAFY = ['tree', 'roundTree', 'bush', 'cherry', 'fruitTree', 'sunflowers', 'flowers'];
  const LAYOUTS = { street: '골목', cross: '사거리', square: '광장' };

  function generate(seed, level = 'normal') {
    const P = LEVEL[level] || LEVEL.normal;
    const rand = D.rng(seed * 7919 + 13);
    const pick = a => a[Math.floor(rand() * a.length)];
    const between = ([a, b]) => a + Math.floor(rand() * (b - a + 1));
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    const v = G.create(), C = Math.floor(v.size / 2), half = Math.floor(P.size / 2);
    const lo = C - half, hi = C + half - 1;
    // roads
    const layout = level === 'easy' ? 'street' : pick(Object.keys(LAYOUTS));
    const roads = [];
    const road = (x, z) => { if (G.place(v, { kind: 'road', ref: 'road', x, z, rot: 0 })) roads.push([x, z]); };
    if (layout === 'street') for (let x = lo; x <= hi; x++) road(x, C);
    else if (layout === 'cross') { for (let x = lo; x <= hi; x++) road(x, C); for (let z = lo; z <= hi; z++) if (z !== C) road(C, z); }
    else { const a = C - 3, b = C + 2; for (let i = a; i <= b; i++) { road(i, a); road(i, b); if (i !== a && i !== b) { road(a, i); road(b, i); } } }

    // what to build
    const n = between(P.blds);
    const refs = [];
    if (layout === 'square') refs.push({ k: 'model', r: rand() < P.rides ? 'carousel' : pick(['fountain', 'pavilion', 'clockTower']), centre: true });
    if (rand() < P.rides) refs.push({ k: 'model', r: pick(RIDES) });
    if (rand() < P.special) refs.push({ k: 'model', r: pick(SPECIAL) });
    if (level === 'hard' && rand() < 0.6) refs.push({ k: 'model', r: pick(SPECIAL) });
    while (refs.length < n) refs.push({ k: 'house', r: String(Math.floor(rand() * 50)) });

    // colours
    const S = pick(SCHEMES);
    const walls = shuffle(S.walls.slice()).slice(0, P.nW), roofs = shuffle(S.roofs.slice()).slice(0, P.nR);
    const leaf = pick(S.leaf), winCol = rand() < P.win ? pick(S.win) : undefined;
    const roadCol = rand() < P.road ? pick(S.road) : null;

    // place buildings facing a road: try road cells and the four sides in random order
    const items = [];
    const fits = (k, r, x, z, rot) => { const [w, d] = G.sized(k, r, rot); const it = { x, z, w, d }; return G.canPlace(v, it) && x >= lo - 4 && z >= lo - 4 && x + w <= hi + 5 && z + d <= hi + 5; };
    function facing(k, r, [rx, rz], rot) {
      const [w, d] = G.sized(k, r, rot);
      if (rot === 0) return [rx - Math.floor(w / 2), rz - d];
      if (rot === 1) return [rx - w, rz - Math.floor(d / 2)];
      if (rot === 2) return [rx - Math.floor(w / 2), rz + 1];
      return [rx + 1, rz - Math.floor(d / 2)];
    }
    refs.forEach((o, i) => {
      let spot = null;
      if (o.centre) {
        const [w, d] = G.sized(o.k, o.r, 0), x = C - 1 - Math.floor((w - 1) / 2), z = C - 1 - Math.floor((d - 1) / 2);
        if (fits(o.k, o.r, x, z, 0)) spot = [x, z, 0];
      }
      const cands = shuffle(roads.flatMap(rc => [0, 1, 2, 3].map(rot => [rc, rot])));
      for (const [rc, rot] of cands) {
        if (spot) break;
        const [x, z] = facing(o.k, o.r, rc, rot);
        if (fits(o.k, o.r, x, z, rot)) spot = [x, z, rot];
      }
      if (!spot) return;
      const [x, z, rot] = spot;
      G.place(v, { kind: o.k, ref: o.r, x, z, rot });
      const it = { k: o.k, r: o.r, x, z, rot, w: walls[i % walls.length], s: roofs[Math.floor(rand() * roofs.length)] };
      if (winCol !== undefined && rand() < 0.8) it.n = winCol;
      items.push(it);
    });

    // trees and flowers around the buildings
    const want = between(P.deco);
    const spots = D.plan(v, seed + 1).filter(d => d.x >= lo - 3 && d.z >= lo - 3 && d.x <= hi + 3 && d.z <= hi + 3);
    for (const d of spots) {
      if (items.filter(i => i.k === 'deco').length >= want) break;
      const ref = pick(DECO);
      if (!G.place(v, { kind: 'deco', ref, x: d.x, z: d.z, rot: 0 })) continue;
      const it = { k: 'deco', r: ref, x: d.x, z: d.z, rot: 0, s: LEAFY.includes(ref) ? leaf : roofs[0] };
      if (ref === 'bench') it.w = walls[0];
      items.push(it);
    }

    const ride = items.some(i => RIDES.includes(i.r)) ? ' 놀이공원' : '';
    return { name: `${S.name}${ride} ${LAYOUTS[layout]}`, level, items, roads, road: roadCol };
  }

  function village(L) {
    const v = G.create();
    L.roads.forEach(([x, z]) => G.place(v, { kind: 'road', ref: 'road', x, z, rot: 0 }));
    L.items.forEach((o, n) => { const id = G.place(v, { kind: o.k, ref: o.r, x: o.x, z: o.z, rot: o.rot }); const it = v.items.find(t => t.id === id); if (it) it.tpl = n; });
    return v;
  }

  const api = { generate, village, LEVEL, SCHEMES };
  if (node) module.exports = api;
  else { root.BV = root.BV || {}; root.BV.Doan = api; }
})(this);
