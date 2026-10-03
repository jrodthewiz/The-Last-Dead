/* NEON BAY v2 — world meshes. Everything the world generator decided, turned into geometry and shaders. */
"use strict";
(function () {
  const NB = window.NB, T = NB.T;
  const { clamp, lerp, M4 } = NB;

  // shared uniforms (the game drives them)
  NB.U = NB.U || {
    uTime: { value: 0 }, uNight: { value: 0 }, uDusk: { value: 0 }, uSunDir: { value: new T.Vector3(0, 1, 0) },
    uSpot: { value: new T.Vector4(0, 0, -9999, 14) }, uSpotI: { value: 0 },
    uHead: { value: new T.Vector4(0, 0, 0, 1) }, uHeadI: { value: 0 },
    uCops: { value: [0, 1, 2, 3].map(() => new T.Vector4(0, 0, 0, 0)) },
    uLM: { value: null }, uLMRect: { value: new T.Vector4(0, 0, 1, 1) },
    uHoles: { value: [0, 1, 2, 3].map(() => new T.Vector4(0, 0, 0, 0)) }, uHoleDir: { value: [0, 1, 2, 3].map(() => new T.Vector2(1, 0)) },
  };
  const U = NB.U;
  const GROUND_GLSL = `
    uniform sampler2D uLM; uniform vec4 uLMRect; uniform float uNight, uHeadI, uSpotI; uniform vec4 uHead, uSpot; uniform vec4 uCops[4];
    uniform vec4 uHoles[4]; uniform vec2 uHoleDir[4];
    bool inHole(vec2 p) { for (int i = 0; i < 4; i++) { vec4 h = uHoles[i]; if (h.z <= 0.0) continue; vec2 d = p - h.xy, u = uHoleDir[i];
      if (abs(dot(d, u)) < h.z && abs(dot(d, vec2(-u.y, u.x))) < h.w) return true; } return false; }
    vec3 nightLight(vec2 p, vec3 alb, float wet) {
      vec3 lm = texture2D(uLM, (p - uLMRect.xy) / uLMRect.zw).rgb;
      float spot = (1.0 - smoothstep(uSpot.w*0.55, uSpot.w, length(p - uSpot.xz))) * uSpotI;
      vec2 hv = p - uHead.xy; float hf = dot(hv, uHead.zw), hl = abs(dot(hv, vec2(-uHead.w, uHead.z)));
      float hw0 = max(hf, 0.0)*0.42 + 1.2, hw1 = max(hf, 0.0)*0.18;
      float head = step(0.0, hf) * (1.0 - smoothstep(hw1, hw0, hl)) * (1.0 - smoothstep(5.0, 42.0, hf)) * smoothstep(0.0, 2.5, hf) * uHeadI;
      vec3 copL = vec3(0.0);
      for (int i = 0; i < 4; i++) { vec4 cp = uCops[i]; vec2 dv = p - cp.xy; copL += mix(vec3(1.0,0.05,0.08), vec3(0.08,0.25,1.0), cp.z) * exp(-dot(dv, dv) / 55.0) * cp.w; }
      return alb * (lm * uNight * 3.2 + vec3(0.75,0.85,1.0) * spot * 1.3 + vec3(0.9,0.95,1.0) * head * 2.0) + copL * (0.06 + 0.5 * uNight);
    }`;
  const withWorldPos = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    Object.assign(sh.uniforms, U);
  };
  NB.withWorldPos = withWorldPos; NB.GROUND_GLSL = GROUND_GLSL;

  NB.buildWorldMeshes = function (W, scene, ctx) {
    const { R, RI, pick } = ctx;
    const tmpM = new T.Matrix4(), tmpV = new T.Vector3(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(), tmpC = new T.Color(), Q0 = new T.Quaternion();
    const nodes = W.nodes, edges = W.edges;
    U.uLM.value = W.lightmap.tex; U.uLMRect.value.set(W.lightmap.x0, W.lightmap.z0, W.lightmap.w, W.lightmap.h);
    W.holes.forEach((h, k) => { if (k < 4) { U.uHoles.value[k].set(h.x, h.z, h.hu, h.hv); U.uHoleDir.value[k].set(h.ux, h.uz); } });
    const glow = []; W.glowMats = glow;
    function instanced(geo, mat, list, place, o = {}) {
      const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length)); m.count = list.length; m.frustumCulled = false;
      list.forEach((it, k) => { place(it, tmpM); m.setMatrixAt(k, tmpM); if (o.color) m.setColorAt(k, tmpC.set(o.color(it))); });
      m.castShadow = !!o.cast; m.receiveShadow = !!o.receive; scene.add(m); return m;
    }

    // ---------------------------------------------------------------- terrain
    {
      const G = W.grid, pos = new Float32Array(G.nx * G.nz * 3), nor = new Float32Array(G.nx * G.nz * 3);
      for (let j = 0; j < G.nz; j++) for (let i = 0; i < G.nx; i++) {
        const k = j * G.nx + i, h = G.data[k];
        pos[k * 3] = G.x0 + i * G.s; pos[k * 3 + 1] = h; pos[k * 3 + 2] = G.z0 + j * G.s;
        const hl = G.data[j * G.nx + Math.max(0, i - 1)], hr = G.data[j * G.nx + Math.min(G.nx - 1, i + 1)], hd = G.data[Math.max(0, j - 1) * G.nx + i], hu = G.data[Math.min(G.nz - 1, j + 1) * G.nx + i];
        const nx = hl - hr, nz = hd - hu, ny = 2 * G.s, l = Math.hypot(nx, ny, nz); nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
      }
      const idx = new Uint32Array((G.nx - 1) * (G.nz - 1) * 6); let o = 0;
      for (let j = 0; j < G.nz - 1; j++) for (let i = 0; i < G.nx - 1; i++) { const a = j * G.nx + i, b = a + 1, c = a + G.nx, d = c + 1; idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d; }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("normal", new T.BufferAttribute(nor, 3)); g.setIndex(new T.BufferAttribute(idx, 1)); g.computeBoundingSphere();
      const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
      mat.onBeforeCompile = (sh) => {
        withWorldPos(sh);
        sh.uniforms.uArcC = { value: new T.Vector3(-440.2, 475, 1450.2) };
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; uniform vec3 uArcC;\n" + NB.GLSL_NOISE + GROUND_GLSL)
          .replace("#include <color_fragment>", `#include <color_fragment>
            if (inHole(vWP.xz)) discard;
            vec2 p = vWP.xz; float n1 = vnoise(p*0.35), n2 = vnoise(p*0.04), n3 = vnoise(p*2.3);
            float slope = 1.0 - normalize(vNormal).y;
            vec3 grass = mix(vec3(0.07,0.15,0.04), vec3(0.15,0.24,0.06), n2) * (0.8 + 0.3*n1);
            vec3 dirt = mix(vec3(0.2,0.14,0.09), vec3(0.28,0.2,0.12), n1);
            vec3 col = mix(grass, dirt, smoothstep(0.25, 0.5, slope + (n3 - 0.5)*0.15));
            float bc = length(p - uArcC.xy) - uArcC.z;
            vec3 sand = mix(vec3(0.6,0.49,0.33), vec3(0.72,0.61,0.43), n2) * (0.9 + 0.15*n3);
            col = mix(col, sand, smoothstep(-8.0, 6.0, bc));
            float y = vWP.y;
            col = mix(col, col*0.55, smoothstep(0.2, -1.4, y));                           // wet near water
            col = mix(col, vec3(0.16,0.13,0.1), smoothstep(-1.4, -3.0, y));              // river / sea bed
            if (bc > 3.0 && bc < 10.0) { float pl = step(0.07, fract(p.y/0.9)); col = mix(vec3(0.12,0.07,0.04), vec3(0.4,0.27,0.15)*(0.8+0.35*vnoise(vec2(p.x*0.35, floor(p.y/0.9)*3.1))), pl); }
            diffuseColor.rgb = col;
            vec3 gL = nightLight(p, col, 0.0);`)
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gL;");
      };
      const m = new T.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; scene.add(m); W.terrainMesh = m;
    }

    // ---------------------------------------------------------------- water (one plane; terrain hides it on land)
    {
      const G = W.grid, hd = new Float32Array(G.nx * G.nz);
      hd.set(G.data);
      const htex = new T.DataTexture(hd, G.nx, G.nz, T.RedFormat, T.FloatType); htex.needsUpdate = true; htex.magFilter = htex.minFilter = T.NearestFilter;
      const mat = new T.MeshStandardMaterial({ color: 0x0d3a4a, roughness: 0.06, metalness: 0, envMapIntensity: 1.3, transparent: false });
      mat.onBeforeCompile = (sh) => {
        withWorldPos(sh); sh.uniforms.uH = { value: htex }; sh.uniforms.uGR = { value: new T.Vector4(G.x0, G.z0, G.nx * G.s, G.nz * G.s) };
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; uniform float uTime; uniform sampler2D uH; uniform vec4 uGR;\n" + NB.GLSL_NOISE)
          .replace("#include <color_fragment>", `#include <color_fragment>
            float bed = texture2D(uH, (vWP.xz - uGR.xy) / uGR.zw).r, depth = ${W.WATER_Y.toFixed(2)} - bed;
            float foam = (1.0 - smoothstep(0.0, 0.9, depth + 0.35*sin(vWP.x*0.3 + vWP.z*0.21 + uTime*1.4) + 0.4*(vnoise(vWP.xz*0.2 + uTime*0.2) - 0.5)));
            diffuseColor.rgb = mix(vec3(0.1,0.33,0.34), diffuseColor.rgb, smoothstep(0.0, 5.0, depth));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9), foam * 0.75);`)
          .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
            { vec2 q = vWP.xz; float t = uTime; vec3 wn = vec3(0.0, 1.0, 0.0);
              wn.x += 0.06*sin(q.x*0.21 + t*1.1) + 0.04*sin(q.x*0.53 - q.y*0.31 + t*1.7) + 0.05*(vnoise(q*0.35 + t*0.25) - 0.5);
              wn.z += 0.06*cos(q.y*0.19 + t*0.9) + 0.04*cos(q.x*0.41 + q.y*0.47 - t*1.3) + 0.05*(vnoise(q*0.35 - t*0.2) - 0.5);
              normal = normalize((viewMatrix * vec4(normalize(wn), 0.0)).xyz); }`);
      };
      const m = new T.Mesh(new T.PlaneGeometry(9000, 9000), mat); m.rotation.x = -Math.PI / 2; m.position.set(400, W.WATER_Y, 480); m.receiveShadow = true; scene.add(m);
    }

    // ---------------------------------------------------------------- roads: strips + intersection patches + bridge structure
    {
      const b = new NB.Builder([["aInfo", 4]]);
      W.liveEdges.forEach((e) => {
        const A = nodes[e.a], rx = -e.uz, rz = e.ux, s0 = e.set[0], s1 = e.len - e.set[1];
        if (s1 - s0 < 0.5) return;
        const n = Math.max(1, Math.ceil((s1 - s0) / 4)); let prev = null;
        for (let k = 0; k <= n; k++) {
          const s = lerp(s0, s1, k / n), x = A.x + e.ux * s, z = A.z + e.uz * s, y = e.yAt(s / e.len);
          // v runs from the start of the strip; aInfo.x is the strip length (so crosswalks/stop lines sit at the strip ends)
          const info = [s1 - s0, e.half, e.lanes, e.bridge ? 2 : 0];
          const l = b.v(x - rx * e.half, y, z - rz * e.half, -1, s - s0, 0, 1, 0, { aInfo: info }), r = b.v(x + rx * e.half, y, z + rz * e.half, 1, s - s0, 0, 1, 0, { aInfo: info });
          if (prev) b.quad(prev[0], l, r, prev[1]);
          prev = [l, r];
        }
      });
      nodes.forEach((n) => {
        if (!n.inc || !n.inc.length) return;
        const ring = [];
        n.inc.forEach((q) => { const e = q.e, dx = e.ux * q.sgn, dz = e.uz * q.sgn, s = q.sgn > 0 ? e.set[0] : e.set[1], px = -dz, pz = dx, cx = n.x + dx * s, cz = n.z + dz * s;
          ring.push([cx - px * e.half, cz - pz * e.half], [cx + px * e.half, cz + pz * e.half]); });
        const c = b.v(n.x, n.y, n.z, 0, 0, 0, 1, 0, { aInfo: [0, 1, 1, 1] }), ids = ring.map((p) => b.v(p[0], n.y, p[1], 0, 0, 0, 1, 0, { aInfo: [0, 1, 1, 1] }));
        for (let k = 0; k < ids.length; k++) b.tri(c, ids[(k + 1) % ids.length], ids[k]);
      });
      const g = b.geo(true);
      const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: T.DoubleSide });
      mat.onBeforeCompile = (sh) => {
        withWorldPos(sh);
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 aInfo; varying vec4 vInfo; varying vec2 vRoadUv;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvInfo = aInfo; vRoadUv = uv;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying vec4 vInfo; varying vec2 vRoadUv;\n" + NB.GLSL_NOISE + GROUND_GLSL)
          .replace("#include <color_fragment>", `#include <color_fragment>
            vec2 p = vWP.xz; float n1 = vnoise(p*0.9), n2 = vnoise(p*0.11);
            float L = vInfo.x, hW = vInfo.y, lanes = vInfo.z, kind = vInfo.w;
            vec3 col = vec3(0.052,0.054,0.06) * (0.78 + 0.35*n1) * (0.9 + 0.2*n2);
            if (kind > 1.5) col = mix(col, vec3(0.09,0.09,0.095), 0.35);
            float rough = 0.8;
            if (kind < 0.5 || kind > 1.5) {
              float lat = vRoadUv.x * hW, al = abs(lat), s = vRoadUv.y;
              float dEnd = min(s, L - s);
              float yl = lanes > 1.5 ? step(abs(al - 0.2), 0.08) : step(al, 0.08) * step(fract(s/6.0), 0.55);
              float dash = lanes > 1.5 ? step(abs(al - 3.7), 0.07) * step(fract(s/9.0), 0.5) : 0.0;
              float edge = step(abs(al - (hW - 0.45)), 0.07);
              float cw = (1.0 - step(4.2, dEnd)) * step(1.0, dEnd) * step(fract(lat/1.2), 0.55) * step(al, hW - 0.3);
              float stopl = ((step(abs(s - (L - 5.0)), 0.22) * step(0.0, lat)) + (step(abs(s - 5.0), 0.22) * step(lat, 0.0))) * step(al, hW - 0.3);
              float nearE = 1.0 - step(5.3, dEnd);
              float white = max(max(dash * (1.0 - nearE), edge * step(1.0, dEnd)), max(cw, stopl));
              float wear = smoothstep(0.2, 0.7, vnoise(p*1.9));
              col = mix(col, vec3(0.8,0.56,0.1), yl * (1.0 - nearE) * (0.5 + 0.5*wear));
              col = mix(col, vec3(0.78), white * (0.5 + 0.5*wear));
              rough = mix(rough, 0.7, max(white, yl));
            }
            rough = mix(rough, 0.5, uNight * 0.8);
            diffuseColor.rgb = col;
            vec3 gL = nightLight(p, col, 1.0); float gR = rough;`)
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = gR;")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gL;");
      };
      const m = new T.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
      // bridge decks: sides + underside, piers, rails, the steel arch
      const bs = new NB.Builder(), piers = [], rails = [];
      W.bridges.forEach((e) => {
        const A = nodes[e.a], rx = -e.uz, rz = e.ux, n = Math.ceil(e.len / 4); let prev = null;
        for (let k = 0; k <= n; k++) {
          const s = (k / n) * e.len, x = A.x + e.ux * s, z = A.z + e.uz * s, y = e.yAt(k / n), h = e.half + 0.6;
          const v = [bs.v(x - rx * h, y + 0.02, z - rz * h), bs.v(x + rx * h, y + 0.02, z + rz * h), bs.v(x - rx * h, y - 1.4, z - rz * h), bs.v(x + rx * h, y - 1.4, z + rz * h)];
          if (prev) { bs.quad(prev[0], prev[2], v[2], v[0]); bs.quad(prev[1], v[1], v[3], prev[3]); bs.quad(prev[2], prev[3], v[3], v[2]); }
          prev = v;
          if (k % 5 === 2) { const ty = W.terrainY(x, z); if (y - ty > 3) for (const sd of [-1, 1]) piers.push({ x: x + rx * (e.half - 1.5) * sd, z: z + rz * (e.half - 1.5) * sd, y0: Math.min(ty, W.WATER_Y) - 2, y1: y - 1.3 }); }
        }
        if (e.arch) {
          const hang = [];
          for (const sd of [-1, 1]) {
            const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24, s = t * e.len, y = e.yAt(t) + 3 + 19 * Math.sin(Math.PI * t) ** 0.85; pts.push(new T.Vector3(A.x + e.ux * s + rx * (e.half + 1.1) * sd, y, A.z + e.uz * s + rz * (e.half + 1.1) * sd)); if (k > 1 && k < 23 && k % 2 === 0) hang.push([pts[k], e.yAt(t)]); }
            const tube = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 80, 0.7, 10), new T.MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.7, roughness: 0.35 }));
            tube.castShadow = true; scene.add(tube);
          }
          instanced(new T.CylinderGeometry(0.07, 0.07, 1, 6).translate(0, 0.5, 0), new T.MeshStandardMaterial({ color: 0xc9cdd3, metalness: 0.8, roughness: 0.3 }), hang,
            ([p, y], mm) => mm.compose(tmpV.set(p.x, y, p.z), Q0, tmpS.set(1, p.y - y, 1)), { cast: true });
        }
      });
      W.colliders.filter((c) => c.kind === "rail").forEach((c) => rails.push(c));
      const bsm = new T.Mesh(bs.geo(true), new T.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.85, side: T.DoubleSide })); bsm.castShadow = bsm.receiveShadow = true; scene.add(bsm);
      instanced(new T.CylinderGeometry(0.9, 1.1, 1, 12).translate(0, 0.5, 0), new T.MeshStandardMaterial({ color: 0x8e8a84, roughness: 0.9 }), piers, (p, mm) => mm.compose(tmpV.set(p.x, p.y0, p.z), Q0, tmpS.set(1, p.y1 - p.y0, 1)), { cast: true, receive: true });
      instanced(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.7, roughness: 0.35 }), rails,
        (c, mm) => mm.compose(tmpV.set(c.x, c.y1 - 0.55, c.z), tmpQ.setFromEuler(new T.Euler(0, c.h, 0)), tmpS.set(c.hw * 2, 0.9, c.hl * 2)), { cast: true });
    }

    // ---------------------------------------------------------------- sidewalks + curbs, block interiors
    {
      const sw = new NB.Builder(), lot = new NB.Builder([["aType", 1]]);
      const TYPES = { lot: 0, park: 1, plaza: 2, parking: 3, hotel: 0 };
      W.blocks.forEach((bk) => {
        if (bk.type === "riverpark") return;
        const P = bk.curb, I = bk.inner, n = P.length;
        const ty = (x, z) => W.terrainY(x, z) + W.CURB_H;
        for (let k = 0; k < n; k++) {
          const a = P[k], b2 = P[(k + 1) % n], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]), steps = Math.max(1, Math.ceil(L / 6));
          const ia = I ? I[k] : null, ib = I ? I[(k + 1) % n] : null;
          let prev = null;
          const ox = (b2[1] - a[1]) / L, oz = -(b2[0] - a[0]) / L;    // outward normal (right of CCW edge)
          for (let s = 0; s <= steps; s++) {
            const t = s / steps, x = lerp(a[0], b2[0], t), z = lerp(a[1], b2[1], t), y = ty(x, z);
            const top = sw.v(x, y, z, x, z, 0, 1, 0), bot = sw.v(x, y - W.CURB_H - 0.05, z, x, z, ox, 0, oz), top2 = sw.v(x, y, z, x, z, ox, 0, oz);
            let inr = null;
            if (I) { const ix = lerp(ia[0], ib[0], t), iz = lerp(ia[1], ib[1], t); inr = sw.v(ix, ty(ix, iz), iz, ix, iz, 0, 1, 0); }
            if (prev) { if (I) sw.quad(prev.top, top, inr, prev.inr); sw.quad(prev.bot, bot, top2, prev.top2); }
            prev = { top, bot, top2, inr };
          }
        }
        // interior: fan over the inner polygon (or the curb polygon if the sidewalk swallowed it)
        const Pi = I || P, c = NB.polyCentroid(Pi), tt = TYPES[bk.type] ?? 0;
        const cid = lot.v(c[0], ty(c[0], c[1]), c[1], c[0], c[1], 0, 1, 0, { aType: tt });
        for (let k = 0; k < Pi.length; k++) {
          const a = Pi[k], b2 = Pi[(k + 1) % Pi.length], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]), steps = Math.max(1, Math.ceil(L / 10));
          let prev = null;
          for (let s = 0; s <= steps; s++) { const x = lerp(a[0], b2[0], s / steps), z = lerp(a[1], b2[1], s / steps), id = lot.v(x, ty(x, z), z, x, z, 0, 1, 0, { aType: tt }); if (prev !== null) lot.tri(cid, prev, id); prev = id; }
        }
      });
      const swMat = new T.MeshStandardMaterial({ color: 0x8a857e, roughness: 0.85 });
      swMat.onBeforeCompile = (sh) => {
        withWorldPos(sh);
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP;\n" + GROUND_GLSL)
          .replace("#include <color_fragment>", "#include <color_fragment>\nvec2 tq = fract(vWP.xz / 1.5); diffuseColor.rgb *= 0.78 + 0.22 * step(0.04, tq.x) * step(0.04, tq.y); vec3 gL = nightLight(vWP.xz, diffuseColor.rgb, 0.0);")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gL;");
      };
      const swm = new T.Mesh(sw.geo(true), swMat); swm.receiveShadow = true; swm.frustumCulled = false; scene.add(swm);
      const lotMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      lotMat.onBeforeCompile = (sh) => {
        withWorldPos(sh);
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aType; varying float vType;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvType = aType;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vWP; varying float vType;\n" + NB.GLSL_NOISE + GROUND_GLSL)
          .replace("#include <color_fragment>", `#include <color_fragment>
            vec2 p = vWP.xz; if (inHole(p)) discard;
            float n1 = vnoise(p*0.9), n2 = vnoise(p*0.11), n3 = vnoise(p*3.7), t = floor(vType + 0.5);
            vec3 col = vec3(0.14,0.135,0.13) * (0.8 + 0.3*n1);
            if (t == 1.0) col = mix(vec3(0.07,0.17,0.04), vec3(0.14,0.26,0.06), n2) * (0.75 + 0.35*n3);
            else if (t == 2.0) { vec2 tp = fract(p/2.0); col = mix(vec3(0.16,0.15,0.14), vec3(0.46,0.42,0.37)*(0.9+0.2*n1), step(0.035, tp.x) * step(0.035, tp.y)); }
            else if (t == 3.0) { col = vec3(0.05,0.052,0.058)*(0.85+0.3*n1); col = mix(col, vec3(0.7), step(abs(fract(p.x/3.0) - 0.5), 0.03) * 0.6); }
            diffuseColor.rgb = col; vec3 gL = nightLight(p, col, 0.0);`)
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gL;");
      };
      const lm = new T.Mesh(lot.geo(true), lotMat); lm.receiveShadow = true; lm.frustumCulled = false; scene.add(lm);
    }

    // ---------------------------------------------------------------- buildings (one instanced draw, local-space window shader)
    {
      const bld = W.bld, geo = new T.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
      const info = new Float32Array(bld.length * 4);
      const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.04 });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uNight = U.uNight;
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec4 bInfo;\nvarying vec4 vInfo; varying vec3 vLP, vON, vSc;")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            vInfo = bInfo; vON = normal;
            vSc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            vLP = transformed * vSc;`);
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec4 vInfo; varying vec3 vLP, vON, vSc; uniform float uNight;")
          .replace("#include <color_fragment>", `#include <color_fragment>
            float bSt = floor(vInfo.x + 0.5), bSeed = vInfo.y, bLit = vInfo.z, sink = vInfo.w;
            vec3 bn = normalize(vON);
            float side = 1.0 - step(0.5, abs(bn.y)), roof = step(0.5, bn.y);
            bool fx = abs(bn.x) > 0.5;
            float hl = fx ? vLP.z : vLP.x, halfW = fx ? vSc.z*0.5 : vSc.x*0.5;
            float yl = vLP.y - sink, top = vSc.y - sink;
            float bVar = floor(fract(bSeed*7.31)*3.0);
            float fh = (bSt < 0.5 ? 3.9 : 3.5) * (bVar < 0.5 ? 0.95 : bVar < 1.5 ? 1.0 : 1.1);
            float cw = (bSt < 0.5 ? 1.9 : (bSt < 1.5 ? 2.8 : (bSt < 2.5 ? 3.4 : 3.0))) * (bVar < 0.5 ? 0.85 : bVar < 1.5 ? 1.0 : 1.3);
            vec2 cell = vec2((hl + halfW) / cw, yl / fh);
            vec2 f = fract(cell), id = floor(cell);
            float ribbon = (bSt > 0.5 && bSt < 1.5 && bVar > 1.5) ? 1.0 : 0.0;
            float mx = bSt < 0.5 ? 0.05 : (ribbon > 0.5 ? 0.015 : 0.22), my = bSt < 0.5 ? 0.06 : (ribbon > 0.5 ? 0.3 : 0.27);
            float win = step(mx, f.x) * step(f.x, 1.0 - mx) * step(my, f.y) * step(f.y, 0.9);
            float frame = win * (1.0 - step(mx + 0.022, f.x) * step(f.x, 1.0 - mx - 0.022) * step(my + 0.025, f.y) * step(f.y, 0.875));
            float ground = step(yl, 4.6);
            win *= side * step(0.9, halfW - abs(hl)) * step(yl, top - 1.3) * (1.0 - ground) * step(0.0, yl);
            frame *= side * (1.0 - ground);
            float u4 = (hl + halfW) / 4.4;
            float sf = side * ground * step(0.07, fract(u4)) * step(fract(u4), 0.93) * step(0.45, yl) * step(yl, 3.9) * step(0.6, halfW - abs(hl)) * step(sink, 3.0);
            vec3 tint = bSt < 0.5 ? mix(vec3(0.04,0.1,0.13), vec3(0.13,0.1,0.06), step(0.62, bSeed)) : vec3(0.025,0.032,0.045);
            if (bSt > 1.5 && bSt < 2.5) { float band = step(0.88, fract(yl/fh)) * side * (1.0 - ground); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*1.12 + 0.06, band); }
            if (bSt < 0.5) diffuseColor.rgb *= mix(1.0, 0.8, side * (1.0 - win) * (1.0 - ground));
            float bWin = max(win, sf);
            float rb = fract(sin(dot(id + vec2(bSeed*91.7, 1.3) + bn.xz*7.0, vec2(39.34, 11.13))) * 24634.63);
            vec3 inside = mix(tint, vec3(0.34,0.31,0.27), step(0.62, rb) * 0.45 * (bSt < 0.5 ? 0.3 : 1.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, inside, bWin);
            diffuseColor.rgb = mix(diffuseColor.rgb, bSt < 0.5 ? vec3(0.05) : mix(diffuseColor.rgb, vec3(0.85,0.83,0.8), 0.3), frame * (bSt < 0.5 ? 0.0 : 1.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.14,0.14,0.15), roof);
            float r = fract(sin(dot(id + vec2(bSeed*37.1, hl > 0.0 ? 3.0 : 0.0) + bn.xz*13.0, vec2(12.9898, 78.233))) * 43758.5453);
            float lit = step(r, bLit) * win * (1.0 - frame);
            float shop = sf * step(0.2, fract(r*5.31));
            vec3 lc = mix(vec3(1.0,0.7,0.4), vec3(0.72,0.84,1.0), step(0.7, fract(r*7.13)));
            vec3 bEmis = lc * lit * (0.35 + 0.75*fract(r*3.7)) * 0.8 * uNight + vec3(1.0,0.78,0.5) * shop * 0.55 * smoothstep(0.25, 0.8, uNight);
            bWin = bWin * (1.0 - frame);`)
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, sf > 0.5 ? 0.3 : 0.06, bWin); roughnessFactor = mix(roughnessFactor, 0.95, roof);")
          .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, (sf > 0.5 ? 0.06 : bSt < 0.5 ? 0.5 : 0.22) * (1.0 - max(lit, shop)*uNight), bWin);")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += bEmis;");
      };
      const mesh = new T.InstancedMesh(geo, mat, bld.length);
      bld.forEach((b, k) => { tmpM.compose(tmpV.set(b.x, b.y, b.z), tmpQ.setFromEuler(new T.Euler(0, b.rot, 0)), tmpS.set(b.w, b.hgt, b.d)); mesh.setMatrixAt(k, tmpM); mesh.setColorAt(k, b.color); info.set([b.style, b.seed, b.lit, b.sink], k * 4); });
      geo.setAttribute("bInfo", new T.InstancedBufferAttribute(info, 4));
      mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
      // rooftop clutter
      const roofs = [], tanks = [];
      bld.forEach((b) => { if (b.hgt < 7 || b.w < 8 || b.d < 8) return; const n = RI(0, 3);
        for (let k = 0; k < n; k++) { const w = R(1.6, Math.min(6, b.w * 0.3)), d = R(1.6, Math.min(6, b.d * 0.3)), a = R(-b.w / 2 + w, b.w / 2 - w), c = R(-b.d / 2 + d, b.d / 2 - d);
          roofs.push({ x: b.x + b.ux * a - b.uz * c, z: b.z + b.uz * a + b.ux * c, y: b.y + b.hgt, w, d, h: R(0.8, 2.6), rot: b.rot, c: pick(["#7d8087", "#9a9ca0", "#5f6268", "#b5b1a8"]) }); }
        if (b.style === 3 && Math.random() < 0.3) tanks.push({ x: b.x, z: b.z, y: b.y + b.hgt }); });
      instanced(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new T.MeshStandardMaterial({ roughness: 0.8 }), roofs,
        (r, mm) => mm.compose(tmpV.set(r.x, r.y, r.z), tmpQ.setFromEuler(new T.Euler(0, r.rot, 0)), tmpS.set(r.w, r.h, r.d)), { color: (r) => r.c, cast: true, receive: true });
      const tankGeo = NB.mergeGeos([{ g: new T.CylinderGeometry(1.3, 1.3, 2.4, 12), m: M4(0, 3.6, 0), c: new T.Color(0x6b4a33) }, { g: new T.ConeGeometry(1.45, 0.9, 12), m: M4(0, 5.25, 0), c: new T.Color(0x3d2c20) },
        ...[[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].map(([x, z]) => ({ g: new T.BoxGeometry(0.14, 2.4, 0.14), m: M4(x, 1.2, z), c: new T.Color(0x2a2a2a) }))]);
      instanced(tankGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), tanks, (t, mm) => mm.compose(tmpV.set(t.x, t.y, t.z), Q0, tmpS.set(1, 1, 1)), { cast: true });
    }

    // ---------------------------------------------------------------- neon, signs, antennas
    {
      const neonMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); glow.push({ m: neonMat, day: 0.5, night: 2.6 });
      instanced(new T.BoxGeometry(1, 1, 1), neonMat, W.neon, (n, mm) => mm.compose(tmpV.set(n.x, n.y, n.z), tmpQ.setFromEuler(new T.Euler(0, n.rot, 0)), tmpS.set(n.w, n.h, n.d)), { color: (n) => n.c });
      const cv = document.createElement("canvas"); cv.width = 2048; cv.height = 512; const x = cv.getContext("2d");
      x.fillStyle = "#000"; x.fillRect(0, 0, 2048, 512);
      W.WORDS.forEach((w, k) => { const letters = w.split(""), cx = k * 128 + 64, st = Math.min(78, 470 / letters.length);
        x.font = `900 ${Math.round(st * 0.92)}px Arial Black, Arial, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.strokeStyle = "#fff"; x.lineWidth = 3;
        letters.forEach((ch, n) => { const cy = 256 - (letters.length - 1) * st / 2 + n * st; x.shadowColor = "#fff"; x.shadowBlur = 18; x.fillStyle = "#fff"; x.fillText(ch, cx, cy); x.shadowBlur = 0; });
        x.strokeRect(k * 128 + 8, 10, 112, 492); });
      const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
      const signMat = new T.MeshBasicMaterial({ map: tex, color: 0xffffff, toneMapped: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false }); glow.push({ m: signMat, day: 0.7, night: 2.2 });
      W.WORDS.forEach((w, k) => { const list = W.signs.filter((s) => s.word === k); if (!list.length) return;
        const g = new T.PlaneGeometry(1.7, 6.8), uv = g.attributes.uv; for (let v = 0; v < uv.count; v++) uv.setX(v, (k + uv.getX(v)) / W.WORDS.length);
        instanced(g, signMat, list, (s, mm) => mm.compose(tmpV.set(s.x + Math.sin(s.rot) * 0.14, s.y, s.z + Math.cos(s.rot) * 0.14), tmpQ.setFromEuler(new T.Euler(0, s.rot, 0)), tmpS.set(1, 1, 1)), { color: (s) => s.c }); });
      instanced(new T.BoxGeometry(1.9, 7.2, 0.25), new T.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6 }), W.signs, (s, mm) => mm.compose(tmpV.set(s.x, s.y, s.z), tmpQ.setFromEuler(new T.Euler(0, s.rot, 0)), tmpS.set(1, 1, 1)), { cast: true });
      instanced(new T.CylinderGeometry(0.18, 0.35, 1, 6).translate(0, 0.5, 0), new T.MeshStandardMaterial({ color: 0x55585e, metalness: 0.7, roughness: 0.4 }), W.antennas, (a, mm) => mm.compose(tmpV.set(a.x, a.y, a.z), Q0, tmpS.set(1, a.h, 1)), { cast: true });
      W.beaconMat = new T.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
      instanced(new T.SphereGeometry(0.55, 8, 6), W.beaconMat, W.antennas, (a, mm) => mm.compose(tmpV.set(a.x, a.y + a.h, a.z), Q0, tmpS.set(1, 1, 1)));
    }

    // ---------------------------------------------------------------- streetlights + signals (knockable)
    {
      const poleGeo = NB.mergeGeos([{ g: new T.CylinderGeometry(0.1, 0.16, 8.2, 8), m: M4(0, 4.1, 0) }, { g: new T.BoxGeometry(2.7, 0.12, 0.12), m: M4(-1.3, 8.05, 0) }, { g: new T.BoxGeometry(0.95, 0.2, 0.42), m: M4(-2.6, 7.95, 0) }]);
      const poleMat = new T.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.45 });
      const lampMesh = instanced(poleGeo, poleMat, W.lamps, () => {}, { cast: true });
      const headMat = new T.MeshBasicMaterial({ color: 0xffc27a, toneMapped: false }); glow.push({ m: headMat, day: 0.35, night: 3.2, hex: 0xffc27a });
      const headGeo = new T.BoxGeometry(0.8, 0.06, 0.34); headGeo.translate(-2.6, 7.83, 0);
      const heads = instanced(headGeo, headMat, W.lamps, () => {});
      const tGeo = NB.mergeGeos([{ g: new T.CylinderGeometry(0.09, 0.12, 4.6, 8), m: M4(0, 2.3, 0) }, { g: new T.BoxGeometry(0.42, 1.25, 0.42), m: M4(0, 4.5, 0) }]);
      const tMesh = instanced(tGeo, poleMat, W.signals, () => {}, { cast: true });
      const sigMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); glow.push({ m: sigMat, day: 1.4, night: 2.6 });
      const sig = new T.InstancedMesh(new T.SphereGeometry(0.2, 10, 8), sigMat, Math.max(1, W.signals.length)); sig.frustumCulled = false; scene.add(sig);
      const up = (it, mm) => {
        const q = tmpQ.setFromEuler(new T.Euler(0, it.rot, 0));
        if (it.fall > 0) { const ax = tmpV.set(it.fz, 0, -it.fx).normalize(); q.premultiply(new T.Quaternion().setFromAxisAngle(ax, Math.min(1.45, it.fall))); }
        mm.compose(tmpS.set(it.x, it.y, it.z), q, new T.Vector3(1, 1, 1));
      };
      W.placeKnockables = (full) => {
        W.lamps.forEach((l, k) => { if (full || l.fall > 0) { up(l, tmpM); lampMesh.setMatrixAt(k, tmpM); if (l.fall > 0) tmpM.makeScale(0, 0, 0); heads.setMatrixAt(k, tmpM); } });
        W.signals.forEach((l, k) => { if (full || l.fall > 0) { up(l, tmpM); tMesh.setMatrixAt(k, tmpM); } });
        lampMesh.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = tMesh.instanceMatrix.needsUpdate = true;
      };
      W.placeKnockables(true);
      const SIGC = [new T.Color(0x21ff6a), new T.Color(0xffc21a), new T.Color(0xff2a1a)];
      W.updateSignals = (t) => {
        W.signals.forEach((l, k) => {
          if (l.fall > 0) { tmpM.makeScale(0, 0, 0); sig.setMatrixAt(k, tmpM); return; }
          tmpM.compose(tmpV.set(l.x - Math.sin(l.rot) * 0.22, l.y + 4.5, l.z - Math.cos(l.rot) * 0.22), Q0, tmpS.set(1, 1, 1)); sig.setMatrixAt(k, tmpM);
          sig.setColorAt(k, SIGC[W.signal(l.node, l.edge, t)]);
        });
        sig.instanceMatrix.needsUpdate = true; if (sig.instanceColor) sig.instanceColor.needsUpdate = true;
      };
    }

    // ---------------------------------------------------------------- palms, trees, umbrellas, lifeguard towers
    {
      const trunkGeo = new T.CylinderGeometry(0.17, 0.3, 1, 7, 6, true).translate(0, 0.5, 0);
      const parts = [], green = new T.Color(0x2f6b25), dgreen = new T.Color(0x1d4a18);
      for (let f = 0; f < 9; f++) {
        const a = (f / 9) * Math.PI * 2 + (f % 2) * 0.2, L = 3.6 + (f % 3) * 0.5, segs = 7, g = new T.BufferGeometry(), pos = [];
        for (let s = 0; s < segs; s++) {
          const t0 = s / segs, t1 = (s + 1) / segs, P0 = (t) => [t * L, Math.sin(t * 2.2) * 0.9 - t * t * 1.9], w = (t) => Math.sin(Math.min(1, t * 1.1) * Math.PI) * 0.6 + 0.05;
          const [x0, y0] = P0(t0), [x1, y1] = P0(t1), w0 = w(t0), w1 = w(t1);
          pos.push(x0, y0, 0, x1, y1, 0, x0, y0 - 0.25 * w0, w0, x1, y1, 0, x1, y1 - 0.25 * w1, w1, x0, y0 - 0.25 * w0, w0, x0, y0, 0, x0, y0 - 0.25 * w0, -w0, x1, y1, 0, x1, y1, 0, x0, y0 - 0.25 * w0, -w0, x1, y1 - 0.25 * w1, -w1);
        }
        g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); parts.push({ g, m: M4(0, 0, 0, a), c: f % 2 ? green : dgreen });
      }
      const crownGeo = NB.mergeGeos(parts);
      const crownMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: T.DoubleSide });
      crownMat.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace("#include <begin_vertex>",
        "#include <begin_vertex>\nfloat sw = sin(uTime*1.4 + instanceMatrix[3].x*0.13 + instanceMatrix[3].z*0.07); transformed.y += sw * 0.12 * length(transformed.xz); transformed.x += sw * 0.1 * length(transformed.xz);"); };
      W.palms.forEach((p) => { p.tx = p.x + Math.cos(p.rot) * p.lean; p.tz = p.z + Math.sin(p.rot) * p.lean; });
      instanced(trunkGeo, new T.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.95 }), W.palms, (p, mm) => {
        const dir = tmpV.set(p.tx - p.x, p.h, p.tz - p.z); const len = dir.length(); dir.normalize();
        mm.compose(tmpS.set(p.x, p.y, p.z), tmpQ.setFromUnitVectors(new T.Vector3(0, 1, 0), dir), new T.Vector3(1, len, 1)); }, { cast: true });
      instanced(crownGeo, crownMat, W.palms, (p, mm) => mm.compose(tmpV.set(p.tx, p.y + p.h, p.tz), tmpQ.setFromEuler(new T.Euler(0, p.rot, 0)), tmpS.set(1, 1, 1)), { cast: true });
      const pine = NB.mergeGeos([{ g: new T.CylinderGeometry(0.15, 0.25, 2.2, 6), m: M4(0, 1.1, 0), c: new T.Color(0x4a3727) }, { g: new T.ConeGeometry(2.2, 4.2, 8), m: M4(0, 3.6, 0), c: new T.Color(0x1f3d22) },
        { g: new T.ConeGeometry(1.7, 3.4, 8), m: M4(0, 5.4, 0), c: new T.Color(0x24472a) }, { g: new T.ConeGeometry(1.1, 2.6, 8), m: M4(0, 7.0, 0), c: new T.Color(0x2a5231) }]);
      const round = NB.mergeGeos([{ g: new T.CylinderGeometry(0.18, 0.28, 2.6, 6), m: M4(0, 1.3, 0), c: new T.Color(0x4a3727) }, { g: new T.IcosahedronGeometry(2.3, 1), m: M4(0, 4.2, 0, 0, 1, 0.85, 1), c: new T.Color(0x2e5a23) },
        { g: new T.IcosahedronGeometry(1.6, 1), m: M4(0.9, 5.2, 0.4), c: new T.Color(0x3a6a2a) }]);
      const tmat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
      for (const [k, geo] of [[1, pine], [0, round]]) instanced(geo, tmat, W.trees.filter((t) => t.kind === k), (t, mm) => mm.compose(tmpV.set(t.x, t.y, t.z), tmpQ.setFromEuler(new T.Euler(0, t.x * 0.37, 0)), tmpS.set(t.s, t.s, t.s)), { cast: true });
      const ug = NB.mergeGeos([{ g: new T.ConeGeometry(1.4, 0.55, 10, 1, true), m: M4(0, 2.3, 0) }, { g: new T.CylinderGeometry(0.03, 0.03, 2.3, 5), m: M4(0, 1.15, 0), c: new T.Color(0xdddddd) }]);
      instanced(ug, new T.MeshStandardMaterial({ roughness: 0.6, side: T.DoubleSide, vertexColors: true }), W.umbrellas,
        (u, mm) => mm.compose(tmpV.set(u.x, W.terrainY(u.x, u.z), u.z), tmpQ.setFromEuler(new T.Euler(0.12, u.x, 0)), tmpS.set(1, 1, 1)), { color: (u) => u.c, cast: true });
      W.guards.forEach((g) => {
        const hut = new T.Color(g.c), wood = new T.Color(0xe8e2d6);
        const geo = NB.mergeGeos([{ g: new T.BoxGeometry(3.4, 2.4, 3.0), m: M4(0, 3.6, 0), c: hut }, { g: new T.BoxGeometry(4.0, 0.25, 3.6), m: M4(0, 4.95, 0), c: wood }, { g: new T.BoxGeometry(3.8, 0.2, 3.4), m: M4(0, 2.35, 0), c: wood },
          ...[[-1.5, -1.3], [1.5, -1.3], [-1.5, 1.3], [1.5, 1.3]].map(([x, z]) => ({ g: new T.BoxGeometry(0.18, 2.4, 0.18), m: M4(x, 1.2, z), c: wood })), { g: new T.BoxGeometry(1.0, 0.12, 4.2), m: M4(-2.4, 1.2, 0, 0, 1, 1, 1, 0, 0.55), c: wood }]);
        const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })); m.position.set(g.x, g.y, g.z); m.rotation.y = Math.PI / 2; m.castShadow = m.receiveShadow = true; scene.add(m);
      });
    }

    // ---------------------------------------------------------------- stunt ramps + pier
    {
      const b = new NB.Builder([["color", 3]]);
      const yellow = [0.9, 0.7, 0.05], black = [0.05, 0.05, 0.05], steel = [0.45, 0.46, 0.48];
      W.ramps.filter((r) => !r.pierRamp).forEach((r) => {
        const lx = -r.uz, lz = r.ux, P = (a, l, y) => [r.x + r.ux * a + lx * l, y, r.z + r.uz * a + lz * l];
        const nS = 10;
        for (let k = 0; k < nS; k++) { const a0 = -r.L / 2 + (k / nS) * r.L, a1 = -r.L / 2 + ((k + 1) / nS) * r.L, y0 = r.y + r.h * (k / nS), y1 = r.y + r.h * ((k + 1) / nS), c = k % 2 ? yellow : black;
          const q = [P(a0, -r.w / 2, y0), P(a0, r.w / 2, y0), P(a1, r.w / 2, y1), P(a1, -r.w / 2, y1)].map((p) => b.v(p[0], p[1], p[2], 0, 0, 0, 1, 0, { color: c }));
          b.quad(q[0], q[3], q[2], q[1]); }
        for (const sd of [-1, 1]) { const q = [P(-r.L / 2, sd * r.w / 2, r.y), P(r.L / 2, sd * r.w / 2, r.y), P(r.L / 2, sd * r.w / 2, r.y + r.h)].map((p) => b.v(p[0], p[1], p[2], 0, 0, 0, 1, 0, { color: steel })); b.tri(q[0], q[1], q[2]); b.tri(q[0], q[2], q[1]); }
        const q = [P(r.L / 2, -r.w / 2, r.y), P(r.L / 2, r.w / 2, r.y), P(r.L / 2, r.w / 2, r.y + r.h), P(r.L / 2, -r.w / 2, r.y + r.h)].map((p) => b.v(p[0], p[1], p[2], 0, 0, 0, 1, 0, { color: steel })); b.quad(q[0], q[1], q[2], q[3]); b.quad(q[0], q[3], q[2], q[1]);
      });
      const m = new T.Mesh(b.geo(true), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3, side: T.DoubleSide })); m.castShadow = m.receiveShadow = true; scene.add(m);
      const p = W.pier, wood = new T.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
      const deck = new T.Mesh(new T.BoxGeometry(p.L - 10, 0.5, p.w), wood); deck.position.set(p.x0 + 10 + (p.L - 10) / 2, p.y - 0.25, p.z); deck.castShadow = deck.receiveShadow = true; scene.add(deck);
      const rampM = new T.Mesh(new T.BoxGeometry(10.5, 0.4, p.w - 0.4), wood); const r0 = W.ramps.find((r) => r.pierRamp);
      rampM.position.set(r0.x, r0.y + r0.h / 2 - 0.2, r0.z); rampM.rotation.z = Math.atan2(r0.h, r0.L); rampM.receiveShadow = true; scene.add(rampM);
      const piles = []; for (let s = 14; s < p.L; s += 8) for (const sd of [-1, 1]) piles.push({ x: p.x0 + s, z: p.z + sd * (p.w / 2 - 0.6) });
      instanced(new T.CylinderGeometry(0.28, 0.28, 1, 8).translate(0, 0.5, 0), wood, piles, (q, mm) => mm.compose(tmpV.set(q.x, -8, q.z), Q0, tmpS.set(1, p.y + 7.8, 1)), { cast: true });
    }

    // ---------------------------------------------------------------- underground garages
    W.garages.forEach((g) => {
      const hd = Math.atan2(-g.uz, g.ux);    // rotation.y whose local x runs along u
      const grp = new T.Group(); grp.position.set(g.mx, 0, g.mz); grp.rotation.y = hd; scene.add(grp);
      // local frame of grp: x = u, z = v (inward)
      const concrete = new T.MeshLambertMaterial({ color: 0x4a4b4f, emissive: 0x0c0d10 });
      const stripeY = new T.MeshLambertMaterial({ color: 0xe0b020, emissive: 0x2a2004 }), stripeB = new T.MeshLambertMaterial({ color: 0x2f7df6, emissive: 0x06142c });
      const floorMat = new T.MeshLambertMaterial({ color: 0xffffff });
      floorMat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vL;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvL = position.xz + vec2(0.0, " + (g.D / 2).toFixed(2) + ");");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vL;\n" + NB.GLSL_NOISE)
          .replace("#include <color_fragment>", `#include <color_fragment>
            vec3 col = vec3(0.1,0.1,0.105) * (0.8 + 0.4*vnoise(vL*0.7));
            float stall = step(abs(fract((vL.x + 0.2)/2.8) - 0.5), 0.022) * (step(abs(vL.y - 4.0), 2.6) + step(abs(vL.y - ${(g.D - 4).toFixed(1)}), 2.6));
            float lane = step(abs(vL.y - ${(g.D / 2).toFixed(1)}), 0.08) * step(fract(vL.x/4.0), 0.5);
            col = mix(col, vec3(0.75,0.72,0.6), max(stall, lane) * 0.8);
            float pool = 0.0; for (int i = 0; i < 6; i++) for (int j = 0; j < 3; j++) { float lx = -${(g.W / 2).toFixed(1)} + 5.0 + float(i) * ${((g.W - 10) / 5).toFixed(2)}, lz = 5.0 + float(j) * ${((g.D - 10) / 2).toFixed(2)};
              vec2 dv = vL - vec2(lx, lz); pool += exp(-dot(dv, dv) / 12.0); }
            diffuseColor.rgb = col;
            vec3 gEm = col * vec3(0.9,1.0,0.95) * (0.12 + min(pool, 1.2) * 1.6);`)
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gEm;");
      };
      const floor = new T.Mesh(new T.PlaneGeometry(g.W, g.D).rotateX(-Math.PI / 2), floorMat); floor.position.set(0, g.floor, g.D / 2); floor.receiveShadow = true; grp.add(floor);
      // ceiling slab, with the ramp opening cut out
      const slabT = g.y0 - g.ceil, slab = (u0, u1, v0, v1) => { if (u1 - u0 < 0.1 || v1 - v0 < 0.1) return; const m = new T.Mesh(new T.BoxGeometry(u1 - u0, slabT, v1 - v0), concrete); m.position.set((u0 + u1) / 2, g.ceil + slabT / 2 - 0.02, (v0 + v1) / 2); m.castShadow = true; grp.add(m); };
      const r0 = g.rampU - g.rampW / 2 - 0.15, r1 = g.rampU + g.rampW / 2 + 0.15;
      slab(-g.W / 2 - 0.6, r0, 0, g.D + 0.6); slab(r1, g.W / 2 + 0.6, 0, g.D + 0.6); slab(r0, r1, g.openV + 0.3, g.D + 0.6);
      // walls
      const wall = (u, v, lu, lv, y0, y1) => { const m = new T.Mesh(new T.BoxGeometry(lu, y1 - y0, lv), concrete); m.position.set(u, (y0 + y1) / 2, v); m.receiveShadow = true; grp.add(m); };
      wall(0, g.D + 0.3, g.W + 1.2, 0.6, g.floor, g.ceil); wall(-g.W / 2 - 0.3, g.D / 2, 0.6, g.D, g.floor, g.ceil); wall(g.W / 2 + 0.3, g.D / 2, 0.6, g.D, g.floor, g.ceil);
      wall((-g.W / 2 + g.rampU - g.rampW / 2) / 2, -0.3, g.rampU - g.rampW / 2 + g.W / 2, 0.6, g.floor, g.ceil); wall((g.rampU + g.rampW / 2 + g.W / 2) / 2, -0.3, g.W / 2 - g.rampU - g.rampW / 2, 0.6, g.floor, g.ceil);
      // ramp + its walls
      const rb = new NB.Builder(), yA = g.y0, yB = g.floor, u0 = g.rampU - g.rampW / 2, u1 = g.rampU + g.rampW / 2;
      const q = [rb.v(u0, yA + 0.01, 0), rb.v(u1, yA + 0.01, 0), rb.v(u1, yB + 0.01, g.LR), rb.v(u0, yB + 0.01, g.LR)]; rb.quad(q[0], q[3], q[2], q[1]);
      const ramp = new T.Mesh(rb.geo(true), new T.MeshLambertMaterial({ color: 0x46474b, side: T.DoubleSide })); ramp.receiveShadow = true; grp.add(ramp);
      const rw = (u, len) => { const m = new T.Mesh(new T.BoxGeometry(0.5, g.y0 + 1.1 - (g.floor - 0.2), len), concrete); m.position.set(u, (g.y0 + 1.1 + g.floor - 0.2) / 2, len / 2); m.castShadow = true; grp.add(m); };
      rw(u1 + 0.25, g.LR - 1); rw(u0 - 0.25, g.LR);
      // pillars, light strips, the sign
      g.pillars.forEach(([x, z]) => { const [u, v] = W.gLocal(g, x, z); wall(u, v, 0.7, 0.7, g.floor, g.ceil);
        const band = new T.Mesh(new T.BoxGeometry(0.74, 0.9, 0.74), stripeY); band.position.set(u, g.floor + 0.45, v); grp.add(band); });
      for (const [u, v, lu, lv] of [[0, g.D - 0.02, g.W, 0.06], [-g.W / 2 + 0.02, g.D / 2, 0.06, g.D], [g.W / 2 - 0.02, g.D / 2, 0.06, g.D]]) {
        const s = new T.Mesh(new T.BoxGeometry(lu, 0.5, lv), stripeB); s.position.set(u, g.floor + 1.4, v); grp.add(s); }
      const lightMat = new T.MeshBasicMaterial({ color: 0xe8fff4, toneMapped: false }); lightMat.color.multiplyScalar(2.6);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { const m = new T.Mesh(new T.BoxGeometry(2.4, 0.06, 0.24), lightMat); m.position.set(-g.W / 2 + 5 + i * (g.W - 10) / 5, g.ceil - 0.05, 5 + j * (g.D - 10) / 2); grp.add(m); }
      const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128; const cx = cv.getContext("2d"); cx.fillStyle = "#1d5cff"; cx.fillRect(0, 0, 128, 128); cx.fillStyle = "#fff"; cx.font = "900 100px Arial"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText("P", 64, 70);
      const sign = new T.Mesh(new T.BoxGeometry(1.6, 1.6, 0.12), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), toneMapped: false })); sign.position.set(u0 - 0.9, g.y0 + 3.2, -0.2); grp.add(sign);
      const post = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 3.2, 6), new T.MeshStandardMaterial({ color: 0x3a3d42 })); post.position.set(u0 - 0.9, g.y0 + 1.6, -0.2); grp.add(post);
    });
    return W;
  };
})();
