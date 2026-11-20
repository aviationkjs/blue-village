// Three.js scene: board, paper houses, 3D models, roads, cars, day/night.
(function (root) {
  const { Models, Roads } = root.BV;
  const { M, DAY, NIGHT } = Models;

  function create(canvas, opts = {}) {
    const SIZE = 24, HALF = SIZE / 2;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.background = DAY.bg.clone();
    scene.fog = new THREE.Fog(DAY.bg.clone(), 45, 80);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.set(17, 16, 20);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.target.set(0, 0.8, 0);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 6; controls.maxDistance = 60;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.autoRotateSpeed = 0.5;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc9d8f5, 0.75); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 0.45); sun.position.set(8, 16, 6); scene.add(sun);

    const groundMat = new THREE.MeshLambertMaterial({ color: DAY.ground });
    const boardMat = new THREE.MeshLambertMaterial({ color: DAY.board });
    const roadMat = new THREE.MeshLambertMaterial({ color: DAY.road });
    const dashMat = new THREE.LineDashedMaterial({ color: DAY.line, dashSize: 0.18, gapSize: 0.14 });
    const gridMat = new THREE.LineBasicMaterial({ color: DAY.line, transparent: true, opacity: 0.18 });

    const ground = new THREE.Mesh(new THREE.CircleGeometry(34, 96), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; scene.add(ground);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), boardMat);
    board.rotation.x = -Math.PI / 2; scene.add(board);
    const rim = [[-HALF, -HALF], [HALF, -HALF], [HALF, HALF], [-HALF, HALF], [-HALF, -HALF]].map(([x, z]) => new THREE.Vector3(x, 0.01, z));
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rim), M.line));
    const gl = [];
    for (let i = 1; i < SIZE; i++) gl.push(-HALF + i, 0.01, -HALF, -HALF + i, 0.01, HALF, -HALF, 0.01, -HALF + i, HALF, 0.01, -HALF + i);
    const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3));
    const grid = new THREE.LineSegments(gridGeo, gridMat); scene.add(grid);

    // painted floor cells (one instanced mesh) and the colour of the round land
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const floorGeo = new THREE.PlaneGeometry(1, 1); floorGeo.rotateX(-Math.PI / 2);
    const floorMesh = new THREE.InstancedMesh(floorGeo, floorMat, SIZE * SIZE);
    // colour buffer sized for every cell up front (three r128 sizes it from count on first use)
    floorMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(SIZE * SIZE * 3), 3);
    floorMesh.frustumCulled = false;
    floorMesh.count = 0; floorMesh.position.y = 0.004; scene.add(floorMesh);
    let floorSig = '', groundCode;
    const groundDay = DAY.ground.clone(), groundNight = NIGHT.ground.clone();
    const m4 = new THREE.Matrix4(), tmpC = new THREE.Color();
    function syncFloor(v) {
      const f = v.floor || {};
      const sig = JSON.stringify(f) + '|' + v.ground;
      if (sig === floorSig) return; floorSig = sig;
      const keys = Object.keys(f);
      keys.forEach((k, i) => {
        const [x, z] = k.split(',').map(Number);
        m4.makeTranslation(x + 0.5 - HALF, 0, z + 0.5 - HALF); floorMesh.setMatrixAt(i, m4);
        floorMesh.setColorAt(i, tmpC.setHex(Models.colorHex(f[k])));
      });
      floorMesh.count = keys.length;
      floorMesh.instanceMatrix.needsUpdate = true;
      if (floorMesh.instanceColor) floorMesh.instanceColor.needsUpdate = true;
      groundCode = v.ground;
      if (groundCode === undefined) { groundDay.copy(DAY.ground); groundNight.copy(NIGHT.ground); }
      else { groundDay.setHex(Models.colorHex(groundCode)); groundNight.copy(groundDay).multiplyScalar(0.42).lerp(NIGHT.ground, 0.35); }
      groundMat.color.copy(groundDay).lerp(groundNight, night);
    }

    // stars for the night
    const sp = [];
    for (let i = 0; i < 400; i++) { const a = Math.random() * 6.283, e = 0.12 + Math.random() * 1.2, R = 70; sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R); }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0, fog: false });
    scene.add(new THREE.Points(starGeo, starMat));

    function buildObject(it) {
      if (it.kind === 'house') return root.BV.House3D.build(it.ref);
      if (it.kind === 'model') return Models.model(it.ref);
      return Models.deco(it.ref);
    }
    const worldX = it => it.x + it.w / 2 - HALF, worldZ = it => it.z + it.d / 2 - HALF;

    // ---- sync village items to scene objects
    const objects = new THREE.Group(); scene.add(objects);
    const live = new Map();
    let roadSig = '';
    const roadGroup = new THREE.Group(); scene.add(roadGroup);
    let roadCells = new Set();

    function sync(v, popId) {
      const seen = new Set();
      v.items.forEach(it => {
        if (it.kind === 'road') return;
        seen.add(it.id);
        const sig = it.kind + '|' + it.ref;
        let rec = live.get(it.id);
        if (!rec || rec.sig !== sig) {
          if (rec) objects.remove(rec.obj);
          const obj = buildObject(it);
          let n = 0;
          obj.traverse(o => {
            o.userData.itemId = it.id;
            const base = o.isMesh && !o.userData.smoke ? Models.paintBaseOf(o.material) : null;
            if (base) { o.userData.paintIdx = n++; o.userData.paintBase = base; o.userData.baseMat = o.material; }
          });
          objects.add(obj);
          rec = { obj, sig, paintSig: '' };
          live.set(it.id, rec);
        }
        const ps = it.paint ? JSON.stringify(it.paint) : '';
        if (ps !== rec.paintSig) { rec.paintSig = ps; applyPaint(rec.obj, it.paint); }
        rec.obj.position.set(worldX(it), 0, worldZ(it));
        rec.obj.rotation.y = it.rot * Math.PI / 2;
        if (it.id === popId) rec.obj.userData.pop = 1;
      });
      live.forEach((rec, id) => { if (!seen.has(id)) { objects.remove(rec.obj); live.delete(id); } });
      syncFloor(v);
      const roads = v.items.filter(i => i.kind === 'road');
      const sig = roads.map(r => r.x + ',' + r.z + (r.paint ? ':' + r.paint[0] : '')).sort().join(';');
      if (sig !== roadSig) { roadSig = sig; buildRoads(v, roads); }
    }

    function applyPaint(obj, paint) {
      obj.traverse(o => {
        if (o.userData.paintIdx === undefined) return;
        const c = paint ? paint[o.userData.paintIdx] : undefined;
        o.material = c !== undefined ? Models.paintMat(c, o.userData.paintBase) : o.userData.baseMat;
      });
    }
    // paintable surfaces of one building: [{ idx, base }]
    function paintParts(id) {
      const rec = live.get(id); if (!rec) return [];
      const out = [];
      rec.obj.traverse(o => { if (o.userData.paintIdx !== undefined) out.push({ idx: o.userData.paintIdx, base: o.userData.paintBase }); });
      return out;
    }

    const tileGeo = new THREE.PlaneGeometry(1, 1); tileGeo.rotateX(-Math.PI / 2);
    function buildRoads(v, roads) {
      roadGroup.clear();
      roadCells = new Set(roads.map(r => r.x + ',' + r.z));
      const occ = Roads.occupancy(v);
      const edges = [], dashes = [];
      roads.forEach(r => {
        const cx = r.x + 0.5 - HALF, cz = r.z + 0.5 - HALF, y = 0.025;
        const t = new THREE.Mesh(tileGeo, r.paint && r.paint[0] !== undefined ? Models.paintMat(r.paint[0], 'fill') : roadMat); t.position.set(cx, 0.012, cz); roadGroup.add(t);
        const m = Roads.mask(v, r.x, r.z, occ);
        const s = 0.5;
        // N, E, S, W sides
        [[1, [-s, -s, s, -s], [0, -s]], [2, [s, -s, s, s], [s, 0]], [4, [-s, s, s, s], [0, s]], [8, [-s, -s, -s, s], [-s, 0]]].forEach(([bit, e, d]) => {
          if (m & bit) dashes.push(cx, y, cz, cx + d[0], y, cz + d[1]);
          else edges.push(cx + e[0], y, cz + e[1], cx + e[2], y, cz + e[3]);
        });
      });
      const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
      roadGroup.add(new THREE.LineSegments(eg, M.line));
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dashes, 3));
      const dl = new THREE.LineSegments(dg, dashMat); dl.computeLineDistances(); roadGroup.add(dl);
    }

    // ---- ghost preview and selection
    let ghost = null, ghostSig = '';
    const okMat = new THREE.MeshBasicMaterial({ color: 0x3f7fe8, transparent: true, opacity: 0.28, depthWrite: false });
    const badMat = new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: 0.32, depthWrite: false });
    const pad = new THREE.Mesh(tileGeo, okMat); pad.visible = false; scene.add(pad);
    function setGhost(spec) {
      if (!spec) { if (ghost) scene.remove(ghost); ghost = null; ghostSig = ''; pad.visible = false; return; }
      const sig = spec.kind + '|' + spec.ref;
      if (sig !== ghostSig) {
        if (ghost) scene.remove(ghost);
        ghostSig = sig;
        ghost = spec.kind === 'road' ? new THREE.Group() : buildObject(spec);
        ghost.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity *= 0.55; o.material.depthWrite = false; } });
        scene.add(ghost);
      }
      ghost.position.set(worldX(spec), 0.02, worldZ(spec));
      ghost.rotation.y = spec.rot * Math.PI / 2;
      pad.visible = true;
      pad.material = spec.ok ? okMat : badMat;
      pad.position.set(worldX(spec), 0.03, worldZ(spec));
      pad.scale.set(spec.w, 1, spec.d);
    }
    const selMat = new THREE.LineBasicMaterial({ color: 0x1b5fd6 });
    const sel = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, z]) => new THREE.Vector3(x, 0, z))), selMat);
    sel.visible = false; scene.add(sel);
    const selPad = new THREE.Mesh(tileGeo, okMat); selPad.visible = false; scene.add(selPad);
    function setSelected(it) {
      sel.visible = selPad.visible = !!it;
      if (!it) return;
      [sel, selPad].forEach(o => { o.position.set(worldX(it), 0.04, worldZ(it)); o.scale.set(it.w + 0.1, 1, it.d + 0.1); });
    }

    // ---- picking
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function aim(cx, cy) { const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
    function pickCell(cx, cy) {
      aim(cx, cy);
      const o = ray.ray.origin, d = ray.ray.direction;
      if (Math.abs(d.y) < 1e-6) return null;
      const t = -o.y / d.y; if (t < 0) return null;
      const x = Math.floor(o.x + d.x * t + HALF), z = Math.floor(o.z + d.z * t + HALF);
      return x >= 0 && z >= 0 && x < SIZE && z < SIZE ? [x, z] : null;
    }
    function pickItemId(cx, cy) {
      aim(cx, cy);
      const hit = ray.intersectObjects(objects.children, true).find(h => h.object.isMesh && !h.object.userData.smoke);
      return hit ? hit.object.userData.itemId : null;
    }

    // the surface under the finger: skips thin outline bars sitting just in front of it
    function pickPart(cx, cy) {
      aim(cx, cy);
      const hits = ray.intersectObjects(objects.children, true).filter(h => h.object.isMesh && !h.object.userData.smoke);
      if (!hits.length) return null;
      const h = hits.find(x => x.object.userData.paintIdx !== undefined && x.distance <= hits[0].distance + 0.35);
      return h ? { itemId: h.object.userData.itemId, idx: h.object.userData.paintIdx, base: h.object.userData.paintBase } : null;
    }

    // the round land outside the board
    function hitsGround(cx, cy) {
      aim(cx, cy);
      const o = ray.ray.origin, d = ray.ray.direction;
      if (Math.abs(d.y) < 1e-6) return false;
      const t = (-0.02 - o.y) / d.y; if (t < 0) return false;
      return Math.hypot(o.x + d.x * t, o.z + d.z * t) < 34;
    }

    // ---- cars for the appreciate mode
    const cars = [];
    function makeCar() {
      const g = new THREE.Group();
      Models.part(Models.box(0.5, 0.16, 0.26), g, 0, 0.14, 0);
      Models.part(Models.box(0.28, 0.13, 0.22), g, -0.03, 0.29, 0, M.soft);
      [[0.15, 0.13], [-0.15, 0.13], [0.15, -0.13], [-0.15, -0.13]].forEach(([x, z]) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 10), M.blue); w.rotation.x = Math.PI / 2; w.position.set(x, 0.065, z); g.add(w);
      });
      const hl = new THREE.Mesh(Models.box(0.02, 0.04, 0.18), M.lamp); hl.position.set(0.26, 0.15, 0); g.add(hl);
      return g;
    }
    const nbrs = (x, z) => [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => roadCells.has(a + ',' + b));
    function startCars() {
      stopCars();
      const cells = [...roadCells].map(k => k.split(',').map(Number));
      const n = Math.min(8, Math.floor(cells.length / 6));
      for (let i = 0; i < n; i++) {
        const from = cells[Math.floor(Math.random() * cells.length)];
        const opts = nbrs(...from); if (!opts.length) continue;
        const g = makeCar(); scene.add(g);
        cars.push({ g, from, to: opts[Math.floor(Math.random() * opts.length)], t: Math.random(), speed: 1.1 + Math.random() * 0.6 });
      }
    }
    function stopCars() { cars.forEach(c => scene.remove(c.g)); cars.length = 0; }
    function moveCars(dt) {
      cars.forEach(c => {
        c.t += dt * c.speed;
        while (c.t >= 1) {
          c.t -= 1;
          const opts = nbrs(...c.to).filter(n => n[0] !== c.from[0] || n[1] !== c.from[1]);
          const all = nbrs(...c.to);
          const pick = opts.length ? opts : all;
          if (!pick.length) { c.t = 0; break; }
          c.from = c.to; c.to = pick[Math.floor(Math.random() * pick.length)];
        }
        const dx = c.to[0] - c.from[0], dz = c.to[1] - c.from[1];
        const lane = 0.18; // drive on the right
        const x = c.from[0] + dx * c.t + 0.5 - HALF - dz * lane, z = c.from[1] + dz * c.t + 0.5 - HALF + dx * lane;
        c.g.position.set(x, 0, z);
        c.g.rotation.y = Math.atan2(-dz, dx);
      });
    }

    // ---- day / night
    let night = 0;
    function setNight(t) {
      night = t;
      const mix = k => DAY[k].clone().lerp(NIGHT[k], t);
      scene.background.copy(mix('bg')); scene.fog.color.copy(mix('bg'));
      M.fill.color.copy(mix('fill'));
      [M.line, M.blue, M.flag, dashMat, gridMat].forEach(m => m.color.copy(mix('line')));
      M.soft.color.copy(mix('soft')); M.win.color.copy(mix('win')); M.lamp.color.copy(mix('lamp'));
      groundMat.color.copy(groundDay).lerp(groundNight, t);
      floorMat.color.setRGB(1, 1, 1).lerp(tmpC.setRGB(0.4, 0.45, 0.62), t); boardMat.color.copy(mix('board')); roadMat.color.copy(mix('road'));
      hemi.intensity = 0.75 - 0.35 * t; sun.intensity = 0.45 - 0.3 * t;
      starMat.opacity = t;
      Models.setPaintNight(t);
    }

    // ---- rings that mark found differences (and hints)
    const markers = new THREE.Group(); scene.add(markers);
    function addMarker(area, color = 0xe5484d, ttl = 0) {
      const r = Math.max(area.w, area.d) * 0.62 + 0.25;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 40), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }));
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 10;
      ring.position.set(area.x + area.w / 2 - HALF, 0.12, area.z + area.d / 2 - HALF);
      ring.userData.born = clock.elapsedTime; ring.userData.ttl = ttl;
      markers.add(ring);
      return ring;
    }
    function clearMarkers() { markers.clear(); }

    // ---- thumbnails for the drawer
    let thumbR = null;
    function thumbnail(kind, ref) {
      if (!thumbR) {
        thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
        thumbR.setSize(112, 112); thumbR.setPixelRatio(1);
      }
      const s = new THREE.Scene();
      s.add(new THREE.HemisphereLight(0xffffff, 0xc9d8f5, 0.8));
      const l = new THREE.DirectionalLight(0xffffff, 0.4); l.position.set(3, 6, 4); s.add(l);
      const obj = kind === 'model' ? Models.model(ref) : kind === 'house' ? root.BV.House3D.build(ref) : Models.deco(ref);
      obj.rotation.y = -0.5; s.add(obj);
      const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      cam.position.set(c.x + r * 1.6, c.y + r * 1.4, c.z + r * 2.6); cam.lookAt(c);
      thumbR.render(s, cam);
      return thumbR.domElement.toDataURL('image/png');
    }

    // insets: pixels covered by the top bar / bottom drawer, so the board centres in the free space
    const inset = { top: 0, bottom: 0 };
    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 0.8 ? 62 : w < 600 ? 52 : 40;
      const shift = Math.round((inset.bottom - inset.top) / 2);
      if (shift) camera.setViewOffset(w, h, 0, shift, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    function setInsets(top, bottom) {
      top = Math.max(0, top || 0); bottom = Math.max(0, bottom || 0);
      if (Math.abs(top - inset.top) < 1 && Math.abs(bottom - inset.bottom) < 1) return;
      inset.top = top; inset.bottom = bottom; resize();
    }
    window.addEventListener('resize', resize); resize();
    // tall phone screens: start further back so the whole board fits across
    if (opts.grid !== false && canvas.clientWidth / canvas.clientHeight < 0.8) {
      camera.position.sub(controls.target).multiplyScalar(1.6).add(controls.target);
      controls.update();
    }

    const clock = new THREE.Clock();
    if (opts.grid === false) grid.visible = false;
    const api = { renderer, scene, camera, controls, sync, setGhost, setSelected, pickCell, pickItemId, pickPart, paintParts, hitsGround, setNight, startCars, stopCars, thumbnail, addMarker, clearMarkers, resize, setInsets, grid, paused: false, get night() { return night; }, onFrame: null };
    (function tick() {
      requestAnimationFrame(tick);
      if (api.paused) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      markers.children.slice().forEach(m => {
        const age = t - m.userData.born;
        m.scale.setScalar(1 + Math.sin(age * 5) * 0.06 + Math.max(0, 0.4 - age) * 1.5);
        if (m.userData.ttl && age > m.userData.ttl) markers.remove(m);
      });
      if (api.onFrame) api.onFrame(dt, t);
      objects.children.forEach(o => {
        if (o.userData.tick) o.userData.tick(t, dt, night);
        if (o.userData.pop > 0) {
          o.userData.pop = Math.max(0, o.userData.pop - dt * 2.2);
          const k = o.userData.pop;
          o.scale.setScalar(1 - Math.sin(k * Math.PI * 2.5) * 0.18 * k);
          o.position.y = Math.max(0, Math.sin((1 - k) * Math.PI) * 0.35 * k);
        }
      });
      if (sel.visible) sel.position.y = 0.04 + Math.abs(Math.sin(t * 3)) * 0.05;
      moveCars(dt);
      controls.update();
      renderer.render(scene, camera);
    })();
    return api;
  }

  root.BV.Scene = { create };
})(this);
