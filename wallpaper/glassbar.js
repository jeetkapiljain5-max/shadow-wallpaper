/* Liquid glass for Shadow Launchpad (search bar, answer card, menus, buttons, dialogs).
   The optics are ported from Liquid Glass Studio by iyinchao (MIT): https://github.com/iyinchao/liquid-glass-studio
   (src/shaders/fragment-main.glsl, "STEP 9": Snell-law edge refraction, RGB dispersion, Fresnel rim, two-sided
   angular glare in LCH; soft SDF shadow from fragment-bg.glsl). LCH helpers: Rachmanin0xFF/GLSL-Color-Functions,
   as in the original. Licence: vendor/liquid-glass-studio-LICENSE.txt.
   Added here: the highlight follows the cursor, a press makes the glass swell and brighten, and every piece is
   "stretchy" (iOS-style spring: it squishes toward a drag and wobbles back). Each element redraws only while it moves.

   ShadowGlass(host, bgCanvas, opts) -> controller
     opts.radius  corner radius in px, or 'pill'           opts.frost  0 = clear (refracts the wallpaper), 1 = frosted
     opts.tint    0..1 white tint                          opts.shadow 0..1 shadow strength
     opts.stretch true to add the press / drag spring      opts.pad    px of room for the shadow                      */
(function () {
  const all = new Set();
  // CSS linear() easing that traces a damped spring (zeta < 1 = a gentle overshoot), sampled once per duration
  const easeCache = {};
  function springEase(zeta, dur) {
    const key = zeta + '|' + dur; if (easeCache[key]) return easeCache[key];
    const w = 2 * Math.PI / (dur / 1000 * 0.62), wd = w * Math.sqrt(1 - zeta * zeta), pts = [];
    for (let i = 0; i <= 48; i++) { const t = i / 48 * dur / 1000; pts.push((1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + zeta * w / wd * Math.sin(wd * t))).toFixed(4)); }
    pts[pts.length - 1] = '1';
    try { const ok = CSS.supports('animation-timing-function', `linear(${pts.join(',')})`); return easeCache[key] = ok ? `linear(${pts.join(',')})` : 'cubic-bezier(.2,.9,.25,1.05)'; }
    catch (_) { return easeCache[key] = 'cubic-bezier(.2,.9,.25,1.05)'; }
  }
  let mouse = { x: -1e4, y: -1e4 };
  addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY }; all.forEach(g => g.lightMoved()); }, { passive: true });

  const VS = `#version 300 es
  in vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`;
  const FS = `#version 300 es
  precision highp float;
  #define PI 3.14159265359
  uniform sampler2D u_bg;
  uniform vec2 u_size, u_shape, u_view, u_light;
  uniform float u_shift;                                                  // stretch: shape centre offset (px)
  uniform float u_dpr, u_radius, u_frost, u_tint, u_shadow, u_press, u_lightOn, u_glare, u_disp, u_rim, u_glRange, u_frRange, u_frAmt, u_glow;
  uniform vec4 u_map, u_bgRect;
  out vec4 o;
  const float REF_N = 1.4;
  const float FR_HARD = 0.12;
  const float GL_RANGE = 20.0, GL_HARD = 0.12, GL_FACTOR = 0.62, GL_CONV = 0.55, GL_OPP = 0.6;

  const vec3 WHITE = vec3(0.95045592705, 1.0, 1.08905775076);
  const mat3 RGB_TO_XYZ_M = mat3(0.4124, 0.3576, 0.1805, 0.2126, 0.7152, 0.0722, 0.0193, 0.1192, 0.9505);
  const mat3 XYZ_TO_RGB_M = mat3(3.2406255, -1.537208, -0.4986286, -0.9689307, 1.8757561, 0.0415175, 0.0557101, -0.2040211, 1.0569959);
  float UNC(float a) { return a > 0.04045 ? pow((a + 0.055) / 1.055, 2.4) : a / 12.92; }
  float COM(float a) { return a <= 0.0031308 ? 12.92 * a : 1.055 * pow(a, 0.41666666666) - 0.055; }
  float LF(float x) { return x > 0.00885645167 ? pow(x, 0.333333333) : 7.78703703704 * x + 0.13793103448; }
  float LFI(float x) { return x > 0.206897 ? x * x * x : 0.12841854934 * (x - 0.137931034); }
  vec3 SRGB_TO_LCH(vec3 c) {
    vec3 xyz = vec3(UNC(c.x), UNC(c.y), UNC(c.z)) * RGB_TO_XYZ_M / WHITE;
    xyz = vec3(LF(xyz.x), LF(xyz.y), LF(xyz.z));
    vec3 lab = vec3(116.0 * xyz.y - 16.0, 500.0 * (xyz.x - xyz.y), 200.0 * (xyz.y - xyz.z));
    return vec3(lab.x, length(lab.yz), atan(lab.z, lab.y) * 57.2957795131);
  }
  vec3 LCH_TO_SRGB(vec3 l) {
    vec3 lab = vec3(l.x, l.y * cos(l.z * 0.01745329251), l.y * sin(l.z * 0.01745329251));
    float w = (lab.x + 16.0) / 116.0;
    vec3 xyz = WHITE * vec3(LFI(w + lab.y / 500.0), LFI(w), LFI(w - lab.z / 200.0));
    vec3 rgb = xyz * XYZ_TO_RGB_M;
    return vec3(COM(rgb.x), COM(rgb.y), COM(rgb.z));
  }
  float sdf(vec2 p) { vec2 b = u_shape * 0.5; float r = min(u_radius, min(b.x, b.y)); vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r; }
  vec2 normalAt(vec2 p) { vec2 e = vec2(0.5, 0.0); return normalize(vec2(sdf(p + e.xy) - sdf(p - e.xy), sdf(p + e.yx) - sdf(p - e.yx)) + 1e-6); }
  vec3 bgAt(vec2 local, float lod) {                                     // what is on screen behind this point (blurred wallpaper + vignette)
    vec2 s = u_map.xy + local * u_map.zw;
    vec3 c = textureLod(u_bg, (s - u_bgRect.xy) / u_bgRect.zw, lod).rgb;
    vec2 e = (s - vec2(0.5, 0.4) * u_view) / (vec2(1.3, 1.0) * u_view);
    return c * (1.0 - mix(0.1, 0.38, clamp((length(e) - 0.3) / 0.7, 0.0, 1.0)));
  }
  vec3 disp(vec2 local, vec2 off, float lod, float k) {                  // three passes at slightly different strengths = chromatic aberration
    return vec3(bgAt(local + off * (1.0 + 0.02 * u_disp * k), lod).r, bgAt(local + off, lod).g, bgAt(local + off * (1.0 - 0.02 * u_disp * k), lod).b);
  }

  void main() {
    vec2 local = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;   // css px, y down
    vec2 p = local - u_size * 0.5 - vec2(u_shift, 0.0);
    float d = sdf(p), aa = 0.75 / u_dpr;
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float sh = (exp(-max(sdf(p - vec2(0.0, 2.0 + 2.0 * u_shadow)), 0.0) / (6.0 + 10.0 * u_shadow)) * 0.6 + exp(-max(sdf(p - vec2(0.0, 0.6)), 0.0) / 1.4) * 0.3) * u_shadow * (1.0 - inside);
    if (inside <= 0.0) { o = vec4(0.0, 0.0, 0.0, sh); return; }

    float h = min(u_shape.x, u_shape.y), thick = clamp(h * 0.44, 8.0, 22.0), dist = min(h * 0.9, 36.0);
    float nm = -d;
    vec2 n = normalAt(p);
    float ef = 0.0;
    if (nm < thick) {                                                     // Snell refraction through the rounded edge
      float x = 1.0 - nm / thick;
      float ti = asin(clamp(x * x, -1.0, 1.0));
      float tt = asin(clamp(sin(ti) / REF_N, -1.0, 1.0));
      ef = -tan(tt - ti);
    }
    float edgeH = clamp(nm / thick, 0.0, 1.0);
    vec2 off = -n * ef * dist * (1.0 + 0.12 * u_press);
    vec3 base = mix(disp(local, off, 0.0, 1.0), disp(local, off, 1.4 + 2.0 * u_frost, 1.0), 0.15 + 0.25 * (1.0 - edgeH) + 0.6 * u_frost);
    float tint = u_tint + 0.05 * u_press;
    vec3 col = mix(base, vec3(1.0), tint);

    // Fresnel rim
    float fres = clamp(pow(max(1.0 + d / 1500.0 * pow(500.0 / u_frRange, 2.0) + FR_HARD, 0.0), 5.0), 0.0, 1.0);   // larger range = thicker rim
    col = mix(col, vec3(1.0), fres * u_frAmt * (0.7 + 0.5 * u_press));
    // a very soft light from inside the glass: brightest in the middle, fading toward the rim
    col = mix(col, vec3(1.0), u_glow * smoothstep(0.0, 1.0, edgeH) * (0.55 + 0.45 * (1.0 - length(p / (u_shape * 0.5)))));

    // glare: faces the light (your cursor when it's near, otherwise from the top-left), weaker on the opposite side
    vec2 ld = normalize(mix(vec2(-0.7, 0.7), normalize(vec2(u_light.x, -u_light.y) + 1e-4), u_lightOn));
    float ga = PI * 0.5 - atan(ld.y, ld.x);
    float geo = clamp(pow(max(1.0 + d / 1500.0 * pow(500.0 / u_glRange, 2.0) + GL_HARD, 0.0), 5.0), 0.0, 1.0);   // smaller range = thinner glare line
    vec2 ng = vec2(n.x, -n.y);
    float ang = atan(ng.y, ng.x); if (ang < 0.0) ang += 2.0 * PI;
    ang = (ang - PI / 4.0 + ga) * 2.0;
    float sa = sin(ang), far = ((ang > PI * 1.5 && ang < PI * 3.5) || ang < -PI * 0.5) ? 1.0 : 0.0;   // as in the studio
    float gaf = (0.5 + sa * 0.5) * mix(1.2, 1.2 * GL_OPP, far) * GL_FACTOR * (1.0 + 0.35 * u_press);
    gaf = clamp(pow(max(gaf, 0.0), 0.1 + GL_CONV * 2.0), 0.0, 1.0);
    vec3 glc = SRGB_TO_LCH(mix(base, vec3(1.0), tint * 0.6));
    glc.x = clamp(glc.x + 70.0 * gaf * geo, 0.0, 100.0); glc.y += 18.0 * gaf * geo;
    col = mix(col, clamp(LCH_TO_SRGB(glc), 0.0, 1.0), clamp(gaf * geo * 0.7 * u_glare, 0.0, 1.0));

    // chromatic rim: a thin prism-like rainbow along the edge, hue turning with the edge direction (Apple's glass shows this even on flat colour)
    float band = clamp(pow(max(1.0 + d / 1500.0 * pow(500.0 / 12.0, 2.0) + 0.05, 0.0), 3.0), 0.0, 1.0) * (1.0 - fres * 0.5);   // pow() of a negative is undefined in GLSL
    vec3 prism = 0.5 + 0.5 * cos(ang * 0.5 + vec3(0.0, 2.094, 4.189));
    col += (prism - 0.5) * band * 0.55 * u_rim;

    // a soft inner shade along the lower edge gives the slab depth
    col *= 1.0 - 0.10 * smoothstep(0.0, 1.0, (1.0 - edgeH)) * smoothstep(-0.2, 1.0, n.y);

    float a = inside;
    if (u_frost > 0.5) a *= clamp(pow(1.0 - edgeH, 1.3) * 0.95 + 0.05 + fres * 0.4 + gaf * geo, 0.0, 1.0);   // liquid: lensing edge, see-through centre
    o = vec4(col * a, a + sh);
  }`;

  window.ShadowGlass = function (host, bgCanvas, opts = {}) {
    const PAD = opts.pad ?? 22;
    const cv = document.createElement('canvas'); cv.className = 'lgCanvas';
    const gl = cv.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) return null;
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const pr = gl.createProgram();
    try { gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); }
    catch (e) { console.warn('glass shader', e); return null; }
    host.prepend(cv);
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['u_size', 'u_shape', 'u_view', 'u_dpr', 'u_map', 'u_bgRect', 'u_radius', 'u_frost', 'u_tint', 'u_shadow', 'u_press', 'u_light', 'u_lightOn', 'u_glare', 'u_disp', 'u_rim', 'u_glRange', 'u_frRange', 'u_frAmt', 'u_glow', 'u_shift'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    let bgDirty = true, raf = 0, until = 0, press = 0, pressTo = 0, lightOn = 0, lightTo = 0, light = [0, -1];

    // spring state for the iOS-style stretch: scale x/y and a little drift toward the drag
    const S = { sx: 1, sy: 1, tx: 0, ty: 0, vsx: 0, vsy: 0, vtx: 0, vty: 0, gsx: 1, gsy: 1, gtx: 0, gty: 0, k: 420, c: 18 };
    let down = null, hover = false, pullT = 0, pullStart = 0, pullLast = 0, pullDir = 0;
    const E = { x: 0, v: 0, g: 0, k: 220, c: 26, max: 1 };                   // glass stretch (px; negative = toward the left)

    function draw() {
      const w = host.offsetWidth, h = host.offsetHeight; if (!w || !h) return;
      const dpr = Math.min(2, devicePixelRatio || 1), cw = w + PAD * 2, ch = h + PAD * 2;
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
      cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; cv.style.left = cv.style.top = -PAD + 'px';
      if (bgDirty && bgCanvas.width) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCanvas); gl.generateMipmap(gl.TEXTURE_2D); bgDirty = false; }
      const r = host.getBoundingClientRect(), kx = r.width / w, ky = r.height / h, b = bgCanvas.getBoundingClientRect();
      const ax = Math.abs(E.x), sw = w + ax, sh = h * (1 - .03 * Math.min(1, ax / Math.max(1, E.max)));      // iOS stretch: longer and a touch thinner
      const rad = typeof opts.radius === 'function' ? opts.radius(sh) : opts.radius === 'pill' || opts.radius == null ? sh / 2 : opts.radius;
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(U.u_size, cw, ch); gl.uniform2f(U.u_shape, sw, sh); gl.uniform1f(U.u_shift, E.x / 2); gl.uniform2f(U.u_view, innerWidth, innerHeight); gl.uniform1f(U.u_dpr, cv.width / cw);
      gl.uniform4f(U.u_map, r.left - PAD * kx, r.top - PAD * ky, kx, ky); gl.uniform4f(U.u_bgRect, b.left, b.top, b.width || 1, b.height || 1);
      gl.uniform1f(U.u_radius, rad); gl.uniform1f(U.u_frost, opts.frost || 0); gl.uniform1f(U.u_tint, opts.tint ?? .035); gl.uniform1f(U.u_shadow, opts.shadow ?? .1);
      gl.uniform1f(U.u_glare, opts.glare ?? 1); gl.uniform1f(U.u_disp, opts.disp ?? 13); gl.uniform1f(U.u_rim, opts.rim ?? .35); gl.uniform1f(U.u_glRange, opts.glareRange ?? 20); gl.uniform1f(U.u_frRange, opts.rimWidth ?? 18); gl.uniform1f(U.u_frAmt, opts.rimAmt ?? .16); gl.uniform1f(U.u_glow, opts.glow ?? 0);
      gl.uniform1f(U.u_press, press); gl.uniform2f(U.u_light, light[0], light[1]); gl.uniform1f(U.u_lightOn, lightOn);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function step(dt) {                                                   // springs: underdamped, so it overshoots a touch and settles
      let moving = false;
      const sp = (k, c, x, v, g) => { const a = -k * (x - g) - c * v; v += a * dt; x += v * dt; return [x, v]; };
      for (const [x, v, g, k, c] of [['sx', 'vsx', 'gsx', S.k, S.c], ['sy', 'vsy', 'gsy', S.k, S.c], ['tx', 'vtx', 'gtx', 300, 20], ['ty', 'vty', 'gty', 300, 20]]) {
        [S[x], S[v]] = sp(k, c, S[x], S[v], S[g]);
        if (Math.abs(S[x] - S[g]) > 1e-4 || Math.abs(S[v]) > 1e-3) moving = true; else { S[x] = S[g]; S[v] = 0; }
      }
      { const a = -E.k * (E.x - E.g) - E.c * E.v; E.v += a * dt; E.x += E.v * dt;
        if (Math.abs(E.x - E.g) > .05 || Math.abs(E.v) > .5) moving = true; else { E.x = E.g; E.v = 0; }
        if (opts.stretchContent) host.style.setProperty('--ext', (E.x * .2).toFixed(2) + 'px'); }   // the text drifts a little with the glass, never squashed
      press += (pressTo - press) * Math.min(1, dt * 14); lightOn += (lightTo - lightOn) * Math.min(1, dt * 8);
      if (Math.abs(press - pressTo) > .01 || Math.abs(lightOn - lightTo) > .01) moving = true;
      host.style.transform = (S.tx || S.ty ? `translate(${S.tx.toFixed(2)}px,${S.ty.toFixed(2)}px) ` : '') + `scale(${S.sx.toFixed(4)},${S.sy.toFixed(4)})`;
      return moving;
    }
    let last = 0;
    function loop(t) {
      const dt = Math.min(1 / 30, last ? (t - last) / 1000 : 1 / 60); last = t;
      const moving = step(dt); draw();
      if (moving || performance.now() < until) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; }
    }
    function kick(ms = 0) { until = Math.max(until, performance.now() + ms); if (!raf) raf = requestAnimationFrame(loop); }

    if (opts.stretch) {
      host.addEventListener('mouseenter', () => { hover = true; if (!down) { S.gsx = S.gsy = 1.012; kick(); } });
      host.addEventListener('mouseleave', () => { hover = false; if (!down) { S.gsx = S.gsy = 1; kick(); } });
      host.addEventListener('mousedown', e => { if (e.button) return; S.k = 420; S.c = 18; down = { x: e.clientX, y: e.clientY }; S.gsx = S.gsy = 1.055; pressTo = 1; kick(); });
      addEventListener('mousemove', e => {
        if (!down) return;
        const dx = e.clientX - down.x, dy = e.clientY - down.y, w = host.offsetWidth || 1, h = host.offsetHeight || 1;
        const ax = Math.tanh(dx / (w * 0.9)), ay = Math.tanh(dy / (h * 2.2));       // rubber-band: gives a little, then resists
        S.gsx = 1.055 + Math.abs(ax) * 0.07 - Math.abs(ay) * 0.035; S.gsy = 1.055 + Math.abs(ay) * 0.1 - Math.abs(ax) * 0.045;
        S.gtx = ax * Math.min(14, w * 0.06); S.gty = ay * Math.min(10, h * 0.3); kick();
      });
      addEventListener('mouseup', () => { if (!down) return; down = null; pressTo = 0; S.gsx = S.gsy = hover ? 1.012 : 1; S.gtx = S.gty = 0; S.vsx -= 1.6; S.vsy += 1.6; kick(); });
    }
    const api = {
      draw, el: host,
      bgChanged() { bgDirty = true; kick(60); },
      animate(ms) { kick(ms); },
      // appear: Apple-style spring (response ~0.35 s, damping ~0.86: settles smoothly, the faintest overshoot)
      pop(from = 0.86, dur = 520, zeta = 0.82) {
        S.sx = S.sy = S.gsx = S.gsy = 1; S.vsx = S.vsy = 0; host.style.transform = 'scale(1,1)'; draw();          // glass drawn once at its final size
        host.getAnimations?.().forEach(a => a.cancel());
        host.animate([{ transform: `scale(${from})` }, { transform: 'scale(1)' }], { duration: dur, easing: springEase(zeta, dur) });   // spring: grows, settles
        host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(200, dur * 0.4), easing: 'cubic-bezier(.2,.7,.3,1)' });  // quick fade in
      },
      out(to = 0.94, dur = 170) { return host.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${to})`, opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }); },
      squish() { S.vsx += 2.2; S.vsy -= 2.2; kick(); },
      // rubber band: stretch toward dir (-1 left, 1 right) while it keeps being pulled, then spring back
      // iOS rubber band: the glass edge you pull toward gives way (far edge stays put), more the longer you hold,
      // with growing resistance up to a limit; let go and it snaps back with a small overshoot
      pull(dir) {
        const w = host.offsetWidth || 1, now = performance.now(); E.max = Math.min(22, w * .045);
        if (!pullStart || now - pullLast > 420 || dir !== pullDir) pullStart = now; pullLast = now; pullDir = dir;
        const t = (now - pullStart) / 1000, give = 1 - 1 / (1 + t * 2.2);                // rubber-band curve: fast at first, then resists
        E.g = dir * E.max * Math.min(1, .1 + give * 1.1); E.k = 150; E.c = 25; kick();
        clearTimeout(pullT); pullT = setTimeout(() => { pullStart = 0; E.g = 0; E.k = 260; E.c = 19; kick(); }, 340);
      },
      lightMoved() {
        if (!host.offsetWidth) return;
        const r = host.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = mouse.x - cx, dy = mouse.y - cy, near = Math.hypot(Math.max(0, Math.abs(dx) - r.width / 2), Math.max(0, Math.abs(dy) - r.height / 2)) < 260;
        light = [dx, dy]; lightTo = near ? 1 : 0; if (near || lightOn > .01) kick(16);
      },
    };
    try { new ResizeObserver(() => kick(120)).observe(host); } catch (_) {}          // follow size changes frame by frame
    all.add(api);
    return api;
  };
})();
