/* Shadow — live lyrics, Apple Music style.
   The helper tells us what Windows says is playing (YouTube Music, Spotify, ... : title, artist, position); time-synced
   lyrics come from LRCLIB (lrclib.net, free and open). Big bold lines under the clock: the current line bright, the rest
   dimmed and softly blurred, gliding up line by line with a slight ripple; "• • •" fills up during instrumental breaks. */
(() => {
  const L = window.LAUNCH;
  const LIVE = !!(window.chrome && window.chrome.webview) || /Lively/i.test(navigator.userAgent);
  if (!L && !window.__mediaTest) return;
  const base = L ? L.url.replace('/open/', '') : '';
  const LEAD = .28;                                                    // show a line a touch early, like Apple Music

  /* ---------------------------------------------------------------- look ---------------------------------------------------------------- */
  const css = document.createElement('style');
  css.textContent = `
  #lyr{position:fixed;z-index:6;pointer-events:none;overflow:hidden;opacity:0;transition:opacity .9s ease;
       -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 16%,#000 64%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 16%,#000 64%,transparent 100%)}
  #lyr.on{opacity:1}
  #lyr:not(.on){transition:opacity .22s ease}                            /* leaving (e.g. swiping to the clock): gone at once */
  #lyr .l,#lyr .dots{position:absolute;left:0;right:0;top:0;transform-origin:0 50%;will-change:transform,opacity,filter;
       transition:transform .78s cubic-bezier(.19,.8,.22,1),opacity .55s ease,filter .55s ease}
  #lyr .l{font:700 4.25vh/1.16 "SF Pro Display","Shadow SF Display","SF Pro","Segoe UI Variable Display","Segoe UI",sans-serif;letter-spacing:-.025em;
       color:#fff;opacity:.3;scale:.965;white-space:normal;text-wrap:balance;
       filter:blur(var(--b,.12vh)) drop-shadow(0 .2vh .9vh rgba(0,0,0,.42));transition:transform .78s cubic-bezier(.19,.8,.22,1),opacity .6s ease,filter .6s ease,scale .7s cubic-bezier(.19,.8,.22,1)}
  #lyr .l.cur{opacity:1;scale:1;--b:0px}
  #lyr .l.past{opacity:.22}
  #lyr .w{display:inline;transition:none}
  #lyr .l.cur .w{color:transparent;-webkit-background-clip:text;background-clip:text;
       background-image:linear-gradient(90deg,#fff calc(var(--f,0) * 135% - 35%),rgba(255,255,255,.4) calc(var(--f,0) * 135%))}
  #lyr .dots{display:flex;gap:1.2vh;height:4.85vh;align-items:center;opacity:0}
  #lyr .dots.on{opacity:1}
  #lyr .dots i{width:1.5vh;height:1.5vh;border-radius:50%;background:#fff;opacity:.3;box-shadow:0 .2vh 1vh rgba(0,0,0,.25);transition:opacity .25s linear}
  #lyr .dots.end{opacity:0;transition:opacity .45s ease}
  #lyr.center{text-align:center}
  #lyr.center .l{transform-origin:50% 50%}
  #lyr.center .dots{justify-content:center}
  #np{position:fixed;left:50%;top:7.5vh;translate:-50% 0;z-index:6;text-align:center;pointer-events:none;visibility:hidden;transition:visibility 0s linear .9s}
  #np.on{visibility:visible;transition:none}
  #np{--w:min(37vh,80vw);--h:var(--w)}
  #np .art{position:relative;width:100%;height:var(--h);border-radius:2.3vh;overflow:hidden;pointer-events:auto;cursor:pointer;background:rgba(255,255,255,.08);
       box-shadow:0 2.8vh 6.5vh rgba(0,0,0,.5),0 .6vh 1.6vh rgba(0,0,0,.3);
       opacity:0;scale:.62;translate:0 6vh;filter:blur(2.2vh) saturate(.6);
       transition:scale .5s cubic-bezier(.4,0,.2,1),translate .5s cubic-bezier(.4,0,.2,1),opacity .4s ease,filter .5s ease}
  #np.on .art{opacity:1;scale:1;translate:0 0;filter:none;transition:scale 1s cubic-bezier(.17,.94,.28,1.06) .12s,translate 1s cubic-bezier(.17,.94,.28,1.06) .12s,opacity .55s ease .12s,filter .8s ease .12s,height .9s cubic-bezier(.2,.9,.25,1)}
  #np .art:active{scale:.97;transition:scale .15s ease}
  #np .art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .8s ease}
  #np .art img.show{opacity:1}
  #np .art.swap img.show{opacity:.72;filter:blur(1.6vh) saturate(1.15) brightness(.82);scale:1.06;transition:opacity .45s ease,filter .45s ease,scale .8s cubic-bezier(.2,.9,.25,1)}   /* the last picture, softly out of focus, until the next one arrives */
  #np .art.swap canvas.freeze.show{filter:blur(1.6vh) saturate(1.15) brightness(.82);scale:1.06;transition:opacity .3s ease,filter .45s ease,scale .8s cubic-bezier(.2,.9,.25,1)}   /* (a video: its last frame) */
  #np .art img.show{filter:none;scale:1}
  #np .art::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
       box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),inset 0 .25vh .5vh rgba(255,255,255,.16),inset 0 -.3vh .8vh rgba(0,0,0,.12)}
  #np .art.paused{scale:.9;transition:scale .6s cubic-bezier(.2,.9,.25,1)}
  #np{transition:visibility 0s linear .9s,top .9s cubic-bezier(.2,.9,.25,1),width .9s cubic-bezier(.2,.9,.25,1),translate .9s cubic-bezier(.2,.9,.25,1)}
  #np.on{transition:top .9s cubic-bezier(.2,.9,.25,1),width .9s cubic-bezier(.2,.9,.25,1),translate .9s cubic-bezier(.2,.9,.25,1)}
  #np{width:var(--w)}
  #np.solo{top:50%;--w:min(52vh,80vw);translate:-50% -58%}
  #np.video{--w:calc(min(78vh,90vw) * var(--vm,1));--h:calc(var(--w) * var(--var,.5625))}
  #np.video.solo{--w:calc(min(104vh,94vw) * var(--vm,1));translate:-50% -56%}
  #np.video .art iframe{inset:auto;left:50%;top:50%;translate:-50% -50%;width:calc(max(var(--w),calc(var(--h) * 1.7778)) * 1.04);height:auto;aspect-ratio:16/9;z-index:1;transition:scale 1.4s cubic-bezier(.3,.1,.25,1),opacity .5s ease,width .9s cubic-bezier(.2,.9,.25,1)}
  #np .art img{transition:opacity .8s ease,scale .9s cubic-bezier(.2,.9,.25,1)}
  #np .art iframe{position:absolute;inset:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .9s ease;pointer-events:none}
  #np .art iframe.on{opacity:1}
  #np .art canvas.freeze{position:absolute;inset:0;width:100%;height:100%;z-index:2;opacity:0;pointer-events:none;filter:blur(.35vh) saturate(1.05);transition:opacity .35s ease}
  #np .art canvas.freeze.show{opacity:1;transition:opacity .12s ease}   /* the frame on screen, while YouTube shows its own marks (pause, play) */
  #np.video .art iframe.zoom{scale:1.22}                             /* YouTube's title bar and logo fall outside the card until they fade */
  #np .npt,#np .npa{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;filter:drop-shadow(0 .2vh .8vh rgba(0,0,0,.45));opacity:0;translate:0 1.2vh;
       transition:opacity .35s ease,translate .35s ease}
  #np .npt{pointer-events:auto;cursor:default;
       -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 var(--fl,0px),#000 calc(100% - var(--fr,0px)),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 var(--fl,0px),#000 calc(100% - var(--fr,0px)),transparent 100%)}
  #np .npt.long{text-overflow:clip;--fr:2.4vh}
  #np .npt.long.go{--fl:2.4vh}
  #np .npt span{display:inline-block}
  #np .npt.go span{animation:npScroll var(--dur,8s) linear .35s infinite}
  @keyframes npScroll{0%,8%{transform:translateX(0)}46%,54%{transform:translateX(calc(-1 * var(--over)))}92%,100%{transform:translateX(0)}}
  #np .npt{margin-top:2.6vh;font:700 2.7vh/1.2 "SF Pro Display","Shadow SF Display","Segoe UI Variable Display","Segoe UI",sans-serif;letter-spacing:-.015em;color:#fff}
  #np .npa{margin-top:.6vh;font:500 2vh/1.2 "SF Pro Text","Shadow SF","Segoe UI Variable Text","Segoe UI",sans-serif;color:rgba(255,255,255,.74)}
  #np.on .npt{opacity:1;translate:0 0;transition:opacity .6s ease .45s,translate .8s cubic-bezier(.17,.94,.28,1) .45s}
  #np.on .npa{opacity:1;translate:0 0;transition:opacity .6s ease .55s,translate .8s cubic-bezier(.17,.94,.28,1) .55s}
  `;
  document.head.appendChild(css);
  const lyrBox = document.createElement('div'); lyrBox.id = 'lyr'; document.body.appendChild(lyrBox);
  const np = document.createElement('div'); np.id = 'np';
  np.innerHTML = '<div class="art"><img alt=""><img alt=""></div><div class="npt"></div><div class="npa"></div>'; document.body.appendChild(np);
  const artBox = np.querySelector('.art'), imgs = [...np.querySelectorAll('img')], npTiBox = np.querySelector('.npt'), npAr = np.querySelector('.npa');
  npTiBox.innerHTML = '<span></span>';
  const npTi = { get textContent() { return npTiBox.firstChild.textContent; }, set textContent(v) { npTiBox.firstChild.textContent = v; npTiBox.classList.remove('go'); requestAnimationFrame(fitTitle); } };
  function fitTitle() {                                                  // a name too long for the line: ends softly, and scrolls on hover
    const sp = npTiBox.firstChild, over = sp.offsetWidth - npTiBox.clientWidth;
    npTiBox.classList.toggle('long', over > 2);
    npTiBox.style.setProperty('--over', Math.max(0, over + 12) + 'px'); npTiBox.style.setProperty('--dur', (3 + over / 40).toFixed(1) + 's');
  }
  npTiBox.addEventListener('mouseenter', () => { if (npTiBox.classList.contains('long')) npTiBox.classList.add('go'); });
  npTiBox.addEventListener('mouseleave', () => npTiBox.classList.remove('go'));
  npTiBox.addEventListener('mousedown', e => e.stopPropagation());

  // the column sits under the clock, left-aligned with its first digit
  let placed = '';
  function place() {
    const W = innerWidth, H = innerHeight;
    const bottom = H - Math.max(.13 * H, 84);                         // stop above the dock
    if (musicMode) {
      const r = np.getBoundingClientRect(), top = Math.max(r.bottom + .035 * H, .5 * H), w = Math.min(.66 * W, 1.25 * H);
      const k = 'm:' + Math.round(top) + ':' + Math.round(w); if (k === placed) return; placed = k;
      lyrBox.classList.add('center');
      Object.assign(lyrBox.style, { left: (W - w) / 2 + 'px', width: w + 'px', top: top + 'px', height: Math.max(.16 * H, bottom - top) + 'px' });
      layout(); return;
    }
    lyrBox.classList.remove('center');
    let w = .52 * W, x = (W - w) / 2;
    try {                                                              // the clock's real digits (its canvas works in device pixels)
      const t = performance.now(), d = devicePixelRatio || 1, ss = [...slots.values()];
      if (ss.length && Array.isArray(box)) {
        const l = Math.min(...ss.map(s => lerpX(s, t))), r = Math.max(...ss.map(s => lerpX(s, t) + s.w));
        x = (box[0] + l) / d + .006 * H; w = Math.max(.3 * W, (r - l) / d);
      }
    } catch (_) {}
    const k = Math.round(x) + ':' + Math.round(w); if (k === placed) return; placed = k;
    Object.assign(lyrBox.style, { left: x + 'px', width: w + 'px', top: .6 * H + 'px', height: Math.max(.18 * H, bottom - .6 * H) + 'px' });
    layout();
  }
  addEventListener('resize', () => { placed = ''; place(); });

  /* -------------------------------------------------------------- lyrics -------------------------------------------------------------- */
  const clean = t => (t || '')
    .replace(/\s*[\(\[【](?:[^\)\]】]*?(?:official|video|audio|lyric|visuali[sz]er|music video|m\/v|\bmv\b|\bhd\b|\b4k\b|remaster|full song|explicit|clean)[^\)\]】]*)[\)\]】]/gi, '')
    .replace(/\s+(?:ft\.?|feat\.?|featuring)\s+.*$/i, '').replace(/\s*\|\s*.*$/, '').replace(/\s+/g, ' ').trim();
  const cleanArtist = a => (a || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').replace(/\s*(official|music)$/i, '').split(/\s*(?:,|&| x | feat\.? | ft\.? )\s*/i)[0].trim();
  function parseLRC(s) {
    const out = [];
    for (const row of (s || '').split(/\r?\n/)) {
      const tags = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]; if (!tags.length) continue;
      const text = row.replace(/\[[^\]]*\]/g, '').trim();
      for (const m of tags) out.push({ t: +m[1] * 60 + +m[2], text });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  const mem = new Map(), inflight = new Map();
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('lyr:') || k.startsWith('lyr3:')) localStorage.removeItem(k); } catch (_) {}   // drop the old, looser matches
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  async function getJ(u) { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; }
  const searches = new Map();                                            // query -> YouTube Music's answer (one search per track)
  function ytmSearch(q, videos) {                                       // videos: YouTube Music's "Videos" filter (official videos first)
    if (!q || !window.__shadowYtm) return Promise.resolve(null);
    const key = (videos ? 'v|' : '') + q, hit = searches.get(key); if (hit && Date.now() - hit.at < 10 * 60e3) return hit.p;
    const p = (videos && L && LIVE ? getJ(`${evBase}/ytm?${new URLSearchParams({ q, f: 'v', t: L.token })}`) : window.__shadowYtm.search(q)).catch(() => null);
    searches.set(key, { p, at: Date.now() });
    if (searches.size > 40) searches.delete(searches.keys().next().value);
    return p;
  }
  function songOf(m) {                                               // "BLACKPINK - 'Shut Down' M/V" -> artist BLACKPINK, title Shut Down
    let title = clean(m.title), artist = cleanArtist(m.artist);
    const dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (dash && (!artist || dash[1].toLowerCase().includes(artist.toLowerCase()) || artist.toLowerCase().includes(dash[1].toLowerCase()) || /topic|vevo|official|music|records|entertainment/i.test(m.artist || ''))) { artist = cleanArtist(dash[1]); title = clean(dash[2]); }
    title = title.replace(/^['"‘“]+|['"’”]+$/g, '').replace(/\s+(?:m\/?v|mv)$/i, '').trim();
    return { title, artist };
  }
  async function findLyrics(m) {
    let { title, artist } = songOf(m);
    const tol = m.tight ? 1.5 : 3;                                       // a video: only lyrics timed to this very length
    const key = 'lyr4:' + (artist + '|' + title).toLowerCase() + (m.tight ? ':v' : '');   // v4: the agreed timing (older entries ignored)
    const dur = m.dur > 1 ? m.dur : 0;
    const cached = mem.get(key) || store.get(key);
    if (cached && (!dur || !cached.dur || Math.abs(cached.dur - dur) <= tol)) { mem.set(key, cached); return cached; }   // a different-length version: look again
    // the right song: same title, same artist, and (when we know it) within 3 s of the same length
    const nm = v => (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const nt = nm(title), na = nm(artist);
    const same = (p, q) => !!p && !!q && (p === q || p.includes(q) || q.includes(p));
    const ok = x => x && x.syncedLyrics && !x.instrumental && (!dur || (m.tight && !x.duration ? false : !x.duration || Math.abs(x.duration - dur) <= tol))
      && same(nm(clean(x.trackName)), nt) && (!na || same(nm(x.artistName), na) || (dur && x.duration && nm(clean(x.trackName)) === nt && nm(x.artistName).split(' ').some(w => w.length > 3 && na.split(' ').includes(w))));
    const best = arr => (arr || []).filter(ok).sort((a, b) => Math.abs((a.duration || dur) - dur) - Math.abs((b.duration || dur) - dur))[0];
    // one song often has many uploads of the same length but timed to different versions (album audio vs. the video's longer intro):
    // the timing most of them agree on wins; the closest length only breaks ties
    const sig = x => { try { return parseLRC(x.syncedLyrics).filter(l => l.text).slice(0, 10).map(l => l.t); } catch (_) { return []; } };
    const agree = (a, b) => { const n = Math.min(a.length, b.length); if (n < 4) return false; let k = 0; for (let i = 0; i < n; i++) if (Math.abs(a[i] - b[i]) < 1) k++; return k >= n * .7; };
    const pick = arr => {
      const c = []; for (const x of arr || []) if (ok(x) && !c.some(q => q.id === x.id)) c.push(x);
      if (c.length < 3) return best(c);
      const S = c.map(sig); let bi = 0, bs = -1e9;
      c.forEach((x, i) => { const sc = S.filter((q, j) => j !== i && agree(S[i], q)).length * 10 - Math.abs((x.duration || dur) - dur); if (sc > bs) { bs = sc; bi = i; } });
      return c[bi];
    };
    if (inflight.has(key)) { const h0 = await inflight.get(key); const r0 = h0 ? { lines: parseLRC(h0.syncedLyrics), dur: h0.duration || 0 } : { lines: null, dur }; mem.set(key, r0); return r0; }
    const job = (async () => {
      const qs = new URLSearchParams({ track_name: title, artist_name: artist }); if (dur) qs.set('duration', Math.round(dur));
      const [x, y] = await Promise.all([                                 // both at once: whichever has synced lyrics
        getJ('https://lrclib.net/api/get?' + qs).catch(() => null),
        getJ('https://lrclib.net/api/search?' + new URLSearchParams({ track_name: title, artist_name: artist })).catch(() => null)]);
      let h = pick([x].concat(Array.isArray(y) ? y : []));
      if (!h) try { h = pick(await getJ('https://lrclib.net/api/search?' + new URLSearchParams({ q: `${title} ${artist}`.trim() }))); } catch (_) {}
      return h;
    })();
    inflight.set(key, job.then(h => { inflight.delete(key); return h; }));
    let hit = await job;
    const res = hit ? { lines: parseLRC(hit.syncedLyrics), dur: hit.duration || 0 } : { lines: null, dur };
    mem.set(key, res);
    if (hit) { store.set(key, res); try { const ks = store.get('lyr4:index') || []; ks.push(key); while (ks.length > 60) localStorage.removeItem(ks.shift()); store.set('lyr4:index', ks); } catch (_) {} }
    return res;
  }

  /* -------------------------------------------------------------- state -------------------------------------------------------------- */
  let song = null, lines = null, els = [], ys = [], cur = -2, dots = null, gap = null, media = null, pausedAt = 0;
  function build() {
    lyrBox.innerHTML = ''; els = []; cur = -2;
    if (!lines) return;
    for (const ln of lines) {
      if (!ln.text) { els.push(null); continue; }
      const d = document.createElement('div'); d.className = 'l';
      const words = ln.text.split(/(\s+)/); let total = 0; ln.words = [];
      for (const w of words) { if (!w) continue; const sp = document.createElement('span'); sp.className = 'w'; sp.textContent = w; d.appendChild(sp); if (/\S/.test(w)) { ln.words.push({ sp, a: total, b: total + w.length }); } total += w.length; }
      ln.chars = Math.max(1, total);
      lyrBox.appendChild(d); els.push(d);
    }
    dots = document.createElement('div'); dots.className = 'dots'; dots.innerHTML = '<i></i><i></i><i></i>'; lyrBox.appendChild(dots);
    layout();
  }
  function layout() {                                                    // each line's resting height, measured once
    if (!els.length) return;
    let y = 0; ys = [];
    const gapPx = .024 * innerHeight;
    els.forEach(e => { ys.push(y); if (e) y += e.offsetHeight + gapPx; });
    cur = -2; tick(true);
  }
  // where we are in the song right now
  let changeAt = 0, litK = -9, inBreak = false;
  function now() {
    if (!media) return 0;
    if (changeAt && Date.now() - changeAt < 4000 && media.upd < changeAt - 250 && media.pos > 3 && media.status === 'Playing')
      return Math.max(0, (Date.now() - changeAt) / 1000);              // the first moment of a new song, before the player reports its position
    let t = media.pos; if (media.status === 'Playing') t += (Date.now() - media.upd) / 1000;
    return Math.max(0, Math.min(t, media.dur || t));
  }
  function activeAt(t) { let lo = 0, hi = lines.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (lines[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k; }
  function tick(force) {
    if (!lines || !els.length) return;
    const t = now() + LEAD;
    let k = activeAt(t);
    // instrumental break: before the first line, on an empty line, or a long wait for the next one
    let nextK = k + 1; while (nextK < lines.length && !lines[nextK].text) nextK++;
    const nextT = nextK < lines.length ? lines[nextK].t : Infinity, prevT = k >= 0 ? lines[k].t : 0;
    const onEmpty = k < 0 || !lines[k].text;
    let lastK = k; while (lastK >= 0 && !lines[lastK].text) lastK--;       // the last line with words
    const lastT = lastK >= 0 ? lines[lastK].t : 0, sungTill = lastK >= 0 ? lastT + Math.max(3, (lines[lastK].chars || lines[lastK].text.length) * .1 + 1.2) : 0;
    const breakNow = onEmpty && nextT < Infinity && t < nextT
      && (lastK < 0 ? nextT > 4 : nextT - lastT > 9 && t > sungTill);     // a real instrumental gap, after the last line has been sung
    if (onEmpty && !breakNow && lastK >= 0) k = lastK;                   // an empty marker mid-verse: the last line stays lit until the next
    const anchorK = breakNow ? nextK : (k < 0 || !lines[k].text ? Math.max(0, nextK) : k);
    if (anchorK !== cur || k !== litK || breakNow !== inBreak || force) {
      cur = anchorK; litK = k; inBreak = breakNow;
      const anchorY = (musicMode ? .26 : .2) * lyrBox.clientHeight, top = (ys[cur] || 0);
      const dotsH = breakNow ? dots.offsetHeight + .024 * innerHeight : 0;
      els.forEach((e, i) => {
        if (!e) return;
        const dy = anchorY - top + ys[i] + (i >= cur ? dotsH : 0);
        e.style.transitionDelay = i > cur ? Math.min(6, i - cur) * 45 + 'ms' : '0ms';                // the ripple: lines below follow a beat later
        e.style.transform = `translateY(${dy}px)`;
        e.className = 'l' + (i === k && !breakNow ? ' cur' : i < cur ? ' past' : '');
        e.style.setProperty('--b', i === k && !breakNow ? '0px' : Math.min(.42, .09 + .09 * Math.abs(i - cur)).toFixed(2) + 'vh');
      });
      dots.style.transform = `translateY(${anchorY}px)`;
      if (breakNow) { dots.classList.remove('end'); dots.classList.add('on'); gap = { from: Math.max(prevT, k < 0 ? 0 : prevT), to: nextT }; }
      else if (dots.classList.contains('on')) { dots.classList.add('end'); dots.classList.remove('on'); gap = null; }
    }
    if (k >= 0 && lines[k].words && !breakNow) {
      const ln = lines[k], end = Math.min(nextT, ln.t + Math.max(1.6, ln.chars * .085));   // a long held note doesn't drag the fill out
      const pr = Math.max(0, Math.min(1, (t - ln.t) / Math.max(.3, end - ln.t))) * ln.chars;
      for (const w of ln.words) { const f = Math.max(0, Math.min(1, (pr - w.a) / Math.max(1, w.b - w.a))); if (w.f !== f) { w.f = f; w.sp.style.setProperty('--f', f.toFixed(3)); } }
    }
    if (gap) {                                                           // the dots light up one by one across the break
      const f = Math.max(0, Math.min(1, (t - gap.from) / Math.max(.1, gap.to - gap.from)));
      [...dots.children].forEach((d, i) => { d.style.opacity = (.3 + .7 * Math.max(0, Math.min(1, f * 3 - i))).toFixed(3); });
    }
  }

  /* ------------------------------------------------------------ up next ------------------------------------------------------------ */
  // YouTube Music's queue for what's playing (its radio, or the rest of a playlist): the next songs' covers and lyrics load early
  const evBase = base.replace(/:(\d+)$/, (q, p) => ':' + (+p + 1));
  const qn = v => (v || '').toLowerCase().replace(/\s*[\(\[].*?[\)\]]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  let queue = [], queueFor = '';
  const queueArt = new Map(), queueVid = new Map(), pairOf = new Map();  // song -> sharp cover / its video id; a song <-> its video
  const ugcIds = new Set();                                              // uploads that aren't official (live performances, fan videos)
  const isLive = t => /\blive\b|performance|concert|\bstage\b|fancam|\btour\b|festival|coachella|unplugged|session|music bank|inkigayo|countdown|music core|the show|kcon|\bmama\b|grammy|\bvmas?\b|라이브|직캠|무대/i.test(t || '');
  async function seedQueue(v, list) {
    if (!v || !L || !LIVE || queueFor === v + '|' + (list || '')) return; queueFor = v + '|' + (list || '');
    try {
      const j = await getJ(`${evBase}/ytnext?${new URLSearchParams({ v, list: list || '', t: L.token })}`); if (!j) return;
      const out = [], other = new Set();                                 // other = the other version listed beside a track (not what plays)
      (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; }
        for (const k in o) {
          if (k === 'playlistPanelVideoWrapperRenderer') {
            const a = o[k].primaryRenderer?.playlistPanelVideoRenderer, b = o[k].counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer;
            if (a?.videoId && b?.videoId) { pairOf.set(a.videoId, b.videoId); pairOf.set(b.videoId, a.videoId); other.add(b); }
          }
          if (k === 'playlistPanelVideoRenderer') out.push(o[k]); else walk(o[k]);
        } })(j.contents);
      queue = out.map(x => {
        const runs = r => (r?.runs || []).map(q => q.text).join(''), th = x.thumbnail?.thumbnails || [];
        const len = (runs(x.lengthText).match(/(\d+):(\d+)/) || []), by = (x.longBylineText?.runs || [])[0]?.text || '';
        const type = x.navigationEndpoint?.watchEndpoint?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType || '';
        if (type === 'MUSIC_VIDEO_TYPE_UGC') ugcIds.add(x.videoId);
        return { v: x.videoId, title: runs(x.title), artist: by, dur: len.length ? +len[1] * 60 + +len[2] : 0, art: th.length ? th[th.length - 1].url : '', song: type === 'MUSIC_VIDEO_TYPE_ATV', other: other.has(x) };
      }).filter(x => x.v && x.title);
      queue.forEach(x => { const k = qn(x.title); if (x.art && x.song) queueArt.set(k, bigArt(x.art));   /* only songs' covers: a video's picture is not a cover */ if (x.song) songIds.add(x.v); else if (!x.other) queueVid.set(k, x.v); });
    } catch (_) {}
  }
  function preloadAfter(title) {                                         // the next two: lyrics fetched, covers in the browser's cache
    const i = queue.findIndex(x => qn(x.title) === qn(title)); if (i < 0) return false;
    const next = queue.slice(i + 1).filter(x => !x.other && qn(x.title) !== qn(title)).slice(0, 2);
    for (const x of next) {
      findLyrics({ title: x.title, artist: x.artist, dur: x.dur }).catch(() => {});
      if (x.song) fetchYtl(x.v);                                          // YouTube Music's synced lyrics, ready before it starts
      if (x.art) { const im = new Image(); im.src = bigArt(x.art); }
    }
    // the next video loads early, paused out of sight (when YouTube Music gets there it just plays): an up-next video, or the next song's own video while videos play
    const nx = next[0], wv = nx && (!nx.song ? nx.v : np.classList.contains('video') ? pairOf.get(nx.v) : null);
    if (wv) setTimeout(() => { if (musicMode && media && qn(media.title) === qn(title)) warmUp(wv); }, 2500);
    return true;
  }
  async function followQueue(m) {                                        // on every song change
    if (preloadAfter(m.title)) return;
    const api = window.__shadowYtm, so = songOf(m); if (!api) return;
    try {                                                                // not in the queue we know: find this song, take its queue
      const j = await ytmSearch(`${so.title} ${so.artist}`.trim()); const items = j ? api.parse(j) : [];
      const it = items.find(x => x.v && qn(x.title) === qn(so.title)) || items.find(x => x.v);
      if (it) { await seedQueue(it.v, ''); preloadAfter(m.title); }
    } catch (_) {}
  }

  /* -------------------------------------------------- YouTube Music's own lyrics -------------------------------------------------- */
  // For YouTube Music the lyrics come from YouTube Music itself, timed to the exact track playing (a song and its video differ by
  // seconds); LRCLIB stays for everything else and for tracks YouTube Music has no synced lyrics for.
  const YTM_APP = /_crx_cinhi|youtube ?music/i, ytl = new Map();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function ytmTrackId(m, asSong) {
    let shape = asSong ? { aspect: 1 } : curThumb;                       // Windows' picture tells a song (square) from a video (wide)
    for (let i = 0; i < 8 && !shape && m.art && L; i++) { shape = await fingerprint(`${base}/mediaart?t=${L.token}&k=${encodeURIComponent(m.artist + '|' + m.title)}&n=${Date.now()}-${i}`); if (!shape) await sleep(400); }
    const t = qn(m.title), picked = lastPick && lastPick.t === t ? lastPick.v : null;
    if (shape ? shape.aspect > 1.25 : picked && !songIds.has(picked)) return { id: null, video: true };   // a video: no lyrics needed
    const out = [], add = v => { if (v && !out.includes(v)) out.push(v); };
    if (lastPick && lastPick.t === t) add(songIds.has(lastPick.v) ? lastPick.v : pairOf.get(lastPick.v));
    for (const x of queue) if (x.song && qn(x.title) === t) add(x.v);
    if (!out.length) try {
      const so = songOf(m), j = await ytmSearch(`${so.title} ${so.artist}`.trim()), items = j ? window.__shadowYtm.parse(j) : [];
      items.filter(x => x.v && x.kind === 'Song' && (qn(x.title) === t || qn(x.title).includes(qn(so.title)))).forEach(x => { songIds.add(x.v); add(x.v); });
    } catch (_) {}
    return out[0] ? { id: out[0], video: false } : null;
  }
  const PLAYER_APP = /_crx_cinhi|youtube ?music|spotify|applemusic|apple music|tidal|deezer|amazon ?music|soundcloud/i;
  async function ytmLyrics(m, asSong) {
    if (!L || !LIVE || !YTM_APP.test(m.app || '')) return { lines: null, video: !PLAYER_APP.test(m.app || '') };   // a browser: a video (lyrics only tell it's music)
    const tr = await ytmTrackId(m, asSong); if (!tr) return null;
    if (tr.video) return { lines: null, video: true, noFallback: true };   // music videos and live performances: the video alone
    return (await fetchYtl(tr.id)) || { lines: null, video: false };
  }
  const ytlInflight = new Map();
  function fetchYtl(id) {
    if (!id || !L || !LIVE) return Promise.resolve(null);
    if (ytl.has(id)) return Promise.resolve(ytl.get(id));
    const cached = store.get('ytl1:' + id); if (cached) { ytl.set(id, cached); return Promise.resolve(cached); }
    if (ytlInflight.has(id)) return ytlInflight.get(id);
    const p = fetchYtl1(id).finally(() => ytlInflight.delete(id)); ytlInflight.set(id, p); return p;
  }
  async function fetchYtl1(id) {
    let res = null;
    try {
      const j = await getJ(`${evBase}/ytlyrics?${new URLSearchParams({ v: id, t: L.token })}`);
      const out = [];
      (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; }
        if (typeof o.lyricLine === 'string' && o.cueRange) { out.push({ t: +o.cueRange.startTimeMilliseconds / 1000, text: o.lyricLine.replace(/^\s*♪\s*$/, '').trim() }); return; }
        for (const k in o) walk(o[k]); })(j);
      out.sort((a, b) => a.t - b.t);
      if (out.some(x => x.text)) res = { lines: out, dur: 0, src: 'ytm:' + id };
    } catch (_) { return null; }
    ytl.set(id, res); if (res) store.set('ytl1:' + id, res);
    return res;
  }

  /* ------------------------------------------------------------ videos ------------------------------------------------------------ */
  // Music videos and live performances play (muted) in the middle, kept in step with the real player
  let vid = null, lastPick = null, curThumb = null, gaveUp = false;       // { el, id, ready } / what you picked / Windows' picture of what plays
  const badVids = new Set(), songIds = new Set();                        // videos that won't embed / ids that are songs (their "video" is a still)
  const vlog = window.__vlog = [], V = (...a) => { vlog.push(((performance.now() / 1000) | 0) + 's ' + a.join(' ')); if (vlog.length > 80) vlog.shift(); };   // what the video did (for debugging)
  window.__vstate = () => ({ vid: vid && { id: vid.id, ready: vid.ready, playing: !!vid.playing }, gaveUp, vidTries, videoCover, lastPick, lyrSrc, cls: np.className, bad: [...badVids], songs: songIds.size, music: musicMode });
  let spare = null;                                                      // the last player, paused and hidden, ready for the next video
  function stopVideo(keep) {
    hideFreeze(); wasPlaying = null; liveAmbAt = 0;                      // the screen's live colours stop with the video: the next cover colours the stripes
    if (!vid) return; V('stop', vid.id, keep ? '(kept)' : '');
    if (keep && vid.ready && !vid.failed) {
      if (spare && spare !== vid.el) spare.remove();
      spare = vid.el; spare.classList.remove('on'); try { spare.contentWindow.postMessage({ cmd: 'sync', pos: 0, playing: false }, '*'); } catch (_) {}
    } else vid.el.remove();
    vid = null;
  }
  function dropSpare() { if (spare) { spare.remove(); spare = null; } }
  // keep trying while a video should be playing (a missed start, or coming back from the clock)
  setInterval(() => { if (musicMode && shot && shot.video && !want && np.classList.contains('video') && !vid && !gaveUp && media && media.title && vidTries < 3) startVideo(media); }, 2500);   // (only once this track is decided)
  function giveUpVideo() { V('give up', 'cover?', !!videoCover);                                               // no video will play here: the song's cover (sharp, 1000 px)
    gaveUp = true; stopVideo(true); const gen = coverGen, m = media;
    const toCover = u => { if (gen !== coverGen || !u) return false; np.classList.remove('video'); document.body.classList.remove('npvideo'); showArt(u); return true; };
    if (toCover(videoCover)) return;
    if (m) artCandidates(m).then(list => { if (!toCover(list[0]) && gen === coverGen && m.art && L) showArt(`${base}/mediaart?t=${L.token}&k=${encodeURIComponent((m.artist + '|' + m.title).toLowerCase())}&n=${Date.now()}`); }).catch(() => {});
  }
  // which video is playing: the candidates' pictures against Windows' picture of what plays (YouTube Music can switch a song to its video)
  const fpCache = new Map();
  // more places a track's video can be: the song's own video (YouTube Music pairs them: "Song | Video"), and a search for the official video
  async function moreVideos(m, so) {
    const out = [], t = qn(so.title);
    try {
      const j = await ytmSearch(`${so.title} ${so.artist}`.trim()), items = j ? window.__shadowYtm.parse(j) : [];
      const songs = items.filter(x => x.v && x.kind === 'Song' && qn(x.title) === t).slice(0, 2);
      await Promise.all(songs.map(async x => {
        if (!pairOf.has(x.v)) {
          const n = await getJ(`${evBase}/ytnext?${new URLSearchParams({ v: x.v, list: '', t: L.token })}`).catch(() => null);
          (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; }
            const w = o.playlistPanelVideoWrapperRenderer;
            if (w) { const a = w.primaryRenderer?.playlistPanelVideoRenderer?.videoId, b = w.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer?.videoId; if (a && b) { pairOf.set(a, b); pairOf.set(b, a); } }
            for (const k in o) walk(o[k]); })(n && n.contents);
        }
        if (pairOf.has(x.v)) out.push(pairOf.get(x.v));
      }));
      const j2 = await ytmSearch(`${so.title} ${so.artist} official video`.trim()), items2 = j2 ? window.__shadowYtm.parse(j2) : [];
      const art2 = (so.artist || '').toLowerCase().split(/[,&]| x | feat/)[0].trim();
      items2.filter(x => x.v && x.kind !== 'Song' && qn(x.title).includes(t) && (/lyric/i.test(m.title || '') || (art2 && (x.sub || '').toLowerCase().includes(art2)) || !/lyric/i.test((x.title || '') + ' ' + (x.sub || '')))).slice(0, 4).forEach(x => out.push(x.v));
    } catch (_) {}
    V('more', out.join(','));
    return out;
  }
  const urlSeen = { key: '', n: 0 }, vidOwner = new Map();               // video id -> the track it was seen with first
  function urlVid(m) {
    if (!media || !media.vid || songIds.has(media.vid)) return null;                       // (YouTube Music's address, or a browser tab's)
    const id = (m.artist + '|' + m.title).toLowerCase();
    if (vidOwner.has(media.vid) && vidOwner.get(media.vid) !== id) return null;   // (a stale address: the last track's video)
    return (media.artist + '|' + media.title).toLowerCase() === id && urlSeen.key === id + '|' + media.vid && urlSeen.n >= 3 ? media.vid : null;
  }
  window.__urlVid = () => ({ vid: media && media.vid, seen: urlSeen });
  async function videoCandidates(m) {
    for (let i = 0; i < 12 && !urlVid(m) && media && media.vid; i++) await sleep(150);   // (the address settles in a moment)
    const uv = urlVid(m);
    if (uv) { V('youtube music plays', uv); const o = [uv]; o.sure = true; o.exact = new Set([uv]); return o; }
    const so = songOf(m), key = qn(so.title), out = [], exact = new Set();
    const add = (v, sure) => { if (v && !badVids.has(v) && !songIds.has(v)) { if (!out.includes(v)) out.push(v); if (sure) exact.add(v); } };
    if (lastPick && lastPick.t === qn(m.title)) add(songIds.has(lastPick.v) ? pairOf.get(lastPick.v) : lastPick.v, true);   // what you picked, or its video
    for (const x of queue) if (x.song && qn(x.title) === qn(m.title) && pairOf.has(x.v)) add(pairOf.get(x.v), true);   // the video YouTube Music pairs with this song (what its Video switch plays)
    add(queueVid.get(qn(m.title)), true);                                // YouTube Music's own up-next
    if (exact.size && !curThumb) { out.exact = exact; out.sure = true; return out; }   // no picture yet: start with it (checked when the picture comes)
    try {
      const j = await ytmSearch(`${so.title} ${so.artist}`.trim(), true); const items = j ? window.__shadowYtm.parse(j) : [];
      const lenOf = x => { const q = (x.sub || '').match(/(\d+):(\d+)\s*$/); return q ? +q[1] * 60 + +q[2] : 0; };
      items.filter(x => x.v && x.kind === 'Song').forEach(x => songIds.add(x.v));
      const art = (so.artist || '').toLowerCase().split(/[,&]| x | feat/)[0].trim(), own = x => art && (x.sub || '').toLowerCase().includes(art) ? 1 : 0;
      const lyricOk = /lyric/i.test(m.title || ''), notLyric = x => lyricOk || own(x) || !/lyric/i.test((x.title || '') + ' ' + (x.sub || ''));
      const vids = items.filter(x => x.v && x.kind !== 'Song' && qn(x.title).includes(key) && notLyric(x));
      const omv = x => x.mvt === 'MUSIC_VIDEO_TYPE_OMV' ? 1 : 0;
      const views = x => { const q = (x.sub || '').match(/([\d.]+)\s*([KMB]?)\s*views/i); return q ? +q[1] * ({ K: 1e3, M: 1e6, B: 1e9 }[q[2].toUpperCase()] || 1) : 0; };
      // official videos first, then the artist's own uploads, then the most watched. Not by length: a lyric video has the song's exact length,
      // so "closest length" picked lyric videos over the real one (two uploads can both be marked official)
      vids.sort((a, b) => omv(b) - omv(a) || own(b) - own(a) || views(b) - views(a)).slice(0, 5).forEach(x => add(x.v));
      // the upload named exactly as shown ("Miracles (Official Music Video)"): searched as it is, put first
      const rawT = (m.title || '').trim();
      if (/[\(\[]/.test(rawT)) {
        const j3 = await ytmSearch(`${rawT} ${so.artist}`.trim(), true), items3 = j3 ? window.__shadowYtm.parse(j3) : [];
        items3.filter(x => x.v && x.kind !== 'Song' && (x.title || '').trim().toLowerCase() === rawT.toLowerCase()).slice(0, 2).reverse().forEach(x => { if (!badVids.has(x.v) && !songIds.has(x.v)) { const i = out.indexOf(x.v); if (i >= 0) out.splice(i, 1); out.unshift(x.v); } });
      }
      // and the video YouTube Music pairs with this song, ahead of the search
      const songs = items.filter(x => x.v && x.kind === 'Song' && qn(x.title) === key).slice(0, 1);
      for (const x of songs) {
        if (!pairOf.has(x.v)) { const n = await getJ(`${evBase}/ytnext?${new URLSearchParams({ v: x.v, list: '', t: L.token })}`).catch(() => null);
          (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; }
            const w = o.playlistPanelVideoWrapperRenderer;
            if (w) { const a = w.primaryRenderer?.playlistPanelVideoRenderer?.videoId, b = w.counterpart?.[0]?.counterpartRenderer?.playlistPanelVideoRenderer?.videoId; if (a && b) { pairOf.set(a, b); pairOf.set(b, a); } }
            for (const k in o) walk(o[k]); })(n && n.contents); }
        if (pairOf.has(x.v)) { const pv = pairOf.get(x.v); if (pv && !badVids.has(pv) && !out.includes(pv)) out.unshift(pv); }
      }
    } catch (_) {}
    out.exact = exact; if (!out.length || !curThumb) { out.sure = false; return out; }   // a search result is never played unchecked   // (one candidate is checked against the picture too)
    const ZOOMS = [1, 1.15, 1.3, 1.45];                                 // (Windows' picture of a video can be its thumbnail zoomed in)
    const score = v => fpCache.has(v) ? Promise.resolve(fpCache.get(v)) : fingerprint(`https://i.ytimg.com/vi/${v}/mqdefault.jpg`, ZOOMS).then(fp => { fpCache.set(v, fp); return fp; });
    const best = fps => fps ? Math.min(...fps.map(f => fpDiff(f, curThumb))) : 999;
    let d = await Promise.all(out.map(v => score(v).then(best)));
    if (Math.min(...d) >= 32) {                                          // none matches clearly: look further
      const more = await moreVideos(m, so);
      for (const v of more) if (!out.includes(v) && !badVids.has(v)) out.push(v);
      d = await Promise.all(out.map(v => score(v).then(best)));
    }
    const ranked = out.map((v, i) => [v, d[i]]).sort((a, b) => a[1] - b[1]); V('match', ranked.map(x => x[0] + ':' + Math.round(x[1])).join(' '));
    const res = ranked.map(x => x[0]); res.exact = exact;
    res.sure = ranked[0][1] < 32;                                        // the picture of what plays decides, even over a remembered pick (right ones score ~20-45)
    // YouTube Music's own pairing (a song's video: what its Video switch plays) is trusted unless its picture clearly disagrees:
    // the 8 x 8 picture check alone scored the real "UP!" video 49 while lyric uploads have scored 54
    const isPair = v => pairOf.has(v), bp = !res.sure && ranked.find(([v, dd]) => isPair(v) && dd < 42);
    if (bp) { res.splice(res.indexOf(bp[0]), 1); res.unshift(bp[0]); res.sure = true; V('paired video', bp[0], Math.round(bp[1])); }
    if (!res.sure && exact.size) { const e = res.find(v => exact.has(v)); res.splice(res.indexOf(e), 1); res.unshift(e); res.sure = true; }   // nothing matches the picture: the remembered one
    return res;
  }
  // the video for this track when it is known for sure without looking: what you picked (a video), or YouTube Music's up-next
  async function checkGuess(m) {                                       // the picture is here: was the early pick right?
    const g = vid, g0 = coverGen; if (!g || !g.guess) return; g.guess = false;
    const c = await videoCandidates(m); if (vid !== g || g0 !== coverGen) return;
    if (!c.sure) { V('guess wrong, no match'); giveUpVideo(); }
    else if (c[0] !== g.id) { V('guess wrong', g.id, '->', c[0]); stopVideo(true); startVideo(m); }
  }
  function videoAlone() {                                               // a video: no lyrics, the video big in the middle (with its controls)
    if (lines) { lines = null; build(); } lyrSrc = '';
    np.classList.add('solo'); document.body.classList.add('npsolo');
  }
  function knownVideo(m) {
    const t = qn(m.title); if (lastPick && lastPick.t === t && !songIds.has(lastPick.v)) return lastPick.v;
    if (queueVid.get(t)) return queueVid.get(t);
    if (lastWasVideo) { const sv = queue.find(x => x.song && qn(x.title) === t && pairOf.has(x.v)); if (sv) return pairOf.get(sv.v); }   // (checked against Windows' picture right after)
    return null;
  }
  // the next video in the queue, loaded and paused out of sight: when YouTube Music gets there, it is just un-paused
  let warm = null;
  function warmUp(v) {
    if (!v || !L || !LIVE || badVids.has(v) || (warm && warm.id === v) || (vid && vid.id === v)) return;
    dropWarm();
    const el = document.createElement('iframe'); el.allow = 'autoplay; encrypted-media';
    el.src = `${evBase}/embed?${new URLSearchParams({ v, s: 0, w: 1, t: L.token })}`;
    warm = { el, id: v, at: Date.now() }; artBox.appendChild(el); V('warm', v);
  }
  function dropWarm() { if (warm) { warm.el.remove(); warm = null; } }
  let vidTries = 0;
  let starting = false;                                                 // one start at a time (several at once raced each other: wrong videos flashed)
  async function startVideo(m) {
    if (!L || !LIVE || (vid && !vid.failed) || gaveUp || starting) return;
    starting = true; const g0 = coverGen;
    try { if (!knownVideo(m)) for (let i = 0; i < 3 && !curThumb; i++) await sleep(200); if (g0 === coverGen) await startVideo1(m, g0); } finally { starting = false; }
    if (g0 !== coverGen && musicMode && media && np.classList.contains('video') && !vid && !gaveUp) startVideo(media);   // the track changed meanwhile: this one now
  }
  async function startVideo1(m, g0 = coverGen) {
    if (!L || !LIVE || (vid && !vid.failed)) return;
    if (gaveUp) return;
    const guess = !curThumb;                                              // no picture yet: the likeliest one, checked when the picture comes
    const cands = await videoCandidates(m), v = cands.sure ? cands[0] : null; V('start', m.title, 'cands', cands.join(','), cands.sure ? 'sure' : 'not sure');
    if (g0 !== coverGen) { V('stale start dropped', m.title); return; }  // another track started while this one was being looked up
    if (!v && YTM_APP.test(m.app || '') && media && media.vid && shot && shot.video && Date.now() - shot.at < 8000) { V('waiting for the youtube music address'); return; }   // (it names the video in a moment)
    if (!v) { if (cands.length && !cands.sure) { giveUpVideo(); return; } if (++vidTries >= 3) giveUpVideo(); return; }   // no wrong video: the real picture instead
    if (!musicMode || gaveUp || (vid && vid.id === v)) return;
    if (!shapes.has(v)) { await Promise.race([videoShape(v), sleep(500)]); if (g0 !== coverGen || (vid && !vid.failed) || gaveUp) return; }   // its real shape first
    stopVideo();
    let el;
    if (warm && warm.id === v) {                                         // loaded early: take it over (no new load)
      el = warm.el; warm = null; vid = { el, id: v, ready: true, at: Date.now(), warm: true }; V('adopt', v); syncVideo();
    } else if (spare) {                                                  // the player from before: just a new video in it
      el = spare; spare = null; vid = { el, id: v, ready: true, at: Date.now(), reused: true }; V('reuse', v);
      el.contentWindow.postMessage({ cmd: 'load', v, pos: Math.max(0, now() + .6) }, '*');
    } else {
      el = document.createElement('iframe'); el.allow = 'autoplay; encrypted-media';
      el.src = `${evBase}/embed?${new URLSearchParams({ v, s: Math.max(0, now() + 1).toFixed(1), t: L.token })}`;
      vid = { el, id: v, ready: false, at: Date.now() }; artBox.appendChild(el);
    }
    const setShape = ar => { if (!ar) return; const cur = +np.style.getPropertyValue('--var') || .5625; if (Math.abs(cur - ar) < .015) return;
      np.style.setProperty('--var', ar.toFixed(4)); np.style.setProperty('--vm', Math.min(1, .5625 / ar).toFixed(4)); };
    if (shapes.has(v)) setShape(shapes.get(v)); else videoShape(v).then(ar => { if (vid && vid.id === v) setShape(ar || .5625); });   // (measured once: no resizing back and forth)
    hqGen = coverGen; shownFp = null; showArt(`https://i.ytimg.com/vi/${v}/maxresdefault.jpg`);   // the video's own sharp picture until it plays (not the song's square cover)
    const mine = vid; vid.guess = guess;
    if (guess && curThumb) setTimeout(() => checkGuess(m), 0);         // the picture came while this was being set up: check now
    setTimeout(function check() {                                        // never started playing: a fresh player
      if (!vid || vid !== mine || vid.playing || vid.failed) return; V('not playing yet', vid.id, media && media.status);   // (this video's own check: a reused player is a new video)
      if (!media || media.status !== 'Playing') { setTimeout(check, 3000); return; }
      if (!mine.kicked) { mine.kicked = true; try { mine.el.contentWindow.postMessage({ cmd: 'kick', pos: now() + .3, playing: true }, '*'); } catch (_) {} setTimeout(check, 5000); return; }   // a nudge first
      stopVideo(); if (++vidTries < 3 && media) startVideo(media); else giveUpVideo();   // then the same (best-matching) video in a fresh player
    }, 6000);
  }
  // The picture's real shape (many videos are filmed wider than 16:9 and come with black bars): measured on YouTube's own
  // stills from the start, middle and end, so the card can take that shape and the bars fall outside it.
  const shapes = new Map();
  function videoShape(v) {
    if (shapes.has(v)) return Promise.resolve(shapes.get(v));
    const one = n => new Promise(res => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const W = 160, H = 120, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
          x.drawImage(im, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data, lum = i => .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2];
          const rowLit = y => { for (let i = 2; i < W - 2; i++) if (lum((y * W + i) * 4) > 34) return true; return false; };
          let y0 = 0, y1 = H - 1; while (y0 < H && !rowLit(y0)) y0++; while (y1 > y0 && !rowLit(y1)) y1--;
          const colLit = xx => { for (let y = y0; y <= y1; y++) if (lum((y * W + xx) * 4) > 34) return true; return false; };
          let x0 = 0, x1 = W - 1; while (x0 < W && !colLit(x0)) x0++; while (x1 > x0 && !colLit(x1)) x1--;
          const w = x1 - x0 + 1, h = y1 - y0 + 1;
          res(h > 20 && w > 40 ? { w: w * 4 / 3 / W, h: h / H } : null);   // the still is 4:3; in units where its width is 4/3
        } catch (_) { res(null); }
      };
      im.onerror = () => res(null); im.src = `https://i.ytimg.com/vi/${v}/hq${n}.jpg`;
    });
    return Promise.all([one(1), one(2), one(3)]).then(r => {
      r = r.filter(Boolean); if (!r.length) return null;
      const w = Math.max(...r.map(q => q.w)), h = Math.max(...r.map(q => q.h));   // the widest / tallest lit area (a dark scene isn't a bar)
      const ar = Math.max(.38, Math.min(1.8, h / w)); const out = Math.abs(ar - .5625) < .03 ? .5625 : ar;   // any shape: wide films to upright phone videos
      shapes.set(v, out); return out;
    });
  }
  addEventListener('message', e => {
    const d = e.data || {}; if (d.t !== 'yt' || !vid || e.source !== vid.el.contentWindow) return;
    if (d.ev === 'drift') { (window.__drift = window.__drift || []).push(Math.round(d.d * 1000) + 'ms/lag' + d.lag); if (window.__drift.length > 20) window.__drift.shift(); return; }   // (for debugging)
    V('ev', d.ev, d.s ?? d.code ?? '', vid.id);
    if (d.ev === 'ready') { vid.ready = true; vidSeg = 0; lastFrame = -1; syncVideo(); videoGlow();
      const mine = vid; setTimeout(() => { if (vid === mine && !mine.playing && !mine.kicked && media && media.status === 'Playing' && musicMode) { mine.kicked = true; V('kick', mine.id); try { mine.el.contentWindow.postMessage({ cmd: 'kick', pos: now() + .3, playing: true }, '*'); } catch (_) {} } }, 2500); }   // YouTube sometimes sits unstarted: a nudge
    if (d.ev === 'state' && d.s === 1 && !vid.playing && blipNext && YTM_APP.test((media && media.app) || '')) {
      blipNext = false; const mine = vid;
      setTimeout(() => { if (vid !== mine || !media || media.status !== 'Playing' || !L) return; V('blip'); blipUntil = Date.now() + 1500;
        fetch(`${base}/ytblip?t=${L.token}`, { mode: 'no-cors' }).catch(() => {});
        setTimeout(() => { if (vid === mine) try { mine.el.contentWindow.postMessage({ cmd: 'fresh' }, '*'); } catch (_) {} }, 1100); }, 1200);
    }
    if (d.ev === 'state' && d.s === 0 && media && media.status === 'Playing' && media.dur && now() < media.dur - 3) { V('video ended early: back in step'); try { vid.el.contentWindow.postMessage({ cmd: 'kick', pos: now(), playing: true }, '*'); } catch (_) {} }
    if (d.ev === 'state' && d.s === 1 && !vid.playing) { vid.playing = true; const el = vid.el, mine = vid; setTimeout(() => { if (vid === mine) el.classList.add('on'); }, 1900); }   // YouTube shows its title and logo for the first seconds: the picture stays until they're gone   // shown once it really plays (no YouTube loading screen)
    if (d.ev === 'error') {                                              // this one can't be embedded: the next candidate, or the song's cover
      badVids.add(vid.id); stopVideo();
      if (++vidTries < 3 && media) startVideo(media); else giveUpVideo();
    }
  });
  let vidSeg = 0, videoCover = null;                                    // a video whose song has a cover: the glow takes the cover's colour
  function songCoverForVideo(m, gen) {
    artCandidates(m).then(list => {
      if (gen !== coverGen || !list.length || !list.strong) return;       // only an exact match (this title, this artist, a song)
      videoCover = list[0];                                               // (shown if no video plays, and at once on a switch to the song)
      coverMemo.set(qn(m.title) + '|' + qn(m.artist), list[0]);
      const im = new Image(); im.src = list[0]; fingerprint(smallArt(list[0]));   // loaded now, ready for the switch
    });
  }
  // YouTube's storyboard for a video: its seek-preview frames (80 x 45, one every ~2 s, 100 to a sheet), brought through the helper
  const boards = new Map(), sheets = new Map();
  function board(v) {
    if (boards.has(v)) return boards.get(v);
    const p = getJ(`${evBase}/ytsb?${new URLSearchParams({ v, t: L.token })}`).then(j => {
      const parts = ((j && j.spec) || '').split('|'); if (parts.length < 2) return null;
      const lv = parts.slice(1).map((p, i) => { const q = p.split('#'); return { base: parts[0], li: i, w: +q[0], h: +q[1], count: +q[2], cols: +q[3], rows: +q[4], every: +q[5], name: q[6], sigh: q[7] }; });
      const small = lv[Math.min(1, lv.length - 1)]; small.big = lv[lv.length - 1];   // 80 x 45 for colour; the largest (160 x 90) for a frozen frame
      return small;
    }).catch(() => null);
    boards.set(v, p); return p;
  }
  function sheet(u) {
    if (sheets.has(u)) return sheets.get(u);
    const p = new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null);
      im.src = `${evBase}/ytsbimg?${new URLSearchParams({ u, t: L.token })}`; });
    sheets.set(u, p); if (sheets.size > 30) sheets.delete(sheets.keys().next().value);
    return p;
  }
  // the frame at a moment, from a storyboard level: [image, sx, sy, sw, sh]
  async function frameAt(b, t, dur) {
    const i = Math.min(b.count - 1, Math.max(0, b.every > 0 ? Math.floor(t * 1000 / b.every) : Math.floor(t / Math.max(1, dur) * b.count)));
    const per = b.cols * b.rows, n = Math.floor(i / per), k = i % per;
    const im = await sheet(b.base.replace('$L', b.li).replace('$N', b.name.replace('$M', n)) + '&sigh=' + b.sigh); if (!im) return null;
    const fw = im.naturalWidth / b.cols, fh = im.naturalHeight / b.rows;
    return { im, cut: [(k % b.cols) * fw, Math.floor(k / b.cols) * fh, fw, fh], i };
  }
  // The frozen frame: the video's frame at this moment drawn over the player while YouTube shows a pause/play mark or its bars
  const freeze = document.createElement('canvas'); freeze.className = 'freeze'; artBox.appendChild(freeze);
  let freezeT = 0, swapFreeze = false;                                    // swapFreeze: the last video's frame, held while the next track loads
  let lastSync = null;                                                    // the video's place at the last sync: { id, t, at }
  const lastFrameAt = () => lastSync ? [lastSync.t + (Date.now() - lastSync.at) / 1000, lastSync.id] : [0, null];
  let freezeTok = 0;
  async function showFreeze(hold, t, id) {
    clearTimeout(freezeT); const tok = ++freezeTok;
    id = id || (vid && vid.id); if (t == null) t = now();
    if (id && L) try {
      const b = await board(id), f = b && await frameAt(b.big || b, t, media && media.dur);
      if (tok !== freezeTok) return;                                      // (the next picture came first: no stale frame over it)
      if (f) {
        const r = artBox.getBoundingClientRect(), W = Math.max(2, Math.round(r.width)), H = Math.max(2, Math.round(r.height));
        freeze.width = W; freeze.height = H; const x = freeze.getContext('2d');
        const dw = Math.max(W, H * 16 / 9) * 1.04, dh = dw * 9 / 16;      // cropped exactly like the player (its bars outside the card)
        x.drawImage(f.im, f.cut[0], f.cut[1], f.cut[2], f.cut[3], (W - dw) / 2, (H - dh) / 2, dw, dh);
        freeze.classList.add('show');
      }
    } catch (_) {}
    if (hold) freezeT = setTimeout(hideFreeze, hold);
  }
  function hideFreeze() { clearTimeout(freezeT); freezeTok++; freeze.classList.remove('show'); }
  let frameBusy = false, lastFrame = -1;
  async function videoGlow() {
    if (!vid || !vid.ready || !musicMode || !media || frameBusy || !L) return;
    frameBusy = true;
    try {
      const id = vid.id, b = await board(id);
      if (!b) {                                                           // no storyboard: YouTube's three stills (start, middle, end)
        const f = media.dur ? now() / media.dur : 0, seg = f < .3 ? 1 : f < .62 ? 2 : 3;
        if (seg !== vidSeg) { vidSeg = seg; tintFrom(`https://i.ytimg.com/vi/${id}/hq${seg}.jpg`, null, true); }
        return;
      }
      const f = await frameAt(b, now() + 1, media.dur);                    // the frame about to show (the colour eases in)
      if (!f || !vid || vid.id !== id || (f.i === lastFrame && vidSeg === -1)) return; lastFrame = f.i; vidSeg = -1;
      tintFrom(f.im, f.cut, true);
    } finally { frameBusy = false; }
  }
  setInterval(videoGlow, 700);
  let wasPlaying = null; const SYNC_LEAD = .04;                     // (measured: the embedded player shows its frames ~60 ms after its reported time... ahead without this)
  function syncVideo() {
    if (!vid || !vid.ready || !media) return;
    const playing = media.status === 'Playing' && musicMode;
    wasPlaying = playing; if (vid.playing) lastSync = { id: vid.id, t: now(), at: Date.now() };
    vid.el.contentWindow.postMessage({ cmd: 'sync', pos: now() + SYNC_LEAD, playing }, '*');   // (measured against YouTube Music's own picture)
  }   // on the clock: paused, kept
  setInterval(syncVideo, 450);                                         // (often: the player keeps its drift under 0.2 s)
  window.__npKey = k => {                                               // the wallpaper's own play/pause, next, previous
    if (!vid || !vid.el) return;
    const post = playing => { try { vid.el.contentWindow.postMessage({ cmd: 'sync', pos: now(), playing }, '*'); } catch (_) {} };
    if (k === 'playpause') post(!(media && media.status === 'Playing'));
    else if (k === 'next' || k === 'prev') { if (vid.playing) { swapFreeze = true; showFreeze(0, ...lastFrameAt()); } artBox.classList.add('swap'); post(false); }
  };
  setInterval(() => { if (vid && media && wasPlaying !== null && (media.status === 'Playing' && musicMode) !== wasPlaying) syncVideo(); }, 200);   // a pause or play right away

  /* ------------------------------------------------------------ music mode ------------------------------------------------------------ */
  let musicMode = false, pendingMin = null, artKey = '', artFront = 0, lostAt = 0, pickedArt = null, lyrSrc = '';
  const bigArt = u => (u || '').replace(/=w\d+-h\d+[^&?#]*$/, '=w1000-h1000-l90-rj').replace(/\/(?:default|mqdefault|hqdefault|sddefault)\.jpg/, '/maxresdefault.jpg');   // no letterbox bars
  // the cover's main colour: the hue covering the most of its coloured pixels (whites, greys and blacks don't vote),
  // so a lavender cover gives lavender, a mostly-white cover with pink details gives pink, black-and-white gives none
  // TV backlight: each stripe takes the colour of its own slice of the picture (12 slices, left to right). Slices with little
  // colour lean on the main hue; everything is kept light and soft
  let liveAmbAt = 0;
  // a video's stripes: like soften, with more colour (x1.3 instead of x0.82, less white)
  function softenV(c, hueCol, own) {
    const m = Math.max(...c, .001); c = c.map(v => v / m);
    c = c.map((v, k) => v * own + hueCol[k] * (1 - own));
    const lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
    return c.map(v => Math.min(1, Math.max(0, (lum + (v - lum) * 1.3) * .92 + .08)));
  }
  function soften(c, hueCol, own) {
    const m = Math.max(...c, .001); c = c.map(v => v / m);               // as light: full brightness
    c = c.map((v, k) => v * own + hueCol[k] * (1 - own));
    const lum = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
    return c.map(v => Math.min(1, Math.max(0, (lum + (v - lum) * .82) * .86 + .14)));   // a little softened, a little lighter
  }
  // a song cover's stripes: rich colour - the same hue, saturation boosted (x1.6), pale tints lifted toward 50%; grey stays soft white
  function richer(c) {
    const m = Math.max(...c, .001); c = c.map(v => v / m);
    const mx = Math.max(...c), mn = Math.min(...c), sat = mx ? (mx - mn) / mx : 0;
    if (sat < .04) return c.map(v => Math.min(1, v * .92 + .08));
    const S = Math.min(.92, Math.max(sat * 1.6, Math.min(.5, sat * 4)));
    return c.map(v => { const t = mx > mn ? (v - mn) / (mx - mn) : 1; return 1 - S + S * t; });
  }
  // a song cover's stripes: the cover's MAIN colour on every stripe (whites, greys and blacks never win - a white cover with pink
  // details is pink). A stripe keeps its own slice's shade only when that slice is the same colour family as the main colour.
  const hueOf = c => { const mx = Math.max(...c), mn = Math.min(...c), ch = mx - mn; if (ch < 1e-4) return -1;
    let h = mx === c[0] ? ((c[1] - c[2]) / ch) % 6 : mx === c[1] ? (c[2] - c[0]) / ch + 2 : (c[0] - c[1]) / ch + 4; return ((h + 6) % 6) * 60; };
  function popCols(d, N, hueCol) {
    const main = richer(hueCol), mh = hueOf(hueCol), cols = [];
    for (let s = 0; s < 12; s++) {
      const x0 = Math.floor(s * N / 12), x1 = Math.floor((s + 1) * N / 12); let w = 0, r = 0, g = 0, b = 0;
      for (let y = 0; y < N; y++) for (let xx = x0; xx < x1; xx++) {
        const i = (y * N + xx) * 4, R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0;
        if (mx < .14 || sat < .2) continue;                                // only coloured pixels speak
        const ww = sat; w += ww; r += R * ww; g += G * ww; b += B * ww;
      }
      const c = w ? [r / w, g / w, b / w] : null, h = c ? hueOf(c) : -1, dh = h < 0 || mh < 0 ? 999 : Math.min(Math.abs(h - mh), 360 - Math.abs(h - mh));
      cols.push(c && dh < 35 ? richer(c.map((v, k) => v * .6 + hueCol[k] * .4)) : main);   // same family: its own shade; anything else: the main colour
    }
    return cols;
  }
  function sliceCols(d, N, hueCol) {
    const cols = [];
    for (let s = 0; s < 12; s++) {
      const x0 = Math.floor(s * N / 12), x1 = Math.floor((s + 1) * N / 12); let w = 0, r = 0, g = 0, b = 0, cw = 0;
      for (let y = 0; y < N; y++) for (let xx = x0; xx < x1; xx++) {
        const i = (y * N + xx) * 4, R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B);
        if (mx < .1) continue;                                           // black (letterbox, shadows) says nothing
        const sat = mx ? (mx - mn) / mx : 0, ww = .15 + sat * 1.6;       // coloured pixels count most
        w += ww; r += R * ww; g += G * ww; b += B * ww; cw += sat;
      }
      cols.push(soften(w ? [r / w, g / w, b / w] : hueCol.slice(), hueCol, Math.min(1, (w ? cw / ((x1 - x0) * N) : 0) * 3.2)));
    }
    return cols;
  }
  // live: while a video plays, the helper reads its colours straight off the screen ~8 times a second (the YouTube player can't be read
  // from the page); the storyboard frames above are only the fallback
  let liveBusy = false, liveFails = 0;
  async function liveGlow() {
    if (liveBusy || !vid || !vid.ready || !musicMode || !L || document.hidden || liveFails > 20) return;
    const r = artBox.getBoundingClientRect(); if (r.width < 20 || r.height < 20) return;
    const dpr = devicePixelRatio || 1, ix = r.width * .06, iy = r.height * .06;   // a little inside the card's rounded edge
    liveBusy = true;
    try {
      const j = await getJ(`${evBase}/vedge?${new URLSearchParams({ x: Math.round((r.left + ix) * dpr), y: Math.round((r.top + iy) * dpr), w: Math.round((r.width - ix * 2) * dpr), h: Math.round((r.height - iy * 2) * dpr), t: L.token })}`);
      if (!j || !j.c || j.c.length !== 12 || !j.tl || !j.tr) { liveFails++; return; }
      if (!musicMode || !vid || !vid.ready) return;                        // switched to the clock while this was on its way: no colour
      liveFails = 0;
      const raw = j.c.map(c => c.map(v => v / 255));
      // the main colour across the whole frame, for slices that are nearly black or grey
      const all = raw.reduce((s, c) => s.map((v, k) => v + c[k] / 12), [0, 0, 0]), am = Math.max(...all, .001);
      const hueCol = am < .08 ? [.92, .92, .92] : all.map(v => v / am);
      // stripes beside the video take its nearest top corner; stripes above it, the video's colour right there
      const tone = c => { const mx = Math.max(...c), mn = Math.min(...c), sat = mx ? (mx - mn) / mx : 0; return softenV(mx < .06 ? hueCol.slice() : c, hueCol, Math.min(1, sat * 2.4) * (mx < .06 ? 0 : 1)); };
      const TL = j.tl.map(v => v / 255), TR = j.tr.map(v => v / 255), cols = [];
      for (let i = 0; i < 12; i++) {
        const x = (i + .5) / 12 * innerWidth;
        cols.push(tone(x < r.left ? TL : x > r.right ? TR : raw[Math.min(11, Math.max(0, Math.floor((x - r.left) / r.width * 12)))]));
      }
      liveAmbAt = Date.now(); window.setStripeAmb?.(cols); window.setStripeTint?.(null, null, .55);
    } catch (_) { liveFails++; } finally { liveBusy = false; }
  }
  setInterval(liveGlow, 120);
  function tintFrom(src, cut, keep) {                                   // cut: part of the picture (a frame of a storyboard); keep: no colour = keep the last
    const loaded = typeof src !== 'string', im = loaded ? src : new Image();
    const run = () => {
      try {
        const N = 64, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d', { willReadFrequently: true });
        if (cut) x.drawImage(im, cut[0], cut[1], cut[2], cut[3], 0, 0, N, N); else x.drawImage(im, 0, 0, N, N); const d = x.getImageData(0, 0, N, N).data;
        const bins = Array.from({ length: 18 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), ch = mx - mn;
          const sat = mx ? ch / mx : 0; if (sat < .08 || mx < .14 || ch < .045) continue;         // white, grey, black: not a colour
          let h = mx === r ? ((g - b) / ch) % 6 : mx === g ? (b - r) / ch + 2 : (r - g) / ch + 4; h = (h + 6) % 6;
          const k = Math.floor(h / 6 * 18) % 18, w = Math.pow(sat, .6) * (.3 + mx);            // area counts most: the cover's MAIN colour, not its loudest speck
          bins[k].w += w; bins[k].r += r * w; bins[k].g += g * w; bins[k].b += b * w;
        }
        // neighbouring hue bins count together (a pink spread over two bins still wins)
        let best = -1, bw = 0;
        for (let k = 0; k < 18; k++) { const s = bins[k].w + .5 * (bins[(k + 17) % 18].w + bins[(k + 1) % 18].w); if (s > bw) { bw = s; best = k; } }
        if (best < 0 || bw < (cut ? .15 : .4)) {                          // no real colour: a grey/dark frame still updates (soft white light), a cover goes plain
          if (cut && Date.now() - liveAmbAt > 1500) window.setStripeAmb?.(sliceCols(d, N, [.92, .92, .92]));
          if (!keep) window.setStripeTint?.(null, null, 0); return;
        }
        const B = [bins[(best + 17) % 18], bins[best], bins[(best + 1) % 18]], tw = B.reduce((s, q) => s + q.w, 0);
        const col = [B.reduce((s, q) => s + q.r, 0) / tw, B.reduce((s, q) => s + q.g, 0) / tw, B.reduce((s, q) => s + q.b, 0) / tw];
        // keep the cover's hue but make it rich: at least 65% saturation, full brightness (pale lavender -> periwinkle)
        const mx2 = Math.max(...col), mn2 = Math.min(...col), sat2 = mx2 ? (mx2 - mn2) / mx2 : 0, S2 = Math.max(.5, Math.min(.8, sat2));
        const hueCol = col.map(v => { const t = mx2 > mn2 ? (v - mn2) / (mx2 - mn2) : 1; return 1 - S2 + S2 * t; });
        if (Date.now() - liveAmbAt > 1500) window.setStripeAmb?.(cut || np.classList.contains('video') ? sliceCols(d, N, hueCol) : popCols(d, N, hueCol));   // (live colours from the screen win when they're coming in; a cover pops)
        window.setStripeTint?.(hueCol, hueCol, musicMode ? .55 : 0);
      } catch (_) {}
    };
    if (loaded) { run(); return; }
    im.crossOrigin = 'anonymous'; im.onload = run; im.src = src;
  }
  function showArt(src) {
    if (!src) return;
    if (musicMode && !vid) tintFrom(src);
    const next = imgs[1 - artFront], cur = imgs[artFront];
    // YouTube answers a missing size with a small grey placeholder (a video icon with three dots): step down a size instead
    const smaller = () => { const u = next.src; if (/maxresdefault/.test(u)) { next.src = u.replace('maxresdefault', 'sddefault'); return true; } if (/sddefault/.test(u)) { next.src = u.replace('sddefault', 'hqdefault'); return true; } return false; };
    next.onload = () => {
      if (/ytimg\.com/.test(next.src) && next.naturalWidth <= 120 && smaller()) return;
      next.classList.add('show'); cur.classList.remove('show'); artFront = 1 - artFront; artBox.classList.remove('swap');
      if (swapFreeze) { swapFreeze = false; hideFreeze(); }
    };
    next.onerror = () => { smaller(); };
    let abs = src; try { abs = new URL(src, location.href).href; } catch (_) {}
    if (next.src === abs && next.complete && next.naturalWidth) next.onload(); else next.src = src;
  }
  // A tiny fingerprint of a picture (8 x 8, centre square) to tell whether two covers are the same artwork.
  function fingerprint(src, zooms) {
    return new Promise(res => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d', { willReadFrequently: true });
          const a = document.createElement('canvas'); a.width = a.height = 12; const ax = a.getContext('2d', { willReadFrequently: true }); ax.drawImage(im, 0, 0, 12, 12);
          const ad = ax.getImageData(0, 0, 12, 12).data; let see = 0; for (let i = 3; i < ad.length; i += 4) if (ad[i] < 200) see++;
          if (see > 8) { res(null); return; }                               // see-through corners: an app's icon (Windows shows it before the artwork), not a cover
          const one = z => { const s0 = Math.min(im.naturalWidth, im.naturalHeight) / z;
            x.clearRect(0, 0, 8, 8); x.drawImage(im, (im.naturalWidth - s0) / 2, (im.naturalHeight - s0) / 2, s0, s0, 0, 0, 8, 8);
            const fp = Array.from(x.getImageData(0, 0, 8, 8).data).filter((_, i) => i % 4 !== 3); fp.aspect = im.naturalWidth / Math.max(1, im.naturalHeight); return fp; };
          res(zooms ? zooms.map(one) : one(1));
        } catch (_) { res(null); }
      };
      im.onerror = () => res(null); im.src = src;
    });
  }
  const fpDiff = (a, b) => { if (!a || !b) return 999; let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length; };
  let coverGen = 0, shownFp = null, swapT = 0;
  // On a song change: Windows' copy of the cover first (re-checked, since the player sometimes updates it a moment late),
  // then the sharp 1000 px version - but only if it is the same artwork (a search can find another release of the song).
  // On a song change: Windows' copy of what's playing first (re-checked: the player sometimes updates it a moment late),
  // then the sharpest version of the same artwork. Music videos: their album cover if there is one, else a 16:9 video card.
  // ONE decision per track (and per Song / Video switch): Windows' picture of what plays is the truth - square = the song
  // version, wide = a video. It is read every ~0.6 s; when a track starts, or the picture's shape flips (seen twice), the state
  // is committed once and the card, cover, video and lyrics all follow that single decision. Nothing guesses ahead of it.
  let hqGen = -1, lastWasVideo = false;
  let shot = null, want = null, flip = null, watchBusy = false, lastWatch = 0;   // committed { id, video, fp } / a track waiting for its picture
  window.__shot = () => ({ shot: shot && { id: shot.id, video: shot.video }, want: want && want.id, flip });
  function beginTrack(m, id) {
    const gen = ++coverGen;
    lastWasVideo = np.classList.contains('video');
    if (vid && vid.playing) { swapFreeze = true; showFreeze(0, ...lastFrameAt()); }   // the last frame stays (softly) until the next picture
    artBox.classList.add('swap');
    stopVideo(true); vidTries = 0; videoCover = null; gaveUp = false; curThumb = null;
    const w = { id, m, gen, at: Date.now(), prevFp: shot && shot.fp }; want = w; shot = null; flip = null;
    clearTimeout(swapT); swapT = setTimeout(() => { if (gen === coverGen) { artBox.classList.remove('swap'); if (swapFreeze) { swapFreeze = false; hideFreeze(); } } }, 6000);   // (never left out of focus)
    return w;
  }
  function updateCover(m, id) { beginTrack(m, id); lastWatch = 0; }
  let albPend = null, blipNext = false, blipUntil = 0;
  async function watch() {
    if (watchBusy || !musicMode || !media || !media.title || !L || !LIVE) return;
    const m = media, id = (m.artist + '|' + m.title).toLowerCase(), t0 = Date.now(), ytm = YTM_APP.test(m.app || '');
    // YouTube Music's Song / Video switch: the song version has an album, a video has none (from the 0.2 s status, no picture needed)
    if (ytm && shot && shot.id === id && !want && (m.album || '') !== shot.alb) {
      const v = !m.album;
      if (v === shot.video) { shot.alb = m.album || ''; albPend = null; }   // (an album that came in late: same version)
      else if (!albPend || albPend.v !== v || albPend.id !== id) albPend = { v, id, at: t0 };
      else if (t0 - albPend.at > 250) { albPend = null; V('switch', v ? 'to video' : 'to song', '(album)', m.title); switchTo(m, id, v, null); return; }
    } else albPend = null;
    if (t0 - lastWatch < (want ? 250 : (shot && !shot.fp) ? 300 : m.status === 'Playing' ? 450 : 1500)) return;
    lastWatch = t0; watchBusy = true;
    try {
      if (want && want.id !== id) return;                                 // (the new track's start comes from musicTick)
      const fp = m.art ? await Promise.race([fingerprint(`${base}/mediaart?t=${L.token}&k=${encodeURIComponent(id)}&n=${t0}`), sleep(1500).then(() => null)]) : null;
      if (!media || (media.artist + '|' + media.title).toLowerCase() !== id) return;
      if (want) {
        const w = want;
        if (!fp) {                                                        // no picture (yet): a song for an app without one; YouTube Music's album decides
          const age = Date.now() - w.at;
          if (!m.art && age > 1500) commit(w, null, false);
          else if (ytm && age > 1200) { V('no picture yet: by album', m.album ? 'song' : 'video'); commit(w, null, !m.album); }
          return;
        }
        if (w.prevFp && fpDiff(fp, w.prevFp) < 8 && Date.now() - w.at < 3000) return;          // still the last track's picture
        commit(w, fp, fp.aspect > 1.25); return;
      }
      const uv = shot && shot.id === id && shot.video ? urlVid(m) : null;
      if (uv && !starting && ((vid && vid.id !== uv) || !vid)) {
        V('youtube music plays', uv, 'not', vid ? vid.id : 'nothing'); stopVideo(true); gaveUp = false; vidTries = 0;
        np.classList.add('video'); document.body.classList.add('npvideo'); videoAlone(); startVideo(m); return;
      }
      if (!shot || shot.id !== id || !fp) return;
      const isVid = fp.aspect > 1.25;
      if (!shot.fp) {                                                     // waiting for Windows' picture of the new version
        if (isVid !== shot.video) {
          if (shot.video && !vid && Date.now() - shot.at > 3000) { V('no wide picture yet: paired video'); shot.fp = []; startVideo(m); }
          return;
        }
        shot.fp = fp; curThumb = fp;
        if (shot.video) startVideo(m); else songCover(m, fp, coverGen);   // the video, or the cover checked against the real picture
        return;
      }
      if (!shot.fp.length || isVid === shot.video || fpDiff(fp, shot.fp) < 10) { flip = null; return; }
      if (!flip || flip.video !== isVid) { flip = { video: isVid, at: Date.now() }; return; }  // seen twice before it counts
      flip = null; V('switch', isVid ? 'to video' : 'to song', '(picture)', m.title);
      switchTo(m, id, isVid, fp);
    } catch (_) {} finally { watchBusy = false; }
  }
  setInterval(watch, 100);
  function switchTo(m, id, isVid, fp) {
    if (lastPick && lastPick.t === qn(m.title)) { const o = pairOf.get(lastPick.v); lastPick = o ? { v: o, t: lastPick.t } : null; }   // what you picked is now its other version
    const w = beginTrack(m, id); w.prevFp = null; if (isVid) blipNext = true; commit(w, fp, isVid);
  }
  function commit(w, fp, isVid) {
    if (w !== want || w.gen !== coverGen) return;
    const fits = !!fp && (fp.aspect > 1.25) === isVid;                   // (Windows' picture can lag a switch: then it isn't used)
    want = null; shot = { id: w.id, video: isVid, fp: fits ? fp : null, alb: w.m.album || '', at: Date.now() }; curThumb = fits ? fp : null; gaveUp = false; vidTries = 0;
    const m = w.m, gen = w.gen; V('now', isVid ? 'video' : 'song', m.title, fits ? '' : '(picture pending)');
    if (isVid) {                                                          // a video: centred, no lyrics, its sharp picture, then the video
      np.classList.add('video'); document.body.classList.add('npvideo'); videoAlone(); songCoverForVideo(m, gen);
      if (fits || (YTM_APP.test(m.app || '') && media && media.vid)) startVideo(m);   // (YouTube Music's address names the video: no need to wait for the picture)
      return;
    }
    np.classList.remove('video'); document.body.classList.remove('npvideo');   // the song: its own cover, square, with its lyrics
    songCover(m, fits ? fp : null, gen);
    if (YTM_APP.test(m.app || '')) songLyrics(m, gen);
    else { np.classList.toggle('solo', !lines); document.body.classList.toggle('npsolo', !lines); }
  }
  // the song's sharp cover, chosen on small copies (all at once): the one matching Windows' picture; without that picture, the best-named one
  const smallArt = u => /googleusercontent|ggpht/.test(u) ? u.replace(/=w\d+-h\d+[^&?#]*$/, '=w90-h90-l90-rj') : u.replace(/(maxres|sd|hq)default/, 'mqdefault');
  const coverMemo = new Map();
  async function songCover(m, fp, gen) {
    const t0 = Date.now(), key = qn(m.title) + '|' + qn(m.artist);
    const pick = async list => {
      list = [...new Set(list.filter(Boolean))]; if (!list.length) return null;
      if (!fp) return list[0];
      const fps = await Promise.all(list.map(u => fingerprint(smallArt(u))));
      let best = null, bd = 1e9; list.forEach((u, i) => { const d = fpDiff(fps[i], fp); if (d < bd) { bd = d; best = u; } });
      return bd < 36 ? best : null;
    };
    let got = await pick([coverMemo.get(key), pickedArt && pickedArt.t === qn(m.title) && pickedArt.u, queueArt.get(qn(m.title)), videoCover]);
    if (!got && gen === coverGen) { const l = await Promise.race([artCandidates(m).catch(() => []), sleep(2500).then(() => [])]); got = await pick(fp || l.strong ? l : []); }
    if (gen !== coverGen) return;
    if (got) coverMemo.set(key, got);
    const u = got || (fp && shot ? `${base}/mediaart?t=${L.token}&k=${encodeURIComponent(shot.id)}&n=${gen}-c` : null);
    V('cover', got ? 'sharp' : u ? 'windows' : 'none', (Date.now() - t0) + 'ms');
    if (u) { shownFp = fp; showArt(u); }
    else if (!fp) return;                                                 // (comes when Windows' picture of the song arrives)
    else { artBox.classList.remove('swap'); if (swapFreeze) { swapFreeze = false; hideFreeze(); } }
  }
  // the song's lyrics: YouTube Music's own (timed to the song version), else LRCLIB
  async function songLyrics(m, gen) {
    if (lines) { lines = null; build(); } lyrSrc = '';
    let r = null;
    try { r = await ytmLyrics(m, true); } catch (_) {}
    if (!(r && r.lines)) try { r = await findLyrics({ ...m }); } catch (_) { r = null; }
    if (gen !== coverGen || !shot || shot.video) return;
    const found = !!(r && r.lines && r.lines.some(x => x.text));
    lines = found ? r.lines : null; lyrSrc = lines ? r.src || 'lrclib' : ''; build();
    np.classList.toggle('solo', !lines); document.body.classList.toggle('npsolo', !lines);
    placed = ''; setTimeout(() => { placed = ''; place(); }, 950);
  }
  // Cover candidates from YouTube Music (1000 px): this song by this artist, as a song or on its album
  async function artCandidates(m) {
    const api = window.__shadowYtm, so = songOf(m); if (!api || !so.title) return [];
    try {
      const j = await ytmSearch(`${so.title} ${so.artist}`.trim()); const items = j ? api.parse(j) : [], t = so.title.toLowerCase();
      const ar = so.artist.toLowerCase().split(/[,&]| x | feat/)[0].trim(), byArtist = x => !ar || (x.sub || '').toLowerCase().includes(ar);
      const score = x => (x.title.toLowerCase() === t ? 3 : x.title.toLowerCase().includes(t) ? 1 : 0) + (byArtist(x) ? 2 : 0) + (x.kind === 'Song' ? 1 : x.kind === 'Album' || x.kind === 'Single' || x.kind === 'EP' ? .5 : 0);
      const list = items.filter(x => !x.c && x.art && score(x) >= 3).sort((p, q) => score(q) - score(p)), out = [];
      for (const x of list) { const u = bigArt(x.art); if (!out.includes(u)) out.push(u); }
      out.strong = list.length > 0 && score(list[0]) >= 6;                // exact title, right artist, a song
      return out.slice(0, 5);
    } catch (_) { return []; }
  }
  let dismissed = false;                                                 // swiped back to the clock: stay there until swiped again
  function enterMusic(d, auto) {
    if (!auto) dismissed = false; else if (dismissed) return;
    document.body.classList.toggle('npsolo', np.classList.contains('solo'));
    pendingMin = auto ? null : { at: Date.now(), prev: song };
    if (d.title) findLyrics({ title: d.title, artist: d.sub || '', dur: d.dur || 0 }).catch(() => {});    // ready before the music starts
    if (d.v) seedQueue(d.v, d.list || '');                               // the queue of what you picked: next songs load early
    if (d.v && d.title) lastPick = { v: d.v, t: qn(d.title) };
    if (!auto && d.v && !songIds.has(d.v)) warmUp(d.v);                   // what you picked starts loading now (paused at the start), while YouTube Music opens it
    npTi.textContent = d.title || ''; npAr.textContent = d.sub || '';
    if (!musicMode) { musicMode = true; window.setMusicMode?.(true); requestAnimationFrame(() => np.classList.add('on')); }
    if (!auto) pickedArt = d.art ? { t: qn(d.title), u: bigArt(d.art) } : null;    // a new pick replaces the last one's picture
    if (pickedArt && d.art) showArt(pickedArt.u);
    placed = ''; setTimeout(() => { placed = ''; place(); }, 50); setTimeout(() => { placed = ''; place(); }, 1300);
  }
  let parked = false;
  function parkMusic() {                                                 // to the clock: hidden, but the video, cover and lyrics stay as they are
    if (!musicMode) return;
    musicMode = false; parked = true; pendingMin = null; np.classList.remove('on'); window.setMusicMode?.(false); window.setStripeTint?.(null, null, 0);
    lyrBox.classList.remove('on'); syncVideo();
    wasPlaying = false;
  }
  function exitMusic() {
    parked = false; dropWarm(); dropSpare();
    if (!musicMode) return;
    musicMode = false; pendingMin = null; stopVideo(); np.classList.remove('on', 'solo', 'video'); document.body.classList.remove('npsolo', 'npvideo'); window.setMusicMode?.(false); window.setStripeTint?.(null, null, 0);
    lyrBox.classList.remove('on');                                        // hide the lyrics now (the clock shows none), and leave them where they are
  }
  window.addEventListener('shadow-music', e => enterMusic(e.detail || {}));
  window.__musicMode = { enter: enterMusic, exit: exitMusic, on: () => musicMode,
    canToggle: () => musicMode || (dismissed && !!(media && media.title)),
    toggle() { if (musicMode) this.dismiss(); else this.restore(); },
    dismiss() { dismissed = true; parkMusic(); },                        // the swipe: back to the clock (Now Playing kept, ready to come back)
    dismissed: () => dismissed && !!(media && media.title),
    restore() {                                                          // the swipe again: Now Playing back
      dismissed = false; if (!media || !media.title) return false;
      const wasParked = parked; parked = false;
      enterMusic({ title: media.title, sub: media.artist || '' }, true);
      if (!wasParked) artKey = '';                                        // set aside: everything is still there (a new song is picked up by the next check)
      np.classList.toggle('solo', !lines); document.body.classList.toggle('npsolo', !lines);
      vidSeg = 0;
      if (vid) {                                                          // drawn again at once (YouTube's little play mark is over before it fades in)
        const el = vid.el; el.classList.add('zoom'); wasPlaying = media.status === 'Playing';   // YouTube shows its marks again on resuming: the frozen frame covers them
        showFreeze(1300); setTimeout(() => { if (vid && vid.el === el) el.classList.add('on'); }, 150); setTimeout(() => el.classList.remove('zoom'), 3800);
        try { el.contentWindow.postMessage({ cmd: 'kick', pos: now() + .2, playing: media.status === 'Playing' }, '*'); } catch (_) {} lastFrame = -1; videoGlow();
      }
      else { vidTries = 0; gaveUp = false; if (np.classList.contains('video')) startVideo(media); const im = imgs[artFront]; if (im && im.src) tintFrom(im.src); }
      return true;
    } };
  artBox.addEventListener('mousedown', e => { e.stopPropagation(); if (L) fetch(`${base}/key?k=playpause&t=${L.token}`, { mode: 'no-cors' }).catch(() => {}); });
  // music apps whose playback turns the wallpaper into Now Playing by itself (after a reload, or played from the app)
  const MUSIC_APP = /_crx_cinhi|youtube ?music|spotify|applemusic|apple music|tidal|deezer|amazon ?music|soundcloud/i;
  function musicTick(m) {
    if (!musicMode && !dismissed && m && m.title && m.status === 'Playing' && MUSIC_APP.test(m.app || '')) {
      enterMusic({ title: m.title, sub: m.artist || '' }, true);
      artKey = '';                                                      // fetch this song's cover below
    }
    if (!musicMode) return;
    const now = Date.now();
    if (!m || !m.title) { if (!lostAt) lostAt = now; if (now - lostAt > 9000 && !pendingMin) exitMusic(); return; }
    lostAt = 0;
    // YouTube Music started playing what you picked: tuck its window away so the wallpaper shows
    const id = (m.artist + '|' + m.title).toLowerCase();
    if (pendingMin && m.status === 'Playing' && (id !== pendingMin.prev || now - pendingMin.at > 12000)) {
      pendingMin = null; if (L && LIVE) fetch(`${base}/ytmin?t=${L.token}`, { mode: 'no-cors' }).catch(() => {});
    }
    if (pendingMin && now - pendingMin.at > 30000) pendingMin = null;
    // the cover and names follow whatever plays next
    if (!pendingMin) {
      if (m.title && npTi.textContent !== m.title) { npTi.textContent = m.title; npAr.textContent = m.artist || ''; }
      if (id !== artKey) { artKey = id; updateCover(m, id); }
    }
    artBox.classList.toggle('paused', m.status !== 'Playing');
    if (m.status === 'Paused' && pausedAt && Date.now() - pausedAt > 120e3 && !pendingMin) exitMusic();     // paused for 2 minutes: back to the clock (a track change's in-between state isn't a pause)
  }

  /* ------------------------------------------------------------- the loop ------------------------------------------------------------- */
  const shown = () => !!(lines && media && (media.status === 'Playing' || (media.status === 'Paused' && Date.now() - pausedAt < 120e3)));
  // (in music mode the lyrics stay with the cover; outside it they sit under the clock)
  function render() {
    const vis = shown() && musicMode && !window.lpCovering;         // the clock shows no lyrics
    lyrBox.classList.toggle('on', vis);
    if (vis) tick(false);
    requestAnimationFrame(render);
  }
  // a browser video that is music: a music video's usual title, or a song YouTube Music knows by this title and artist
  const MV_TITLE = /official\s*(music\s*)?video|official\s*(lyric\s*)?video|official\s*audio|lyric\s*video|\(lyrics?\)|visuali[sz]er|\bm\/?v\b|music\s*video/i;
  async function looksLikeMusic(m) {
    if (MV_TITLE.test(m.title || '')) return true;
    try {
      const so = songOf(m); if (!so.title || !window.__shadowYtm) return false;
      const j = await ytmSearch(`${so.title} ${so.artist}`.trim()), items = j ? window.__shadowYtm.parse(j) : [];
      const ar = (so.artist || '').toLowerCase().split(/[,&]| x | feat/)[0].trim();
      return items.some(x => x.kind === 'Song' && qn(x.title) === qn(so.title) && (!ar || (x.sub || '').toLowerCase().includes(ar)));
    } catch (_) { return false; }
  }
  async function poll() {
    let m = null;
    try {
      if (window.__mediaTest) m = await window.__mediaTest();
      else if (LIVE) m = await getJ(`${base}/media?t=${L.token}`);
    } catch (_) {}
    if (m && m.title) {
      // a browser tab's own seek bar, while it moves: the real second (ads, pauses, buffering that Windows never reported)
      if (m.bpos != null && m.bat && m.now && m.status === 'Playing' && m.now - m.bat < 2500) {
        const truth = m.bpos + .3 + (m.now - m.bat) / 1000, est = m.pos + (m.now - m.upd) / 1000;
        if (Math.abs(est - truth) > 1.2) { m.pos = truth; m.upd = m.now; if (!window.__bfix || Date.now() - window.__bfix > 5000) { window.__bfix = Date.now(); V('browser position', est.toFixed(1), '->', truth.toFixed(1)); } }
      }
      if (m.now) { const skew = Date.now() - m.now; m.upd += skew; }
      if (m.status === 'Paused' && Date.now() < blipUntil) { m.status = 'Playing'; m.upd = Date.now() - 50; }   // (the pause / play blink)      // helper and page clocks agree anyway; keep it exact
      if (m.status === 'Paused' && media?.status !== 'Paused') pausedAt = Date.now();
      const id = (m.artist + '|' + m.title).toLowerCase();
      media = m;
      { const k = id + '|' + (m.vid || ''); if (urlSeen.key === k) urlSeen.n++; else { urlSeen.key = k; urlSeen.n = 1; }
        if (m.vid && urlSeen.n >= 3 && !vidOwner.has(m.vid)) vidOwner.set(m.vid, id); }   // (an address that held for this track)
      if (id !== song) {
        song = id; lines = null; build(); changeAt = Date.now(); curThumb = null;
        { const so = songOf(m), q = `${so.title} ${so.artist}`.trim(); ytmSearch(q); ytmSearch(q, true); }   // started now: ready by the time the picture tells what it is
        followQueue(m);
        if (!YTM_APP.test(m.app || '')) ytmLyrics(m).catch(() => null).then(r => r && r.lines ? r : r && r.noFallback ? { lines: null, video: true } : findLyrics({ ...m, tight: !!(r && r.video) }).then(x => ({ ...x, video: !!(r && r.video) }))).catch(() => ({ lines: null })).then(r => {
          if (song !== id) return;
          const found = !!(r.lines && r.lines.some(x => x.text));          // (for a video in a browser: only the sign that it's music)
          lines = found && !r.video && !np.classList.contains('video') ? r.lines : null; lyrSrc = lines ? r.src || 'lrclib' : ''; build();
          np.classList.toggle('solo', !lines);                                    // no lyrics: a bigger cover in the middle
          document.body.classList.toggle('npsolo', !lines);
          placed = ''; setTimeout(() => { placed = ''; place(); }, 950);
          const enter = () => { if (song === id && !musicMode && !dismissed && !parked && media && media.status === 'Playing') { enterMusic({ title: media.title, sub: media.artist || '' }, true); artKey = ''; } };
          if (found) enter();                                                // a music video in a browser
          else if (!musicMode) looksLikeMusic(m).then(yes => { if (yes) { V('music video in a browser', m.title); enter(); } });
        });
      }
    } else { media = null; }
    try { musicTick(m && m.title ? m : null); } catch (_) {}
    window.__nowPlaying = m && m.title ? { status: m.status, title: m.title } : null;
    setTimeout(poll, pendingMin || musicMode ? 180 : document.hidden ? 3000 : media && media.status === 'Playing' ? 500 : 1500);
  }
  place(); poll(); requestAnimationFrame(render); setInterval(place, 2000);
  // where the cover / video and its names end: the media controls sit just below when there are no lyrics
  // the video's card, for the wallpaper to even out the stripes around it
  setInterval(() => { const on = musicMode && np.classList.contains('video'); const r = artBox.getBoundingClientRect();
    window.setCardBox?.(r.width > 20 ? [r.left / innerWidth, r.top / innerHeight, r.width / innerWidth, r.height / innerHeight] : null, on && r.width > 20); }, 300);
  setInterval(() => { if (!musicMode) return; const b = np.getBoundingClientRect().bottom; if (b > 0) document.body.style.setProperty('--npEnd', Math.min(innerHeight * .86, b + innerHeight * .025) + 'px'); }, 300);
  try { new ResizeObserver(() => layout()).observe(lyrBox); } catch (_) {}
  document.fonts?.addEventListener?.('loadingdone', () => layout());
  window.__lyrics = { findLyrics, parseLRC, clean, state: () => ({ song, lines: lines && lines.length, cur, media, t: now() }) };
})();
