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
      if (groundCode === undefined) { groundDay.copy(SEASON_GROUND[season] ? new THREE.Color(SEASON_GROUND[season]) : DAY.ground); groundNight.copy(NIGHT.ground); }
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
      if (it.kind === 'statue') return Models.statue(it.ref, root.BV.Statues ? root.BV.Statues.get(it.ref) : null);
      return Models.deco(it.ref);
    }
    const worldX = it => it.x + it.w / 2 - HALF, worldZ = it => it.z + it.d / 2 - HALF;

    // ---- sync village items to scene objects
    const objects = new THREE.Group(); scene.add(objects);
    const live = new Map();
    let roadSig = '';
    const roadGroup = new THREE.Group(); scene.add(roadGroup);
    let roadCells = new Set();

    let lastV = null;
    function sync(v, popId) {
      lastV = v;
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
          // leaves of trees and bushes follow the season; roofs (soft surfaces of buildings) get snow in winter
          const leafy = it.kind === 'deco' && ['tree', 'roundTree', 'bush', 'fruitTree', 'treeSwing'].includes(it.ref);
          obj.traverse(o => { if (o.userData.paintBase === 'soft') { if (leafy) o.userData.leaf = true; else if (it.kind === 'house' || it.kind === 'model') o.userData.roofish = true; } });
          rec = { obj, sig, paintSig: '' };
          live.set(it.id, rec);
        }
        const ps = it.paint ? JSON.stringify(it.paint) : '';
        rec.paint = it.paint;
        if (ps !== rec.paintSig || rec.season !== season) { rec.paintSig = ps; rec.season = season; applyPaint(rec.obj, it.paint); }
        rec.obj.position.set(worldX(it), 0, worldZ(it));
        rec.obj.rotation.y = it.rot * Math.PI / 2;
        if (it.id === popId) rec.obj.userData.pop = 1;
      });
      live.forEach((rec, id) => { if (!seen.has(id)) { objects.remove(rec.obj); live.delete(id); } });
      syncFloor(v);
      const roads = v.items.filter(i => i.kind === 'road');
      const sig = roads.map(r => r.x + ',' + r.z + Roads.tileRef(r) + (r.paint ? ':' + r.paint[0] : '')).sort().join(';');
      if (sig !== roadSig) { roadSig = sig; buildRoads(v, roads); }
    }

    function applyPaint(obj, paint) {
      obj.traverse(o => {
        if (o.userData.paintIdx === undefined) return;
        const c = paint ? paint[o.userData.paintIdx] : undefined;
        o.material = c !== undefined ? Models.paintMat(c, o.userData.paintBase) : (seasonMat(o) || o.userData.baseMat);
      });
    }
    // world-space centre of one kind of surface on a building (for number tags)
    function partCenter(id, base) {
      const rec = live.get(id); const box = new THREE.Box3();
      if (!rec) return new THREE.Vector3();
      rec.obj.updateMatrixWorld(true);
      rec.obj.traverse(o => { if (o.userData.paintBase === base) box.expandByObject(o); });
      return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    }
    // paintable surfaces of one building: [{ idx, base }]
    function paintParts(id) {
      const rec = live.get(id); if (!rec) return [];
      const out = [];
      rec.obj.traverse(o => { if (o.userData.paintIdx !== undefined) out.push({ idx: o.userData.paintIdx, base: o.userData.paintBase }); });
      return out;
    }

    const tileGeo = new THREE.PlaneGeometry(1, 1); tileGeo.rotateX(-Math.PI / 2);
    // tiles: kind 'road' with ref 'road' | 'water' (creek) | 'rail'
    let railCells = new Set(), waterCells = new Set();
    const railBedMat = new THREE.MeshLambertMaterial({ color: 0xdfe5f1 });
    const waveMat = new THREE.LineBasicMaterial({ color: 0x5b93ec, transparent: true, opacity: 0.85 });
    let waves = null;
    const SIDES = [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]; // bit, dx, dz (N E S W)
    function lineSegs(arr, mat) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return new THREE.LineSegments(g, mat); }
    function buildRoads(v, roads) {
      roadGroup.clear();
      const by = { road: [], water: [], rail: [] };
      roads.forEach(r => (by[Roads.tileRef(r)] || by.road).push(r));
      const keyset = list => new Set(list.map(r => r.x + ',' + r.z));
      roadCells = keyset(by.road); waterCells = keyset(by.water); railCells = keyset(by.rail);
      const occ = Roads.occupancy(v);
      const s = 0.5, y = 0.025;
      const tile = (r, mat, yy = 0.012) => { const t = new THREE.Mesh(tileGeo, r.paint && r.paint[0] !== undefined ? Models.paintMat(r.paint[0], 'fill') : mat); t.position.set(r.x + 0.5 - HALF, yy, r.z + 0.5 - HALF); roadGroup.add(t); };
      const outline = (r, m, edges) => {
        const cx = r.x + 0.5 - HALF, cz = r.z + 0.5 - HALF;
        [[1, [-s, -s, s, -s]], [2, [s, -s, s, s]], [4, [-s, s, s, s]], [8, [-s, -s, -s, s]]].forEach(([bit, e]) => { if (!(m & bit)) edges.push(cx + e[0], y, cz + e[1], cx + e[2], y, cz + e[3]); });
      };
      // roads: dashed centre lines toward each joined side
      const edges = [], dashes = [];
      by.road.forEach(r => {
        tile(r, roadMat);
        const m = Roads.mask(v, r.x, r.z, occ, 'road'), cx = r.x + 0.5 - HALF, cz = r.z + 0.5 - HALF;
        SIDES.forEach(([bit, dx, dz]) => { if (m & bit) dashes.push(cx, y, cz, cx + dx * s, y, cz + dz * s); });
        outline(r, m, edges);
      });
      // creek: water tiles with banks and a few ripples
      const wave = [];
      by.water.forEach(r => {
        tile(r, M.water, 0.014);
        outline(r, Roads.mask(v, r.x, r.z, occ, 'water'), edges);
        const cx = r.x + 0.5 - HALF, cz = r.z + 0.5 - HALF, k = (r.x * 7 + r.z * 13) % 5;
        [[-0.2 + k * 0.05, -0.15], [0.15 - k * 0.03, 0.2]].forEach(([ox, oz]) => wave.push(cx + ox - 0.12, 0.03, cz + oz, cx + ox + 0.12, 0.03, cz + oz));
      });
      // railway: bed, sleepers and two rails toward each joined side
      by.rail.forEach(r => {
        tile(r, railBedMat, 0.013);
        const m = Roads.mask(v, r.x, r.z, occ, 'rail'), cx = r.x + 0.5 - HALF, cz = r.z + 0.5 - HALF;
        let sides = SIDES.filter(([bit]) => m & bit);
        if (!sides.length) sides = [SIDES[1], SIDES[3]];
        sides.forEach(([, dx, dz]) => {
          [0.18, 0.4].forEach(d => { const sl = Models.bar(roadGroup, dz ? 0.62 : 0.08, 0.03, dx ? 0.62 : 0.08, cx + dx * d, 0.03, cz + dz * d); sl.material = sleeperMat; });
          [-0.17, 0.17].forEach(o => Models.bar(roadGroup, dx ? 0.5 : 0.035, 0.04, dz ? 0.5 : 0.035, cx + dx * 0.25 + (dz ? o : 0), 0.06, cz + dz * 0.25 + (dx ? o : 0)));
        });
        outline(r, m, edges);
      });
      roadGroup.add(lineSegs(edges, M.line));
      const dl = lineSegs(dashes, dashMat); dl.computeLineDistances(); roadGroup.add(dl);
      waves = wave.length ? lineSegs(wave, waveMat) : null;
      if (waves) roadGroup.add(waves);
    }
    const sleeperMat = new THREE.MeshLambertMaterial({ color: 0xc9a27a });

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


    // ---- seasons: leaves and snowy roofs follow the season unless painted; the round land tints too
    let season = 'summer';
    const SEASON_GROUND = { spring: 0xeef6e4, summer: null, autumn: 0xf6ead6, winter: 0xf4f8ff };
    const SEASON_BOARD = { spring: null, summer: null, autumn: 0xfcf6ec, winter: 0xffffff };
    function seasonMat(o) {
      if (o.userData.leaf) {
        if (season === 'spring') return M.blossom;
        if (season === 'autumn') return o.userData.paintIdx % 2 ? M.autumn1 : M.autumn2;
        if (season === 'winter') return M.snow;
      } else if (season === 'winter' && o.userData.paintBase === 'soft' && o.userData.roofish) return M.snow;
      return null;
    }
    function setSeason(s) {
      season = s;
      live.forEach(rec => applyPaint(rec.obj, rec.paint));
      floorSig = ''; if (lastV) syncFloor(lastV);
      const b = SEASON_BOARD[s]; boardDay.copy(b ? new THREE.Color(b) : DAY.board);
      setNight(night);
    }
    const boardDay = DAY.board.clone();

    // ---- weather: rain streaks, snowflakes, a rainbow that stays behind the village from where you look
    let weather = 'clear';
    const weatherGroup = new THREE.Group(); scene.add(weatherGroup);
    const RAIN_N = 1400, SNOW_N = 900, SPAN = 30, TOPY = 16;
    const rainPos = new Float32Array(RAIN_N * 6);
    const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.LineBasicMaterial({ color: 0x7fa6e8, transparent: true, opacity: 0.55, fog: false });
    const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.visible = false; weatherGroup.add(rain);
    const rainV = new Float32Array(RAIN_N);
    for (let i = 0; i < RAIN_N; i++) { const x = (Math.random() - 0.5) * SPAN, y = Math.random() * TOPY, z = (Math.random() - 0.5) * SPAN; rainPos.set([x, y, z, x - 0.05, y + 0.55, z], i * 6); rainV[i] = 14 + Math.random() * 6; }
    const flake = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    const snowPos = new Float32Array(SNOW_N * 3), snowPh = new Float32Array(SNOW_N);
    for (let i = 0; i < SNOW_N; i++) { snowPos.set([(Math.random() - 0.5) * SPAN, Math.random() * TOPY, (Math.random() - 0.5) * SPAN], i * 3); snowPh[i] = Math.random() * 6.28; }
    const snowGeo = new THREE.BufferGeometry(); snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({ size: 0.28, map: flake, transparent: true, depthWrite: false, color: 0xffffff, fog: false });
    const snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; snow.visible = false; weatherGroup.add(snow);
    const rainbow = new THREE.Group(); rainbow.visible = false; scene.add(rainbow);
    [0xff6b6b, 0xffa94d, 0xffd43b, 0x69db7c, 0x4dabf7, 0x5c7cfa, 0xb197fc].forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 0.9, 0.45, 8, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
      rainbow.add(m);
    });
    function setWeather(w) {
      weather = w;
      rain.visible = w === 'rain'; snow.visible = w === 'snow'; rainbow.visible = w === 'rainbow';
      setNight(night);
    }
    function moveWeather(dt, t) {
      if (rain.visible) {
        for (let i = 0; i < RAIN_N; i++) {
          const o = i * 6; let y = rainPos[o + 1] - rainV[i] * dt;
          if (y < 0) { y += TOPY; rainPos[o] = rainPos[o + 3] = (Math.random() - 0.5) * SPAN; rainPos[o + 2] = rainPos[o + 5] = (Math.random() - 0.5) * SPAN; rainPos[o + 3] -= 0.05; }
          rainPos[o + 1] = y; rainPos[o + 4] = y + 0.55;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      if (snow.visible) {
        for (let i = 0; i < SNOW_N; i++) {
          const o = i * 3; let y = snowPos[o + 1] - dt * 1.1;
          if (y < 0) { y += TOPY; snowPos[o] = (Math.random() - 0.5) * SPAN; snowPos[o + 2] = (Math.random() - 0.5) * SPAN; }
          snowPos[o + 1] = y; snowPos[o] += Math.sin(t * 0.8 + snowPh[i]) * dt * 0.35;
        }
        snowGeo.attributes.position.needsUpdate = true;
      }
      if (rainbow.visible) {
        // stand on the far side of the village from the camera, facing it
        const dx = camera.position.x - controls.target.x, dz = camera.position.z - controls.target.z, l = Math.hypot(dx, dz) || 1;
        rainbow.position.set(controls.target.x - dx / l * 22, -4, controls.target.z - dz / l * 22);
        rainbow.rotation.y = Math.atan2(dx, dz);
      }
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

    // ---- a little train on the rail tiles (runs whenever there is enough track)
    const train = { g: null, wagons: [], from: null, to: null, t: 0, trail: [], smoke: null };
    function makeTrainCar(engine, hue) {
      const g = new THREE.Group();
      const body = Models.paintMat(Models.code(hue, 5), 'fill');
      Models.part(Models.box(0.5, 0.2, 0.3), g, 0, 0.2, 0, body);
      if (engine) {
        Models.part(Models.box(0.2, 0.18, 0.3), g, -0.14, 0.39, 0, M.soft);
        Models.part(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), g, 0.15, 0.38, 0);
        const lamp = new THREE.Mesh(Models.box(0.02, 0.06, 0.08), M.lamp); lamp.position.set(0.26, 0.24, 0); g.add(lamp);
      } else {
        Models.part(Models.box(0.44, 0.03, 0.32), g, 0, 0.33, 0, M.soft);
        [-0.12, 0.12].forEach(x => { const w = new THREE.Mesh(Models.box(0.12, 0.08, 0.02), M.win); w.position.set(x, 0.24, 0.155); g.add(w); });
      }
      [-0.16, 0.16].forEach(x => [-0.12, 0.12].forEach(z => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 10), M.blue); w.rotation.x = Math.PI / 2; w.position.set(x, 0.07, z); g.add(w); }));
      return g;
    }
    const railNbrs = (x, z) => [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dz]) => [x + dx, z + dz]).filter(([a, b]) => railCells.has(a + ',' + b));
    function clearTrain() { if (train.g) { scene.remove(train.g); train.wagons.forEach(w => scene.remove(w)); } train.g = null; train.wagons = []; train.trail = []; }
    function moveTrain(dt, t) {
      const ok = c => c && railCells.has(c[0] + ',' + c[1]);
      if (railCells.size < 4) { clearTrain(); return; }
      if (!train.g || !ok(train.from) || !ok(train.to)) {
        clearTrain();
        const cells = [...railCells].map(k => k.split(',').map(Number)).filter(c => railNbrs(...c).length);
        if (!cells.length) return;
        train.from = cells[Math.floor(Math.random() * cells.length)];
        train.to = railNbrs(...train.from)[0]; train.t = 0;
        train.g = makeTrainCar(true, 0); scene.add(train.g);
        train.wagons = [8, 3].map(h => { const w = makeTrainCar(false, h); scene.add(w); return w; });
        train.smoke = Models.addSmoke(train.g, 0.15, 0.5, 0);
        train.g.traverse(o => { if (o.userData.smoke) o.scale.multiplyScalar(0.4); });
      }
      train.t += dt * 1.1;
      while (train.t >= 1) {
        train.t -= 1;
        const nb = railNbrs(...train.to);
        const ahead = nb.filter(n => n[0] !== train.from[0] || n[1] !== train.from[1]);
        // keep going straight when the track allows it
        const dx = train.to[0] - train.from[0], dz = train.to[1] - train.from[1];
        const straight = ahead.find(n => n[0] - train.to[0] === dx && n[1] - train.to[1] === dz);
        const next = straight || ahead[Math.floor(Math.random() * ahead.length)] || train.from; // dead end: turn back
        train.from = train.to; train.to = next;
      }
      const x = train.from[0] + (train.to[0] - train.from[0]) * train.t + 0.5 - HALF, z = train.from[1] + (train.to[1] - train.from[1]) * train.t + 0.5 - HALF;
      const last = train.trail[train.trail.length - 1];
      if (!last || Math.hypot(last.x - x, last.z - z) > 0.03) { train.trail.push({ x, z }); if (train.trail.length > 200) train.trail.shift(); }
      const place = (obj, back) => {
        let d = 0, i = train.trail.length - 1, p = { x, z }, q = p;
        while (i > 0 && d < back) { q = train.trail[i - 1]; d += Math.hypot(p.x - q.x, p.z - q.z); p = q; i--; }
        const a = train.trail[Math.max(0, i)], b = train.trail[Math.min(train.trail.length - 1, i + 3)] || a;
        obj.position.set(p.x, 0.04, p.z);
        if (a && b && (a.x !== b.x || a.z !== b.z)) obj.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
      };
      train.g.position.set(x, 0.04, z);
      train.g.rotation.y = Math.atan2(-(train.to[1] - train.from[1]), train.to[0] - train.from[0]);
      train.wagons.forEach((w, k) => place(w, 0.6 * (k + 1)));
      if (train.smoke) train.smoke(t, dt, night);
    }

    // ---- day / night
    let night = 0;
    function setNight(t) {
      night = t;
      const mix = k => DAY[k].clone().lerp(NIGHT[k], t);
      scene.background.copy(mix('bg'));
      if (typeof weather !== 'undefined' && (weather === 'rain' || weather === 'snow')) scene.background.lerp(new THREE.Color(weather === 'rain' ? 0xb9c6dc : 0xdfe7f3), 0.45 * (1 - t));
      scene.fog.color.copy(scene.background);
      M.fill.color.copy(mix('fill'));
      [M.line, M.blue, M.flag, dashMat, gridMat].forEach(m => m.color.copy(mix('line')));
      M.soft.color.copy(mix('soft')); M.win.color.copy(mix('win')); M.lamp.color.copy(mix('lamp'));
      groundMat.color.copy(groundDay).lerp(groundNight, t);
      floorMat.color.setRGB(1, 1, 1).lerp(tmpC.setRGB(0.4, 0.45, 0.62), t); roadMat.color.copy(mix('road'));
      boardMat.color.copy(typeof boardDay !== 'undefined' ? boardDay.clone().lerp(NIGHT.board, t) : mix('board'));
      M.water.color.setHex(0xbcd7ff).lerp(new THREE.Color(0x2a4580), t);
      railBedMat.color.setHex(0xdfe5f1).lerp(new THREE.Color(0x26375e), t);
      sleeperMat.color.setHex(0xc9a27a).multiplyScalar(1 - 0.55 * t);
      waveMat.opacity = 0.85 - 0.5 * t;
      [M.blossom, M.autumn1, M.autumn2, M.snow].forEach((m, i) => m.color.setHex([0xffc9de, 0xffa94d, 0xff8787, 0xffffff][i]).multiplyScalar(1 - 0.5 * t));
      if (typeof rainMat !== 'undefined') { rainMat.color.setHex(t > 0.5 ? 0x8fb6ff : 0x7fa6e8); snowMat.opacity = 1 - 0.3 * t; rainbow.children.forEach(m => { m.material.opacity = 0.55 * (1 - t); }); }
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

    // ---- still picture of the current view at any size (wallpaper, village list thumbnails)
    function capture(w, h, o = {}) {
      // o.elev (degrees above the ground): place the camera at that angle, keep the direction, fit the board
      const saved = o.elev !== undefined ? { p: camera.position.clone(), up: camera.up.clone() } : null;
      if (saved) {
        const tg = controls.target, dx = camera.position.x - tg.x, dz = camera.position.z - tg.z, l = Math.hypot(dx, dz) || 1;
        const el = Math.max(4, Math.min(89.5, o.elev)) * Math.PI / 180;
        const vf = (o.fov || (w / h < 0.8 ? 62 : 45)) * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * w / h);
        const R = HALF * 1.2, dist = R / Math.sin(Math.min(vf, hf) / 2) * (o.elev >= 80 ? 0.78 : o.elev < 10 ? 0.6 : 0.9);
        camera.position.set(tg.x + dx / l * Math.cos(el) * dist, tg.y + Math.sin(el) * dist, tg.z + dz / l * Math.cos(el) * dist);
        camera.lookAt(tg);
      }
      const prevNight = night, hidden = [grid, sel, selPad, pad, markers, ghost].filter(x => x && x.visible);
      hidden.forEach(x => { x.visible = false; });
      if (o.night !== undefined) setNight(o.night);
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.fov = o.fov || (w / h < 0.8 ? 62 : 45); camera.clearViewOffset(); camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL(o.type || 'image/png', o.quality || 0.92);
      hidden.forEach(x => { x.visible = true; });
      if (o.night !== undefined) setNight(prevNight);
      if (saved) { camera.position.copy(saved.p); camera.lookAt(controls.target); }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      resize();
      renderer.render(scene, camera);
      return url;
    }

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
      // size the shot by the solid parts only: smoke, light beams and water drops would shrink the picture
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3();
      obj.traverse(o => { if ((o.isMesh || o.isLineSegments) && !o.userData.smoke) box.expandByObject(o); });
      const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
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
    // tap in the appreciate view: hop, then the building's own reaction (or a soft chime)
    function react(id) {
      const rec = live.get(id); if (!rec) return false;
      rec.obj.userData.pop = 1;
      if (rec.obj.userData.react) rec.obj.userData.react();
      else if (root.BV.Sound && root.BV.Sound.chime) root.BV.Sound.chime();
      return true;
    }
    const tiles = ref => (ref === 'rail' ? railCells : ref === 'water' ? waterCells : roadCells);
    const api = { HALF, tiles, react, village: () => lastV, objectOf: id => (live.get(id) || {}).obj, life: null, renderer, scene, camera, controls, sync, setGhost, setSelected, pickCell, pickItemId, pickPart, paintParts, partCenter, hitsGround, capture, setSeason, setWeather, setNight, startCars, stopCars, thumbnail, addMarker, clearMarkers, resize, setInsets, grid, paused: false, get night() { return night; }, onFrame: null };
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
      moveCars(dt); moveWeather(dt, t); moveTrain(dt, t);
      if (waves) waves.position.x = Math.sin(t * 0.8) * 0.07;
      if (api.life) api.life.update(dt, t, night);
      controls.update();
      renderer.render(scene, camera);
    })();
    return api;
  }

  root.BV.Scene = { create };
})(this);
