// Living things in the village: residents strolling on roads, cats near houses, ducks on water,
// butterflies around flowers, birds overhead by day and fireflies at night. Browser only.
// create(sceneApi) → { update(dt, t, night), tap(cell) }; the scene calls update every frame.
(function (root) {
  const Mo = root.BV.Models;
  const { M, part, box, bar, paintMat, code } = Mo;
  const col = (hue, tone, base = 'fill') => paintMat(code(hue, tone), base);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const FLOWERY = { model: ['flowerShop', 'field', 'hill', 'market'], deco: ['flowers', 'sunflowers', 'flowerArch', 'cherry', 'fruitTree', 'beehive'] };
  const WATERY = ['pond', 'fountain', 'waterfall'];
  const GREEN = ['tree', 'roundTree', 'bush', 'cherry', 'bamboo', 'fruitTree', 'treeSwing'];

  function person(i) {
    const g = new THREE.Group();
    part(new THREE.CylinderGeometry(0.05, 0.08, 0.2, 8), g, 0, 0.14, 0, col([0, 8, 5, 11, 1, 13][i % 6], 4));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), col(2, 1)); head.position.y = 0.3; g.add(head);
    if (i % 3 === 0) { const hat = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.07, 8), col(3, 5)); hat.position.y = 0.37; g.add(hat); }
    return g;
  }
  function cat(i) {
    const g = new THREE.Group(), c = col([1, 15, 15, 2][i % 4], [5, 9, 13, 2][i % 4]);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), c); body.scale.set(1.5, 0.9, 0.9); body.position.y = 0.1; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), c); head.position.set(0.14, 0.17, 0); g.add(head);
    [-0.035, 0.035].forEach(z => { const e = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 4), c); e.position.set(0.15, 0.24, z); g.add(e); });
    const tail = new THREE.Group(); tail.position.set(-0.14, 0.12, 0); g.add(tail);
    const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.16, 6), c); tm.position.y = 0.08; tail.add(tm);
    g.userData.tail = tail;
    return g;
  }
  function duck() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.fill); b.scale.set(1.4, 0.8, 1); b.position.y = 0.06; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), col(5, 7)); h.position.set(0.08, 0.13, 0); g.add(h);
    const k = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05, 6), col(2, 5)); k.rotation.z = -Math.PI / 2; k.position.set(0.13, 0.12, 0); g.add(k);
    return g;
  }
  function butterfly(i) {
    const g = new THREE.Group(), m = col([13, 3, 8, 1, 11][i % 5], 3, 'soft');
    const w = [-1, 1].map(s => { const p = new THREE.Group(); g.add(p); const plane = new THREE.Mesh(new THREE.CircleGeometry(0.05, 6), m); plane.position.x = s * 0.045; p.add(plane); return p; });
    g.userData.wings = w;
    return g;
  }
  function bird() {
    const g = new THREE.Group();
    const w = [-1, 1].map(s => { const p = new THREE.Group(); g.add(p); const b = bar(p, 0.3, 0.02, 0.06, s * 0.15, 0, 0); return p; });
    g.userData.wings = w;
    return g;
  }

  function create(S) {
    const H = S.HALF;
    const group = new THREE.Group(); S.scene.add(group);
    const world = (x, z) => [x + 0.5 - H, z + 0.5 - H];
    const centre = it => [it.x + it.w / 2 - H, it.z + it.d / 2 - H];
    let sig = '';
    let people = [], cats = [], ducks = [], flies = [], birds = [], spark = null;

    // fireflies: one point cloud, shown at night
    const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,240,150,1)'); g.addColorStop(0.4, 'rgba(255,230,120,0.6)'); g.addColorStop(1, 'rgba(255,220,100,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    const FF = 60, ffPos = new Float32Array(FF * 3), ffHome = [], ffPh = new Float32Array(FF);
    const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const ffMat = new THREE.PointsMaterial({ size: 0.22, map: glowTex, transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending });
    const fireflies = new THREE.Points(ffGeo, ffMat); fireflies.frustumCulled = false; group.add(fireflies);

    function clearAll() { [...people, ...cats, ...ducks, ...flies, ...birds].forEach(o => group.remove(o.g)); people = []; cats = []; ducks = []; flies = []; birds = []; }

    function rebuild(v) {
      clearAll();
      const roads = [...S.tiles('road')].map(k => k.split(',').map(Number));
      const houses = v.items.filter(i => i.kind === 'house' || (i.kind === 'model' && !WATERY.includes(i.ref)));
      const waterSpots = [...S.tiles('water')].map(k => world(...k.split(',').map(Number)))
        .concat(v.items.filter(i => i.kind === 'model' && (i.ref === 'pond')).map(centre));
      const flowerSpots = v.items.filter(i => (FLOWERY[i.kind] || []).includes(i.ref)).map(centre);
      const greenSpots = v.items.filter(i => i.kind === 'deco' && GREEN.includes(i.ref)).map(centre).concat(waterSpots);
      // residents
      const nP = Math.min(10, Math.floor(roads.length / 6));
      for (let i = 0; i < nP; i++) {
        const from = pick(roads), nb = roadNbrs(from); if (!nb.length) continue;
        const g = person(i); group.add(g);
        people.push({ g, from, to: pick(nb), t: Math.random(), speed: rnd(0.35, 0.5), ph: Math.random() * 6 });
      }
      // cats near houses
      const nC = Math.min(5, Math.ceil(houses.length / 5));
      for (let i = 0; i < nC; i++) {
        const h = pick(houses); if (!h) break;
        const [hx, hz] = centre(h), g = cat(i); group.add(g);
        const home = [hx + (h.w / 2 + 0.3) * (Math.random() < 0.5 ? -1 : 1), hz + rnd(-0.4, 0.4)];
        g.position.set(home[0], 0, home[1]);
        cats.push({ g, home, target: home.slice(), wait: rnd(2, 8), ph: Math.random() * 6 });
      }
      // ducks
      const nD = Math.min(8, waterSpots.length);
      for (let i = 0; i < nD; i++) { const g = duck(); group.add(g); ducks.push({ g, c: waterSpots[i % waterSpots.length], r: rnd(0.12, 0.3), a: Math.random() * 6, sp: rnd(0.3, 0.6) * (i % 2 ? 1 : -1) }); }
      // butterflies
      const nB = Math.min(10, flowerSpots.length * 2);
      for (let i = 0; i < nB; i++) { const g = butterfly(i); group.add(g); flies.push({ g, c: flowerSpots[i % flowerSpots.length], ph: Math.random() * 6, sp: rnd(0.6, 1.1) }); }
      // a small flock (whenever there is a village)
      if (v.items.length > 3) for (let i = 0; i < 5; i++) { const g = bird(); group.add(g); birds.push({ g, k: i }); }
      // fireflies home around greenery and water
      ffHome.length = 0;
      for (let i = 0; i < FF; i++) {
        const s = greenSpots.length ? pick(greenSpots) : [rnd(-H, H), rnd(-H, H)];
        ffHome.push([s[0] + rnd(-0.8, 0.8), rnd(0.3, 1.4), s[1] + rnd(-0.8, 0.8)]); ffPh[i] = Math.random() * 6.28;
      }
    }
    const roadNbrs = ([x, z]) => [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => S.tiles('road').has(a + ',' + b));

    function update(dt, t, night) {
      const v = S.village(); if (!v) return;
      const s = [S.tiles('road').size, S.tiles('water').size, v.items.length, v.items.filter(i => i.kind === 'house').length].join('|');
      if (s !== sig) { sig = s; rebuild(v); }
      const day = 1 - night;
      people.forEach((p, i) => {
        p.g.visible = i < Math.ceil(people.length * (1 - night * 0.7));
        p.t += dt * p.speed;
        while (p.t >= 1) {
          p.t -= 1;
          const nb = roadNbrs(p.to), ahead = nb.filter(n => n[0] !== p.from[0] || n[1] !== p.from[1]);
          const next = ahead.length ? pick(ahead) : (nb[0] || p.from);
          p.from = p.to; p.to = next;
          if (!S.tiles('road').has(p.to.join())) { p.to = p.from; }
        }
        const dx = p.to[0] - p.from[0], dz = p.to[1] - p.from[1];
        const [fx, fz] = world(...p.from);
        p.g.position.set(fx + dx * p.t + dz * 0.3, Math.abs(Math.sin(t * 7 + p.ph)) * 0.03, fz + dz * p.t - dx * 0.3);
        if (dx || dz) p.g.rotation.y = Math.atan2(-dz, dx);
      });
      cats.forEach(c => {
        const pos = c.g.position, dx = c.target[0] - pos.x, dz = c.target[1] - pos.z, d = Math.hypot(dx, dz);
        if (d > 0.03) { pos.x += dx / d * dt * 0.35; pos.z += dz / d * dt * 0.35; c.g.rotation.y = Math.atan2(-dz, dx); c.g.position.y = Math.abs(Math.sin(t * 9)) * 0.015; }
        else if ((c.wait -= dt) < 0) { c.wait = rnd(4, 12); c.target = [c.home[0] + rnd(-0.7, 0.7), c.home[1] + rnd(-0.7, 0.7)]; }
        c.g.userData.tail.rotation.z = 0.6 + Math.sin(t * 2.2 + c.ph) * 0.4;
      });
      ducks.forEach(d => { d.a += dt * d.sp; d.g.position.set(d.c[0] + Math.cos(d.a) * d.r, 0.02 + Math.sin(t * 3 + d.a) * 0.008, d.c[1] + Math.sin(d.a) * d.r); d.g.rotation.y = -d.a - Math.sign(d.sp) * Math.PI / 2; });
      flies.forEach(f => {
        f.g.visible = night < 0.55;
        const a = t * f.sp + f.ph;
        f.g.position.set(f.c[0] + Math.sin(a) * 0.6, 0.6 + Math.sin(a * 2.3) * 0.25 + (f.up || 0), f.c[1] + Math.sin(a * 0.7) * Math.cos(a) * 0.6);
        f.g.rotation.y = a;
        const flap = Math.sin(t * 18 + f.ph) * 0.9; f.g.userData.wings[0].rotation.y = flap; f.g.userData.wings[1].rotation.y = -flap;
        if (f.up) f.up = Math.max(0, f.up - dt * 0.6);
      });
      birds.forEach(b => {
        b.g.visible = night < 0.5;
        const a = t * 0.12 + b.k * 0.07, r = 11 + (b.k % 2) * 0.6;
        b.g.position.set(Math.cos(a) * r - (b.k % 3) * 0.4, 8 + Math.sin(t * 0.5 + b.k) * 0.3 + b.k * 0.15, Math.sin(a) * r);
        b.g.rotation.y = -a;
        const flap = Math.sin(t * 6 + b.k) * 0.5; b.g.userData.wings[0].rotation.x = flap; b.g.userData.wings[1].rotation.x = -flap;
      });
      ffMat.opacity = Math.max(0, night - 0.3) * 1.4;
      if (ffMat.opacity > 0) {
        for (let i = 0; i < FF; i++) {
          const h = ffHome[i]; if (!h) continue;
          ffPos[i * 3] = h[0] + Math.sin(t * 0.5 + ffPh[i]) * 0.4;
          ffPos[i * 3 + 1] = h[1] + Math.sin(t * 0.9 + ffPh[i] * 2) * 0.25 * (0.5 + 0.5 * Math.sin(t * 2.5 + ffPh[i]));
          ffPos[i * 3 + 2] = h[2] + Math.cos(t * 0.4 + ffPh[i]) * 0.4;
        }
        ffGeo.attributes.position.needsUpdate = true;
      }
      fireflies.visible = ffMat.opacity > 0;
      group.visible = true;
      void day;
    }
    // a tap on open ground in the appreciate view: nearby butterflies flutter up, a bird sings
    function tap(cell) {
      if (cell) { const [wx, wz] = world(...cell); flies.forEach(f => { if (Math.hypot(f.c[0] - wx, f.c[1] - wz) < 3) f.up = 0.8; }); }
      const Snd = root.BV.Sound; if (Snd && Snd.chirp) Snd.chirp();
    }
    return { update, tap };
  }

  root.BV.Life = { create };
})(this);
