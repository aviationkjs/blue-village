// Nature, farm and resting places for the healing village. Browser only (needs THREE and BV.Models).
// Models are built in grid units around the footprint centre (front +z); decorations fill one cell.
(function (root) {
  const Mo = root.BV.Models;
  const { M, part, box, bar, gable, addSmoke, paintMat, code } = Mo;
  const col = (hue, tone, base = 'fill') => paintMat(code(hue, tone), base);
  const sound = (name) => { const S = root.BV.Sound; if (S && S[name]) S[name](); };
  const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sphere = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
  function flower(g, x, y, z, hue, r = 0.06) { const f = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), col(hue, 4)); f.position.set(x, y, z); g.add(f); return f; }
  function glowPool(r) {
    const m = Mo.M.glow.clone(); m.opacity = 0;
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 28), m); p.rotation.x = -Math.PI / 2; p.position.y = 0.03; p.renderOrder = 2; p.userData.smoke = true;
    return p;
  }

  const MOD = {}, DEC = {};

  // waterfall: a rocky cliff, falling water and a pool
  MOD.waterfall = () => {
    const g = new THREE.Group();
    [[-0.55, 0.35, -0.55, 0.5], [0.5, 0.4, -0.55, 0.5], [0, 0.55, -0.7, 0.6], [-0.4, 1.0, -0.65, 0.42], [0.4, 1.05, -0.62, 0.42], [0, 1.4, -0.7, 0.4], [-0.75, 0.25, 0.1, 0.25], [0.78, 0.22, 0.2, 0.22]]
      .forEach(([x, y, z, r], i) => { const m = part(new THREE.DodecahedronGeometry(r, 0), g, x, y, z, col(15, 3 + (i % 3))); m.rotation.set(i, i * 2, 0); });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), M.water); pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.04, 0.3); g.add(pool);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 1.35), M.water); sheet.position.set(0, 0.95, -0.24); sheet.rotation.x = -0.12; g.add(sheet);
    const drops = [];
    for (let i = 0; i < 16; i++) { const d = new THREE.Mesh(sphere(0.04, 6, 4), M.water); d.userData.smoke = true; g.add(d); drops.push({ d, t: i / 16, x: (Math.random() - 0.5) * 0.3 }); }
    const mist = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false })); m.userData.smoke = true; g.add(m); mist.push({ m, t: i / 4 }); }
    g.userData.tick = (t, dt) => {
      drops.forEach(o => { o.t = (o.t + dt * 0.8) % 1; o.d.position.set(o.x, 1.6 - o.t * 1.55, -0.2 + o.t * 0.25); });
      mist.forEach(o => { o.t = (o.t + dt * 0.3) % 1; o.m.position.set(Math.sin(o.t * 6 + o.m.id) * 0.3, 0.1 + o.t * 0.5, 0.15); o.m.scale.setScalar(0.6 + o.t * 1.4); o.m.material.opacity = 0.5 * (1 - o.t); });
    };
    g.userData.react = () => sound('splash');
    return g;
  };

  // field: rows of crops that grow, are harvested and sprout again; a scarecrow keeps watch
  MOD.field = () => {
    const g = new THREE.Group();
    part(box(1.85, 0.08, 1.85), g, 0, 0.04, 0, col(2, 11));
    const plants = [];
    for (let r = 0; r < 4; r++) {
      bar(g, 1.7, 0.05, 0.12, 0, 0.1, -0.66 + r * 0.44).material = col(2, 12);
      for (let c = 0; c < 5; c++) {
        const p = new THREE.Group(); p.position.set(-0.68 + c * 0.34, 0.1, -0.66 + r * 0.44); g.add(p);
        part(new THREE.ConeGeometry(0.1, 0.32, 6), p, 0, 0.16, 0, M.soft);
        plants.push({ p, ph: (r * 5 + c) * 0.037 });
      }
    }
    const sc = new THREE.Group(); sc.position.set(0.72, 0.08, 0.72); g.add(sc);
    bar(sc, 0.04, 0.9, 0.04, 0, 0.45, 0); bar(sc, 0.55, 0.04, 0.04, 0, 0.62, 0);
    part(sphere(0.1), sc, 0, 0.95, 0); part(new THREE.ConeGeometry(0.17, 0.12, 10), sc, 0, 1.07, 0, col(2, 6));
    part(box(0.24, 0.3, 0.1), sc, 0, 0.62, 0, col(0, 5));
    let hurry = 0;
    g.userData.tick = (t, dt) => {
      hurry = Math.max(0, hurry - dt * 0.2);
      plants.forEach(o => { o.ph = (o.ph + dt * (0.02 + hurry)) % 1; o.p.scale.setScalar(0.2 + o.ph * 1.0); });
      sc.rotation.y = Math.sin(t * 0.7) * 0.15;
    };
    g.userData.react = () => { hurry = 0.3; sound('chime'); };
    return g;
  };

  // hill: a soft green mound with a little tree and flowers
  MOD.hill = () => {
    const g = new THREE.Group();
    const h = part(new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), g, 0, 0, 0, col(4, 2, 'soft')); h.scale.set(0.95, 0.55, 0.95);
    const t = Mo.deco('roundTree'); t.scale.setScalar(0.75); t.position.set(0.15, 0.5, -0.1); g.add(t);
    [[-0.45, 0.3, 0.35, 13], [-0.2, 0.42, 0.45, 3], [0.45, 0.3, 0.4, 0], [0.55, 0.22, -0.45, 11]].forEach(([x, y, z, hue]) => flower(g, x, y, z, hue));
    g.userData.react = () => sound('chime');
    return g;
  };

  // cherry tree: pink blossoms whatever the season, petals drifting down
  DEC.cherry = () => {
    const g = new THREE.Group();
    part(cyl(0.06, 0.09, 0.6, 6), g, 0, 0.3, 0, col(2, 10));
    const pink = col(13, 2, 'soft');
    [[0, 0.85, 0, 0.36], [-0.2, 0.75, 0.1, 0.24], [0.22, 0.78, -0.08, 0.25]].forEach(([x, y, z, r]) => part(new THREE.IcosahedronGeometry(r, 0), g, x, y, z, pink));
    const petals = [];
    for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.04), col(13, 3, 'soft')); p.userData.smoke = true; g.add(p); petals.push({ p, t: i / 6, a: Math.random() * 6 }); }
    g.userData.tick = (t, dt) => petals.forEach(o => {
      o.t = (o.t + dt * 0.12) % 1;
      o.p.position.set(Math.sin(o.a) * 0.3 + Math.sin(t + o.a) * 0.12, 0.85 - o.t * 0.85, Math.cos(o.a) * 0.3 + o.t * 0.25);
      o.p.rotation.set(t * 2 + o.a, t + o.a, 0);
    });
    return g;
  };
  DEC.bamboo = () => {
    const g = new THREE.Group();
    const stalks = [];
    [[-0.2, -0.15, 1.5], [0.15, -0.2, 1.75], [0.05, 0.18, 1.3], [-0.25, 0.22, 1.1], [0.28, 0.1, 1.55]].forEach(([x, z, h], i) => {
      const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
      part(cyl(0.035, 0.04, h, 6), s, 0, h / 2, 0, col(4, 6));
      for (let y = 0.3; y < h; y += 0.3) bar(s, 0.09, 0.02, 0.09, 0, y, 0);
      part(new THREE.ConeGeometry(0.12, 0.3, 5), s, 0.06, h - 0.1, 0, M.soft).rotation.z = -0.6;
      stalks.push({ s, ph: i });
    });
    g.userData.tick = (t) => stalks.forEach(o => { o.s.rotation.z = Math.sin(t * 0.9 + o.ph) * 0.04; o.s.rotation.x = Math.cos(t * 0.7 + o.ph) * 0.03; });
    return g;
  };
  DEC.fruitTree = () => {
    const g = Mo.deco('roundTree');
    [[0.25, 0.75, 0.2], [-0.22, 0.7, 0.22], [0.05, 0.9, 0.3], [0.3, 0.6, -0.15], [-0.28, 0.62, -0.12]].forEach(([x, y, z]) => { const f = new THREE.Mesh(sphere(0.05, 8, 6), col(0, 6)); f.position.set(x, y, z); g.add(f); });
    return g;
  };
  DEC.sunflowers = () => {
    const g = new THREE.Group();
    const heads = [[-0.22, 0.75, 0], [0.18, 0.9, -0.1], [0.05, 0.62, 0.22]].map(([x, h, z], i) => {
      const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
      bar(s, 0.03, h, 0.03, 0, h / 2, 0).material = col(5, 7);
      const f = new THREE.Group(); f.position.y = h; s.add(f);
      const pet = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), col(3, 4)); pet.position.z = 0.02; f.add(pet);
      const c = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), col(2, 11)); c.position.z = 0.03; f.add(c);
      const leaf = part(new THREE.ConeGeometry(0.06, 0.18, 4), s, 0.07, h * 0.45, 0, M.soft); leaf.rotation.z = -1.2;
      return { s, ph: i * 1.3 };
    });
    g.userData.tick = (t) => heads.forEach(o => { o.s.rotation.z = Math.sin(t * 0.8 + o.ph) * 0.05; });
    return g;
  };
  DEC.beehive = () => {
    const g = new THREE.Group();
    [-0.15, 0.15].forEach(x => bar(g, 0.04, 0.25, 0.04, x, 0.12, 0));
    part(box(0.45, 0.06, 0.45), g, 0, 0.27, 0);
    [0, 1, 2].forEach(i => part(box(0.38 - i * 0.02, 0.15, 0.38 - i * 0.02), g, 0, 0.38 + i * 0.16, 0, col(3, 4)));
    part(new THREE.ConeGeometry(0.32, 0.18, 4), g, 0, 0.94, 0, M.soft).rotation.y = Math.PI / 4;
    const bees = [0, 1, 2].map(i => { const b = new THREE.Mesh(sphere(0.035, 6, 4), col(3, 9)); b.userData.smoke = true; g.add(b); return b; });
    g.userData.tick = (t) => bees.forEach((b, i) => { const a = t * (1.6 + i * 0.4) + i * 2; b.position.set(Math.cos(a) * (0.35 + i * 0.05), 0.55 + Math.sin(t * 3 + i) * 0.15, Math.sin(a) * (0.35 + i * 0.05)); });
    return g;
  };
  DEC.rock = () => {
    const g = new THREE.Group();
    [[0, 0.16, 0, 0.22], [0.22, 0.1, 0.12, 0.13], [-0.2, 0.08, 0.15, 0.1]].forEach(([x, y, z, r], i) => { const m = part(new THREE.DodecahedronGeometry(r, 0), g, x, y, z, col(15, 3 + i)); m.rotation.set(i, i, 0); m.scale.y = 0.75; });
    return g;
  };

  // ---- resting places
  MOD.hammock = () => {
    const g = new THREE.Group();
    [-0.85, 0.85].forEach(x => { part(cyl(0.06, 0.08, 1.0, 6), g, x, 0.5, 0, col(2, 10)); part(new THREE.IcosahedronGeometry(0.22, 0), g, x, 1.05, 0, M.soft); });
    const sling = new THREE.Group(); sling.position.y = 0.85; g.add(sling);
    const pts = [[-0.8, 0], [-0.4, -0.3], [0, -0.4], [0.4, -0.3], [0.8, 0]].map(([x, y]) => new THREE.Vector3(x, y, 0));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.1, 6), col(8, 3, 'soft')); tube.scale.z = 2.2; sling.add(tube);
    g.userData.tick = (t) => { sling.rotation.x = Math.sin(t * 0.9) * 0.18; };
    g.userData.react = () => sound('chime');
    return g;
  };
  MOD.tent = () => {
    const g = new THREE.Group();
    part(gable(1.35, 1.0, 1.4), g, 0, 0, -0.15, col(1, 4, 'soft'));
    const door = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-0.25, 0); s.lineTo(0, 0.6); s.lineTo(0.25, 0); s.closePath(); return s; })()), new THREE.MeshBasicMaterial({ color: 0x2c4680 }));
    door.position.set(0, 0.01, 0.56); g.add(door);
    [[-0.85, 0.55], [0.85, 0.55], [-0.85, -0.85], [0.85, -0.85]].forEach(([x, z]) => g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x * 0.78, 0.25, z * 0.8), new THREE.Vector3(x, 0, z)]), M.line)));
    bar(g, 0.02, 0.3, 0.02, 0, 1.12, 0.55);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.12), M.flag); fl.position.set(0.1, 1.22, 0.55); g.add(fl);
    const lamp = new THREE.Mesh(sphere(0.07), M.lamp); lamp.position.set(0.32, 0.42, 0.65); g.add(lamp);
    g.userData.tick = (t) => { fl.rotation.y = Math.sin(t * 2.2) * 0.4; };
    g.userData.react = () => sound('chime');
    return g;
  };
  MOD.footbath = () => {
    const g = new THREE.Group();
    const wood = col(2, 9);
    [[0, 0.2, 0.55, 1.3, 0.4, 0.1], [0, 0.2, -0.55, 1.3, 0.4, 0.1], [0.6, 0.2, 0, 0.1, 0.4, 1.2], [-0.6, 0.2, 0, 0.1, 0.4, 1.2]].forEach(([x, y, z, w, h, d]) => part(box(w, h, d), g, x, y, z, wood));
    const water = new THREE.Mesh(box(1.1, 0.04, 1.0), M.water); water.position.y = 0.32; g.add(water);
    [-0.85, 0.85].forEach(x => { part(box(0.3, 0.06, 1.1), g, x, 0.3, 0, wood); [-0.4, 0.4].forEach(z => bar(g, 0.04, 0.3, 0.04, x, 0.15, z)); });
    [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]].forEach(([x, z]) => bar(g, 0.06, 1.4, 0.06, x, 0.7, z));
    part(Mo.hipRoof(2.0, 2.0, 0.45, 0.8), g, 0, 1.4, 0, M.soft);
    const steam = [addSmoke(g, -0.25, 0.4, 0), addSmoke(g, 0.25, 0.4, 0.1)];
    g.traverse(o => { if (o.userData.smoke && o.material) o.scale.multiplyScalar(0.5); });
    g.userData.tick = (t, dt, n) => steam.forEach(f => f(t, dt * 0.5, n));
    g.userData.react = () => sound('splash');
    return g;
  };
  MOD.clothesline = () => {
    const g = new THREE.Group();
    [-0.85, 0.85].forEach(x => { bar(g, 0.05, 1.1, 0.05, x, 0.55, 0); bar(g, 0.25, 0.04, 0.04, x, 1.08, 0); });
    bar(g, 1.7, 0.012, 0.012, 0, 1.02, 0.1);
    const clothes = [[-0.5, 0.36, 0.42, 0], [-0.08, 0.3, 0.32, 8], [0.3, 0.32, 0.4, 3], [0.62, 0.22, 0.28, 13]].map(([x, w, h, hue]) => {
      const p = new THREE.Group(); p.position.set(x, 1.02, 0.1); g.add(p);
      part(box(w, h, 0.015), p, 0, -h / 2, 0, col(hue, 3, 'soft'));
      return p;
    });
    g.userData.tick = (t) => clothes.forEach((p, i) => { p.rotation.x = 0.15 + Math.sin(t * 2.2 + i * 0.8) * 0.2; });
    g.userData.react = () => sound('whoosh');
    return g;
  };
  DEC.campfire = () => {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; part(new THREE.DodecahedronGeometry(0.07, 0), g, Math.cos(a) * 0.25, 0.05, Math.sin(a) * 0.25); }
    [0.5, -0.5, 1.6].forEach(r => { const l = part(cyl(0.035, 0.035, 0.4, 6), g, 0, 0.06, 0, col(2, 10)); l.rotation.set(Math.PI / 2, 0, 0); l.rotation.y = r; });
    const flames = [[0, 0.15, 0.2, 1], [0.05, 0.12, 0.14, 3], [-0.05, 0.11, 0.12, 2]].map(([x, h, r, hue]) => { const f = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, h * 2, 7), col(hue, 5)); f.position.set(x, 0.1 + h, 0); f.userData.smoke = true; g.add(f); return f; });
    const pool = glowPool(1.0); g.add(pool);
    g.userData.tick = (t, dt, n) => {
      flames.forEach((f, i) => { f.scale.set(1, 0.8 + Math.sin(t * 9 + i * 2) * 0.2 + Math.random() * 0.1, 1); });
      pool.material.opacity = 0.25 + n * 0.75 + Math.sin(t * 7) * 0.05;
    };
    return g;
  };
  DEC.picnic = () => {
    const g = new THREE.Group();
    [[0, 0, 0], [1, 0, 1], [0, 1, 1], [1, 1, 0]].forEach(([i, j, red]) => part(box(0.4, 0.02, 0.4), g, -0.2 + i * 0.4, 0.01, -0.2 + j * 0.4, red ? col(0, 4) : M.fill));
    part(box(0.26, 0.16, 0.18), g, 0.15, 0.1, -0.12, col(2, 8));
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 12, Math.PI), M.blue); h.position.set(0.15, 0.18, -0.12); g.add(h);
    [[-0.2, 0.15, 0], [-0.08, 0.2, 3]].forEach(([x, z, hue]) => { const c = part(cyl(0.04, 0.035, 0.07, 8), g, x, 0.055, z, col(hue, 3)); });
    return g;
  };
  DEC.treeSwing = () => {
    const g = new THREE.Group();
    part(cyl(0.07, 0.09, 1.1, 6), g, -0.3, 0.55, 0, col(2, 10));
    part(new THREE.IcosahedronGeometry(0.42, 0), g, -0.15, 1.2, 0, M.soft);
    bar(g, 0.6, 0.05, 0.05, 0.05, 1.0, 0).material = col(2, 10);
    const sw = new THREE.Group(); sw.position.set(0.15, 1.0, 0); g.add(sw);
    [-0.1, 0.1].forEach(x => bar(sw, 0.012, 0.72, 0.012, x, -0.36, 0));
    part(box(0.26, 0.04, 0.12), sw, 0, -0.73, 0, col(1, 5));
    g.userData.tick = (t) => { sw.rotation.x = Math.sin(t * 1.4) * 0.35; };
    return g;
  };
  DEC.flowerArch = () => {
    const g = new THREE.Group();
    [-0.4, 0.4].forEach(x => bar(g, 0.04, 0.75, 0.04, x, 0.375, 0));
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 18, Math.PI), M.blue); arch.position.y = 0.75; g.add(arch);
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; flower(g, Math.cos(a) * 0.4, 0.75 + Math.sin(a) * 0.4, 0.03, [13, 3, 0, 11, 1][i % 5], 0.055); }
    [-0.4, 0.4].forEach(x => [0.2, 0.45].forEach((y, k) => flower(g, x, y, 0.04, [5, 13][k], 0.05)));
    return g;
  };
  DEC.mailbox = () => {
    const g = new THREE.Group();
    bar(g, 0.05, 0.6, 0.05, 0, 0.3, 0).material = col(2, 10);
    part(box(0.22, 0.18, 0.32), g, 0, 0.69, 0, col(8, 6));
    part(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 10, 1, false, 0, Math.PI), g, 0, 0.78, 0, col(8, 6)).rotation.set(Math.PI / 2, 0, Math.PI / 2);
    const flag = new THREE.Group(); flag.position.set(0.12, 0.68, -0.06); g.add(flag);
    bar(flag, 0.015, 0.2, 0.015, 0, 0.1, 0); part(box(0.01, 0.07, 0.1), flag, 0, 0.18, 0.05, col(0, 6));
    let up = 0;
    g.userData.tick = (t, dt) => { up = Math.max(0, up - dt * 0.15); flag.rotation.x = -up * Math.PI / 2 * 0.95; };
    g.userData.react = () => { up = 1; sound('chime'); };
    return g;
  };

  const NAMES = {
    waterfall: '폭포', field: '밭', hill: '언덕', cherry: '벚나무', bamboo: '대나무', fruitTree: '과일나무', sunflowers: '해바라기', beehive: '벌통', rock: '바위',
    hammock: '해먹', tent: '텐트', footbath: '족욕탕', clothesline: '빨랫줄', campfire: '모닥불', picnic: '피크닉', treeSwing: '나무 그네', flowerArch: '꽃 아치', mailbox: '우편함',
  };
  Object.entries(MOD).forEach(([ref, fn]) => Mo.register(ref, NAMES[ref], fn, 1));
  Object.entries(DEC).forEach(([ref, fn]) => Mo.registerDeco(ref, NAMES[ref], fn));
})(this);
