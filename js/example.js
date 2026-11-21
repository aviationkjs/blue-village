// The example village on the 32x32 board: homes, a theme park, forest and farm, a shopping street and a station,
// laid out around a main street (east-west, z=15) and an avenue (north-south, x=15). Pure logic.
// build() → { village, missed } (missed lists anything that did not fit, for the tests).
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const G = node ? require('./grid.js') : root.BV.Grid;
  const R = node ? require('./roads.js') : root.BV.Roads;
  const D = node ? require('./decorate.js') : root.BV.Decorate;

  function build() {
    const v = G.create();
    const missed = [];
    const P = (kind, ref, x, z, rot = 0) => { const id = G.place(v, { kind, ref: String(ref), x, z, rot }); if (!id) missed.push(`${kind}:${ref}@${x},${z}`); return id; };
    const tile = (ref, x, z) => P('road', ref, x, z);

    // ---- roads
    for (let x = 1; x <= 30; x++) tile('road', x, 15);              // main street
    for (let z = 1; z <= 29; z++) if (z !== 15) tile('road', 15, z); // avenue
    for (let x = 1; x <= 14; x++) tile('road', x, 8);              // lane in the homes quarter
    for (let x = 16; x <= 29; x++) tile('road', x, 22);            // lane in the shopping quarter
    for (let z = 3; z <= 12; z++) tile('road', 22, z);             // path inside the park
    tile('road', 22, 14);                                          // from the park gate to the street

    // ---- north-west: homes, clock tower, church, a small park
    [[1, 0], [4, 12], [7, 3], [10, 15]].forEach(([x, h]) => P('house', h, x, 6, 0));
    P('model', 'church', 12, 5, 0);
    [[1, 21], [4, 33], [7, 4], [10, 43]].forEach(([x, h]) => P('house', h, x, 9, 2));
    P('model', 'clockTower', 12, 9, 2);
    [[2, 1], [5, 49], [8, 31]].forEach(([x, h]) => P('house', h, x, 13, 0));
    P('model', 'cafe', 11, 13, 0);
    P('model', 'pond', 2, 2, 0); P('model', 'treehouse', 6, 2, 0); P('model', 'pavilion', 10, 2, 0);
    [[1, 1, 'cherry'], [5, 1, 'cherry'], [9, 1, 'flowers'], [13, 2, 'bench'], [13, 3, 'flowers'], [4, 3, 'bench']].forEach(([x, z, r]) => P('deco', r, x, z));

    // ---- north-east: theme park with a monorail around it
    P('model', 'coaster', 16, 1, 0);
    P('model', 'bigWheel', 24, 1, 0);
    P('model', 'dropTower', 28, 1, 0);
    P('model', 'swingRide', 24, 4, 0);
    P('model', 'obsTower', 28, 4, 0);
    P('model', 'carousel', 18, 6, 0);
    P('model', 'spaceRide', 24, 8, 0);
    P('model', 'viking', 16, 10, 0);
    P('model', 'logFlume', 26, 11, 0);
    P('model', 'parkArch', 20, 13, 0);
    [[21, 12, 'queueRail'], [19, 12, 'ticketBooth'], [23, 12, 'balloonStand'], [24, 12, 'cottonCandy'], [20, 10, 'stringLights'], [21, 10, 'stringLights'], [23, 7, 'bench'], [21, 5, 'flowers']].forEach(([x, z, r]) => P('deco', r, x, z));
    for (let x = 16; x <= 31; x++) tile('mono', x, 0);
    for (let z = 1; z <= 10; z++) tile('mono', 31, z);

    // ---- south-west: forest and farm along the creek
    for (let x = 1; x <= 14; x++) tile('water', x, 23);
    P('model', 'field', 2, 17, 0); P('model', 'field', 4, 17, 0); P('model', 'field', 2, 19, 0);
    P('model', 'windmill', 7, 17, 0);
    P('model', 'waterwheel', 11, 21, 0);
    [[10, 17, 'beehive'], [11, 17, 'sunflowers'], [12, 17, 'sunflowers'], [5, 20, 'fruitTree'], [7, 20, 'fruitTree'], [9, 20, 'fruitTree']].forEach(([x, z, r]) => P('deco', r, x, z));
    P('model', 'waterfall', 1, 24, 0);
    P('model', 'hill', 4, 26, 0);
    P('model', 'tent', 8, 26, 0);
    P('model', 'hammock', 11, 25, 0);
    P('model', 'footbath', 1, 28, 0);
    [[10, 27, 'campfire'], [7, 29, 'picnic'], [4, 29, 'cherry'], [5, 29, 'cherry'], [12, 29, 'bamboo'], [13, 29, 'bamboo'], [6, 25, 'rock'], [13, 26, 'treeSwing']].forEach(([x, z, r]) => P('deco', r, x, z));

    // ---- south-east: shops on the street, a quiet lane, the station and railway
    [['bakery', 16], ['flowerShop', 19], ['bookstore', 22], ['postOffice', 25], ['iceCream', 28]].forEach(([r, x]) => P('model', r, x, 16, 2));
    P('model', 'library', 16, 20, 0); P('model', 'market', 20, 20, 0); P('model', 'lighthouse', 24, 20, 0); P('house', 22, 27, 20, 0);
    P('model', 'fountain', 17, 23, 2); P('house', 37, 20, 23, 2); P('house', 26, 23, 23, 2); P('model', 'greenhouse', 26, 23, 2);
    P('house', 46, 28, 23, 2);
    [[19, 23, 'bench'], [19, 24, 'flowers'], [25, 25, 'roundTree'], [28, 25, 'tree']].forEach(([x, z, r]) => P('deco', r, x, z));
    for (let x = 16; x <= 30; x++) tile('rail', x, 28);
    for (let z = 18; z <= 27; z++) tile('rail', 30, z);
    P('model', 'station', 20, 26, 0);
    P('model', 'gate', 14, 30, 2);

    // ---- lamps along the main street, then a little greenery in the gaps
    // (no automatic road joining: homes and shops already face a road, and paths through the park and farm would clutter it)
    [4, 10, 14, 18, 26, 29].forEach(x => P('deco', 'lamp', x, 14));
    D.plan(v, 11).filter(d => d.ref !== 'lamp' && d.ref !== 'fence').slice(0, 22).forEach(d => G.place(v, d));
    void R;
    return { village: v, missed };
  }

  const api = { build };
  if (node) module.exports = api;
  else { root.BV = root.BV || {}; root.BV.Example = api; }
})(this);
