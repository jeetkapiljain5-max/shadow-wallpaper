/* Shadow Launchpad: every Start-menu app in a frosted full-screen grid (macOS-Launchpad style), most-used first.
   Open: two-finger swipe left on the desktop (the helper reads the trackpad and sends F13), or F4.
   Inside: swipe left/right (F13/F14), arrow keys or the dots to change page; Esc or click empty space to close.
   Search: type anything. Besides apps it answers right away: maths (12x12, 15% of 200, sqrt 2), money (200 aed in inr),
   units (5 ft in cm, 30c), world clocks (time in london, 5pm pst in ist), dates (days until christmas), timers (timer 25),
   settings (wifi, bluetooth), folders (downloads), music keys (next, mute), lock, coin / dice / password, define, wiki,
   weather, colours, number bases, and web search (g / yt / wiki / maps / scholar ...).
   Built for speed: grid and icons are prepared once, the blurred background is one snapshot of the wallpaper, and the
   wallpaper stops drawing while Launchpad covers it. */
(() => {
  const L = window.LAUNCH; if (!L) return;
  const base = L.url.replace('/open/', ''), COLS = 7, ROWS = 5, PER = COLS * ROWS;
  const q2s = o => new URLSearchParams({ ...o, t: L.token }).toString();
  const call = (path, o = {}) => (path === 'launch' || path === 'web') && window.__lpFast ? window.__lpFast(path, o)
    : fetch(`${base}/${path}?${q2s(o)}`, { cache: 'no-store', mode: 'no-cors' }).catch(() => {});
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} } };
  const LOC = navigator.language || 'en-IN';

  /* ================================================================ look ================================================================ */
  // Proportions follow macOS Launchpad: small centred search field, 7 x 5 grid, ~9.4vh icons, 1.4vh labels, round page dots.
  const EASE = 'cubic-bezier(.2,.9,.25,1)';                       // macOS-like: quick start, long soft settle
  const css = document.createElement('style');
  css.textContent = `
  @font-face{font-family:'Shadow SF';src:url('fonts/SF-Pro-Text-Regular.otf') format('opentype');font-weight:400;font-display:swap}
  @font-face{font-family:'Shadow SF';src:url('fonts/SF-Pro-Text-Medium.otf') format('opentype');font-weight:500;font-display:swap}
  @font-face{font-family:'Shadow SF';src:url('fonts/SF-Pro-Text-Semibold.otf') format('opentype');font-weight:600;font-display:swap}
  @font-face{font-family:'Shadow SF Display';src:url('fonts/SF-Pro-Display-Semibold.otf') format('opentype');font-weight:600;font-display:swap}
  #lp{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;overflow:hidden;
      opacity:0;pointer-events:none;visibility:hidden;contain:strict;
      transition:opacity .22s ease-out,visibility 0s linear .24s;
      font-family:"Shadow SF","SF Pro Text","SF Pro","Segoe UI Variable Text",system-ui,sans-serif;color:#fff;user-select:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  #lp.open{opacity:1;pointer-events:auto;visibility:visible;transition:opacity .2s ease-out,visibility 0s}
  html.overlay #lpBg{display:none}                                  /* over your apps: their live blur shows instead, under a soft tint */
  html.overlay #lp{background:none}                                /* over your apps: nothing outside the frosted panel - no tint, no vignette (it showed as a dark box) */
  html.overlay #lp::after{display:none}
  html.overlay #lpIn{scale:.82}                                     /* over your apps: a smaller Launchpad, sitting a little lower */
  html.overlay #lpSB{margin-top:9vh;background:rgba(255,255,255,.13);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}   /* over your apps: see-through, like it looks while the genie pours in */
  html.overlay .lpi > span{display:none}                            /* over your apps: icons only */
  html.overlay .lpi{align-self:center}                              /* ...so the highlight hugs the icon (no room for a name that isn't there) */
  html.overlay #lp.q .lpi.sel,html.overlay #lpTrack .lpi.sel,#lp.big #lpTrack .lpi.sel{z-index:3}
  html.overlay #lpTrack .lpi.sel > span,#lp.big #lpTrack .lpi.sel > span{display:block;position:absolute;left:50%;top:calc(100% - .2vh);transform:translateX(-50%);max-width:15vh;pointer-events:none}
  html.overlay #lpTrack .lpi.sel::before,#lp.big #lpTrack .lpi.sel::before{bottom:-2.6vh}
  #lpTrack .lpi::before{content:"";position:absolute;inset:0;border-radius:1.6vh;background:rgba(255,255,255,.15);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18);opacity:0;transition:opacity .14s ease-out;pointer-events:none}
  #lpTrack .lpi.sel::before{opacity:1}
  html.overlay #lp.q .lpi.sel > span{display:block;position:absolute;left:50%;top:calc(100% - .2vh);transform:translateX(-50%);max-width:15vh;pointer-events:none}
  html.overlay #lp.q .lpi.sel::before{bottom:-2.6vh}
  /* searching over your apps: the bar and the answers take the panel's whole width, and a long answer (wiki) fills its height and scrolls */
  #lp.q #lpSB,#lp.q #lpAns{width:min(92vw,126vh)}
  #lp .ar .aw{max-height:62vh;overflow-y:auto;overscroll-behavior:contain;padding-right:1vh;cursor:grab}
  #lp.bigAns .ar .aw{height:62vh}
  #lp .ar .aw::-webkit-scrollbar{width:.6vh}
  .ar .aw h4{margin:1.8vh 0 .7vh;font:600 2vh "Shadow SF",sans-serif;color:#fff}
  #lp .ar .aw::-webkit-scrollbar-thumb{background:rgba(255,255,255,.28);border-radius:1vh}
  #lp .ar .aw::-webkit-scrollbar-track{background:transparent}
  /* over your apps it opens like a Mac app: zooms up out of the bottom of the screen (where Start is) and back down into it -
     the overlay window runs the same curves, so the frosted panel zooms with it */
  html.overlay #lp:not(.fopen) #lpIn{transform:none}
  /* power (over your apps only): hidden in the bottom-right corner of the app grid, shows while the pointer is there */
  #lpIn{position:relative}
  #lpPwrZone{position:absolute;right:calc((100% - min(92vw,126vh)) / 2);top:89vh;width:13vh;height:7vh;z-index:8}
  #lpPwr{position:absolute;right:1.4vh;bottom:1.4vh;width:3.6vh;height:3.6vh;border:0;padding:0;background:none;outline:none;cursor:pointer;
      opacity:0;transform:scale(.8) translateY(.5vh);transition:opacity .3s ease,transform .45s ${EASE}}
  #lpPwr svg{width:100%;height:100%;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;filter:drop-shadow(0 .2vh .6vh rgba(0,0,0,.4))}
  #lpPwrZone:hover #lpPwr,#lpPwrZone.menu #lpPwr{opacity:1;transform:none}
  #lpPwrZone:hover #lpPwr:hover{transform:scale(1.08)}
  #lpPwr:active{transform:scale(.92)!important;transition-duration:.12s}
  #lpPwrMenu{position:absolute;right:0;bottom:6.4vh;width:24vh;padding:.8vh;border-radius:2.2vh;background:rgba(36,36,40,.8);
      box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.2),0 1.6vh 4vh rgba(0,0,0,.4);backdrop-filter:blur(3vh) saturate(1.6);
      opacity:0;pointer-events:none;transform:scale(.92) translateY(1vh);transform-origin:100% 100%;transition:opacity .18s ease,transform .3s ${EASE}}
  #lpPwrZone.menu #lpPwrMenu{opacity:1;pointer-events:auto;transform:none}
  #lpPwrMenu .mi{display:flex;align-items:center;gap:1.4vh;padding:1.2vh 1.4vh;border-radius:1.4vh;font:500 1.9vh "Shadow SF","Segoe UI Variable Text",sans-serif;color:#fff;cursor:pointer;transition:background-color .12s,transform .12s}
  #lpPwrMenu .mi svg{width:2.2vh;height:2.2vh;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
  #lpPwrMenu .mi:hover{background:rgba(255,255,255,.17)}
  #lpPwrMenu .mi:active{transform:scale(.97)}
  html.overlay:not(.gn) #lp{transform-origin:50% 97%;transform:scale(.1);transition:opacity .2s ease-in .05s,transform .26s cubic-bezier(.5,0,.75,.35),visibility 0s linear .27s}
  html.gn #lp,html.gn #lp.open{transform:none;transition:visibility 0s}
  html.gn #lp.gh{opacity:0!important}
  html.overlay:not(.gn) #lp.open{transform:none;transition:opacity .08s ease-out,transform .4s cubic-bezier(.16,1,.3,1),visibility 0s}
  #lpBg{position:absolute;inset:-4%;width:108%;height:108%;z-index:-1;transform:scale(1.04);transition:transform .5s ${EASE}}
  #lp.open #lpBg{transform:none}
  #lp::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
      background:radial-gradient(130% 100% at 50% 40%,rgba(0,0,0,.1) 30%,rgba(0,0,0,.38) 100%)}
  #lpIn{display:flex;flex-direction:column;align-items:center;width:100%;height:100%;transform:scale(1.1);
      transition:transform .42s ${EASE}}
  #lp.open #lpIn{transform:none}
  #lp.closing #lpIn{transform:scale(1.1);transition:transform .26s cubic-bezier(.4,0,.8,.6)}

  /* liquid-glass search capsule (macOS): icon + "Search" centred as one group; when you type the group glides left */
  #lpSB{position:relative;margin-top:7vh;width:40vh;height:5.4vh;flex:none;border-radius:99px;transition:width .42s ${EASE}}
  #lp.q #lpSB,#lp.wide #lpSB{width:min(92vw,126vh)}                 /* searching: the bar spans the app grid's width */
  .lgCanvas{position:absolute;pointer-events:none;z-index:-1}
  .lgHost{isolation:isolate}
  #lpSB.nogl{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.08));box-shadow:inset 0 .07vh 0 rgba(255,255,255,.5),inset 0 0 0 .07vh rgba(255,255,255,.18),0 .6vh 2vh rgba(0,0,0,.2)}
  #lpPh{position:absolute;z-index:2;top:0;bottom:0;left:50%;display:flex;align-items:center;gap:.75vh;transform:translateX(-50%);pointer-events:none;
      transition:left .42s ${EASE},transform .42s ${EASE}}
  #lp.q #lpPh,#lp.typing #lpPh{left:2vh;transform:none}
  #lpMag{width:2.15vh;height:2.15vh;flex:none;opacity:.95;filter:drop-shadow(0 .08vh .25vh rgba(0,0,0,.45));
      background:no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='M15.5 15.5 21 21'/%3E%3C/svg%3E")}
  #lpPh span{font-size:2.2vh;line-height:1;letter-spacing:-.012em;color:rgba(255,255,255,.86);text-shadow:0 .08vh .35vh rgba(0,0,0,.5);transition:opacity .14s,transform .42s ${EASE}}
  #lp.q #lpPh span{opacity:0}
  #lp.typing:not(.q) #lpPh span{transform:translateX(.35vh);opacity:.6}
  #lpSearch{position:relative;z-index:3;display:block;width:100%;height:100%;box-sizing:border-box;padding:0 2.6vh 0 5.1vh;border:0;outline:none;background:transparent;border-radius:inherit;
      font:500 2.2vh/1 "Shadow SF","SF Pro Text",system-ui,sans-serif;letter-spacing:-.012em;color:#fff;caret-color:transparent;text-align:left;text-shadow:0 .08vh .35vh rgba(0,0,0,.55),0 0 .12vh rgba(0,0,0,.35)}
  #lpSearch::selection{background:transparent}
  #lpPh,#lpSearch,#lpCaret,#lpSelHi{translate:var(--ext,0px) 0}
  #lpSB.clipL #lpSearch{-webkit-mask-image:linear-gradient(to right,transparent 4.6vh,#000 6.6vh);mask-image:linear-gradient(to right,transparent 4.6vh,#000 6.6vh)}
  #lpMeas{position:absolute;visibility:hidden;white-space:pre;font:500 2.2vh/1 "Shadow SF","SF Pro Text",system-ui,sans-serif;letter-spacing:-.012em;pointer-events:none}
  #lpCaret{position:absolute;z-index:4;left:0;top:50%;width:.22vh;min-width:2px;height:2.6vh;margin-top:-1.3vh;border-radius:2px;background:#fff;
      box-shadow:0 0 .4vh rgba(255,255,255,.35);opacity:0;pointer-events:none;transition:transform .09s ease-out}
  #lp.typing #lpCaret{opacity:1;animation:lpBlink 1.06s step-end infinite}
  #lp.typing #lpCaret.solid{animation:none}
  @keyframes lpBlink{0%{opacity:1}50%{opacity:0}}
  #lpSelHi{position:absolute;z-index:1;top:50%;height:2.9vh;margin-top:-1.45vh;border-radius:.4vh;background:rgba(120,170,255,.45);opacity:0;pointer-events:none}
  /* answers (Spotlight-style card under the search field) */
  #lpAns{width:74vh;flex:none;margin-top:1.4vh;border-radius:2.6vh;display:none;position:relative;
      background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.07));backdrop-filter:blur(2vh) saturate(1.8);
      box-shadow:inset 0 .07vh 0 rgba(255,255,255,.45),inset 0 0 0 .07vh rgba(255,255,255,.14),0 1.6vh 4.5vh rgba(0,0,0,.28)}
  #lpAns.on{display:block}
  #lpAns.lgHost{background:none !important;backdrop-filter:none !important;box-shadow:none !important}
  #lpAnsRows{position:relative}
  #lpAnsRows .ar:first-child{border-radius:2.6vh 2.6vh 0 0}
  #lpAnsRows .ar:last-child{border-radius:0 0 2.6vh 2.6vh}
  #lpAnsRows .ar:only-child{border-radius:2.6vh}
  @keyframes lpAnsIn{from{opacity:0;transform:translateY(-.6vh) scale(.99)}}
  .ar{display:flex;align-items:center;gap:1.7vh;padding:1.35vh 2vh;cursor:pointer;position:relative;transition:background-color .12s}
  .ar + .ar{box-shadow:inset 0 .5px 0 rgba(255,255,255,.09)}
  .ar.sel{background:rgba(255,255,255,.12)}
  .ar .ai{flex:none;width:3.9vh;height:3.9vh;border-radius:1.1vh;display:grid;place-items:center;background:rgba(255,255,255,.14)}
  .ar .ai svg{width:2.2vh;height:2.2vh;fill:none;stroke:#fff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .ar .ai.sw{box-shadow:inset 0 0 0 .5px rgba(255,255,255,.4)}
  .ar .ai.art{width:4.6vh;height:4.6vh;border-radius:.9vh;overflow:hidden;background:rgba(255,255,255,.1);box-shadow:0 .3vh 1vh rgba(0,0,0,.25)}
  .ar .ai.art.round{border-radius:50%}
  .ar .ai.art img{width:100%;height:100%;object-fit:cover;display:block}
  .ar .tx{flex:1;min-width:0}
  .ar .at{font-size:2vh;font-weight:500;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ar .as{font-size:1.5vh;color:rgba(255,255,255,.72);margin-top:.4vh;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ar .as.wrap{white-space:normal;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;line-height:1.38}
  /* a whole Wikipedia introduction: the box grows into the free space and the apps step aside */
  #lp.bigAns #lpView,#lp.bigAns #lpDots{display:none}
  #lp.bigAns .ar.hero{align-items:flex-start}
  .ar .aw{margin-top:1.4vh;max-height:calc(100vh - 40vh);overflow:hidden;font:400 1.85vh/1.55 "Shadow SF",sans-serif;color:rgba(255,255,255,.92);
      text-shadow:0 .05vh .25vh rgba(0,0,0,.35);-webkit-mask-image:linear-gradient(#000 88%,transparent);mask-image:linear-gradient(#000 88%,transparent)}
  .ar .aw p{margin:0 0 1.1vh}
  .ar .aw img{float:right;max-width:20vh;max-height:22vh;margin:.3vh 0 1vh 2vh;border-radius:1.4vh;object-fit:cover;box-shadow:0 .6vh 1.8vh rgba(0,0,0,.3)}
  .ar.hero{padding:2vh 2.2vh}
  .ar.hero .ai{width:5.2vh;height:5.2vh;border-radius:1.4vh}
  .ar.hero .ai svg{width:2.9vh;height:2.9vh}
  .ar.hero .at{font-family:'Shadow SF Display','Shadow SF',sans-serif;font-size:4vh;font-weight:600;letter-spacing:-.015em;font-variant-numeric:tabular-nums}
  .ar .ak{flex:none;font-size:1.35vh;opacity:0;padding:.5vh .9vh;border-radius:.7vh;background:rgba(255,255,255,.14);transition:opacity .15s,background-color .15s,color .15s}
  .ar.sel .ak{opacity:.85}
  /* like Windows search: filters under the bar, and an app's own actions as small buttons in its row */
  #lpFilt{display:none;flex:none;gap:1.1vh;margin-top:1.8vh;width:min(92vw,126vh);flex-wrap:wrap;justify-content:flex-start}
  #lpFilt.on{display:flex}
  #lpFilt .fc{font-size:2.25vh;font-weight:500;padding:1vh 2.2vh;border-radius:99px;cursor:pointer;color:rgba(255,255,255,.88);
      background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18);transition:background-color .15s,color .15s}
  #lpFilt .fc:hover{background:rgba(255,255,255,.18)}
  #lpFilt .fc.cur{background:rgba(255,255,255,.92);color:#111;box-shadow:none}
  .ar .achips{flex:none;display:flex;gap:.6vh}
  .ar .ach{font-size:1.35vh;padding:.55vh 1.1vh;border-radius:99px;background:rgba(255,255,255,.13);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.2);cursor:pointer;transition:background-color .15s,color .15s}
  .ar .ach:hover{background:rgba(255,255,255,.24)}
  .ar .ach.done{background:rgba(255,255,255,.92);color:#111}
  /* ---------- ShadowUI search: typing turns Launchpad into the results. Everything found is a Launchpad tile, in a row per kind
     (the strongest kind first); a strong answer is a card across the top; web searches and other answers are pills; what's selected,
     and what you can do with it, sits in a caption along the bottom. No panes, no boxes: it's Launchpad. ---------- */
  #lp.q #lpView,#lp.q #lpDots,#lp.q #lpEmpty,#lp.q #lpPwrZone{display:none}
  #lpPrev{display:none}
  #lp.q #lpAns.on{display:block;flex:1 1 auto;min-height:0;margin:1.2vh 0 0;width:min(92vw,126vh);overflow:hidden;
      background:none !important;box-shadow:none !important;backdrop-filter:none !important;border-radius:0}
  #lp.q #lpAns > .lgCanvas{display:none}
  #lp.q #lpAnsRows{height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:.4vh 0 3vh;box-sizing:border-box;
      -webkit-mask-image:linear-gradient(#000 calc(100% - 3.5vh),transparent);mask-image:linear-gradient(#000 calc(100% - 3.5vh),transparent)}
  #lp.q #lpAnsRows::-webkit-scrollbar{display:none}
  /* a row of one kind: a quiet label, then Launchpad tiles */
  .sxg{margin-top:1.8vh}
  .sxg:first-child{margin-top:.2vh}
  .sxg > h6{display:flex;align-items:baseline;gap:1.4vh;margin:0 0 .6vh 2vh;font:600 2vh 'Shadow SF',sans-serif;color:rgba(255,255,255,.76);letter-spacing:.01em;text-shadow:0 .1vh .4vh rgba(0,0,0,.35)}
  .sxg > h6 b{font-weight:500;font-size:1.8vh;color:rgba(255,255,255,.6);cursor:pointer;padding:.3vh .8vh;margin:-.3vh 0;border-radius:.8vh;transition:color .15s,background-color .15s}
  .sxg > h6 b:hover{background:rgba(255,255,255,.1)}
  .sxg > h6 b::after{content:" ›"}
  .sxg > h6 b:hover{color:#fff}
  .sxr{display:grid;grid-template-columns:repeat(${COLS},1fr);padding:0 1vh;row-gap:.6vh}
  #lpAnsRows .lpi.sx > span{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.25;max-width:16vh;text-align:center;font-size:1.85vh;font-weight:600}
  /* every result is a big icon; the selected one eases down and says its name */
  #lp #lpAnsRows .lpi.sx{height:17.4vh;justify-content:center;gap:0;padding:.6vh 0;box-sizing:border-box;align-self:start}
  #lp #lpAnsRows .lpi.sx .ic{width:11.4vh;height:11.4vh;border-radius:2.6vh;transition:width .26s cubic-bezier(.2,.9,.25,1),height .26s cubic-bezier(.2,.9,.25,1),border-radius .26s,filter .2s}
  #lp #lpAnsRows .lpi.sx.sel .ic{width:10.2vh;height:10.2vh;border-radius:2.35vh}
  #lp #lpAnsRows .lpi.sx > span,#lp #lpAnsRows .lpi.sx.sel > span{display:-webkit-box;position:static;transform:none;visibility:visible;max-height:0;opacity:0;margin-top:0;
      transition:max-height .26s cubic-bezier(.2,.9,.25,1),opacity .18s ease-out,margin-top .26s cubic-bezier(.2,.9,.25,1)}
  #lp #lpAnsRows .lpi.sx.sel > span{max-height:5vh;opacity:1;margin-top:.8vh}
  #lp #lpAnsRows .lpi.sx.sel::before{bottom:0}
  #lp #lpAnsRows.rr .lpi.sx .ic,#lp #lpAnsRows.rr .lpi.sx > span{transition:none}
  html.overlay #lpAnsRows .lpi.sxapp > span,html.overlay #lpAnsRows .lpi.sxapp.sel > span,#lp.big #lpAnsRows .lpi.sxapp > span,#lp.big #lpAnsRows .lpi.sxapp.sel > span{display:-webkit-box;position:static;transform:none;visibility:hidden}   /* room kept for the name, so nothing moves */
  html.overlay #lpAnsRows .lpi.sxapp.sel > span,#lp.big #lpAnsRows .lpi.sxapp.sel > span{visibility:visible}
  html.overlay #lpAnsRows .lpi.sxapp.sel::before,#lp.big #lpAnsRows .lpi.sxapp.sel::before{bottom:0}
  html.overlay #lpAnsRows .lpi.sxapp,#lp.big #lpAnsRows .lpi.sxapp{align-self:start}
  /* names: apps follow your Launchpad (no names over your apps, or with large icons - the selected one shows its name); everything else always says what it is */
  html.overlay #lpAns .lpi.sx:not(.sxapp) > span,html.overlay #lpAns .lpi.sx:not(.sxapp).sel > span,#lp.big #lpAns .lpi.sx:not(.sxapp) > span,#lp.big #lpAns .lpi.sx:not(.sxapp).sel > span{display:-webkit-box;position:static;transform:none}
  html.overlay #lpAns .lpi.sx:not(.sxapp).sel::before,#lp.big #lpAns .lpi.sx:not(.sxapp).sel::before{bottom:0}
  html.overlay #lpAns .lpi.sx:not(.sxapp),#lp.big #lpAns .lpi.sx:not(.sxapp){align-self:start}
  /* Launchpad over your apps: every result says its name while searching (the home grid keeps its own look) */
  html.overlay #lp #lpAnsRows .lpi.sx .ic{width:10.4vh;height:10.4vh;border-radius:2.4vh}
  html.overlay #lp #lpAnsRows .lpi.sx.sel .ic{width:9.8vh;height:9.8vh;border-radius:2.25vh}
  html.overlay #lp #lpAnsRows .lpi.sx > span,html.overlay #lp #lpAnsRows .lpi.sx.sel > span{visibility:visible;max-height:5vh;opacity:.8;margin-top:.8vh}
  html.overlay #lp #lpAnsRows .lpi.sx.sel > span{opacity:1}
  /* pictures for what isn't an app: a white glyph on colour (like an app icon), a real thumbnail, a Store logo, album art */
  #lp #lpAns .ic.sxgl{background:linear-gradient(155deg,var(--t1),var(--t2));border-radius:2.15vh;box-shadow:inset 0 .1vh 0 rgba(255,255,255,.28),0 .5vh 1.2vh rgba(0,0,0,.28)}
  #lp #lpAns .ic.sxgl svg{width:48%;height:48%;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  #lp #lpAns .ic.sxim{background:none;box-shadow:none}
  #lp #lpAns .ic.sxim img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 .4vh .7vh rgba(0,0,0,.28))}
  #lp #lpAns .ic.sxim.cover,#lp #lpAns .ic.sxim.plate{overflow:hidden;border-radius:2.15vh;background:rgba(255,255,255,.08);box-shadow:0 .5vh 1.2vh rgba(0,0,0,.28)}
  #lp #lpAns .ic.sxim.cover img{object-fit:cover;filter:none}
  #lp #lpAns .ic.sxim.plate img{filter:none}
  #lp #lpAns .ic.sxim.round{border-radius:50%}
  #lp #lpAns .ic.sxim.nf{background:linear-gradient(155deg,#a3abb7,#5f6774);border-radius:2.15vh}
  #lp #lpAns .ic.sxsw{border-radius:2.15vh;box-shadow:inset 0 0 0 .12vh rgba(255,255,255,.35),0 .5vh 1.2vh rgba(0,0,0,.28)}
  /* a strong answer (a sum, the weather, Wikipedia ...): a card across the top */
  .sxh{margin:.2vh 1.6vh 1vh;padding:2.4vh 2.8vh;border-radius:2.6vh;background:rgba(255,255,255,.07);cursor:pointer;transition:background-color .15s}
  .sxh.sel{background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18)}
  .sxhh{display:flex;align-items:center;gap:2.6vh}
  #lp .sxh .ic{width:8.4vh;height:8.4vh;flex:none}
  .sxhx{min-width:0;flex:1}
  .sxht{font:600 5.4vh/1.06 'Shadow SF Display','Shadow SF',sans-serif;letter-spacing:-.02em;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
  .sxht.long{font-size:3.4vh;line-height:1.18}
  .sxht.free{font:500 2.3vh/1.45 'Shadow SF',sans-serif}
  .sxht.mono{font:500 3.2vh Consolas,monospace}
  .sxhs{margin-top:.8vh;font-size:2.1vh;line-height:1.4;color:rgba(255,255,255,.62)}
  .sxh .aw{margin-top:2vh;max-height:36vh;overflow-y:auto;overscroll-behavior:contain;padding-right:1vh;cursor:grab;scrollbar-width:thin;
      font:400 1.95vh/1.6 'Shadow SF',sans-serif;color:rgba(255,255,255,.9)}
  .sxh .aw p{margin:0 0 1.1vh}
  .sxh .aw h4{margin:1.8vh 0 .7vh;font:600 2.2vh 'Shadow SF',sans-serif;color:#fff}
  .sxh .aw img{float:right;max-width:18vh;max-height:20vh;margin:0 0 1vh 2.2vh;border-radius:1.6vh;object-fit:cover}
  .sxh.load .sxht{opacity:.55}
  /* pills: web searches, and answers that are a line of text */
  .sxp{display:flex;flex-wrap:wrap;gap:1vh;padding:0 1.6vh}
  .sxpl{display:flex;align-items:center;gap:1.1vh;padding:1.3vh 2.2vh;min-height:5vh;box-sizing:border-box;border-radius:99px;background:rgba(255,255,255,.09);font-size:2.2vh;cursor:pointer;max-width:46vh;min-width:0;transition:background-color .15s}
  .sxpl > svg{width:2vh;height:2vh;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;opacity:.7}
  .sxpl > span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sxpl > span b{font-weight:500}
  .sxpl.ans{border-radius:1.8vh;padding:1vh 1.8vh 1vh 1.1vh}
  .sxpl.ans > span small{display:block;font-size:1.7vh;color:rgba(255,255,255,.58);margin-top:.15vh;overflow:hidden;text-overflow:ellipsis}
  .sxpl.sel{background:rgba(255,255,255,.15);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18)}
  .lpNo{padding:4vh 1.6vh;text-align:center;font-size:1.95vh;color:rgba(255,255,255,.6)}
  /* small pictures (pills, the caption) */
  .ri{flex:none;width:4.4vh;height:4.4vh;border-radius:1.1vh;display:grid;place-items:center;position:relative;overflow:hidden}
  .ri.tile{background:linear-gradient(155deg,var(--t1),var(--t2))}
  .ri.tile svg{width:56%;height:56%;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .ri.img{overflow:visible}
  .ri.img img{width:100%;height:100%;object-fit:contain}
  .ri.img.cover,.ri.img.plate{overflow:hidden;background:rgba(255,255,255,.08)}
  .ri.img.cover img{object-fit:cover}
  .ri.img.round{border-radius:50%}
  .ri.img.nf{background:linear-gradient(155deg,#a3abb7,#5f6774)}
  .ri.sw{box-shadow:inset 0 0 0 .1vh rgba(255,255,255,.35)}
  /* the caption: what's selected, and what you can do with it */
  #lpCap{display:none;flex:none;width:min(92vw,126vh);margin:.4vh 0 4.4vh;padding:1.5vh 1.8vh 0;box-sizing:border-box;align-items:center;gap:1.7vh;box-shadow:inset 0 .07vh 0 rgba(255,255,255,.1)}
  #lp.q #lpCap.on{display:flex}
  #lpCap .ri{width:5.6vh;height:5.6vh;border-radius:1.4vh}
  .sxct{flex:1;min-width:0}
  .sxct b{display:block;font:600 2.5vh 'Shadow SF',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sxct span{display:block;margin-top:.4vh;font-size:1.9vh;color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sxa{display:flex;gap:.9vh;flex:none}
  .sxab{display:flex;align-items:center;gap:.9vh;padding:1.25vh 2vh;min-height:4.8vh;box-sizing:border-box;border-radius:99px;background:rgba(255,255,255,.11);font-size:2.05vh;font-weight:500;cursor:pointer;white-space:nowrap;transition:background-color .15s,transform .12s}
  .sxab svg{width:2vh;height:2vh;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .sxab kbd{font:500 1.55vh 'Shadow SF',sans-serif;opacity:.6;margin-left:.3vh}
  .sxab:hover{background:rgba(255,255,255,.17)}
  .sxab:active{transform:scale(.96)}
  .sxab.primary{background:#f2f2f4;color:#111;font-weight:600}
  .sxab.done{background:rgba(110,220,150,.34);color:#fff}
  #lpCap > .sxct{animation:lpCapIn .16s cubic-bezier(.2,.9,.25,1) both}
  #lpCap.still > *{animation:none}
  @keyframes lpCapIn{from{opacity:.2;transform:translateY(.3vh)}}
  /* new results arrive with a quick ripple; later refreshes don't replay it */
  #lpAnsRows .lpi::before{content:"";position:absolute;inset:0;border-radius:1.6vh;background:rgba(255,255,255,.15);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18);opacity:0;transition:opacity .14s ease-out}
  #lpAnsRows .lpi.sel::before{opacity:1}
  #lpAnsRows.rr .lpi::before{transition:none}
  #lpAnsRows .ic img{opacity:0;transition:opacity .22s ease-out}
  #lpAnsRows .ic img.ld{opacity:1}
  #lpAnsRows.capf .lpi.sel::before{opacity:.45}
  #lpAnsRows.capf .sxpl.sel,#lpAnsRows.capf .sxh.sel{background:rgba(255,255,255,.09)}
  .sxab.kf{background:rgba(255,255,255,.24);box-shadow:0 0 0 .22vh rgba(255,255,255,.9)}
  .sxab.primary.kf{background:#fff;box-shadow:0 0 0 .22vh rgba(255,255,255,.9),0 0 0 .5vh rgba(255,255,255,.25)}
  #lpAnsRows .nw{animation:lpTileIn .28s cubic-bezier(.2,.9,.25,1) both;animation-delay:calc(var(--i,0) * 12ms)}
  @keyframes lpTileIn{from{opacity:0;transform:translateY(.8vh) scale(.95)}}
  #lpAnsRows .lpi.done .ic,#lpAnsRows .sxpl.done,#lpAnsRows .sxh.done{transition:filter .15s;filter:brightness(1.35)}
  /* filters: a quiet row of words; the one you're in has Launchpad's highlight */
  #lpFilt .fc{background:none;box-shadow:none;color:rgba(255,255,255,.62);border-radius:1.6vh;transition:color .15s,background-color .15s}
  #lpFilt .fc:hover{background:none;color:#fff}
  #lpFilt .fc.cur{color:#fff;background:rgba(255,255,255,.15);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18)}
  #lpFilt .fc{color:rgba(255,255,255,.72)}
  @media (prefers-reduced-motion: reduce){#lpAnsRows .nw,#lpCap > .sxct{animation:none}#lpAnsRows .lpi::before{transition:none}}
  .ar.done .ak{opacity:1;background:rgba(255,255,255,.92);color:#111}
  .ar.load .at{opacity:.6}

  /* grid */
  #lpView{width:min(92vw,126vh);height:68vh;align-self:center;flex:none;overflow:hidden;margin-top:7.4vh;position:relative}
  #lp.q #lpView{margin-top:2.6vh}
  #lpTrack{display:flex;height:100%;transition:transform .46s ${EASE}}
  #lpTrack.moving{will-change:transform}
  .lpPage{flex:0 0 100%;height:100%;display:grid;grid-template-columns:repeat(${COLS},1fr);grid-template-rows:repeat(${ROWS},13.6vh);align-content:start;padding:0 1vh;box-sizing:border-box}
  .lpi{display:flex;flex-direction:column;align-items:center;gap:.8vh;padding:.7vh 0 .85vh;cursor:pointer;position:relative;margin:0 .5vh;border-radius:1.6vh}
  .lpi.sel::before{content:"";position:absolute;inset:0;border-radius:1.6vh;background:rgba(255,255,255,.15);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.18)}
  .ic{width:9.4vh;height:9.4vh;display:grid;place-items:center;border-radius:2.15vh;position:relative;transition:transform .2s ${EASE},filter .2s}
  .ic img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 .4vh .7vh rgba(0,0,0,.28))}
  .lpi:active .ic,.lpi.press .ic{filter:brightness(.62);transform:scale(.97);transition-duration:.06s}
  .lpi span{position:relative;max-width:13.5vh;font-size:1.4vh;line-height:1.35;padding-bottom:.1vh;font-weight:500;letter-spacing:-.003em;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
       color:#fff;text-shadow:0 .08vh .3vh rgba(0,0,0,.6)}
  /* icon styles */
  #lp.tiles .ic{background:linear-gradient(160deg,rgba(255,255,255,.26),rgba(255,255,255,.08) 60%,rgba(255,255,255,.05));
       box-shadow:inset 0 0 0 .5px rgba(255,255,255,.32),inset 0 .1vh 0 rgba(255,255,255,.36),0 .6vh 1.6vh rgba(0,0,0,.22)}
  #lp.tiles .ic img{width:58%;height:58%;filter:drop-shadow(0 .2vh .4vh rgba(0,0,0,.25))}
  #lp.soft .ic{background:linear-gradient(160deg,hsl(var(--h,0) calc(var(--s,0%) * .7) 74% / .32),hsl(var(--h,0) var(--s,0%) 42% / .16) 70%);
       box-shadow:inset 0 0 0 .5px rgba(255,255,255,.3),inset 0 .1vh 0 rgba(255,255,255,.34),0 .5vh 1.4vh rgba(0,0,0,.2);transition:background .5s,transform .2s ${EASE},filter .2s}
  #lp.soft .ic img{width:56%;height:56%;filter:saturate(.82) drop-shadow(0 .2vh .4vh rgba(0,0,0,.22))}
  #lp.mono .ic img{filter:grayscale(1) contrast(1.06) brightness(1.08) drop-shadow(0 .3vh .5vh rgba(0,0,0,.28))}
  #lpDots{display:flex;gap:1.1vh;height:4vh;align-items:center;margin-top:1vh;flex:none}
  #lpDots i{width:.8vh;height:.8vh;border-radius:50%;background:rgba(255,255,255,.34);cursor:pointer;transition:background-color .3s,transform .3s ${EASE}}
  #lpDots i.on{background:rgba(255,255,255,.96)}
  #lpDots i:hover{transform:scale(1.25)}
  #lp.q #lpDots{visibility:hidden}
  #lpEmpty{position:absolute;inset:0;display:none;place-items:center;font-size:1.8vh;color:rgba(255,255,255,.7)}
  /* edit mode: wiggle, delete badge, drag, folders */
  #lp.wiggle .lpi .ic{animation:lpJig var(--jd,.26s) cubic-bezier(.45,.05,.55,.95) var(--jo,0s) infinite alternate;transform-origin:50% 55%}
  @keyframes lpJig{0%{transform:rotate(calc(-1.9deg * var(--ja,1))) translate3d(0,.05vh,0)}100%{transform:rotate(calc(1.9deg * var(--ja,1))) translate3d(0,-.05vh,0)}}
  .lpi .x{position:absolute;z-index:3;top:-.7vh;left:-.7vh;width:2.35vh;height:2.35vh;border-radius:50%;background:rgba(232,232,237,.94);
      box-shadow:0 .15vh .5vh rgba(0,0,0,.35),inset 0 0 0 .05vh rgba(0,0,0,.12);transform:scale(0);opacity:0;
      transition:transform .42s cubic-bezier(.3,1.7,.45,1) var(--bd,0s),opacity .15s var(--bd,0s);cursor:pointer}
  .lpi .x:hover{background:#fff}
  .lpi .x:active{transform:scale(.88) !important}
  .lpi .x::before,.lpi .x::after{content:"";position:absolute;left:50%;top:50%;width:1.05vh;height:.2vh;margin:-.1vh 0 0 -.525vh;border-radius:.2vh;background:#3a3a3c;transform:rotate(45deg)}
  .lpi .x::after{transform:rotate(-45deg)}
  #lp.wiggle .lpi .x{transform:scale(1);opacity:1}
  #lp.wiggle .lpi:active .ic{filter:none}
  .lpi.dragging{visibility:hidden}
  .lpi.ftarget .ic{transform:scale(1.16) !important;animation:none !important}
  .lpi.ftarget .ic::before{content:"";position:absolute;inset:-1.1vh;border-radius:2.8vh;background:rgba(255,255,255,.22);box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.3);z-index:-1}
  .lpGhost{position:fixed;left:0;top:0;z-index:70;pointer-events:none;filter:drop-shadow(0 1.2vh 1.8vh rgba(0,0,0,.35))}
  .lpGhost .ic{width:100% !important;height:100% !important}
  .lpGhost .x{display:none}
  .lpi.folder .ic{box-sizing:border-box;padding:1.05vh;border-radius:2.15vh;background:rgba(255,255,255,.17);
      box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.26),inset 0 .1vh 0 rgba(255,255,255,.28),0 .5vh 1.4vh rgba(0,0,0,.18)}
  .fgrid{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:min-content;gap:.42vh;width:100%;height:100%;align-content:start}
  .fgrid img{width:100% !important;height:auto !important;aspect-ratio:1;object-fit:contain;filter:none !important}
  #lpBar{position:absolute;z-index:46;top:7.6vh;right:4.5vw;display:none;gap:1vh}
  #lp.wiggle #lpBar{display:flex}
  #lpSizeBar{position:absolute;z-index:46;top:7.6vh;left:4.5vw;display:none}
  #lp.wiggle #lpSizeBar{display:flex}
  #lpSize{display:flex;align-items:center;gap:.9vh}
  #lpSize i{width:1.9vh;height:1.9vh;flex:none;background:currentColor;opacity:.95;
      -webkit-mask:var(--szi) center/contain no-repeat;mask:var(--szi) center/contain no-repeat}
  #lpSize{--szi:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='3' width='7.5' height='7.5' rx='2'/%3E%3Crect x='13.5' y='3' width='7.5' height='7.5' rx='2'/%3E%3Crect x='3' y='13.5' width='7.5' height='7.5' rx='2'/%3E%3Crect x='13.5' y='13.5' width='7.5' height='7.5' rx='2'/%3E%3C/svg%3E")}
  #lp.big #lpSize{--szi:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='3' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='9.7' y='3' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='16.4' y='3' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='3' y='9.7' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='9.7' y='9.7' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='16.4' y='9.7' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='3' y='16.4' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='9.7' y='16.4' width='4.6' height='4.6' rx='1.2'/%3E%3Crect x='16.4' y='16.4' width='4.6' height='4.6' rx='1.2'/%3E%3C/svg%3E")}
  /* large icons: bigger, and no names (like iPadOS) */
  #lp.big .ic{width:11.4vh;height:11.4vh;border-radius:2.6vh}
  html:not(.overlay) #lp.big .ic{width:10.4vh;height:10.4vh;border-radius:2.38vh}   /* on the wallpaper: a bit smaller, more space around each */
  #lp.big .lpi > span{display:none}
  #lp.big .lpi{align-self:center}
  #lp.big.q .lpi.sel{z-index:3}                                     /* ...except the highlighted one while searching */
  #lp.big.q .lpi.sel > span{display:block;position:absolute;left:50%;top:calc(100% - .2vh);transform:translateX(-50%);max-width:15vh;pointer-events:none}
  #lp.big.q .lpi.sel::before{bottom:-2.6vh}
  #lp.sizing .ic{transition:width .4s ${EASE},height .4s ${EASE},border-radius .4s ${EASE},transform .2s ${EASE},filter .2s}
  /* over your apps the corners are the panel's, not the screen's */
  html.overlay #lpSizeBar{top:calc(var(--pt,8vh) + 1.6vh);left:calc(var(--pl,4.5vw) + 1.8vh)}
  html.overlay #lpBar{top:calc(var(--pt,8vh) + 1.6vh);right:auto;left:calc(var(--pl,0px) + var(--pw,90vw) - 1.8vh);transform:translateX(-100%)}
  .lpPill{position:relative;padding:1vh 2.3vh;border-radius:99px;background:rgba(255,255,255,.17);color:#fff;font:600 1.55vh "Shadow SF",sans-serif;cursor:pointer;user-select:none;text-shadow:0 .05vh .2vh rgba(0,0,0,.3);
      box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.3),0 .4vh 1.2vh rgba(0,0,0,.15)}
  .lpPill:hover{background:rgba(255,255,255,.24)}
  .lpPill.lgHost,.lpPill.lgHost:hover{background:none;box-shadow:none}
  #lpFolder{position:absolute;inset:0;z-index:45;display:none;place-items:center;pointer-events:none}
  #lp.fopen #lpFolder{display:grid}
  #lp.fopen #lpIn{opacity:.18;transform:scale(.96);transition:transform .4s ${EASE},opacity .3s}
  #lpFPanel{pointer-events:auto;padding:2.2vh 2.6vh 2.6vh;border-radius:3.4vh;background:rgba(255,255,255,.13);backdrop-filter:blur(4vh) saturate(1.7);
      box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.24),inset 0 .12vh 0 rgba(255,255,255,.3),0 3vh 8vh rgba(0,0,0,.35)}
  #lpFPanel.in{animation:lpFIn .42s ${EASE}}
  @keyframes lpFIn{from{opacity:0;transform:scale(.35)}}
  #lpFName{display:block;margin:0 auto 1.6vh;width:44vh;box-sizing:border-box;padding:.5vh 1vh;border:0;outline:none;border-radius:1vh;background:transparent;color:#fff;
      font:600 2.6vh/1.2 "Shadow SF Display","Shadow SF",sans-serif;letter-spacing:-.01em;text-align:center;cursor:text}
  #lpFName.editing{background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.3)}
  #lpFGrid{display:grid;grid-template-columns:repeat(var(--c,4),13.6vh);grid-auto-rows:13.6vh}
  #lpMenu{position:absolute;z-index:50;width:36vh;padding:.9vh;border-radius:2.4vh;display:none;transform-origin:1.4vh 0;
      background:rgba(58,58,66,.52);backdrop-filter:blur(3.4vh) saturate(1.8) brightness(1.06)}
  #lpMenu:not(.lgHost){background:rgba(36,36,40,.8);box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.2),0 1.6vh 4vh rgba(0,0,0,.4)}
  #lpMenu.on{display:block}
  #lpMenu.out{pointer-events:none}
  #lpMenuIn{position:relative}
  #lpMenu .mh{display:flex;align-items:center;gap:1.3vh;padding:1vh 1.2vh 1.2vh}
  #lpMenu .mh img{width:4.2vh;height:4.2vh;object-fit:contain}
  #lpMenu .mh b{display:block;font:600 2vh "Shadow SF",sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #lpMenu .mh small{display:block;font:400 1.5vh "Shadow SF",sans-serif;color:rgba(255,255,255,.66);margin-top:.25vh}
  #lpMenu .sep{height:.1vh;margin:.2vh 1.1vh .6vh;background:rgba(255,255,255,.18)}
  #lpMenu .mi{display:flex;align-items:center;gap:1.4vh;padding:1.25vh 1.4vh;border-radius:1.5vh;font:500 1.95vh "Shadow SF",sans-serif;text-shadow:0 .05vh .2vh rgba(0,0,0,.3);color:#fff;cursor:pointer;
      transition:background-color .12s,transform .12s}
  #lpMenu .mi svg{width:2.3vh;height:2.3vh;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
  #lpMenu .mi:hover{background:rgba(255,255,255,.17)}
  #lpMenu .mi:active{transform:scale(.97)}
  #lpMenu .mi.red{color:#ff6961}
  #lpDlg{position:absolute;inset:0;z-index:55;display:none;place-items:center;background:rgba(0,0,0,.22)}
  #lp.dopen #lpDlg{display:grid}
  #lpDlgIn{position:relative}
  #lpDlgBox{position:relative;width:36vh;padding:2.8vh 2.4vh 2.2vh;border-radius:2.6vh;background:rgba(24,24,28,.4);backdrop-filter:blur(3vh) saturate(1.8);text-align:center;
      box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.2),0 2.4vh 6vh rgba(0,0,0,.45)}
  #lpDlgBox.lgHost{box-shadow:none}
  #lpDlgBox img{width:7vh;height:7vh;object-fit:contain}
  #lpDlgBox h3{margin:1.2vh 0 .6vh;font:600 1.85vh/1.3 "Shadow SF",sans-serif}
  #lpDlgBox p{margin:0 0 2vh;font:400 1.4vh/1.4 "Shadow SF",sans-serif;color:rgba(255,255,255,.7)}
  #lpDlgBox .db{display:flex;gap:1vh}
  #lpDlgBox button{flex:1;padding:1vh;border:0;border-radius:1.1vh;background:rgba(255,255,255,.14);color:#fff;font:500 1.55vh "Shadow SF",sans-serif;cursor:pointer}
  #lpDlgBox button.red{background:#ff453a}
  #lpDlgBox button.pri{background:#0a84ff}
  #lpToast{position:absolute;z-index:56;left:50%;bottom:5.5vh;transform:translate(-50%,1.2vh);opacity:0;pointer-events:none;padding:1.1vh 2.2vh;border-radius:99px;
      background:rgba(36,36,40,.78);backdrop-filter:blur(3vh);font:500 1.5vh "Shadow SF",sans-serif;box-shadow:inset 0 0 0 .07vh rgba(255,255,255,.2);
      transition:opacity .25s,transform .4s ${EASE}}
  #lpToast.on{opacity:1;transform:translate(-50%,0)}`;
  document.head.appendChild(css);
  document.body.insertAdjacentHTML('beforeend', `
    <div id="lp" aria-hidden="true"><canvas id="lpBg"></canvas><div id="lpIn">
      <div id="lpSB"><div id="lpPh"><i id="lpMag"></i><span>Search</span></div><input id="lpSearch" spellcheck="false" autocomplete="off" aria-label="Search"></div>
      <div id="lpAns"></div>
      <div id="lpView"><div id="lpTrack"></div><div id="lpEmpty">No Results</div></div><div id="lpDots"></div>
      <div id="lpPwrZone"><div id="lpPwrMenu" role="menu">
        <div class="mi" role="menuitem" data-p="sleep"><svg viewBox="0 0 24 24"><path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/></svg>Sleep</div>
        <div class="mi" role="menuitem" data-p="lock"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9"/></svg>Lock</div>
        <div class="mi" role="menuitem" data-p="restart"><svg viewBox="0 0 24 24"><path d="M19.6 12.4a7.6 7.6 0 1 1-2.3-6"/><path d="M19.6 3.6v4.6H15"/></svg>Restart</div>
        <div class="mi" role="menuitem" data-p="shutdown"><svg viewBox="0 0 24 24"><path d="M12 3.2v8"/><path d="M6.4 6.6a7.6 7.6 0 1 0 11.2 0"/></svg>Shut down</div>
      </div><button id="lpPwr" aria-label="Power"><svg viewBox="0 0 24 24"><path d="M12 3.2v8"/><path d="M6.4 6.6a7.6 7.6 0 1 0 11.2 0"/></svg></button></div></div>
      <div id="lpSizeBar"><div class="lpPill" id="lpSize"><i></i><span>Large icons</span></div></div>
      <div id="lpBar"><div class="lpPill" id="lpRestore" style="display:none"><span></span></div><div class="lpPill" id="lpDone"><span>Done</span></div></div>
      <div id="lpFolder"><div id="lpFPanel"><input id="lpFName" spellcheck="false" autocomplete="off"><div id="lpFGrid"></div></div></div>
      <div id="lpMenu"><div id="lpMenuIn"></div></div><div id="lpDlg"><div id="lpDlgBox"><div id="lpDlgIn"></div></div></div><div id="lpToast"></div></div>`);
  const $ = id => document.getElementById(id);
  const lp = $('lp'), bg = $('lpBg'), bgx = bg.getContext('2d'), search = $('lpSearch'), track = $('lpTrack'), dots = $('lpDots'), empty = $('lpEmpty'), ansEl = $('lpAns');
  { const wb = document.getElementById('lpWinZone'); if (wb) lp.appendChild(wb); }   // the Windows button lives in Launchpad's bottom corner
  const sb = $('lpSB'); let glass = null, gAns = null, gMenu = null, gDone = null, gSize = null, gRestore = null, gDlg = null; const glasses = [];
  ansEl.innerHTML = '<div id="lpAnsRows" role="listbox" aria-label="Search results"></div>'; const ansRows = $('lpAnsRows');   // searching: results on the left, the selected one large on the right   // searching: Launchpad becomes the results (ShadowUI)
  const filtEl = document.createElement('div'); filtEl.id = 'lpFilt'; ansEl.before(filtEl);
  const capEl = document.createElement('div'); capEl.id = 'lpCap'; capEl.setAttribute('aria-live', 'polite'); ansEl.after(capEl);           // searching: what's selected, and what you can do with it
  sb.insertAdjacentHTML('beforeend', '<i id="lpSelHi"></i><i id="lpCaret"></i><span id="lpMeas"></span>');
  (() => { const sc = document.createElement('script'); sc.src = 'glassbar.js' + (location.protocol.startsWith('http') ? '?v=' + Date.now() : '');
    sc.onload = () => {
      const vh = v => innerHeight * v / 100;
      const mk = (el, o) => { let g = null; try { g = window.ShadowGlass(el, bg, o); } catch (_) {} if (g) { el.classList.add('lgHost'); glasses.push(g); } else el.classList.add('nogl'); return g; };
      glass = window.OVERLAY ? null : mk(sb, { radius: 'pill', tint: .14, shadow: .07, stretch: true, stretchContent: true, pad: 64, glare: 3.8, glareRange: 12.5, disp: 9, rim: .15, rimWidth: 30, rimAmt: .3, glow: 0 });   // brighter, thick soft rim, faint inner glow, little rainbow   // brighter bar, thin bright glare, softer colour fringe
      gAns = mk(ansEl, { radius: () => vh(2.6), tint: .1, frost: 0, shadow: .12, pad: 30, disp: 18, rim: .5 });
      gMenu = mk($('lpMenu'), { radius: () => vh(2.4), tint: .05, frost: 1, shadow: .3, pad: 44, glare: 1.2, glareRange: 14, disp: 10, rim: .25, rimWidth: 22, rimAmt: .22 });
      gDone = mk($('lpDone'), { radius: 'pill', tint: .09, shadow: .1, stretch: true });
      gSize = mk($('lpSize'), { radius: 'pill', tint: .09, shadow: .1, stretch: true });
      gRestore = mk($('lpRestore'), { radius: 'pill', tint: .07, shadow: .1, stretch: true });
      gDlg = mk($('lpDlgBox'), { radius: () => vh(2.6), tint: .05, frost: 1, shadow: .38, pad: 50 });
      window.__lpGlass = glass; window.__lpGlasses = glasses; if (open) glasses.forEach(g => g.animate(400));
    };
    sc.onerror = () => sb.classList.add('nogl'); document.head.appendChild(sc); })();

  // our own caret and selection (the field rarely has real keyboard focus inside the wallpaper, so the browser's caret never shows)
  const caretEl = $('lpCaret'), selHi = $('lpSelHi'), meas = $('lpMeas'); let solidT = 0;
  // the field rarely has real focus, so it never scrolls by itself: keep the caret in view by hand
  let scrollX = 0;
  const textW = t => { meas.textContent = t; return meas.getBoundingClientRect().width / ((sb.getBoundingClientRect().width / sb.offsetWidth) || 1); };
  function placeCaret() {
    const v = search.value, a = Math.min(search.selectionStart ?? v.length, v.length), b = Math.min(search.selectionEnd ?? v.length, v.length);
    const back = search.selectionDirection === 'backward';
    const cs = getComputedStyle(search), padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    const xa = textW(v.slice(0, a)), xb = textW(v.slice(0, b)), full = textW(v), visW = Math.max(10, search.clientWidth - padL - padR);
    const cx = back ? xa : xb;
    if (cx - scrollX > visW - 3) scrollX = cx - visW + 3;                     // caret ran off the right: follow it
    if (cx - scrollX < 0) scrollX = cx;                                        // ...or off the left
    scrollX = Math.max(0, Math.min(scrollX, Math.max(0, full - visW + 3)));   // never leave empty space on the right
    search.scrollLeft = scrollX; const sl = search.scrollLeft;
    sb.classList.toggle('clipL', sl > 1);                                      // soft fade where text slides under the left edge
    caretEl.style.transform = `translateX(${(padL + cx - sl).toFixed(1)}px)`;
    if (a !== b) { const l = Math.max(padL, padL + xa - sl), r = Math.min(padL + visW, padL + xb - sl); selHi.style.left = l + 'px'; selHi.style.width = Math.max(0, r - l) + 'px'; selHi.style.opacity = 1; } else selHi.style.opacity = 0;
    caretEl.classList.add('solid'); clearTimeout(solidT); solidT = setTimeout(() => caretEl.classList.remove('solid'), 500);   // stays lit while you type, then blinks
  }

  // icon styles: 0 plain icons, 1 soft colour glass tiles, 2 monochrome glass tiles, 3 monochrome
  function iconStyle(v) { v = +v || 0; lp.classList.toggle('tiles', v === 1 || v === 2); lp.classList.toggle('soft', v === 1); lp.classList.toggle('mono', v === 2 || v === 3); }
  iconStyle(window.S_?.lpIcons ?? 0);
  const prevProp = window.lpProp; window.lpProp = (n, v) => { prevProp?.(n, v); if (n === 'lpIcons') iconStyle(v); };

  /* ================================================================ apps ================================================================ */
  let apps = [], page = 0, pages = 1, open = false, builtFor = null, shown = [];
  window.lpOpen = false; window.lpCovering = false;
  const iconUrl = k => `${base}/icon?k=${k}&v=5&t=${L.token}`;

  async function loadApps() {
    try {
      const a = await (await fetch(`${base}/launchpad?${q2s({})}`, { cache: 'no-store' })).json();
      if (Array.isArray(a) && JSON.stringify(a) !== JSON.stringify(apps)) { apps = a; builtFor = null; store.set('lpApps', a); }
    } catch (_) {}
  }

  // each icon's own colour, softly tinting its glass tile (measured once, remembered)
  const tint = store.get('lpTint') || {}; let tintSave = 0;
  function measure(k, img) {
    if (tint[k] || !img.naturalWidth) return;
    try {
      const c = document.createElement('canvas'); c.width = c.height = 20; const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, 20, 20); const d = x.getImageData(0, 0, 20, 20).data; let R = 0, G = 0, B = 0, W = 0, S = 0, N = 0;
      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; if (a < .4) continue; const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx ? (mx - mn) / mx : 0;
        const w = a * (s * s + .02) * (mx > 30 ? 1 : .2); R += r * w; G += g * w; B += b * w; W += w; S += s * a; N += a; }
      if (!W) return;
      R /= W; G /= W; B /= W; const mx = Math.max(R, G, B), mn = Math.min(R, G, B), dd = mx - mn; let h = 0;
      if (dd) h = mx === R ? ((G - B) / dd) % 6 : mx === G ? (B - R) / dd + 2 : (R - G) / dd + 4;
      const sat = N ? Math.min(1, S / N * 1.6) : 0;
      tint[k] = { h: Math.round((h * 60 + 360) % 360), s: Math.round(sat * 70) };
      clearTimeout(tintSave); tintSave = setTimeout(() => store.set('lpTint', tint), 1500);
      applyTint(k);
    } catch (_) { tint[k] = { h: 0, s: 0 }; }
  }
  function applyTint(k) { const el = tiles.get(k), t = tint[k]; if (el && t) { const ic = el.firstChild; ic.style.setProperty('--h', t.h); ic.style.setProperty('--s', t.s + '%'); } }

  // one element per app, made once and moved around (searching never rebuilds icons, so it stays instant)
  const tiles = new Map();
  function tile(a) {
    let el = tiles.get(a.k);
    if (!el) {
      el = document.createElement('div'); el.className = 'lpi'; el.dataset.k = a.k;
      el.innerHTML = `<div class="ic"><img alt="" draggable="false" decoding="async" crossorigin="anonymous"><b class="x"></b></div><span>${esc(a.name)}</span>`;
      const img = el.querySelector('img'); img.onload = () => measure(a.k, img); img.src = iconUrl(a.k);
      tiles.set(a.k, el); applyTint(a.k);
    }
    el.classList.remove('sel', 'press', 'ftarget', 'dragging'); el.style.transform = '';
    return el;
  }
  function warmIcons() { apps.forEach(tile); }

  /* app search that forgives: "yt music", "vsc", "whatsap", "chorme", "spotfy" all find the right app */
  const ALIAS = { yt: 'youtube', ytm: 'youtube music', ytmusic: 'youtube music', vsc: 'visual studio code', vscode: 'visual studio code', 
    wa: 'whatsapp', whatsap: 'whatsapp', gpt: 'chatgpt', ppt: 'powerpoint', pptx: 'powerpoint', xl: 'excel', xls: 'excel', xlsx: 'excel', doc: 'word', docx: 'word',
    cmd: 'command prompt', ps: 'powershell', pwsh: 'powershell', files: 'file explorer', explorer: 'file explorer', finder: 'file explorer', calc: 'calculator',
    snip: 'snipping tool', screenshot: 'snipping tool', todo: 'microsoft to do', notes: 'sticky notes', tg: 'telegram', tm: 'task manager', taskmgr: 'task manager',
    store: 'microsoft store', ms: 'microsoft', bs: 'bluestacks', davinci: 'davinci resolve', resolve: 'davinci resolve', insta: 'instagram', mail: 'outlook',
    browser: 'google chrome', prefs: 'settings', preferences: 'settings', control: 'control panel', vlc: 'vlc media player', music: 'youtube music',
    ai: 'claude', anthropic: 'claude', mc: 'minecraft', minecraft: 'minecraft launcher' };
  function dl(a, b) {                                         // edit distance (counts a swapped pair as one typo)
    const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = [];
    for (let i = 0; i <= m; i++) { d[i] = [i]; for (let j = 1; j <= n; j++) d[i][j] = i ? 0 : j; }
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[m][n];
  }
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[®™]/g, '');
  const wordsOf = t => norm(t).split(/[^a-z0-9+#]+/).filter(Boolean);
  function wordScore(w, nws, used) {                          // best match of one typed word against the app's words
    let best = 9, at = -1;
    nws.forEach((nw, i) => {
      if (used.has(i)) return; let s = 9;
      if (nw === w) s = 0; else if (nw.startsWith(w)) s = 1;
      else if (w.length >= 4) { const tol = w.length >= 8 ? 2 : 1; const e = Math.min(dl(w, nw.slice(0, w.length)), dl(w, nw.slice(0, w.length + 1)), w.length > 4 ? dl(w, nw.slice(0, w.length - 1)) : 9); if (e <= tol) s = 2.5 + e; }
      if (s === 9 && w.length >= 3 && nw.includes(w)) s = 4.5;            // inside a word, only for 3+ letters ("yt" never finds pYThon)
      if (s < best) { best = s; at = i; }
    });
    return [best, at];
  }
  const prep = new Map();                                              // name -> { n, nws, flat, ini }, built once per app
  function prepped(a) { let p = prep.get(a.name); if (!p) { const nws = wordsOf(a.name); p = { n: norm(a.name), nws, flat: nws.join(''), ini: nws.map(w => w[0]).join('') }; prep.set(a.name, p); } return p; }
  function scoreApp(qWords, qJoined, a) {
    const { n, nws, flat, ini } = prepped(a);
    if (n === qJoined || flat === qJoined.replace(/\s/g, '')) return 0;
    if (n.startsWith(qJoined) || flat.startsWith(qJoined.replace(/\s/g, ''))) return .5;
    if (qWords.length === 1 && qJoined.length >= 2 && nws.length > 1 && ini.startsWith(qJoined)) return 1.5;   // initials: vsc, gc
    const used = new Set(); let sum = 0, worst = 0;
    for (const w of qWords) { const [s, at] = wordScore(w, nws, used); if (s >= 9) return null; used.add(at); sum += s; worst = Math.max(worst, s); }
    return worst + sum / 10;
  }
  let mCacheQ = null, mCacheApps = null, mCache = [];
  function matchApps(q) {
    if (q === mCacheQ && apps === mCacheApps) return mCache;
    mCacheQ = q; mCacheApps = apps; return mCache = matchAppsRaw(q);
  }
  function matchAppsRaw(q) {
    const raw = norm(q).trim(); if (!raw) return [];
    const variants = [wordsOf(raw)];
    const ex = wordsOf(raw).flatMap(w => (ALIAS[w] || w).split(' ')); if (ex.join(' ') !== variants[0].join(' ')) variants.push(ex);
    if (ALIAS[raw.replace(/\s/g, '')]) variants.push(ALIAS[raw.replace(/\s/g, '')].split(' '));
    const out = [];
    apps.forEach((a, idx) => {
      let best = null;
      variants.forEach((v, vi) => { const s = scoreApp(v, v.join(' '), a); if (s != null) { const ss = s + (vi ? .2 : 0); if (best == null || ss < best) best = ss; } });
      if (best != null) out.push([best * 40 + idx, best, idx, a]);
    });
    return out.sort((x, y) => x[0] - y[0]).map(x => ({ ...x[3], r: x[1], u: x[2] }));
  }

  /* ================================================ your layout: order, folders, hidden apps ================================================
     Until you move something, apps are ordered by use. Once you drag, your arrangement is kept (saved by the helper in
     launcher/layout.json, with a copy in this browser) and new apps are added at the end. */
  let layout = store.get('lpLayout'); if (!layout || !Array.isArray(layout.items)) layout = null;
  let layoutVer = 0, wiggle = false, folderOpenId = null, renaming = false, dlg = null, menuFor = null, suppressClick = false;
  const folderEls = new Map();
  function entries() {
    const byK = new Map(apps.map(a => [a.k, a]));
    if (!layout) return apps.map(a => ({ t: 'a', a }));
    const seen = new Set(), hidden = new Set(layout.hidden || []), out = [];
    for (const it of layout.items) {
      if (typeof it === 'string') { const a = byK.get(it); if (a && !seen.has(it) && !hidden.has(it)) { seen.add(it); out.push({ t: 'a', a }); } }
      else if (it && it.f) {
        const as = (it.a || []).map(k => byK.get(k)).filter(a => a && !seen.has(a.k) && !hidden.has(a.k)); as.forEach(a => seen.add(a.k));
        if (as.length > 1) out.push({ t: 'f', f: it, apps: as }); else if (as.length === 1) out.push({ t: 'a', a: as[0] });
      }
    }
    apps.forEach(a => { if (!seen.has(a.k) && !hidden.has(a.k)) out.push({ t: 'a', a }); });      // newly installed apps go at the end
    return out;
  }
  const toItems = ents => ents.map(e => e.t === 'a' ? e.a.k : { f: e.f.f, n: e.f.n, a: e.apps.map(a => a.k) });
  function commit(ents) { layout = { items: toItems(ents), hidden: layout?.hidden || [] }; layoutVer++; builtFor = null; saveLayout(); }
  let saveT = 0;
  function saveLayout() {
    store.set('lpLayout', layout); clearTimeout(saveT);
    saveT = setTimeout(() => fetch(`${base}/layout?${q2s({})}`, { method: 'POST', body: JSON.stringify(layout), mode: 'no-cors' }).catch(() => {}), 250);
  }
  async function loadLayout() {
    try { const j = await (await fetch(`${base}/layout?${q2s({})}`, { cache: 'no-store' })).json();
      const nl = j && Array.isArray(j.items) ? j : null;                      // the helper's copy wins (none saved = automatic order)
      if (JSON.stringify(nl) !== JSON.stringify(layout)) { layout = nl; store.set('lpLayout', nl); layoutVer++; builtFor = null; if (!drag && !search.value) build(''); } } catch (_) {}
  }
  const ensureLayout = () => { if (!layout) layout = { items: apps.map(a => a.k), hidden: [] }; };
  function folderName(list) {
    const n = list.map(a => a.name.toLowerCase()).join(' ');
    const groups = [[/word|excel|powerpoint|onenote|outlook|teams|publisher|access|to do|sticky/, 'Productivity'], [/code|cursor|terminal|studio|pycharm|git|python|node|docker|wsl|arduino/, 'Developer'],
      [/chrome|edge|zen|firefox|browser/, 'Browsers'], [/music|spotify|itunes|vlc|media|ableton|audio|sound/, 'Music & Media'], [/whatsapp|telegram|teams|discord|linkedin|mail/, 'Social'],
      [/chatgpt|claude|perplexity|gemini|copilot|ollama/, 'AI'], [/photo|camera|paint|capcut|davinci|clipchamp|handbrake/, 'Creativity'], [/xbox|roblox|game|solitaire|bluestacks|launcher/, 'Games'],
      [/settings|control|task manager|security|update|lenovo|intel|vantage|backup|snipping|clock|calculator|notepad|terminal/, 'Utilities']];
    for (const [re, name] of groups) if (list.every(a => re.test(a.name.toLowerCase()))) return name;
    return 'Folder';
  }
  function folderTile(e) {
    let el = folderEls.get(e.f.f);
    if (!el) { el = document.createElement('div'); el.className = 'lpi folder'; el.dataset.f = e.f.f; el.innerHTML = '<div class="ic"><div class="fgrid"></div><b class="x"></b></div><span></span>'; folderEls.set(e.f.f, el); }
    el.querySelector('span').textContent = e.f.n;
    el.querySelector('.fgrid').innerHTML = e.apps.slice(0, 9).map(a => `<img src="${iconUrl(a.k)}" draggable="false" alt="">`).join('');
    el.classList.remove('sel', 'press', 'ftarget', 'dragging'); return el;
  }

  function build(q, limit) {
    const key = q + '|' + limit + '|' + apps.length + '|' + layoutVer; if (builtFor === key) return; builtFor = key;
    const list = limit === -1 ? [] : q ? matchApps(q).slice(0, limit || 999).map(a => ({ t: 'a', a })) : entries(); shown = list;
    render(list);
    empty.style.display = list.length || ansList.length ? 'none' : 'grid';
  }
  function render(list, keepPages) {
    pages = Math.max(keepPages || 1, Math.ceil(list.length / PER)); page = Math.min(page, pages - 1);
    const frag = document.createDocumentFragment();
    for (let p = 0; p < pages; p++) {
      const pg = document.createElement('div'); pg.className = 'lpPage' + (p === page ? ' cur' : '');
      list.slice(p * PER, (p + 1) * PER).forEach(e => pg.appendChild(e.t === 'a' ? tile(e.a) : folderTile(e)));
      frag.appendChild(pg);
    }
    track.replaceChildren(frag);
    dots.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, p) => `<i data-p="${p}"></i>`).join('') : '';
    goPage(page, true);
  }
  function flip(fn) {                                                   // animate tiles from where they were to where they land
    const before = new Map(); track.querySelectorAll('.lpPage .lpi').forEach(el => before.set(el, el.getBoundingClientRect()));
    fn();
    track.querySelectorAll('.lpPage .lpi').forEach(el => {
      const b = before.get(el); if (!b) return; const a = el.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
      if ((!dx && !dy) || Math.abs(dx) > innerWidth * .6) return;
      el.style.transition = 'none'; el.style.transform = `translate(${dx}px,${dy}px)`; el.offsetWidth;
      el.style.transition = `transform .34s ${EASE}`; el.style.transform = '';
    });
  }

  /* ---- wiggle (edit) mode ---- */
  function enterWiggle() {
    if (wiggle || search.value) return; wiggle = true;
    document.querySelectorAll('#lp .lpi').forEach((el, i) => {                // like macOS: each icon jiggles at its own pace
      el.style.setProperty('--jd', (0.22 + Math.random() * 0.1).toFixed(3) + 's'); el.style.setProperty('--jo', (-Math.random() * 0.3).toFixed(3) + 's');
      el.style.setProperty('--ja', (0.8 + Math.random() * 0.4).toFixed(2)); el.style.setProperty('--bd', (Math.min(i % 35, 20) * 0.012).toFixed(3) + 's');
    });
    lp.classList.add('wiggle'); updateBar(); requestAnimationFrame(() => { gDone?.pop(.6, 520, .62); gRestore?.pop(.6, 520, .62); gSize?.pop(.6, 520, .62); });
  }
  function exitWiggle() { if (!wiggle) return; wiggle = false; lp.classList.remove('wiggle'); closeMenu(); stopRename(); }
  function updateBar() { const n = layout?.hidden?.length || 0; $('lpRestore').style.display = n ? '' : 'none'; $('lpRestore').querySelector('span').textContent = `Show ${n} hidden app${n === 1 ? '' : 's'}`; gRestore?.animate(200); }
  function toast(msg) { const t = $('lpToast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); }

  const MI = { hide: '<svg viewBox="0 0 24 24"><path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 20 20 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.9 11.6A2 2 0 0 0 9.4 20.5h5.2a2 2 0 0 0 2-1.9L17.5 7M10.2 11v5.5M13.8 11v5.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M14.5 5.5l4 4L8 20H4v-4z"/><path d="M12.5 7.5l4 4"/></svg>',
    unfold: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>' };
  let menuOutT = 0;
  function openMenu(it) {
    const m = $('lpMenu'), inner = $('lpMenuIn'), isF = !!it.dataset.f, a = isF ? null : apps.find(x => x.k === it.dataset.k);
    const f = isF ? entries().find(x => x.t === 'f' && x.f.f === it.dataset.f) : null;
    menuFor = it; clearTimeout(menuOutT); m.classList.remove('out');
    inner.innerHTML = isF
      ? `<div class="mh"><div><b>${esc(f?.f.n || 'Folder')}</b><small>${f ? f.apps.length + ' apps' : ''}</small></div></div><div class="sep"></div>
         <div class="mi" data-m="rename">${MI.pen}Rename Folder</div><div class="mi" data-m="unfold">${MI.unfold}Remove Folder</div>`
      : `<div class="mh"><img src="${iconUrl(a.k)}" alt=""><div><b>${esc(a?.name || '')}</b><small>Application</small></div></div><div class="sep"></div>
         <div class="mi" data-m="hide">${MI.hide}Remove from Launchpad</div><div class="mi red" data-m="uninstall">${MI.trash}Uninstall…</div>`;
    const r = (it.querySelector('.x') || it.querySelector('.ic')).getBoundingClientRect(), lr = lp.getBoundingClientRect();
    m.classList.add('on');
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left = r.left - lr.left, top = r.bottom - lr.top + 6, ox = r.width / 2, oy = -6;
    if (left + mw > lr.width - 12) { left = lr.width - 12 - mw; ox = r.left - lr.left - left + r.width / 2; }
    if (top + mh > lr.height - 12) { top = r.top - lr.top - mh - 6; oy = mh + 6; }
    m.style.left = left + 'px'; m.style.top = top + 'px'; m.style.transformOrigin = `${ox}px ${oy}px`;
    if (gMenu) gMenu.pop(.55, 460, .86);                                // grows out of the badge on a soft spring, like a macOS / iOS menu
    else m.animate([{ transform: 'scale(.55)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.9,.25,1)' });
  }
  function closeMenu() {
    const m = $('lpMenu'); if (!m.classList.contains('on')) { menuFor = null; return; }
    menuFor = null; m.classList.add('out'); clearTimeout(menuOutT);
    (gMenu ? gMenu.out(.9, 150) : m.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.9)' }], { duration: 150, fill: 'forwards' }));
    menuOutT = setTimeout(() => { m.classList.remove('on', 'out'); m.getAnimations().forEach(a => a.cancel()); }, 160);
  }
  $('lpMenu').addEventListener('click', e => {
    const mi = e.target.closest('.mi'); if (!mi || !menuFor) return; const it = menuFor, act = mi.dataset.m; closeMenu();
    if (act === 'hide') hideApp(it.dataset.k);
    else if (act === 'uninstall') askUninstall(it.dataset.k);
    else if (act === 'unfold') unfold(it.dataset.f);
    else if (act === 'rename') { openFolder(it.dataset.f); startRename(); }
  });
  function hideApp(k) {
    ensureLayout();
    const ents = entries().map(e => e.t === 'f' ? { ...e, apps: e.apps.filter(a => a.k !== k) } : e).filter(e => !(e.t === 'a' && e.a.k === k));
    layout.hidden = [...new Set([...(layout.hidden || []), k])]; commit(ents); flip(() => build('')); updateBar();
    toast('Removed from Launchpad. Search still finds it.');
  }
  function unfold(id) {
    const ents = entries(), i = ents.findIndex(e => e.t === 'f' && e.f.f === id); if (i < 0) return;
    ents.splice(i, 1, ...ents[i].apps.map(a => ({ t: 'a', a }))); commit(ents); flip(() => build(''));
  }
  function restoreHidden() { if (!layout) return; layout.hidden = []; layoutVer++; builtFor = null; saveLayout(); flip(() => build('')); updateBar(); toast('Hidden apps are back at the end.'); }

  /* ---- confirm dialog (uninstall) ---- */
  function openDlg(o) {
    dlg = o; const d = $('lpDlgIn');
    d.innerHTML = `${o.icon ? `<img src="${o.icon}" alt="">` : ''}<h3>${esc(o.title)}</h3><p>${esc(o.text)}</p><div class="db"><button data-d="0">Cancel</button><button data-d="1" class="${o.red ? 'red' : 'pri'}">${esc(o.ok)}</button></div>`;
    lp.classList.add('dopen'); gDlg?.pop(.88, 480, .8);
  }
  function closeDlg(ok) { const o = dlg; dlg = null; lp.classList.remove('dopen'); if (ok && o) o.onOk(); }
  $('lpDlgBox').addEventListener('click', e => { const b = e.target.closest('button'); if (b) closeDlg(b.dataset.d === '1'); });
  function askUninstall(k) {
    const a = apps.find(x => x.k === k); if (!a) return;
    openDlg({ icon: iconUrl(k), title: `Uninstall “${a.name}”?`, text: 'It will be removed from this PC. Desktop apps open their own uninstaller first.', ok: 'Uninstall', red: true,
      onOk: async () => {
        let how = 'settings';
        try { how = (await (await fetch(`${base}/uninstall?${q2s({ k })}`, { cache: 'no-store' })).json()).how; } catch (_) {}
        toast(how === 'store' ? `Uninstalling ${a.name}…` : how === 'uninstaller' ? `${a.name}'s uninstaller is open.` : how === 'system' ? `${a.name} is part of Windows and can't be uninstalled.` : 'Opened Installed apps in Settings.');
        if (how === 'store' || how === 'uninstaller') [5000, 15000, 40000].forEach(t => setTimeout(() => loadApps().then(() => { builtFor = null; if (!drag && !search.value) flip(() => build('')); }), t));
      } });
  }

  /* ---- folders ---- */
  const fpanel = $('lpFPanel'), fgrid = $('lpFGrid'), fname = $('lpFName');
  function openFolder(id) {
    const e = entries().find(x => x.t === 'f' && x.f.f === id); if (!e) return;
    folderOpenId = id; fname.value = e.f.n;
    fgrid.style.setProperty('--c', Math.min(5, Math.max(3, Math.ceil(Math.sqrt(e.apps.length)))));
    fgrid.replaceChildren(...e.apps.map(tile));
    const src = folderEls.get(id)?.querySelector('.ic').getBoundingClientRect();
    lp.classList.add('fopen');
    if (src) { const pr = fpanel.getBoundingClientRect(); fpanel.style.transformOrigin = `${src.left + src.width / 2 - pr.left}px ${src.top + src.height / 2 - pr.top}px`; }
    fpanel.classList.remove('in'); fpanel.offsetWidth; fpanel.classList.add('in');
  }
  function closeFolder() { stopRename(); if (!folderOpenId) return; folderOpenId = null; lp.classList.remove('fopen'); builtFor = null; build(''); }
  function startRename() { renaming = true; fname.classList.add('editing'); try { fname.focus({ preventScroll: true }); fname.select(); } catch (_) {} }
  function stopRename() { if (!renaming) return; renaming = false; fname.classList.remove('editing'); fname.blur(); }
  function renameFolder(n) {
    ensureLayout(); const it = layout.items.find(x => x && x.f === folderOpenId); if (!it) return;
    it.n = n.trim() || 'Folder'; layoutVer++; builtFor = null; saveLayout();
    const el = folderEls.get(folderOpenId); if (el) el.querySelector('span').textContent = it.n;
  }
  fname.addEventListener('mousedown', e => { e.stopPropagation(); startRename(); });
  fname.addEventListener('input', () => renameFolder(fname.value));

  function activate(it) {
    if (it.dataset.f) return openFolder(it.dataset.f);
    if (!wiggle) launch(it);
  }

  /* ---- drag to move, hold to wiggle, drop on an app to make a folder ---- */
  let pend = null, drag = null, holdT = 0;
  function onTileDown(e) {
    if (e.button !== 0 || search.value || dlg) return;
    if (e.target.closest('.x')) { e.preventDefault(); return; }
    const it = e.target.closest('.lpi'); if (!it) return;
    e.preventDefault(); suppressClick = false; closeMenu();
    const st = pend = { it, x: e.clientX, y: e.clientY, started: false };
    clearTimeout(holdT); holdT = setTimeout(() => { if (pend === st && !st.started) { enterWiggle(); suppressClick = true; } }, 520);
  }
  track.addEventListener('mousedown', onTileDown); fgrid.addEventListener('mousedown', onTileDown);
  addEventListener('mousemove', e => {
    if (pend && !pend.started && Math.hypot(e.clientX - pend.x, e.clientY - pend.y) > 7) startDrag(pend, e);
    if (drag) moveDrag(e);
  });
  addEventListener('mouseup', e => { clearTimeout(holdT); if (drag) endDrag(e); pend = null; });

  function startDrag(st, e) {
    st.started = true; clearTimeout(holdT); suppressClick = true; enterWiggle();
    const it = st.it, ic = it.querySelector('.ic'), r = ic.getBoundingClientRect();
    const ghost = document.createElement('div'); ghost.className = 'lpGhost'; ghost.appendChild(ic.cloneNode(true));
    ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px'; lp.appendChild(ghost);
    drag = { it, ghost, dx: st.x - r.left, dy: st.y - r.top, inFolder: !!it.closest('#lpFGrid'), target: null, tgtT: 0, moveT: 0, edgeT: 0, ents: null, idx: -1 };
    if (!drag.inFolder) beginGridDrag();
    it.classList.add('dragging');
    moveDrag(e);
  }
  function beginGridDrag() {
    drag.ents = entries();
    drag.idx = drag.ents.findIndex(x => drag.it.dataset.f ? (x.t === 'f' && x.f.f === drag.it.dataset.f) : (x.t === 'a' && x.a.k === drag.it.dataset.k));
  }
  function pullOutOfFolder() {                                            // dragged an app out of an open folder: it joins the grid
    const k = drag.it.dataset.k, id = folderOpenId; ensureLayout();
    const ents = entries(), fi = ents.findIndex(x => x.t === 'f' && x.f.f === id); if (fi < 0) return;
    const f = ents[fi], a = f.apps.find(x => x.k === k); f.apps = f.apps.filter(x => x.k !== k);
    if (f.apps.length === 1) ents[fi] = { t: 'a', a: f.apps[0] };
    ents.splice(Math.min(ents.length, page * PER + PER - 1), 0, { t: 'a', a });
    commit(ents); stopRename(); folderOpenId = null; lp.classList.remove('fopen');
    drag.inFolder = false; build(''); beginGridDrag(); drag.it.classList.add('dragging');
  }
  function setTarget(el) {
    if (drag.target === el) return;
    drag.target?.classList.remove('ftarget'); drag.target = el; el?.classList.add('ftarget');
  }
  function moveDrag(e) {
    const x = e.clientX, y = e.clientY;
    drag.ghost.style.transform = `translate3d(${x - drag.dx}px,${y - drag.dy}px,0) scale(1.08)`;
    if (drag.inFolder) { const pr = fpanel.getBoundingClientRect(); if (x < pr.left - 10 || x > pr.right + 10 || y < pr.top - 10 || y > pr.bottom + 10) pullOutOfFolder(); return; }
    const vr = $('lpView').getBoundingClientRect();
    const edge = x < vr.left + 24 ? -1 : x > vr.right - 24 ? 1 : 0;           // hold at the edge to flip pages
    if (edge) { if (!drag.edgeT) drag.edgeT = setTimeout(() => { drag && dragPage(edge); if (drag) drag.edgeT = 0; }, 520); }
    else { clearTimeout(drag.edgeT); drag.edgeT = 0; }
    const pg = track.children[page]; if (!pg) return;
    const pr = pg.getBoundingClientRect(), pad = innerHeight * .01, cw = (pr.width - pad * 2) / COLS, ch = pr.height / ROWS;
    const col = Math.floor((x - pr.left - pad) / cw), row = Math.floor((y - pr.top) / ch);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) { setTarget(null); clearTimeout(drag.tgtT); return; }
    const cell = Math.min(drag.ents.length - 1, page * PER + row * COLS + col);
    const el = pg.children[row * COLS + col];
    // over the middle of another app's icon: after a moment, that's "make a folder"
    if (el && el !== drag.it && !drag.it.dataset.f) {
      const r = el.querySelector('.ic').getBoundingClientRect(), m = r.width * .24;
      if (x > r.left + m && x < r.right - m && y > r.top + m && y < r.bottom - m) {
        clearTimeout(drag.moveT); drag.moveT = 0;
        if (drag.target !== el && !drag.tgtWait) { drag.tgtWait = el; clearTimeout(drag.tgtT); drag.tgtT = setTimeout(() => { if (drag && drag.tgtWait === el) setTarget(el); }, 380); }
        return;
      }
    }
    drag.tgtWait = null; clearTimeout(drag.tgtT); setTarget(null);
    if (cell !== drag.idx && !drag.moveT) drag.moveT = setTimeout(() => {           // make room where you're pointing
      if (!drag) return; drag.moveT = 0;
      const [m] = drag.ents.splice(drag.idx, 1); drag.ents.splice(cell, 0, m); drag.idx = cell;
      flip(() => render(drag.ents, pages));
      drag.it.classList.add('dragging');
    }, 90);
  }
  function dragPage(dir) {                                                // carry the icon to the next / previous page
    const np = page + dir; if (np < 0) return;
    const [m] = drag.ents.splice(drag.idx, 1), to = Math.min(drag.ents.length, np * PER + (dir > 0 ? 0 : PER - 1));
    drag.ents.splice(to, 0, m); drag.idx = to;
    render(drag.ents, Math.max(pages, np + 1)); goPage(np); drag.it.classList.add('dragging');
  }
  function endDrag() {
    const d = drag; drag = null; clearTimeout(d.edgeT); clearTimeout(d.tgtT); clearTimeout(d.moveT);
    let dest = d.it, folderId = null;
    if (d.inFolder) { d.it.classList.remove('dragging'); d.ghost.remove(); setTimeout(() => { suppressClick = false; }, 0); return; }
    if (d.target) {                                                         // dropped on an app or a folder
      const ti = d.ents.findIndex(x => (x.t === 'a' && x.a.k === d.target.dataset.k) || (x.t === 'f' && x.f.f === d.target.dataset.f));
      const me = d.ents[d.idx];
      if (ti >= 0 && me && me.t === 'a') {
        const tgt = d.ents[ti];
        if (tgt.t === 'f') { tgt.apps.push(me.a); folderId = tgt.f.f; }
        else { folderId = 'f' + Date.now().toString(36); d.ents[ti] = { t: 'f', f: { f: folderId, n: folderName([tgt.a, me.a]) }, apps: [tgt.a, me.a] }; }
        d.ents.splice(d.idx, 1);
      }
      d.target.classList.remove('ftarget');
    }
    commit(d.ents);
    flip(() => build(''));
    if (folderId) dest = folderEls.get(folderId) || dest;
    const r = dest.querySelector('.ic').getBoundingClientRect();
    d.ghost.style.transition = `transform .3s ${EASE}, opacity .24s ease`;
    d.ghost.style.transform = `translate3d(${r.left}px,${r.top}px,0) scale(${folderId ? .34 : 1})`;
    if (folderId) d.ghost.style.opacity = '0';
    setTimeout(() => { d.ghost.remove(); d.it.classList.remove('dragging'); }, 300);
    setTimeout(() => { suppressClick = false; }, 0);                       // only the click that ends this drag is ignored
  }
  let bounceT = 0;
  // pages slide by whole pixels and the strip is only a GPU layer while it moves, so labels stay crisp when it stops
  const viewEl = $('lpView');
  function sizeView() {
    let w = Math.round(Math.min(innerWidth * .92, innerHeight * 1.26)); if ((innerWidth - w) % 2) w -= 1;   // even margins: no half-pixel offset
    viewEl.style.width = w + 'px';
  }
  sizeView(); addEventListener('resize', () => { sizeView(); goPage(page, true); });
  const pageX = p => p ? `translateX(${-p * viewEl.clientWidth}px)` : 'none';
  let settleT = 0;
  function slide(tf, instant) {
    clearTimeout(settleT);
    if (instant) { track.classList.remove('moving'); track.style.transition = 'none'; track.style.transform = tf; track.offsetWidth; track.style.transition = ''; return; }
    track.classList.add('moving'); track.style.transform = tf;
    settleT = setTimeout(() => track.classList.remove('moving'), 520);
  }
  let homeSel = -1;                                                    // the app highlighted on the home grid (-1: none)
  const homeTiles = () => [...track.querySelectorAll('.lpPage.cur .lpi')];
  function setHome(i) {
    track.querySelectorAll('.lpi.sel').forEach(t => t.classList.remove('sel'));
    const ts = homeTiles(); if (i < 0 || !ts.length) { homeSel = -1; return; }
    homeSel = Math.max(0, Math.min(ts.length - 1, i)); ts[homeSel].classList.add('sel');
  }
  function homeKey(key) {                                               // arrows over the grid; returns true if it used the key
    if (search.value || wiggle || folderOpenId || dlg) return false;
    const ts = homeTiles(); if (!ts.length) return false;
    if (homeSel < 0) { setHome(0); return true; }                       // first press: highlight the first app
    const col = homeSel % COLS, row = Math.floor(homeSel / COLS);
    if (key === 'ArrowRight') {
      if (col < COLS - 1 && homeSel + 1 < ts.length) setHome(homeSel + 1);
      else if (page < pages - 1) { goPage(page + 1); setHome(row * COLS); }
      else goPage(page + 1);                                            // the last page: a little rubber-band
    } else if (key === 'ArrowLeft') {
      if (col > 0) setHome(homeSel - 1);
      else if (page > 0) { goPage(page - 1); setHome(Math.min(homeTiles().length - 1, row * COLS + COLS - 1)); }
      else goPage(page - 1);
    } else if (key === 'ArrowDown') { if (homeSel + COLS < ts.length) setHome(homeSel + COLS); else if (row < Math.ceil(ts.length / COLS) - 1) setHome(ts.length - 1); }
    else if (key === 'ArrowUp') { if (homeSel - COLS >= 0) setHome(homeSel - COLS); }
    return true;
  }
  track.addEventListener('mouseover', e => { if (search.value || wiggle || drag) return; const it = e.target.closest('.lpi'); if (!it) return; const i = homeTiles().indexOf(it); if (i >= 0 && i !== homeSel) setHome(i); });
  track.addEventListener('mouseleave', () => { if (!search.value) setHome(-1); });
  function goPage(p, instant) {
    if (!instant && (p < 0 || p > pages - 1)) {                       // rubber-band at the ends, like macOS
      const edge = p < 0 ? 1 : -1, nudge = Math.round(innerHeight * .05); clearTimeout(bounceT);
      slide(`translateX(${-page * viewEl.clientWidth + edge * nudge}px)`);
      bounceT = setTimeout(() => slide(pageX(page)), 140);
      return;
    }
    page = Math.max(0, Math.min(pages - 1, p)); homeSel = -1; track.querySelectorAll('.lpi.sel').forEach(t => t.classList.remove('sel'));
    slide(pageX(page), instant);
    [...track.children].forEach((pg, k) => pg.classList.toggle('cur', k === page));
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === page));
  }

  /* ============================================================ background ============================================================ */
  function drawBg(cv) {
    const w = Math.max(160, Math.round(innerWidth / 4)), h = Math.max(90, Math.round(innerHeight / 4));   // softer blur than before, so the glass has stripes to bend
    if (bg.width !== w || bg.height !== h) { bg.width = w; bg.height = h; }
    bgx.filter = 'blur(3px) saturate(150%) brightness(.64)';
    bgx.drawImage(cv, -w * .05, -h * .05, w * 1.1, h * 1.1);
    bgx.filter = 'none'; bgx.fillStyle = 'rgba(10,10,14,.2)'; bgx.fillRect(0, 0, w, h); glasses.forEach(g => g.bgChanged());
  }
  // While music plays the stripes keep bouncing behind Launchpad: the wallpaper keeps drawing and the frosted
  // background is refreshed from it ~30 times a second. Without music it stays a still snapshot (saves power).
  let liveBgT = 0, liveLast = 0;
  function liveBg() {
    clearTimeout(liveBgT); liveBgT = 0;
    if (!open) return;
    const music = typeof audLast !== 'undefined' && performance.now() - audLast < 1500;
    if (music) {
      window.lpCovering = false;
      window.__snapCb = cv => { const t = performance.now(); if (t - liveLast > 30) { liveLast = t; drawBg(cv); } };
    } else if (!window.lpCovering) { window.__snapCb = null; window.lpCovering = true; }
    liveBgT = setTimeout(liveBg, music ? 33 : 500);
  }
  function snapshot(done) {
    if (window.OVERLAY) { if (window.__overlayBg) drawBg(window.__overlayBg); else bgx.clearRect(0, 0, bg.width, bg.height); done(); return; }   // over your apps: Windows blurs them live; the picture is only for the glass to bend
    window.__snapCb = cv => { drawBg(cv); done(); };
    setTimeout(() => {                                                // wallpaper paused (no fresh frame): plain frosted tone instead
      if (!window.__snapCb) return; window.__snapCb = null;
      if (!bg.width || bg.width === 300) { bg.width = 64; bg.height = 36; const g = bgx.createRadialGradient(32, 16, 4, 32, 18, 44); g.addColorStop(0, '#3c3c40'); g.addColorStop(1, '#1c1c1f'); bgx.fillStyle = g; bgx.fillRect(0, 0, 64, 36); glasses.forEach(gl => gl.bgChanged()); }
      done();
    }, 100);
  }

  function show() {
    fixedPanel = null;
    try { loadYtLib(); } catch (_) {}
    if (open || window.TM?.setting) return;
    open = window.lpOpen = true; fastState(1);
    if (search.value) { search.value = ''; onQuery(); }
    page = 0; build(''); goPage(0, true);
    $('dock')?.classList.remove('open');
    snapshot(() => {
      if (!open) return;
      window.lpCovering = true;                                       // the snapshot covers it: stop drawing the wallpaper now
      lp.classList.remove('closing'); if (genie) lp.classList.add('gh'); lp.offsetWidth; lp.classList.add('open', 'typing'); lp.setAttribute('aria-hidden', 'false'); glasses.forEach(g => g.animate(700)); placeCaret();   // caret blinks from the start
      requestAnimationFrame(() => open && search.focus({ preventScroll: true }));
      if (window.OVERLAY) {
        if (genie) requestAnimationFrame(() => { genie.open().then(ok => { if (!ok && open) { lp.classList.remove('gh'); window.chrome?.webview?.postMessage('shown'); } }); });
        else window.chrome?.webview?.postMessage('shown');               // zooming in now: the frosted panel zooms with it
      }
      liveBg();
    });
    refreshBattery(); fetchRates(); loadLayout();
  }
  function hide() {
    if (!open) return;
    if (genie?.busy) genie.cancel();                                  // closed while still pouring in
    const poured = window.OVERLAY && genie && !genie.busy && genie.close(() => { if (!open) window.chrome?.webview?.postMessage('hide'); });   // over your apps: pours down into the bottom
    if (dlg) closeDlg(false); closeMenu(); closeFolder(); exitWiggle();
    $('lpPwrZone').classList.remove('menu'); setTimeout(() => { if (!open) frost?.reset(); }, 600);   // next time: a fresh picture of what's behind
    open = window.lpOpen = false; window.lpCovering = false; fastState(0); clearTimeout(liveBgT); window.__snapCb = null;
    lp.classList.add('closing'); lp.classList.remove('open', 'typing', 'wide'); lp.setAttribute('aria-hidden', 'true'); search.blur(); glass?.animate(320);
    setTimeout(() => { if (!open) lp.classList.remove('closing'); }, 300);
    if (window.OVERLAY && !poured) { window.chrome?.webview?.postMessage('closing'); setTimeout(() => { if (!open) window.chrome?.webview?.postMessage('hide'); }, 280); }   // blur off now, window away once the zoom-out ends
    clearInterval(liveT); liveT = 0;
    setTimeout(() => { if (!open) loadApps().then(() => { if (!open) build(''); }); }, 450);   // pick up the new usage order for next time
  }
  window.lpShow = show; window.lpHide = hide;
  // the overlay window: opened with a picture of the screen behind it (frosted into Launchpad's background)
  window.__overlayShow = src => { const im = new Image(); im.onload = () => { window.__overlayBg = im; show(); }; im.onerror = () => show(); im.src = src; };
  // faster: the picture of the screen goes up sharp first (the window appears looking exactly like the screen), then
  // Launchpad blurs and zooms in over it in plain sight
  window.__overlayPrep = src => new Promise(res => {
    let sh = document.getElementById('ovShot');
    if (!sh) { sh = document.createElement('img'); sh.id = 'ovShot'; sh.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none'; document.body.prepend(sh); }
    sh.onload = () => { window.__overlayBg = sh; res(1); }; sh.onerror = () => res(0); sh.src = src;
  });
  window.__overlayGo = () => { show(); sendPanel(true); };
  let lastPanel = '';
  // Launchpad's panel over your apps (search bar + answers + app grid + dots + power, an open folder / menu), padded, in screen pixels
  let fixedPanel = null;                                               // over your apps: the panel's size, fixed while it's open
  function panelPx() {
    if (window.OVERLAY && open && fixedPanel) return fixedPanel;
    const els = ['lpSB', 'lpAns', 'lpView', 'lpDots', 'lpPwrZone', 'lpFPanel', 'lpMenuIn', 'lpDlgBox'].map(id => $(id)).filter(e => e && e.offsetParent !== null);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    // where things will be once the zooms settle (Launchpad's own around the bottom, the inner one around the middle)
    const inner = $('lpIn'), k = new DOMMatrix(getComputedStyle(inner).transform).a || 1, cx = innerWidth / 2, cy = innerHeight / 2;
    const kl = new DOMMatrix(getComputedStyle(lp).transform).a || 1, ox = innerWidth / 2, oy = innerHeight * .97;
    const un = (v, o, f) => o + (v - o) / f;
    for (const e of els) {
      let r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
      if (Math.abs(kl - 1) > .001) r = { left: un(r.left, ox, kl), top: un(r.top, oy, kl), right: un(r.right, ox, kl), bottom: un(r.bottom, oy, kl) };
      if (inner.contains(e) && Math.abs(k - 1) > .001) r = { left: un(r.left, cx, k), top: un(r.top, cy, k), right: un(r.right, cx, k), bottom: un(r.bottom, cy, k) };
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    if (x1 < x0) return null;
    const pad = innerHeight * .045, d = devicePixelRatio || 1;
    const px = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2, innerHeight * .045].map(n => Math.round(Math.max(0, n) * d));
    if (window.OVERLAY && open && !search.value && !lp.classList.contains('q') && !lp.classList.contains('fopen')) fixedPanel = px;   // measured in the plain grid view
    return px;
  }
  /* Launchpad's own frosted glass over your apps: the overlay sends a small live picture of what is behind the panel; it is
     blurred and tinted here, with properly round corners (Windows' own blur can't be shaped, and drew a box and a shadow) */
  const frost = (() => {
    if (!window.OVERLAY) return null;
    const box = document.createElement('div'); box.id = 'ovFrost';
    const c = document.createElement('canvas'), x = c.getContext('2d'); box.appendChild(c); lp.prepend(box);
    const css = document.createElement('style');
    css.textContent = `#ovFrost{position:fixed;z-index:0;border-radius:2.6vh;overflow:hidden;pointer-events:none;background:rgba(40,40,46,.55);
}
      #ovFrost canvas{position:absolute;inset:0;width:100%;height:100%}
      #ovFrost::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.26)}`;   /* the outline sits above the picture (the picture covered it) */
    document.head.appendChild(css);
    const im = new Image(); let busy = false, next = null, have = false;
    function paint() {
      const w = Math.max(8, Math.round(box.clientWidth / 5)), h = Math.max(8, Math.round(box.clientHeight / 5));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const b = Math.max(2, h * .035);                                 // a strong blur, like Windows' acrylic
      x.filter = `blur(${b}px) saturate(160%)`; x.drawImage(im, -b * 2, -b * 2, w + b * 4, h + b * 4); x.filter = 'none';
      x.fillStyle = 'rgba(26,26,30,.38)'; x.fillRect(0, 0, w, h);      // a soft dark tint, so white text and icons read on anything
      have = true;
    }
    im.onload = () => { paint(); busy = false; if (next) { const n = next; next = null; busy = true; im.src = n; } };
    im.onerror = () => { busy = false; };
    window.chrome?.webview?.addEventListener('message', e => {
      const d = e.data; if (typeof d !== 'string' || !d.startsWith('bg:')) return;
      if (busy) { next = d.slice(3); return; } busy = true; im.src = d.slice(3);
    });
    return {
      place(px) { const d = devicePixelRatio || 1; Object.assign(box.style, { left: px[0] / d + 'px', top: px[1] / d + 'px', width: px[2] / d + 'px', height: px[3] / d + 'px' });
        lp.style.setProperty('--pl', px[0] / d + 'px'); lp.style.setProperty('--pt', px[1] / d + 'px'); lp.style.setProperty('--pw', px[2] / d + 'px'); },
      canvas: c, get ready() { return have; }, reset() { have = false; next = null; }
    };
  })();
  function sendPanel(force) {
    if (!window.OVERLAY || !open || genie?.busy) return;
    const p = panelPx(); if (!p) return; frost?.place(p); const v = p.join(',');
    if (v !== lastPanel || force) { lastPanel = v; window.chrome?.webview?.postMessage('panel:' + v); }
  }

  /* ---------- the genie (macOS): over your apps, Launchpad pours up out of the bottom of the screen, and back down into it ----------
     Launchpad is painted into a picture (icons, search bar, dots, on a frosted copy of the screen) and the picture is bent on a
     mesh: its bottom pinches toward the bottom-middle of the screen as it slides in or out. Once it settles, the real Launchpad
     and Windows' live blur take over (and on closing, the picture takes over from them). */
  const genie = (() => {
    if (!window.OVERLAY) return null;
    const cv = document.createElement('canvas'); cv.id = 'lpGenie';
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:100;pointer-events:none;visibility:hidden';
    document.body.appendChild(cv);
    const g = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!g) return null;
    const mk = (t, src) => { const sh = g.createShader(t); g.shaderSource(sh, src); g.compileShader(sh); return sh; };
    const pr = g.createProgram();
    g.attachShader(pr, mk(g.VERTEX_SHADER, 'attribute vec2 p;attribute vec2 q;varying vec2 v;void main(){v=q;gl_Position=vec4(p,0.,1.);}'));
    g.attachShader(pr, mk(g.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;uniform sampler2D t;uniform float a;void main(){gl_FragColor=texture2D(t,v)*a;}'));
    g.linkProgram(pr); if (!g.getProgramParameter(pr, g.LINK_STATUS)) return null;
    g.useProgram(pr);
    const C = 14, RW = 72, N = (RW + 1) * (C + 1), pos = new Float32Array(N * 2), uv = new Float32Array(N * 2), idx = [];
    for (let r = 0; r <= RW; r++) for (let c = 0; c <= C; c++) { const i = r * (C + 1) + c; uv[i * 2] = c / C; uv[i * 2 + 1] = r / RW; }
    for (let r = 0; r < RW; r++) for (let c = 0; c < C; c++) { const i = r * (C + 1) + c; idx.push(i, i + 1, i + C + 1, i + 1, i + C + 2, i + C + 1); }
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, g.createBuffer()); g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), g.STATIC_DRAW);
    const qb = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, qb); g.bufferData(g.ARRAY_BUFFER, uv, g.STATIC_DRAW);
    const qL = g.getAttribLocation(pr, 'q'); g.enableVertexAttribArray(qL); g.vertexAttribPointer(qL, 2, g.FLOAT, false, 0, 0);
    const pb = g.createBuffer(), pL = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(pL);
    const aU = g.getUniformLocation(pr, 'a');
    const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
    [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]].forEach(([k, v]) => g.texParameteri(g.TEXTURE_2D, k, v));
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    const tc = document.createElement('canvas'), tx = tc.getContext('2d');
    let P = null, t = 0, alpha = 1, raf = 0;
    const clamp = v => Math.max(0, Math.min(1, v)), smooth = (a, b, v) => { v = clamp((v - a) / (b - a)); return v * v * (3 - 2 * v); };
    const rr = (x, y, w, h, r) => { tx.beginPath(); tx.roundRect(x, y, w, h, r); };
    function paint() {                                                 // Launchpad as it looks right now, into the picture
      const d = devicePixelRatio || 1, W = Math.max(2, Math.round(P.w * d)), H = Math.max(2, Math.round(P.h * d));
      if (tc.width !== W || tc.height !== H) { tc.width = W; tc.height = H; }
      tx.setTransform(1, 0, 0, 1, 0, 0); tx.clearRect(0, 0, W, H); tx.setTransform(d, 0, 0, d, -P.x * d, -P.y * d);
      const rad = innerHeight * .026;
      tx.save(); rr(P.x, P.y, P.w, P.h, rad); tx.clip();
      const bg = window.__overlayBg;                                    // the same frosted glass as the settled panel
      if (frost?.ready) { tx.fillStyle = 'rgba(40,40,46,.55)'; tx.fillRect(P.x, P.y, P.w, P.h); tx.drawImage(frost.canvas, P.x, P.y, P.w, P.h); tx.fillStyle = 'rgba(0,0,0,0)'; }
      else if (bg && bg.width) { tx.filter = 'blur(28px) saturate(150%)'; tx.drawImage(bg, -40, -40, innerWidth + 80, innerHeight + 80); tx.filter = 'none'; tx.fillStyle = 'rgba(26,26,30,.4)'; }
      else tx.fillStyle = 'rgba(34,34,38,.82)';
      tx.fillRect(P.x, P.y, P.w, P.h);
      tx.restore();
      tx.save(); rr(P.x + .5, P.y + .5, P.w - 1, P.h - 1, rad); tx.strokeStyle = 'rgba(255,255,255,.26)'; tx.lineWidth = 1; tx.stroke(); tx.restore();
      const sb = $('lpSB').getBoundingClientRect();                     // the search bar
      if (sb.width > 2) {
        tx.save(); rr(sb.left, sb.top, sb.width, sb.height, sb.height / 2); tx.fillStyle = 'rgba(255,255,255,.13)'; tx.fill(); tx.strokeStyle = 'rgba(255,255,255,.22)'; tx.lineWidth = 1; tx.stroke();
        // the placeholder where the real bar has it: on the left while it's focused (it always is, once open), else centred
        const k = sb.width / ($('lpSB').offsetWidth || sb.width), vh = innerHeight / 100, left = search.value || lp.classList.contains('typing');
        const fs = 2.2 * vh * k; tx.font = `400 ${fs}px "Shadow SF","SF Pro Text","Segoe UI Variable Text",sans-serif`; tx.textBaseline = 'middle';
        const txt = search.value || 'Search', tw = tx.measureText(txt).width, mx = left ? sb.left + 2 * vh * k : sb.left + (sb.width - tw - fs * 1.3) / 2, my = sb.top + sb.height / 2;
        tx.fillStyle = search.value ? '#fff' : (left ? 'rgba(255,255,255,.52)' : 'rgba(255,255,255,.86)'); tx.strokeStyle = 'rgba(255,255,255,.92)'; tx.lineWidth = fs * .11;
        tx.beginPath(); tx.arc(mx + fs * .36, my - fs * .06, fs * .3, 0, 7); tx.stroke(); tx.beginPath(); tx.moveTo(mx + fs * .58, my + fs * .16); tx.lineTo(mx + fs * .8, my + fs * .38); tx.stroke();
        tx.fillText(txt, mx + fs * 1.3 + (left && !search.value ? .35 * vh * k : 0), my + fs * .04); tx.restore();
      }
      const vr = $('lpView').getBoundingClientRect();                   // the icons on the page you're on
      tx.save(); tx.shadowColor = 'rgba(0,0,0,.28)'; tx.shadowBlur = 8; tx.shadowOffsetY = 3;
      for (const it of track.querySelectorAll('.lpi')) {
        const ic = it.querySelector('.ic'); if (!ic) continue; const r = ic.getBoundingClientRect();
        if (r.right < vr.left || r.left > vr.right || r.bottom < vr.top || r.top > vr.bottom || r.width < 2) continue;
        if (it.classList.contains('folder')) { rr(r.left, r.top, r.width, r.height, r.width * .23); tx.fillStyle = 'rgba(255,255,255,.2)'; tx.fill(); }
        for (const im of ic.querySelectorAll('img')) {
          if (!im.complete || !im.naturalWidth) continue; const b = im.getBoundingClientRect(); if (b.width < 1) continue;
          const k = Math.min(b.width / im.naturalWidth, b.height / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
          try { tx.drawImage(im, b.left + (b.width - w) / 2, b.top + (b.height - h) / 2, w, h); } catch (_) {}
        }
      }
      tx.restore();
      for (const dt of dots.children) { const r = dt.getBoundingClientRect(); if (r.width < 1) continue; tx.fillStyle = getComputedStyle(dt).backgroundColor; tx.beginPath(); tx.arc(r.left + r.width / 2, r.top + r.height / 2, r.width / 2, 0, 7); tx.fill(); }
      g.bindTexture(g.TEXTURE_2D, tex);
      try { g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, tc); } catch (_) { return false; }
      return true;
    }
    function draw() {                                                  // t: 0 = Launchpad in place, 1 = poured into the bottom of the screen
      const d = devicePixelRatio || 1, W = Math.round(innerWidth * d), H = Math.round(innerHeight * d);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      g.viewport(0, 0, W, H); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      const tX = innerWidth / 2, tY = innerHeight - 2, tw = innerHeight * .05, span = tY - P.y;
      const pinch = smooth(0, .55, t), slide = smooth(.2, 1, t);         // the bottom pinches in first, then everything slides down the funnel
      for (let r = 0; r <= RW; r++) {
        const v = r / RW; let Y = P.y + v * P.h + slide * span; if (Y > tY) Y = tY;
        const f = (1 - Math.cos(Math.PI * clamp((Y - P.y) / span))) / 2 * pinch;
        const L = P.x + (tX - tw / 2 - P.x) * f, Rt = P.x + P.w + (tX + tw / 2 - P.x - P.w) * f;
        for (let c = 0; c <= C; c++) { const i = (r * (C + 1) + c) * 2, X = L + (Rt - L) * (c / C); pos[i] = X / innerWidth * 2 - 1; pos[i + 1] = 1 - Y / innerHeight * 2; }
      }
      g.bindBuffer(g.ARRAY_BUFFER, pb); g.bufferData(g.ARRAY_BUFFER, pos, g.DYNAMIC_DRAW); g.vertexAttribPointer(pL, 2, g.FLOAT, false, 0, 0);
      g.uniform1f(aU, alpha * (1 - smooth(.86, 1, t)));
      g.drawElements(g.TRIANGLES, idx.length, g.UNSIGNED_SHORT, 0);
    }
    function run(from, to, ms, ease, done) {
      cancelAnimationFrame(raf); const t0 = performance.now();
      const step = now => { const p = Math.min(1, Math.max(0, now - t0) / ms); t = from + (to - from) * ease(p); draw(); if (p < 1) raf = requestAnimationFrame(step); else { raf = 0; done && done(); } };
      raf = requestAnimationFrame(step);
    }
    const post = m => window.chrome?.webview?.postMessage(m);
    function region() {                                                // the window while the genie runs: the panel, down to the bottom of the screen
      const d = devicePixelRatio || 1, tw = innerHeight * .05, x0 = Math.min(P.x, innerWidth / 2 - tw), x1 = Math.max(P.x + P.w, innerWidth / 2 + tw);
      return [x0 - 2, P.y - 2, x1 - x0 + 4, innerHeight - P.y + 2].map(n => Math.round(n * d)).join(',');
    }
    const api = { busy: false };
    api.cancel = () => { cancelAnimationFrame(raf); raf = 0; cv.style.visibility = 'hidden'; api.busy = false; };
    // open: Launchpad is laid out (invisible); paint it, pour it up, then hand over to the real thing
    api.open = async () => {
      const px = panelPx(); if (!px) return false; frost?.place(px);
      for (let i = 0; i < 6 && frost && !frost.ready; i++) await new Promise(r => setTimeout(r, 16));
      const d = devicePixelRatio || 1; P = { x: px[0] / d, y: px[1] / d, w: px[2] / d, h: px[3] / d };
      const imgs = [...track.querySelectorAll('.lpi img')].slice(0, 48).filter(im => !im.complete);
      if (imgs.length) await Promise.race([Promise.all(imgs.map(im => im.decode().catch(() => {}))), new Promise(r => setTimeout(r, 120))]);
      if (!open || !paint()) return false;
      api.busy = true; alpha = 1; t = 1; draw(); cv.style.visibility = 'visible';
      post('vis'); post('place:' + region());
      requestAnimationFrame(() => run(1, 0, 500, p => p * p * (3 - 2 * p), () => {               // even, eased at both ends - the whole pour is visible
        if (!open) { api.busy = false; return; }
        api.busy = false; sendPanel(true); post('frost:1');            // the window shrinks to the panel and Windows' live blur comes on underneath
        requestAnimationFrame(() => {
          lp.classList.remove('gh');                                   // the real Launchpad under the picture, then the picture fades
          const t0 = performance.now(), fade = now => { if (api.busy) return; alpha = 1 - Math.min(1, Math.max(0, now - t0) / 170); draw(); if (alpha > 0 && open) requestAnimationFrame(fade); else if (open) cv.style.visibility = 'hidden'; };
          requestAnimationFrame(fade);
        });
      }));
      return true;
    };
    // close: the picture takes over from Launchpad and Windows' blur, and pours down into the bottom of the screen
    api.close = done => {
      const px = panelPx(); if (!px) return false;
      const d = devicePixelRatio || 1; P = { x: px[0] / d, y: px[1] / d, w: px[2] / d, h: px[3] / d };
      if (!paint()) return false;
      api.busy = true; alpha = 1; t = 0; draw(); cv.style.visibility = 'visible'; lp.classList.add('gh');
      post('genieout'); post('place:' + region());
      requestAnimationFrame(() => run(0, 1, 400, p => p * p * (3 - 2 * p) * .35 + p * p * .65, () => { cv.style.visibility = 'hidden'; api.busy = false; done && done(); }));
      return true;
    };
    document.documentElement.classList.add('gn');
    return api;
  })();
  setInterval(() => sendPanel(false), 250);                           // follows the bar widening, answers, folders
  window.__overlayBgSet = src => { const im = new Image(); im.onload = () => { window.__overlayBg = im; drawBg(im); }; im.src = src; };   // the screen under the glass search bar
  let lastToggle = 0, helperLive = false;
  function toggle() { const t = performance.now(); if (t - lastToggle < 350) return; lastToggle = t; open ? hide() : show(); }
  // only the real wallpaper (Lively's WebView2) talks to the helper's key channel: a test page or browser tab must never
  // receive your keystrokes or tell the helper that Launchpad opened or closed. Add ?helper to the URL to force it on.
  const IN_LIVELY = !!(window.chrome && window.chrome.webview) || /Lively/i.test(navigator.userAgent) || new URLSearchParams(location.search).has('helper');
  function fastState(o) { if (!IN_LIVELY || window.OVERLAY) return; fetch(`${evBase}/lpstate?${q2s({ open: o })}`, { cache: 'no-store', mode: 'no-cors' }).catch(() => call('lpstate', { open: o })); }
  const evBase = base.replace(/:(\d+)$/, (m, p) => ':' + (+p + 1));      // the helper's instant key / swipe channel
  // apps and web searches open from that channel at once (it never waits behind slower look-ups); the old way if it can't
  window.__lpFast = (path, o) => {
    const slow = () => fetch(`${base}/${path}?${q2s(o)}`, { cache: 'no-store', mode: 'no-cors' }).catch(() => {});
    return fetch(`${evBase}/${path === 'launch' ? 'go' : 'goweb'}?${q2s(o)}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) return slow(); if (path === 'launch') fetch(`${base}/launch?${q2s({ ...o, count: 1 })}`, { cache: 'no-store', mode: 'no-cors' }).catch(() => {}); })
      .catch(slow);
  };
  (async function waitForHelper() {                                 // long-poll: answered the moment a key, swipe or F4 happens
    if (!IN_LIVELY || window.OVERLAY) return;                        // the overlay gets its keys directly (it's a normal focused window)
    let since = -1;
    for (;;) {
      try {
        const j = await (await fetch(`${evBase}/wait?${q2s({ since })}`, { cache: 'no-store' })).json();
        helperLive = true;
        if (since >= 0) (j.evs || []).forEach(ev => { try { onHelperEvent(ev); } catch (_) {} });
        since = j.seq ?? since;
      } catch (_) { helperLive = false; since = -1; await new Promise(r => setTimeout(r, 2000)); }
    }
  })();

  // the power menu closes on any press that isn't on it or its button (before anything else gets the press)
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#lpPwr,#lpPwrMenu')) $('lpPwrZone').classList.remove('menu'); }, true);
  // large icons (no names) <-> small icons with names; remembered on this PC
  const bigIcons = on => {
    lp.classList.add('sizing'); lp.classList.toggle('big', on); clearTimeout(bigIcons.t); bigIcons.t = setTimeout(() => lp.classList.remove('sizing'), 450);
    $('lpSize').querySelector('span').textContent = on ? 'Small icons' : 'Large icons';
    try { localStorage.setItem('lpBigIcons', on ? '1' : '0'); } catch (_) {}
    setTimeout(() => gSize?.pop?.(.5, 420, .6), 10);
  };
  { let on = false; try { on = localStorage.getItem('lpBigIcons') === '1'; } catch (_) {} lp.classList.toggle('big', on); $('lpSize').querySelector('span').textContent = on ? 'Small icons' : 'Large icons'; }
  $('lpSize').addEventListener('click', e => { e.stopPropagation(); bigIcons(!lp.classList.contains('big')); });
  // a long answer scrolls with the wheel (over your apps), by dragging it, or with Page Up / Page Down (the wallpaper gets no wheel)
  let awDrag = null;
  ansEl.addEventListener('mousedown', e => { const aw = e.target.closest('.aw'); if (!aw || e.button !== 0) return; awDrag = { aw, y: e.clientY, top: aw.scrollTop, moved: false }; });
  addEventListener('mousemove', e => { if (!awDrag) return; const dy = e.clientY - awDrag.y; if (Math.abs(dy) > 4) awDrag.moved = true; awDrag.aw.scrollTop = awDrag.top - dy; });
  addEventListener('mouseup', () => { if (awDrag?.moved) { suppressAnsClick = true; setTimeout(() => suppressAnsClick = false, 0); } awDrag = null; });
  let suppressAnsClick = false;
  ansEl.addEventListener('click', e => { if (suppressAnsClick) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  window.__lpScrollAns = dir => {                                      // eased by hand (smooth scrolling isn't available everywhere this runs)
    const aw = ansEl.querySelector('.aw'); if (!aw) return false;
    const from = aw.scrollTop, to = Math.max(0, Math.min(aw.scrollHeight - aw.clientHeight, from + dir * aw.clientHeight * .85)), t0 = performance.now();
    clearInterval(window.__lpScrollT);
    window.__lpScrollT = setInterval(() => { const p = Math.min(1, (performance.now() - t0) / 320), e = 1 - Math.pow(1 - p, 3); aw.scrollTop = from + (to - from) * e; if (p >= 1) clearInterval(window.__lpScrollT); }, 16);
    return true;
  };
  $('lpPwr').addEventListener('click', e => { e.stopPropagation(); $('lpPwrZone').classList.toggle('menu'); });
  $('lpPwrMenu').addEventListener('click', e => {
    const mi = e.target.closest('.mi'); if (!mi) return; e.stopPropagation();
    if (window.OVERLAY) window.chrome?.webview?.postMessage('launch'); // no handing the keyboard back: the PC is going to sleep / lock / restart
    hide(); setTimeout(() => call('power', { a: mi.dataset.p }), 320);   // Launchpad zooms away first
  });
  function launch(it) {                                               // macOS: the app opens while Launchpad zooms away
    if (!it.dataset.k) return;
    it.classList.add('press');
    if (window.OVERLAY) window.chrome?.webview?.postMessage('launch');   // the app you open keeps the keyboard
    call('launch', { k: it.dataset.k });
    hide();
  }

  /* ========================================================== instant answers ========================================================== */
  const ICON = {
    calc: '<path d="M5 9h14M5 15h14"/>',
    money: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8m0 8v1.5"/>',
    unit: '<path d="M4 16 16 4l4 4L8 20zM8 12l2 2m1-5 2 2m1-5 2 2"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    globe: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.4 2.3 3.5 5 3.5 8s-1.1 5.7-3.5 8c-2.4-2.3-3.5-5-3.5-8s1.1-5.7 3.5-8z"/>',
    cal: '<rect x="4.5" y="5.5" width="15" height="14" rx="2.5"/><path d="M4.5 10h15M9 3.5v4m6-4v4"/>',
    timer: '<circle cx="12" cy="13" r="7"/><path d="M12 13V9.5M10 3.5h4M18 6.5l1.2-1.2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2m0 12.6v2.2M3.5 12h2.2m12.6 0h2.2M6 6l1.6 1.6m8.8 8.8L18 18M6 18l1.6-1.6m8.8-8.8L18 6"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    play: '<path d="M8 6v12l10-6z"/>',
    next: '<path d="M6 6v12l8-6zM17 6v12"/>',
    prev: '<path d="M18 6v12l-8-6zM7 6v12"/>',
    vol: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>',
    mute: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l4.5 5m0-5-4.5 5"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    dice: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><circle cx="9" cy="9" r=".6" fill="#fff"/><circle cx="15" cy="15" r=".6" fill="#fff"/><circle cx="12" cy="12" r=".6" fill="#fff"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5 19 4m-3 3 2.5 2.5M14 9l2 2"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19"/>',
    wiki: '<path d="M3.5 7l3.5 10 3-7.5 3 7.5 3.5-10M15 7h5.5"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4"/>',
    cloud: '<path d="M7.5 18.5h9.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.2A3.5 3.5 0 0 0 7.5 18.5z"/>',
    rain: '<path d="M7.5 15.5h9.5a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.2A3.5 3.5 0 0 0 7.5 15.5zM9 18l-1 2.5m5-2.5-1 2.5m5-2.5-1 2.5"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
    bolt: '<path d="M13 3 6 13.5h5L10 21l8-11h-5z"/>',
    battery: '<rect x="3.5" y="7.5" width="15" height="9" rx="2"/><path d="M21 10.5v3"/>',
    hash: '<path d="M9 4 7.5 20M16.5 4 15 20M4.5 9h15.5M4 15h15.5"/>',
    web: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.4 2.3 3.5 5 3.5 8s-1.1 5.7-3.5 8c-2.4-2.3-3.5-5-3.5-8s1.1-5.7 3.5-8z"/>',
    yt: '<rect x="3.5" y="6" width="17" height="12" rx="3.5"/><path d="M10.5 9.5v5l4-2.5z"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    text: '<path d="M5 6.5h14M12 6.5V19"/>',
  };
  const svg = n => `<svg viewBox="0 0 24 24">${ICON[n] || ICON.search}</svg>`;

  // ---- number formatting ----
  const nf = (n, max = 10) => { if (!isFinite(n)) return String(n); const a = Math.abs(n);
    if (a !== 0 && (a >= 1e15 || a < 1e-6)) return n.toExponential(6).replace(/\.?0+e/, 'e');
    return n.toLocaleString(LOC, { maximumFractionDigits: a >= 1000 ? Math.min(max, 2) : max }); };
  const raw = n => { const v = Number(n.toPrecision(12)); return String(v); };

  // ---- calculator: a small parser (never eval) ----
  const FN = { sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
    sin: x => Math.sin(x * Math.PI / 180), cos: x => Math.cos(x * Math.PI / 180), tan: x => Math.tan(x * Math.PI / 180),
    asin: x => Math.asin(x) * 180 / Math.PI, acos: x => Math.acos(x) * 180 / Math.PI, atan: x => Math.atan(x) * 180 / Math.PI };
  const CONST = { pi: Math.PI, 'π': Math.PI, e: Math.E, tau: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2 };
  function calc(src) {
    let s = src.toLowerCase().trim().replace(/^=|=$/g, '').replace(/(\d),(?=\d{3}(\D|$))/g, '$1')
      .replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/\*\*/g, '^').replace(/√/g, 'sqrt ')
      .replace(/(?<=[\d)\s])x(?=[\s\d(.])/g, '*').replace(/\bmod\b/g, '@').replace(/(\d+(?:\.\d+)?)\s*%\s*of\b/g, '($1/100)*')
      .replace(/\btimes\b/g, '*').replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\bdivided by\b/g, '/').replace(/\bover\b/g, '/');
    if (!/^[\d\s.+\-*/^%!()@a-zπ]+$/.test(s) || !/[\d)πa-z]/.test(s)) return null;
    const tk = s.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-zπ]+|[+\-*/^%!()@]/g); if (!tk) return null;
    if (!tk.some(t => /[+\-*/^%!@]/.test(t) || FN[t]) && !(tk.length > 1)) return null;
    let i = 0;
    const peek = () => tk[i], next = () => tk[i++];
    function expr() {
      let v = term();
      while (peek() === '+' || peek() === '-') {
        const op = next(), r = term();
        v = r.pct ? { v: v.v * (1 + (op === '+' ? 1 : -1) * r.v) } : { v: op === '+' ? v.v + r.v : v.v - r.v };   // 200 + 10% = 220
      }
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        const t = peek();
        if (t === '*' || t === '/' || t === '@') { next(); const r = unary(); v = { v: t === '*' ? v.v * r.v : t === '/' ? v.v / r.v : ((v.v % r.v) + r.v) % r.v }; }
        else if (t !== undefined && (/^[\d.]/.test(t) || t === '(' || FN[t] || t in CONST)) { const r = unary(); v = { v: v.v * r.v }; }   // 2pi, 3(4+1)
        else return v;
      }
    }
    function unary() { if (peek() === '-') { next(); const r = unary(); return { v: -r.v, pct: r.pct }; } if (peek() === '+') { next(); return unary(); } return power(); }
    function power() { const b = postfix(); if (peek() === '^') { next(); const e = unary(); return { v: Math.pow(b.v, e.v) }; } return b; }
    function postfix() {
      let v = primary();
      for (;;) {
        if (peek() === '!') { next(); if (v.v < 0 || v.v > 170 || v.v % 1) throw 0; let f = 1; for (let k = 2; k <= v.v; k++) f *= k; v = { v: f }; }
        else if (peek() === '%') { next(); v = { v: v.v / 100, pct: true }; }
        else return v;
      }
    }
    function primary() {
      const t = next();
      if (t === undefined) throw 0;
      if (t === '(') { const v = expr(); if (next() !== ')') throw 0; return { v: v.v }; }
      if (/^[\d.]/.test(t)) return { v: parseFloat(t) };
      if (t in CONST) return { v: CONST[t] };
      if (FN[t]) { const a = peek() === '(' ? (next(), (() => { const v = expr(); if (next() !== ')') throw 0; return v; })()) : postfix(); return { v: FN[t](a.v) }; }
      throw 0;
    }
    try { const r = expr(); if (i !== tk.length) return null; return isFinite(r.v) ? r.v : null; } catch (_) { return null; }
  }

  // ---- currency (live rates, cached 6 h) ----
  const CUR_ALIAS = { '$': 'USD', dollar: 'USD', dollars: 'USD', bucks: 'USD', '€': 'EUR', euro: 'EUR', euros: 'EUR', '£': 'GBP', pound: 'GBP', pounds: 'GBP', quid: 'GBP',
    '₹': 'INR', rs: 'INR', 'rs.': 'INR', rupee: 'INR', rupees: 'INR', dirham: 'AED', dirhams: 'AED', dhs: 'AED', dh: 'AED', '¥': 'JPY', yen: 'JPY', yuan: 'CNY', rmb: 'CNY',
    riyal: 'SAR', riyals: 'SAR', won: 'KRW', franc: 'CHF', francs: 'CHF', ringgit: 'MYR', baht: 'THB', lira: 'TRY', ruble: 'RUB', rubles: 'RUB', peso: 'MXN', pesos: 'MXN',
    dinar: 'KWD', taka: 'BDT', btc: null };
  let rates = store.get('shadowRates');
  async function fetchRates(force) {
    if (!force && rates && Date.now() - rates.at < 6 * 3600e3) return;
    try {
      const j = await (await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })).json();
      if (j && j.rates) { rates = { at: Date.now(), upd: (j.time_last_update_unix || 0) * 1000, r: j.rates }; store.set('shadowRates', rates); if (open && search.value) onQuery(); }
    } catch (_) {}
  }
  // countries -> their currency (so "100 usd to japan" or "uae dirham" work)
  const COUNTRY_CUR = {};
  ('india,bharat:INR|uae,emirates,united arab emirates,dubai,abu dhabi:AED|usa,us,america,united states:USD|uk,britain,england,united kingdom:GBP|japan:JPY|china:CNY|' +
   'europe,eurozone,germany,france,italy,spain,netherlands,ireland,portugal,austria,belgium,finland,greece:EUR|canada:CAD|australia:AUD|new zealand,nz:NZD|singapore:SGD|' +
   'saudi,saudi arabia,ksa:SAR|qatar:QAR|kuwait:KWD|oman:OMR|bahrain:BHD|jordan:JOD|pakistan:PKR|bangladesh:BDT|sri lanka:LKR|nepal:NPR|malaysia:MYR|thailand:THB|' +
   'indonesia:IDR|philippines:PHP|south korea,korea:KRW|vietnam:VND|hong kong:HKD|taiwan:TWD|switzerland:CHF|russia:RUB|turkey,turkiye:TRY|south africa:ZAR|egypt:EGP|' +
   'nigeria:NGN|kenya:KES|ghana:GHS|morocco:MAD|brazil:BRL|mexico:MXN|argentina:ARS|chile:CLP|colombia:COP|peru:PEN|sweden:SEK|norway:NOK|denmark:DKK|poland:PLN|' +
   'czechia,czech republic:CZK|hungary:HUF|romania:RON|israel:ILS|iran:IRR|iraq:IQD|afghanistan:AFN|ukraine:UAH|kazakhstan:KZT|maldives:MVR|mauritius:MUR|iceland:ISK')
    .split('|').forEach(g => { const [n, c] = g.split(':'); n.split(',').forEach(k => COUNTRY_CUR[k] = c); });
  const GENERIC = /\s+(dollars?|dirhams?|rupees?|pounds?|pesos?|francs?|dinars?|riyals?|rials?|kronas?|kronor|kroner|krone|yen|yuan|won|lira|liras|rand|ringgit|baht|taka|shillings?|currency|money)$/;
  let curIndex = null;
  function curNames() {                                                 // every currency's English name -> code ("japanese yen" -> JPY)
    if (curIndex || !rates?.r) return curIndex || {};
    curIndex = {};
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'currency' }), last = {};
      Object.keys(rates.r).forEach(c => { const n = (dn.of(c) || '').toLowerCase(); if (!n || n === c.toLowerCase()) return; curIndex[n] = c; const w = n.split(' ').pop(); (last[w] = last[w] || []).push(c); });
      Object.entries(last).forEach(([w, cs]) => { if (cs.length === 1 && !curIndex[w]) curIndex[w] = cs[0]; });     // distinctive last words: naira, rupiah, shekel, rand...
    } catch (_) {}
    return curIndex;
  }
  function curPhrase(w) {                                               // a currency from free text: code, symbol, name, plural or country
    if (!w) return null; w = w.trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
    const one = curCode(w); if (one) return one;
    const names = curNames(); if (names[w]) return names[w];
    const sing = w.replace(/(e?s)$/, ''); if (names[sing]) return names[sing]; if (names[w.replace(/s$/, '')]) return names[w.replace(/s$/, '')];
    if (COUNTRY_CUR[w]) return COUNTRY_CUR[w];
    const g = w.replace(GENERIC, ''); if (g !== w && COUNTRY_CUR[g]) return COUNTRY_CUR[g];
    return null;
  }
  const curCode = w => { if (!w) return null; w = w.toLowerCase(); if (w in CUR_ALIAS) return CUR_ALIAS[w]; const u = w.toUpperCase(); return rates?.r?.[u] || /^(usd|eur|gbp|inr|aed|jpy|cny|sar|qar|kwd|omr|bhd|cad|aud|nzd|sgd|chf|hkd|myr|thb|idr|php|krw|pkr|bdt|lkr|npr|try|rub|zar|egp|brl|mxn|sek|nok|dkk|pln)$/.test(w) ? u : null; };
  const MULT = { k: 1e3, thousand: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, cr: 1e7, million: 1e6, mn: 1e6, mil: 1e6, billion: 1e9, bn: 1e9 };
  const money = (n, c) => { try { return n.toLocaleString(LOC, { style: 'currency', currency: c, maximumFractionDigits: Math.abs(n) >= 1 ? 2 : 4 }); } catch (_) { return nf(n, 4) + ' ' + c; } };
  function currency(q) {
    // "200 aed in inr", "$50", "100 japanese yen to rupees", "5 lakh inr to usd", "inr to aed", "100 dollars in japan"
    const m0 = q.match(/^([$€£₹¥])?\s*(\d[\d,]*\.?\d*)?\s*(k|thousand|lakhs?|lacs?|crores?|cr|million|mn|mil|billion|bn)?\s*([$€£₹¥])?\s*(.*)$/i);
    if (!m0 || (!m0[2] && !/\s(in|to|into)\s|=|->/.test(q))) return null;
    const rest = (m0[5] || '').trim(), parts = rest.split(/\s+(?:in|to|into|as)\s+|\s*(?:=|->)\s*/);
    const fromW = m0[1] || m0[4] || parts[0], toW = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const from = curPhrase(fromW); if (!from) return null;
    let to = toW ? curPhrase(toW) : null; if (toW && !to) return null;
    if (!m0[2] && !toW) return null;
    const m = [q, m0[1] || m0[4], m0[2], m0[3]];
    const amt = (m[2] ? parseFloat(m[2].replace(/,/g, '')) : 1) * (MULT[(m[3] || '').toLowerCase()] || 1);
    const targets = to ? [to] : (from === 'INR' ? ['USD', 'AED'] : from === 'USD' ? ['INR', 'AED'] : ['INR', 'USD']);
    if (!rates) { fetchRates(true); return [{ ic: 'money', t: 'Getting exchange rates…', s: `${nf(amt)} ${from}`, cls: 'load', pr: 3 }]; }
    return targets.filter(c => rates.r[c] && rates.r[from]).map((c, k) => {
      const v = amt / rates.r[from] * rates.r[c], one = rates.r[c] / rates.r[from], age = Math.round((Date.now() - (rates.upd || rates.at)) / 3600e3);
      return { ic: 'money', t: money(v, c), s: `${amt !== 1 ? `${nf(amt)} ${from} = ${nf(v, 2)} ${c}  ·  ` : ''}1 ${from} = ${nf(one, 4)} ${c}  ·  1 ${c} = ${nf(1 / one, 4)} ${from}  ·  rates ${age < 1 ? 'just updated' : age + ' h old'}`,
        copy: (Math.round(v * 100) / 100).toString(), pr: 3, hero: k === 0 };
    });
  }

  // ---- units ----
  const U = {}; const defU = (cat, f, ...names) => names.forEach(n => U[n] = { cat, f });
  [['length', 1e-9, 'nm', 'nanometer', 'nanometre'], ['length', 1e-6, 'um', 'µm', 'micron', 'micrometer'], ['length', .001, 'mm', 'millimeter', 'millimetre'], ['length', .01, 'cm', 'centimeter', 'centimetre'],
   ['length', 1, 'm', 'meter', 'metre', 'mtr'], ['length', 1000, 'km', 'kilometer', 'kilometre', 'kms'], ['length', .0254, 'in', 'inch', 'inches', '"'], ['length', .3048, 'ft', 'foot', 'feet', "'"],
   ['length', .9144, 'yd', 'yard', 'yards'], ['length', 1609.344, 'mi', 'mile', 'miles'], ['length', 1852, 'nmi', 'nautical mile'],
   ['mass', 1e-6, 'mg', 'milligram'], ['mass', .001, 'g', 'gram', 'grams', 'gm', 'gms'], ['mass', 1, 'kg', 'kilo', 'kilos', 'kilogram', 'kgs'], ['mass', 1000, 't', 'tonne', 'tonnes', 'ton', 'tons'],
   ['mass', .028349523125, 'oz', 'ounce', 'ounces'], ['mass', .45359237, 'lb', 'lbs', 'pound', 'pounds'], ['mass', 6.35029318, 'st', 'stone'], ['mass', .0002, 'ct', 'carat', 'carats'], ['mass', .01166, 'tola', 'tolas'],
   ['volume', .001, 'ml', 'milliliter', 'millilitre'], ['volume', .01, 'cl'], ['volume', .1, 'dl'], ['volume', 1, 'l', 'liter', 'litre', 'liters', 'litres', 'ltr'], ['volume', 1000, 'm3', 'cubic meter'],
   ['volume', .00492892, 'tsp', 'teaspoon'], ['volume', .0147868, 'tbsp', 'tablespoon'], ['volume', .2365882, 'cup', 'cups'], ['volume', .0295735, 'floz', 'fl oz'], ['volume', .473176, 'pt', 'pint', 'pints'],
   ['volume', .946353, 'qt', 'quart'], ['volume', 3.78541, 'gal', 'gallon', 'gallons'],
   ['speed', 1, 'm/s', 'mps'], ['speed', 1 / 3.6, 'km/h', 'kmh', 'kph', 'kmph'], ['speed', .44704, 'mph'], ['speed', .514444, 'knot', 'knots', 'kn', 'kt'], ['speed', 343, 'mach'],
   ['data', 1, 'b', 'byte', 'bytes'], ['data', .125, 'bit', 'bits'], ['data', 1e3, 'kb', 'kilobyte'], ['data', 1e6, 'mb', 'megabyte'], ['data', 1e9, 'gb', 'gigabyte', 'gig', 'gigs'], ['data', 1e12, 'tb', 'terabyte'],
   ['data', 1e15, 'pb'], ['data', 1024, 'kib'], ['data', 1048576, 'mib'], ['data', 1073741824, 'gib'], ['data', 1099511627776, 'tib'],
   ['area', 1, 'm2', 'sqm', 'sq m', 'square meter', 'square metre'], ['area', 1e-4, 'cm2', 'sqcm'], ['area', 1e6, 'km2', 'sqkm', 'sq km'], ['area', .09290304, 'ft2', 'sqft', 'sq ft', 'square feet', 'square foot'],
   ['area', .83612736, 'yd2', 'sqyd', 'sq yd', 'gaj'], ['area', 4046.8564224, 'acre', 'acres'], ['area', 10000, 'ha', 'hectare', 'hectares'], ['area', 2589988.11, 'mi2', 'sqmi', 'sq mi'],
   ['time', .001, 'ms', 'millisecond', 'milliseconds'], ['time', 1, 's', 'sec', 'secs', 'second', 'seconds'], ['time', 60, 'min', 'mins', 'minute', 'minutes'], ['time', 3600, 'h', 'hr', 'hrs', 'hour', 'hours'],
   ['time', 86400, 'd', 'day', 'days'], ['time', 604800, 'wk', 'week', 'weeks'], ['time', 2629746, 'month', 'months'], ['time', 31556952, 'yr', 'year', 'years'],
   ['energy', 1, 'j', 'joule', 'joules'], ['energy', 1000, 'kj'], ['energy', 4.184, 'cal', 'calorie'], ['energy', 4184, 'kcal', 'calories', 'kilocalorie'], ['energy', 3600, 'wh'], ['energy', 3.6e6, 'kwh', 'unit', 'units'],
   ['energy', 1.602176634e-19, 'ev'],
   ['pressure', 1, 'pa'], ['pressure', 1000, 'kpa'], ['pressure', 1e5, 'bar'], ['pressure', 100, 'mbar', 'hpa'], ['pressure', 101325, 'atm'], ['pressure', 6894.757, 'psi'], ['pressure', 133.322, 'mmhg'],
   ['angle', 1, 'deg', 'degree', 'degrees', '°'], ['angle', 180 / Math.PI, 'rad', 'radian', 'radians'], ['angle', .9, 'grad'],
   ['power', 1, 'w', 'watt', 'watts'], ['power', 1000, 'kw', 'kilowatt'], ['power', 745.7, 'hp', 'horsepower'],
  ].forEach(([c, f, ...n]) => defU(c, f, ...n));
  const TEMP = { c: 'C', '°c': 'C', celsius: 'C', centigrade: 'C', f: 'F', '°f': 'F', fahrenheit: 'F', k: 'K', kelvin: 'K' };
  const unitOf = w => { w = w.trim().toLowerCase().replace(/^degrees?\s+/, '').replace(/square\s+/, 'sq ').replace(/\s+/g, ' '); return TEMP[w] ? { cat: 'temp', t: TEMP[w] } : U[w] || U[w.replace(/ /g, '')] || (w.endsWith('s') && U[w.slice(0, -1)]) || null; };
  const toK = (v, u) => u === 'C' ? v + 273.15 : u === 'F' ? (v - 32) * 5 / 9 + 273.15 : v, fromK = (v, u) => u === 'C' ? v - 273.15 : u === 'F' ? (v - 273.15) * 9 / 5 + 32 : v;
  const uname = w => w.trim().toLowerCase();
  function units(q) {
    let m = q.match(/^(\d+)\s*(?:ft|feet|foot|')\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches|"|'')?\s*(?:(?:in|to)\s+(cm|m|mm|centimeters?|meters?))?$/i);   // 5'10 / 5 ft 10 in cm
    if (m && (m[3] || /'|ft|feet|foot/.test(q))) {
      const cm = (+m[1] * 12 + +m[2]) * 2.54, to = (m[3] || 'cm').toLowerCase()[0] === 'm' && !/mm/.test(m[3] || '') ? 'm' : /mm/.test(m[3] || '') ? 'mm' : 'cm';
      const v = to === 'm' ? cm / 100 : to === 'mm' ? cm * 10 : cm;
      return [{ ic: 'unit', t: `${nf(v, 2)} ${to}`, s: `${m[1]} ft ${m[2]} in`, copy: raw(v), pr: 3, hero: true }];
    }
    m = q.match(/^(-?\d[\d,]*\.?\d*(?:e-?\d+)?)\s*(.+?)\s+(?:in|to|into|as|=|->)\s+(.+)$/i);
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, '')), a = unitOf(m[2]), b = unitOf(m[3]);
      if (!a || !b || a.cat !== b.cat) return null;
      if (a.cat === 'temp') { const r = fromK(toK(v, a.t), b.t); return [{ ic: 'unit', t: `${nf(r, 2)} °${b.t}`, s: `${nf(v)} °${a.t}`, copy: raw(r), pr: 3, hero: true }]; }
      const r = v * a.f / b.f, out = [{ ic: 'unit', t: `${nf(r, 4)} ${uname(m[3])}`, s: `${nf(v)} ${uname(m[2])}`, copy: raw(r), pr: 3, hero: true }];
      if (a.cat === 'length' && /^(ft|feet|foot)$/.test(uname(m[3]))) { const ti = v * a.f / .0254, ft = Math.floor(ti / 12 + 1e-9), inch = ti - ft * 12;
        out.push({ ic: 'unit', t: `${ft} ft ${nf(inch, 1)} in`, s: 'feet and inches', copy: `${ft}'${nf(inch, 1)}"`, pr: 3 }); }
      return out;
    }
    m = q.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*(c|f|celsius|fahrenheit)$/i);      // 30c -> F, 98.6f -> C
    if (m) { const v = +m[1], a = TEMP[m[2].toLowerCase()], b = a === 'C' ? 'F' : 'C', r = fromK(toK(v, a), b);
      return [{ ic: 'unit', t: `${nf(r, 1)} °${b}`, s: `${nf(v)} °${a}`, copy: raw(r), pr: 2, hero: true }]; }
    return null;
  }

  // ---- number bases ----
  function bases(q) {
    const m = q.match(/^(0x[0-9a-f]+|0b[01]+|0o[0-7]+|\d+)\s+(?:in|to|as)\s+(hex|hexadecimal|binary|bin|octal|oct|decimal|dec|roman)$/i); if (!m) return null;
    const s = m[1].toLowerCase(), n = s.startsWith('0x') ? parseInt(s.slice(2), 16) : s.startsWith('0b') ? parseInt(s.slice(2), 2) : s.startsWith('0o') ? parseInt(s.slice(2), 8) : parseInt(s, 10);
    const to = m[2].toLowerCase(); let r;
    if (to === 'roman') { if (n < 1 || n > 3999) return null; let x = n; r = ''; [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].forEach(([v, l]) => { while (x >= v) { r += l; x -= v; } }); }
    else r = to.startsWith('hex') ? '0x' + n.toString(16).toUpperCase() : to.startsWith('bin') ? '0b' + n.toString(2) : to.startsWith('oct') ? '0o' + n.toString(8) : String(n);
    return [{ ic: 'hash', t: r, s: `${m[1]} in ${to}`, copy: r, pr: 3, hero: true }];
  }

  // ---- world clock ----
  const ZONES = {};
  ('london,england,uk,britain,united kingdom:Europe/London|paris,france:Europe/Paris|berlin,germany,munich,frankfurt:Europe/Berlin|madrid,spain,barcelona:Europe/Madrid|rome,italy,milan:Europe/Rome|' +
   'amsterdam,netherlands,holland:Europe/Amsterdam|dublin,ireland:Europe/Dublin|lisbon,portugal:Europe/Lisbon|zurich,geneva,switzerland:Europe/Zurich|vienna,austria:Europe/Vienna|' +
   'stockholm,sweden:Europe/Stockholm|oslo,norway:Europe/Oslo|copenhagen,denmark:Europe/Copenhagen|helsinki,finland:Europe/Helsinki|athens,greece:Europe/Athens|brussels,belgium:Europe/Brussels|' +
   'prague,czechia:Europe/Prague|warsaw,poland:Europe/Warsaw|istanbul,turkey:Europe/Istanbul|moscow,russia:Europe/Moscow|kyiv,kiev,ukraine:Europe/Kyiv|reykjavik,iceland:Atlantic/Reykjavik|' +
   'dubai,uae,abu dhabi,sharjah,ajman,emirates:Asia/Dubai|doha,qatar:Asia/Qatar|riyadh,jeddah,mecca,saudi,saudi arabia,ksa:Asia/Riyadh|kuwait:Asia/Kuwait|muscat,oman:Asia/Muscat|bahrain,manama:Asia/Bahrain|' +
   'tehran,iran:Asia/Tehran|karachi,lahore,islamabad,pakistan:Asia/Karachi|kabul,afghanistan:Asia/Kabul|' +
   'india,delhi,new delhi,mumbai,bombay,kolkata,calcutta,chennai,madras,bangalore,bengaluru,hyderabad,pune,ahmedabad,jaipur,lucknow,chandigarh,goa,kochi,surat,indore:Asia/Kolkata|' +
   'kathmandu,nepal:Asia/Kathmandu|dhaka,bangladesh:Asia/Dhaka|colombo,sri lanka:Asia/Colombo|bangkok,thailand:Asia/Bangkok|singapore:Asia/Singapore|kuala lumpur,malaysia:Asia/Kuala_Lumpur|' +
   'jakarta,indonesia:Asia/Jakarta|bali:Asia/Makassar|manila,philippines:Asia/Manila|hong kong,hk:Asia/Hong_Kong|shanghai,beijing,china,shenzhen:Asia/Shanghai|taipei,taiwan:Asia/Taipei|' +
   'seoul,korea,south korea:Asia/Seoul|tokyo,osaka,kyoto,japan:Asia/Tokyo|hanoi,ho chi minh,vietnam:Asia/Ho_Chi_Minh|' +
   'sydney,australia,canberra:Australia/Sydney|melbourne:Australia/Melbourne|brisbane:Australia/Brisbane|perth:Australia/Perth|adelaide:Australia/Adelaide|auckland,new zealand,nz,wellington:Pacific/Auckland|' +
   'new york,nyc,ny,usa,us,america,united states,boston,washington,dc,miami,atlanta,philadelphia,toronto,canada,montreal,ottawa:America/New_York|' +
   'chicago,dallas,houston,austin,texas,mexico city,mexico:America/Chicago|denver,phoenix:America/Denver|los angeles,la,san francisco,sf,seattle,vancouver,las vegas,california,silicon valley:America/Los_Angeles|' +
   'anchorage,alaska:America/Anchorage|honolulu,hawaii:Pacific/Honolulu|sao paulo,rio,rio de janeiro,brazil:America/Sao_Paulo|buenos aires,argentina:America/Argentina/Buenos_Aires|' +
   'lima,peru:America/Lima|bogota,colombia:America/Bogota|santiago,chile:America/Santiago|cairo,egypt:Africa/Cairo|lagos,nigeria:Africa/Lagos|nairobi,kenya:Africa/Nairobi|' +
   'johannesburg,south africa,cape town:Africa/Johannesburg|casablanca,morocco:Africa/Casablanca|' +
   'utc,gmt,zulu:UTC|ist:Asia/Kolkata|gst:Asia/Dubai|pst,pdt,pt,pacific:America/Los_Angeles|est,edt,et,eastern:America/New_York|cst,cdt,ct,central:America/Chicago|mst,mdt,mountain:America/Denver|' +
   'bst:Europe/London|cet,cest:Europe/Paris|jst:Asia/Tokyo|kst:Asia/Seoul|aest,aedt:Australia/Sydney|sgt:Asia/Singapore|hkt:Asia/Hong_Kong|pkt:Asia/Karachi|nzst,nzdt:Pacific/Auckland')
    .split('|').forEach(g => { const [names, z] = g.split(':'); names.split(',').forEach(n => ZONES[n] = z); });
  const HERE = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // every city that names a time zone (about 400), on top of the hand-picked list
  try { Intl.supportedValuesOf('timeZone').forEach(z => { const c = z.split('/').pop().replace(/_/g, ' ').toLowerCase(); if (!ZONES[c]) ZONES[c] = z; }); } catch (_) {}
  // anything else (any town or country on Earth): ask the free Open-Meteo geocoder, which returns its time zone
  // every country by name -> its time zone (browser's own region data; picks the main zone of big countries via the list above)
  let countryIdx = null;
  function countryZone(w) {
    if (!countryIdx) {
      countryIdx = {};
      try { const dn = new Intl.DisplayNames(['en'], { type: 'region' });
        for (let a = 65; a < 91; a++) for (let b = 65; b < 91; b++) { const c = String.fromCharCode(a, b); let n; try { n = dn.of(c); } catch (_) { continue; } if (n && n !== c) countryIdx[n.toLowerCase()] = c; } } catch (_) {}
    }
    const c = countryIdx[w]; if (!c) return null;
    try { const loc = new Intl.Locale('und-' + c), zs = (loc.getTimeZones ? loc.getTimeZones() : loc.timeZones) || []; return zs.length ? zs.slice().sort()[0] : null; } catch (_) { return null; }
  }
  function findZone(w, strict) {
    w = (w || '').trim().toLowerCase().replace(/[?.!]$/, '').replace(/^(the)\s+/, ''); if (!w) return null;
    if (ZONES[w]) return { tz: ZONES[w], label: title(w) };                   // exact city first, then a country, then a forgiving spelling match
    const cz = countryZone(w); if (cz) return { tz: cz, label: title(w) };
    const z = zoneOf(w); if (z) return { tz: z, label: title(w) };
    if (w.length < 3 || /\d/.test(w)) return null;
    const e = look('tz:' + w, async () => {
      const g = await getJ(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=${encodeURIComponent(w)}`);
      const rs = (g?.results || []).filter(r => r.timezone); if (!rs.length) return null;
      const exact = rs.filter(r => r.name.toLowerCase() === w);
      const p = exact.find(r => /^PCL/.test(r.feature_code || '')) || exact.sort((a, b) => (b.population || 0) - (a.population || 0))[0] || rs[0];
      return { tz: p.timezone, label: p.name + (p.country && p.country !== p.name ? ', ' + p.country : ''), big: /^PCL/.test(p.feature_code || '') || (p.population || 0) >= 20000 };
    });
    if (e.state === 'load') return { loading: true, label: title(w) };
    if (e.state !== 'ok' || (strict && !e.data.big)) return null;
    return e.data;
  }
  const zoneOf = w => { w = (w || '').trim().toLowerCase().replace(/[?.!]$/, ''); if (ZONES[w]) return ZONES[w];
    if (w.length >= 5) { const k = Object.keys(ZONES).find(z => z.length >= 4 && dl(w, z) <= (w.length >= 10 ? 2 : 1)); if (k) return ZONES[k]; } try { if (w.includes('/')) { Intl.DateTimeFormat('en', { timeZone: w }); return w; } } catch (_) {} return null; };
  const title = w => w.replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\b(Uk|Usa|Us|Uae|Ksa|Nyc|La|Sf|Nz|Dc|Hk|Utc|Gmt|Ist|Gst|Pst|Pdt|Est|Edt|Cst|Cdt|Mst|Bst|Cet|Jst|Kst|Aest|Sgt|Hkt|Pkt)\b/g, s => s.toUpperCase());
  function offMin(tz, d) {
    const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(d).forEach(x => p[x.type] = x.value);
    return Math.round((Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(d.getTime() / 60000) * 60000) / 60000);
  }
  const h24 = () => !!window.S_?.hour24;
  const fmtT = (d, tz) => d.toLocaleTimeString(LOC, { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: !h24() });
  const fmtD = (d, tz) => d.toLocaleDateString(LOC, { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' });
  function diffTxt(m) { if (!m) return 'same time as you'; const a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60; return `${h ? h + ' h' : ''}${h && mm ? ' ' : ''}${mm ? mm + ' m' : ''} ${m > 0 ? 'ahead of' : 'behind'} you`; }
  function clockAns(place, tz, d = new Date()) {
    const diff = offMin(tz, d) - offMin(HERE, d);
    return { ic: 'clock', t: fmtT(d, tz), s: `${fmtD(d, tz)}  ·  ${title(place)}  ·  ${diffTxt(diff)}`, copy: fmtT(d, tz), pr: 3, hero: true, live: true };
  }
  function worldClock(q) {
    let m = q.match(/^(?:what(?:'s| is)? (?:the )?time(?: is it)?|time|clock|current time|now)\s+(?:in|at|for)?\s*(.+)$/) || q.match(/^(.+?)\s+(?:time|clock|time now)$/);
    if (m) {
      const explicit = !/(time|clock|time now)$/.test(q) || /^(what|time|clock|current|now)\b/.test(q);
      const f = findZone(m[1], !explicit);
      if (f?.tz) return [clockAns(f.label, f.tz)];
      if (f?.loading && explicit) return [{ ic: 'clock', t: '…', s: `Finding ${f.label}…`, cls: 'load', pr: 2.8, hero: true }];
    }
    if (/^(time|what time is it|current time|clock)$/.test(q)) {
      const d = new Date(), out = [{ ic: 'clock', t: fmtT(d), s: `${d.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}  ·  your time  ·  week ${weekNo(d)}`, copy: fmtT(d), pr: appHit ? 1.5 : 3, hero: true, live: true }];
      [['london', 'Europe/London'], ['new york', 'America/New_York'], ['dubai', 'Asia/Dubai'], ['tokyo', 'Asia/Tokyo']].filter(([, z]) => z !== HERE).slice(0, 3).forEach(([n, z]) => { const a = clockAns(n, z); a.hero = false; out.push(a); });
      return out;
    }
    // "5pm pst in ist", "17:30 london to tokyo", "9am in dubai" (your time)
    m = q.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:(.+?)\s+)?(?:in|to)\s+(.+)$/);
    if (m && (m[3] || m[2])) {
      const fz = m[4] ? findZone(m[4]) : { tz: HERE, label: 'your time' }, tzz = findZone(m[5]);
      if (fz?.loading || tzz?.loading) return [{ ic: 'globe', t: '…', s: 'Finding the places…', cls: 'load', pr: 2.8, hero: true }];
      if (!fz?.tz || !tzz?.tz) return null;
      const fromTz = fz.tz, toTz = tzz.tz; m[4] = m[4] ? fz.label : m[4]; m[5] = tzz.label;
      let h = +m[1] % 12 + (m[3] === 'pm' ? 12 : 0); if (!m[3]) h = +m[1]; const mi = +(m[2] || 0); if (h > 23 || mi > 59) return null;
      const now = new Date(), ref = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi);                 // that wall time, in my zone
      const t = new Date(ref.getTime() - (offMin(fromTz, now) - offMin(HERE, now)) * 60000);                            // ...shifted to the source zone
      return [{ ic: 'globe', t: fmtT(t, toTz), s: `${fmtT(t, fromTz)} ${title(m[4] || 'your time')}  =  ${fmtT(t, toTz)} ${title(m[5])}  ·  ${fmtD(t, toTz)}`, copy: fmtT(t, toTz), pr: 3, hero: true }];
    }
    return null;
  }

  // ---- dates ----
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const nextOf = (mo, da, past) => { const t = today0(); let d = new Date(t.getFullYear(), mo, da); if (!past && d < t) d = new Date(t.getFullYear() + 1, mo, da); if (past && d > t) d = new Date(t.getFullYear() - 1, mo, da); return d; };
  const FIXED = { diwali: ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05'], holi: ['2027-03-22', '2028-03-11', '2029-03-01'], 'eid': ['2027-03-10', '2028-02-27'],
    easter: ['2027-03-28', '2028-04-16', '2029-04-01'], 'raksha bandhan': ['2027-08-17', '2028-08-05'] };
  function parseDay(w, past) {
    w = w.trim().toLowerCase().replace(/^(the\s+)/, '').replace(/[?.!]$/, '');
    const named = { christmas: [11, 25], xmas: [11, 25], 'new year': [0, 1], 'new years': [0, 1], "new year's": [0, 1], valentines: [1, 14], 'valentines day': [1, 14], "valentine's day": [1, 14],
      halloween: [9, 31], 'independence day': [7, 15], 'republic day': [0, 26], 'gandhi jayanti': [9, 2], "children's day": [10, 14], 'teachers day': [8, 5] };
    if (named[w]) return nextOf(...named[w], past);
    if (FIXED[w]) { const t = today0(), ds = FIXED[w].map(s => new Date(s + 'T00:00')); return past ? ds.reverse().find(d => d <= t) : ds.find(d => d >= t); }
    if (w === 'today') return today0();
    if (w === 'tomorrow') { const d = today0(); d.setDate(d.getDate() + 1); return d; }
    if (w === 'weekend') { const d = today0(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return d; }
    const wd = DAYS.findIndex(x => x === w || x.slice(0, 3) === w || 'next ' + x === w); if (wd >= 0) { const d = today0(); d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7 || 7)); return d; }
    let m = w.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return new Date(+m[1], m[2] - 1, +m[3]);
    m = w.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/); if (m) { const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null; return y ? new Date(y, m[2] - 1, +m[1]) : nextOf(m[2] - 1, +m[1], past); }   // day/month (India, UK)
    m = w.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)\.?(?:,?\s+(\d{4}))?$/) || w.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/);
    if (m) { let [d, mo] = /^\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]]; const mi = MONTHS.indexOf(mo.slice(0, 3)); if (mi < 0) return null; return m[3] ? new Date(+m[3], mi, d) : nextOf(mi, d, past); }
    m = w.match(/^([a-z]+)\s+(\d{4})$/); if (m) { const mi = MONTHS.indexOf(m[1].slice(0, 3)); if (mi >= 0) return new Date(+m[2], mi, 1); }
    return null;
  }
  const longD = d => d.toLocaleDateString(LOC, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  function weekNo(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }
  function dates(q) {
    let m;
    if (/^(today|date|today'?s date|what(?:'s| is) (?:the )?date(?: today)?|what day is it|day)$/.test(q)) {
      const d = new Date(), doy = Math.round((today0() - new Date(d.getFullYear(), 0, 1)) / 864e5) + 1, len = new Date(d.getFullYear(), 1, 29).getDate() === 29 ? 366 : 365;
      return [{ ic: 'cal', t: longD(d), s: `Week ${weekNo(d)}  ·  day ${doy} of ${len}  ·  ${len - doy} days left this year`, copy: d.toLocaleDateString(LOC), pr: 3, hero: true }];
    }
    if (/^(week|week number|what week is it|week no)$/.test(q)) return [{ ic: 'cal', t: `Week ${weekNo(new Date())}`, s: longD(new Date()), copy: String(weekNo(new Date())), pr: 3, hero: true }];
    m = q.match(/^(?:(?:how many )?days? (?:until|till|til|to|before)|how long (?:until|till|to)|countdown(?: to)?|time (?:until|till))\s+(.+)$/) || q.match(/^(.+?)\s+countdown$/);
    if (m) { const d = parseDay(m[1]); if (!d) return null; const n = Math.round((d - today0()) / 864e5);
      return [{ ic: 'cal', t: n === 0 ? 'Today!' : `${nf(n)} day${n === 1 ? '' : 's'}`, s: `until ${longD(d)}${n >= 14 ? `  ·  ${Math.floor(n / 7)} weeks ${n % 7 ? n % 7 + ' days' : ''}` : ''}`, copy: String(n), pr: 3, hero: true }]; }
    m = q.match(/^(?:(?:how many )?days? since|how long since)\s+(.+)$/);
    if (m) { const d = parseDay(m[1], true); if (!d) return null; const n = Math.round((today0() - d) / 864e5);
      return [{ ic: 'cal', t: `${nf(n)} day${n === 1 ? '' : 's'}`, s: `since ${longD(d)}`, copy: String(n), pr: 3, hero: true }]; }
    m = q.match(/^(?:in\s+)?(\d+)\s+(day|week|month|year)s?\s+(from now|from today|later|ago|before)?$/) || q.match(/^in\s+(\d+)\s+(day|week|month|year)s?$/);
    if (m && (m[3] || /^in\s/.test(q))) { const n = +m[1] * (/ago|before/.test(m[3] || '') ? -1 : 1), d = today0();
      if (m[2] === 'day') d.setDate(d.getDate() + n); else if (m[2] === 'week') d.setDate(d.getDate() + 7 * n); else if (m[2] === 'month') d.setMonth(d.getMonth() + n); else d.setFullYear(d.getFullYear() + n);
      return [{ ic: 'cal', t: longD(d), s: q, copy: d.toLocaleDateString(LOC), pr: 3, hero: true }]; }
    m = q.match(/^(?:what day (?:is|was|will be)|day of|weekday of)\s+(.+)$/);
    if (m) { const d = parseDay(m[1]); if (!d) return null; return [{ ic: 'cal', t: d.toLocaleDateString(LOC, { weekday: 'long' }), s: longD(d), copy: d.toLocaleDateString(LOC, { weekday: 'long' }), pr: 3, hero: true }]; }
    m = q.match(/^(?:age|how old (?:am i|is someone) born)\s+(.+)$/);
    if (m) { const d = parseDay(m[1], true); if (!d) return null; const t = today0(); let y = t.getFullYear() - d.getFullYear(); if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) y--;
      return [{ ic: 'cal', t: `${y} years old`, s: `born ${longD(d)}`, copy: String(y), pr: 3, hero: true }]; }
    return null;
  }

  // ---- timer (the big glass clock) ----
  function timer(q) {
    if (/^(stop|cancel|reset|end|clear) (the )?timer$/.test(q) || q === 'stop timer') return [{ ic: 'timer', t: 'Stop the timer', s: 'Back to the clock', key: 'Stop', pr: 3, run: () => { window.TMctl?.stop(); hide(); } }];
    if (/^(pause|resume) (the )?timer$/.test(q)) return [{ ic: 'timer', t: q[0] === 'p' ? 'Pause the timer' : 'Resume the timer', s: 'On the wallpaper clock', key: 'Do it', pr: 3, run: () => { window.TMctl?.pause(); hide(); } }];
    let m = q.match(/^(?:timer|focus|study|set (?:a )?timer(?: for)?|countdown)\s*(?:for\s+)?(\d+(?:\.\d+)?)?\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)?$/) || q.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)?\s+(?:timer|focus|study)$/);
    let min = null, label;
    if (m) { const n = m[1] ? +m[1] : (window.S_?.focus || 20), u = (m[2] || 'm')[0]; min = u === 's' ? n / 60 : u === 'h' ? n * 60 : n; }
    if (/^pomodoro|^pomo$/.test(q)) { min = 25; label = 'Pomodoro'; }
    if (/^(short )?break$/.test(q)) { min = 5; label = 'Short break'; }
    if (/^long break$/.test(q)) { min = 15; label = 'Long break'; }
    if (min == null || !(min > 0) || min > 600) return null;
    const txt = min < 1 ? `${Math.round(min * 60)} seconds` : min % 60 === 0 && min >= 60 ? `${min / 60} hour${min === 60 ? '' : 's'}` : `${nf(min, 1)} minutes`;
    const ends = new Date(Date.now() + min * 60000);
    return [{ ic: 'timer', t: `${label ? label + ' · ' : ''}${txt}`, s: `Starts on the wallpaper clock  ·  ends at ${fmtT(ends)}`, key: 'Start', pr: 3, hero: true, run: () => { window.TMctl?.start(min); hide(); } }];
  }

  // ---- translation: "anuched in english", "hello in japanese", "translate thank you to hindi", "how do you say ... in french" ----
  // Every language Google Translate supports. Text typed in English letters for another language ("anuched", "shukriya")
  // is first spelled in that language's own script (Google Input Tools), then translated. "... from marathi in english" picks the script.
  const LANG_CODES = 'af sq am ar hy as ay az bm eu be bn bho bs bg ca ceb ny zh-CN zh-TW co hr cs da dv doi nl en eo et ee tl fi fr fy gl ka de el gn gu ht ha haw iw hi hmn hu is ig ilo id ga it ja jw kn kk km rw gom ko kri ku ckb ky lo la lv ln lt lg lb mk mai mg ms ml mt mi mr mni-Mtei lus mn my ne no or om ps fa pl pt pa qu ro ru sm sa gd nso sr st sn sd si sk sl so es su sw sv tg ta tt te th ti ts tr tk ak uk ur ug uz vi cy xh yi yo zu'.split(' ');
  let langIdx = null;
  function langCode(name) {
    if (!langIdx) {
      langIdx = { chinese: 'zh-CN', mandarin: 'zh-CN', 'simplified chinese': 'zh-CN', 'traditional chinese': 'zh-TW', cantonese: 'zh-TW', farsi: 'fa', persian: 'fa', hebrew: 'iw',
        filipino: 'tl', tagalog: 'tl', punjabi: 'pa', panjabi: 'pa', hinglish: 'hi', burmese: 'my', myanmar: 'my', kurdish: 'ku', sorani: 'ckb', 'scottish gaelic': 'gd', gaelic: 'gd',
        javanese: 'jw', konkani: 'gom', manipuri: 'mni-Mtei', meitei: 'mni-Mtei', mizo: 'lus', sesotho: 'st', 'sepedi': 'nso', twi: 'ak', 'haitian creole': 'ht', creole: 'ht',
        odia: 'or', oriya: 'or', sinhalese: 'si', sinhala: 'si', 'brazilian portuguese': 'pt', castilian: 'es', flemish: 'nl', moldovan: 'ro', bhojpuri: 'bho', maithili: 'mai', dogri: 'doi' };
      try { const dn = new Intl.DisplayNames(['en'], { type: 'language' });
        LANG_CODES.forEach(c => { const n = (dn.of(c === 'iw' ? 'he' : c === 'jw' ? 'jv' : c) || '').toLowerCase(); if (n && !langIdx[n]) langIdx[n] = c; const short = n.replace(/\s*\(.*\)$/, ''); if (short && !langIdx[short]) langIdx[short] = c; }); } catch (_) {}
    }
    name = (name || '').trim().toLowerCase().replace(/[?.!]$/, '').replace(/\s+language$/, '');
    if (langIdx[name]) return langIdx[name];
    if (LANG_CODES.includes(name)) return name;
    const k = name.length >= 5 && Object.keys(langIdx).find(l => l.length >= 5 && dl(name, l) <= 1); return k ? langIdx[k] : null;   // "spansih", "japanes"
  }
  const langName = c => { try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(c === 'iw' ? 'he' : c === 'jw' ? 'jv' : c) || c; } catch (_) { return c; } };
  async function gtx(text, tl, sl = 'auto') {
    const j = await getJ(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=rm&q=${encodeURIComponent(text)}`);
    if (!Array.isArray(j)) return null;
    const segs = j[0] || [], out = segs.filter(x => x && x[0]).map(x => x[0]).join(''), rm = segs.find(x => x && x[0] == null && (x[2] || x[3]));
    return { text: out, src: j[2] || sl, roman: rm ? (rm[2] || null) : null, srcRoman: rm ? (rm[3] || null) : null };
  }
  // Google first; if it hands the text back unchanged and it's written in English letters, try it as phonetically typed Hindi
  // (or the language named with "from ..."); then a second translator (MyMemory), which catches words like "bonjour".
  async function translateText(text, tl, sl) {
    // "unchanged" also covers a near-copy in the same letters ("taapman" -> "tapman"): Google only respelled it
    const same = x => !x || x.text.trim().toLowerCase() === text.toLowerCase() || (/^[a-z\s']+$/i.test(text) && /^[a-z\s']+$/i.test(x.text.trim()) && dl(x.text.trim().toLowerCase(), text.toLowerCase()) <= 2);
    let r = await gtx(text, tl, sl || 'auto').catch(() => null);
    if (same(r) && /^[a-z\s']+$/i.test(text)) {
      const via = sl || (tl === 'hi' ? null : 'hi');
      if (via) {
        const it = await getJ(`https://inputtools.google.com/request?itc=${via}-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&text=${encodeURIComponent(text)}`).catch(() => null);
        const native = it?.[0] === 'SUCCESS' ? it[1]?.[0]?.[1]?.[0] : null;
        if (native) { const r2 = await gtx(native, tl, via).catch(() => null); if (!same(r2) && r2.text.trim() !== native) r = { ...r2, native, src: via }; }
      }
    }
    if (same(r) && !sl) {
      const mm = await getJ(`https://api.mymemory.translated.net/get?langpair=autodetect|${tl}&q=${encodeURIComponent(text)}`).catch(() => null);
      const t2 = mm?.responseData?.translatedText;
      if (t2 && +mm.responseStatus === 200 && t2.trim().toLowerCase() !== text.toLowerCase() && !/MYMEMORY|INVALID|DISTINCT LANGUAGES|QUERY LENGTH/i.test(t2) && t2 !== t2.toUpperCase())
        r = { text: t2, src: (mm.responseData.detectedLanguage || 'auto').split('-')[0], roman: null };
    }
    return r && r.text ? r : null;
  }
  function translate(q) {
    const raw = curRaw;
    let m, text, to, from = null, explicit = false;
    if ((m = raw.match(/^(?:translate|tr)\s+(.+?)\s+(?:from\s+([a-z][a-z ()-]+?)\s+)?(?:to|in|into)\s+([a-z][a-z ()-]+)$/i))) { text = m[1]; from = m[2]; to = m[3]; explicit = true; }
    else if ((m = raw.match(/^how (?:do (?:you|i)|to|would you) say\s+(.+?)\s+in\s+([a-z][a-z ()-]+?)\??$/i))) { text = m[1]; to = m[2]; explicit = true; }
    else if ((m = raw.match(/^(?:translate|tr)\s+(.+)$/i))) { text = m[1]; to = 'english'; explicit = true; }
    else if ((m = raw.match(/^(?:what(?:'s| is)\s+)?(.+?)\s+(?:from\s+([a-z][a-z ()-]+?)\s+)?(?:in|to|into)\s+([a-z][a-z ()-]+?)\??$/i))) { text = m[1]; from = m[2]; to = m[3]; }
    if (!text || !to) return null;
    text = text.replace(/^["“']|["”']$/g, '').trim(); if (!text || (!explicit && /^[\d$€£₹¥]/.test(text))) return null;   // "5 ft in cm", "$50 in inr" are not translations
    const tl = langCode(to); if (!tl) return null;
    const sl = from ? langCode(from) : null; if (from && !sl) return null;
    if (!explicit && /^(time|date|day|weather|now|clock)$/i.test(text)) return null;
    const key = `tr:${sl || ''}>${tl}:${text.toLowerCase()}`;
    const e = look(key, () => translateText(text, tl, sl));
    const openGT = () => { call('web', { q: text, e: 'translate' }); hide(); };
    const pr = explicit ? 3.3 : 2.95;
    if (e.state === 'load') return [{ ic: 'globe', t: '…', s: `Translating into ${langName(tl)}…`, cls: 'load', pr, hero: true }];
    if (e.state !== 'ok') return explicit ? [{ ic: 'globe', t: `Translate “${text}”`, s: 'Open Google Translate', key: 'Open', pr, run: openGT }] : null;
    const d = e.data;
    if (!explicit && d.text.trim().toLowerCase() === text.toLowerCase()) return null;                         // not really a translation
    const srcName = langName(d.src) || 'Detected';
    const sub = [`${srcName} → ${langName(tl)}`, d.native ? `${text} = ${d.native}` : null, d.roman ? `say: ${d.roman}` : null].filter(Boolean).join('  ·  ');
    return [{ ic: 'globe', t: d.text, s: sub, copy: d.text, pr, hero: true, heroSmall: d.text.length > 26, wrapT: d.text.length > 60 },
            { ic: 'globe', t: 'Open in Google Translate', s: 'translate.google.com', key: 'Open', pr: pr - .01, run: openGT }];
  }

  // ---- YouTube Music: "play blinding lights", "ytm arijit singh", or just type a song / album / artist ----
  // The helper asks YouTube Music's own search (the page can't, it's a local file); Enter plays it in the YouTube Music app.
  const GL = ((navigator.language || '').split('-')[1] || '').toUpperCase();
  function ytmParse(j) {
    const found = [], seen = new Set();
    const runs = t => (t?.runs || []).map(r => r.text).join('');
    const walk = o => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      for (const k in o) {
        if (k === 'musicCardShelfRenderer') { found.push([k, o[k]]); continue; }       // the top result (its extra videos are weaker matches)
        if (k === 'musicResponsiveListItemRenderer') found.push([k, o[k]]);
        walk(o[k]);
      }
    };
    walk(j?.contents);
    const out = [];
    for (const [k, v] of found) {
      let title, sub;
      if (k === 'musicCardShelfRenderer') { title = runs(v.title); sub = runs(v.subtitle); }
      else { const fc = v.flexColumns || []; title = runs(fc[0]?.musicResponsiveListItemFlexColumnRenderer?.text); sub = runs(fc[1]?.musicResponsiveListItemFlexColumnRenderer?.text); }
      if (!title) continue;
      const pe = (v.overlay || v.thumbnailOverlay)?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint || {};
      const w = pe.watchEndpoint || pe.watchPlaylistEndpoint || {};
      const nav = (v.navigationEndpoint || v.title?.runs?.[0]?.navigationEndpoint || {});
      const bid = nav.browseEndpoint?.browseId || '';
      const tw = nav.watchEndpoint || {};
      const it = { title, sub: sub.replace(/\s*•\s*/g, '  ·  '), kind: (sub.split('•')[0] || '').trim() };
      if (w.videoId || tw.videoId) it.v = w.videoId || tw.videoId;
      const mvt = (w.watchEndpointMusicSupportedConfigs || tw.watchEndpointMusicSupportedConfigs)?.watchEndpointMusicConfig?.musicVideoType;
      if (mvt) it.mvt = mvt;                                                 // official video / fan upload / song
      if (w.playlistId) it.list = w.playlistId;
      if (!it.v && !it.list) { if (/^UC/.test(bid)) it.c = bid; else if (/^VL/.test(bid)) it.list = bid.slice(2); else continue; }
      const id = it.v || it.list || it.c; if (seen.has(id)) continue; seen.add(id);
      const th = (v.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails) || [];
      it.art = (th.find(t => t.width >= 100) || th[th.length - 1])?.url || '';
      it.round = !!it.c;
      out.push(it);
    }
    // top result is the music video and the song itself is listed too: play the song (cleaner audio, proper radio after it)
    if (out[0]?.kind === 'Video') { const i = out.findIndex(x => x.kind === 'Song' && out[0].title.toLowerCase().startsWith(x.title.toLowerCase())); if (i > 0) out.unshift(out.splice(i, 1)[0]); }
    return out;
  }
  // picking a song: the wallpaper turns into Now Playing (lyrics.js listens)
  const nowPlaying = (art, title, sub, v, list) => { try { window.dispatchEvent(new CustomEvent('shadow-music', { detail: { art, title, sub, v, list } })); } catch (_) {} };
  function ytmSearch(q) {
    if (window.__ytmTest) return window.__ytmTest(q);
    if (!IN_LIVELY) return Promise.resolve(null);              // previews never use the helper
    return fetch(`${evBase}/ytm?${q2s({ q, gl: GL })}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null);
  }
  window.__shadowYtm = { search: q => ytmSearch(q), parse: j => ytmParse(j) };      // lyrics.js uses it for sharp cover art
  function music(q, implicit) {
    let term;
    const m = curRaw.match(/^(?:play|ytm|yt music|youtube music|music|song|listen to|put on)\s+(.+)$/i);
    if (m && !/^(music|pause|next|song|it|again)$/i.test(m[1].trim())) term = m[1].trim();
    else if (implicit) term = curRaw;
    else return null;
    if (term.length < 2 || term.length > 120) return null;
    const e = look('ytm:' + term.toLowerCase(), async () => { const j = await ytmSearch(term); const r = j ? ytmParse(j) : []; return r.length ? r : null; });
    if (e.state === 'load') return implicit ? null : [{ ic: 'play', t: `Searching YouTube Music for “${term}”…`, s: '', cls: 'load', pr: 3 }];
    if (e.state !== 'ok') return implicit ? null : [{ ic: 'play', t: `Nothing on YouTube Music for “${term}”`, s: 'Enter opens a YouTube search', key: 'Search', pr: 3, run: () => { call('web', { q: term, e: 'yt' }); hide(); } }];
    const n = implicit ? 3 : 4, pr = implicit ? 1.6 : 3;
    return e.data.slice(0, n).map((it, k) => ({
      ic: 'play', art: it.art, round: it.round, t: it.title, s: (it.sub || 'YouTube Music') + (k === 0 && implicit ? '  ·  YouTube Music' : ''),
      key: it.c ? 'Open' : 'Play', pr: pr - k * .01,
      run: () => { if (!it.c) nowPlaying(it.art, it.title, (it.sub || '').split('  ·  ').slice(1, 2).join('') || it.kind, it.v, it.list); call('ytplay', it.v ? { v: it.v, list: it.list || '' } : it.list ? { list: it.list } : { c: it.c }); hide(); }
    }));
  }

  // ---- your own YouTube Music: playlists, the songs in them, likes (after "sign in to youtube music") ----
  // The helper keeps a copy of your library on this PC (google.ps1); matching it is instant and needs no network.
  let ylib = null, ylibAt = 0;
  function loadYtLib(force) {
    if (!force && Date.now() - ylibAt < 60e3) return; ylibAt = Date.now();
    const src = window.__ytlibTest ? Promise.resolve(window.__ytlibTest()) : IN_LIVELY ? fetch(`${base}/ytlib?${q2s({})}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null) : Promise.resolve(null);
    src.then(j => { if (!j) return; ylib = j; ylib.idx = null; if (open && search.value) onQuery(); }).catch(() => {});
  }
  const fold = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const songTitle = t => (t || '').replace(/\s*[\(\[](?:[^\)\]]*?(?:official|video|audio|lyric|visuali[sz]er|\bmv\b|\bhd\b|\b4k\b))[^\)\]]*[\)\]]/gi, '').replace(/\s+/g, ' ').trim();
  function ylibIndex() {
    if (ylib.idx) return ylib.idx;
    const L = ylib.lib || {}, seen = new Set(), idx = [];
    (L.playlists || []).forEach(p => idx.push({ kind: 'pl', t: p.t, img: p.img, n: p.n, list: p.id, f: fold(p.t) }));
    (L.liked || []).forEach(x => { if (seen.has(x.v)) return; seen.add(x.v); idx.push({ kind: 'like', t: songTitle(x.t), a: x.a, img: x.img, v: x.v, music: x.music, f: fold(songTitle(x.t) + ' ' + x.a) }); });
    (L.songs || []).forEach(x => { if (seen.has(x.v)) return; seen.add(x.v); idx.push({ kind: 'song', t: songTitle(x.t), a: x.a, img: x.img, v: x.v, pl: x.pl, list: x.list, f: fold(songTitle(x.t) + ' ' + x.a) }); });
    return ylib.idx = idx;
  }
  function mine(q, implicit) {
    const st = ylib?.state?.state, signed = ylib?.signedIn;
    // signing in / out of your account
    if (/^(sign ?in|log ?in|connect|link|login)\b.*\b(youtube|yt|music|google|account)\b|^(youtube music|yt music|ytm|music) (sign ?in|log ?in|account|login|sync)$/.test(q)) {
      if (!ylib?.client) return [{ ic: 'play', t: 'Sign in to YouTube Music', s: 'First save google-client.json in the Shadow launcher folder', pr: 3.2, hero: true }];
      if (signed && st !== 'expired') return [{ ic: 'play', t: st === 'syncing' ? 'Loading your library…' : 'Signed in to YouTube Music',
        s: (ylib.state?.msg || '') + '  ·  Enter syncs again', key: 'Sync', pr: 3.2, hero: true, run: () => { call('gsync'); setTimeout(() => loadYtLib(true), 4000); return 'stay'; } }];
      return [{ ic: 'play', t: 'Sign in to YouTube Music', s: 'Opens Google’s sign-in page in your browser  ·  read-only access', key: 'Sign in', pr: 3.2, hero: true, run: () => { call('gsignin'); hide(); } }];
    }
    if (!ylib?.lib) return null;
    const L = ylib.lib, out = [];
    const playRow = (it, pr) => it.kind === 'pl'
      ? { ic: 'play', art: it.img, t: it.t, s: `Your playlist  ·  ${it.n} song${it.n === 1 ? '' : 's'}`, key: 'Play', pr, run: () => { nowPlaying(it.img, it.t, 'Your playlist', '', it.list); call('ytplay', { list: it.list }); hide(); } }
      : { ic: 'play', art: it.img, t: it.t, s: (it.kind === 'like' ? 'Liked' : `In “${it.pl}”`) + (it.a ? '  ·  ' + it.a : ''), key: 'Play', pr,
          run: () => { nowPlaying(it.img, it.t, it.a, it.v, it.kind === 'song' ? it.list : it.music ? 'LM' : ''); call('ytplay', it.kind === 'song' ? { v: it.v, list: it.list } : it.music ? { v: it.v, list: 'LM' } : { v: it.v }); hide(); } };
    if (/^(my )?(liked|loved) (songs|music)$|^(my )?likes$|^favou?rites$/.test(q))
      return [{ ic: 'play', art: (L.liked || []).find(x => x.music)?.img || '', t: 'Liked songs', s: `${(L.liked || []).filter(x => x.music).length} songs  ·  YouTube Music`, key: 'Play', pr: 3.2,
                run: () => { nowPlaying((L.liked || []).find(x => x.music)?.img || '', 'Liked songs', 'YouTube Music'); call('ytplay', { list: 'LM' }); hide(); } }];
    if (/^(my )?playlists?$/.test(q))
      return (L.playlists || []).slice(0, 5).map((p, k) => playRow({ kind: 'pl', t: p.t, img: p.img, n: p.n, list: p.id }, 3.2 - k * .01));
    // anything else: "play X" or plain text, matched against your library
    const m = curRaw.match(/^(?:play|ytm|yt music|youtube music|music|song|listen to|put on)\s+(.+)$/i);
    const term = fold(m ? m[1] : implicit ? curRaw : ''); if (term.length < 2) return null;
    const words = term.split(' ');
    const scored = [];
    for (const it of ylibIndex()) {
      let sc = 0;
      if (it.f.startsWith(term)) sc = 3; else if (it.f.includes(' ' + term) ) sc = 2.4; else if (words.every(w => it.f.includes(w))) sc = 1.6; else continue;
      if (it.kind === 'pl') sc += .5; if (it.kind === 'like' && it.music) sc += .3;
      scored.push([sc, it]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const base_ = m ? 3.05 : 1.7;
    return scored.slice(0, 3).map(([, it], k) => playRow(it, base_ - k * .01));
  }

  // ---- stopwatch (counts up on the big wallpaper clock) ----
  function stopwatch(q) {
    if (!/^(stopwatch|stop watch|chrono|chronometer|start stopwatch|pause stopwatch|reset stopwatch|stopwatch reset|lap)$/.test(q)) return null;
    const T = window.TM, ctl = window.TMctl; if (!T || !ctl?.stopwatch) return null;
    const on = T.on && T.up, ms = on ? (T.running ? Date.now() - T.start : T.left) : 0;
    const fmt = v => { const t = Math.floor(v / 100), s2 = Math.floor(t / 10), mi = Math.floor(s2 / 60), h = Math.floor(mi / 60);
      return (h ? h + ':' + String(mi % 60).padStart(2, '0') : String(mi)) + ':' + String(s2 % 60).padStart(2, '0') + '.' + (t % 10); };
    if (/reset/.test(q) && on) return [{ ic: 'timer', t: 'Reset the stopwatch', s: fmt(ms), key: 'Reset', pr: 3, hero: true, run: () => { ctl.stop(); onQuery(); return 'stay'; } }];
    if (!on) return [{ ic: 'timer', t: 'Start a stopwatch', s: 'It counts up on the wallpaper clock', key: 'Start', pr: 3, hero: true, run: () => { ctl.stopwatch(); hide(); } }];
    return [{ ic: 'timer', t: fmt(ms), s: T.running ? 'Stopwatch running on the wallpaper clock' : 'Stopwatch paused', key: T.running ? 'Pause' : 'Resume', pr: 3, hero: true, live: true,
              run: () => { ctl.pause(); onQuery(); return 'stay'; } },
            { ic: 'timer', t: 'Reset', s: 'Back to the clock', key: 'Reset', pr: 3, run: () => { ctl.stop(); onQuery(); return 'stay'; } }];
  }
  // ---- fun facts ----
  let factN = 0;
  function funFact(q) {
    if (!/^(fun ?facts?|facts?|random fact|tell me (a|something) (fun )?fact|something interesting|did you know|trivia)$/.test(q)) return null;
    const e = look('fact:' + factN, async () => { const j = await getJ('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en'); return j?.text ? j : null; });
    const another = () => { factN++; onQuery(); return 'stay'; };
    if (e.state === 'load') return [{ ic: 'book', t: 'Finding a fun fact…', s: '', cls: 'load', pr: 3, hero: true, run: another }];
    if (e.state !== 'ok') return [{ ic: 'book', t: 'No fact right now', s: 'Enter tries again', key: 'Again', pr: 3, run: another }];
    return [{ ic: 'book', t: e.data.text, s: 'Did you know?  ·  Enter for another', key: 'Another', pr: 3, wrapT: true, copy: null, run: another }];
  }

  // ---- settings, folders, music keys, lock ----
  const SET = [['wifi', 'Wi-Fi', 'wifi,wi-fi,wireless,internet'], ['bluetooth', 'Bluetooth', 'bluetooth,bt,airpods,headphones'], ['display', 'Display', 'display,screen,brightness,resolution,monitor,scale'],
    ['sound', 'Sound', 'sound,audio,speakers,microphone,mic'], ['battery', 'Battery & power', 'battery saver,battery'], ['power', 'Power & sleep', 'power,sleep'], ['update', 'Windows Update', 'update,updates,windows update'],
    ['apps', 'Installed apps', 'apps,uninstall,programs,installed apps'], ['notifications', 'Notifications', 'notifications'], ['focus', 'Focus / Do not disturb', 'dnd,do not disturb,focus'],
    ['background', 'Wallpaper', 'wallpaper,background'], ['personalization', 'Personalisation', 'personalization,personalisation'], ['touchpad', 'Touchpad & gestures', 'touchpad,trackpad,gestures'],
    ['mouse', 'Mouse', 'mouse,cursor,pointer'], ['keyboard', 'Keyboard', 'keyboard'], ['storage', 'Storage', 'storage,disk space'], ['privacy', 'Privacy & security', 'privacy,permissions'],
    ['accounts', 'Your account', 'account,accounts'], ['time', 'Date & time', 'date,timezone,time zone'], ['language', 'Language & region', 'language,region'],
    ['printers', 'Printers & scanners', 'printer,printers,scanner'], ['vpn', 'VPN', 'vpn'], ['hotspot', 'Mobile hotspot', 'hotspot,tethering'], ['nightlight', 'Night light', 'night light,nightlight,blue light'],
    ['about', 'About this PC', 'about,specs,pc info,system info,ram'], ['colors', 'Colours & dark mode', 'colors,colours,dark mode,light mode'], ['themes,theme', 'Themes', 'themes'],
    ['taskbar', 'Taskbar', 'taskbar'], ['defaultapps', 'Default apps', 'default apps,default browser'], ['startup', 'Startup apps', 'startup apps,startup'], ['gaming', 'Game Bar', 'game bar,gaming'],
    ['accessibility', 'Accessibility', 'accessibility'], ['network', 'Network & internet', 'network,ethernet']];
  const FOLD = [['downloads', 'Downloads', 'downloads,download'], ['documents', 'Documents', 'documents,my documents'], ['desktop', 'Desktop', 'desktop'], ['pictures', 'Pictures', 'pictures'],
    ['music', 'Music folder', 'music folder'], ['videos', 'Videos', 'videos'], ['recycle', 'Recycle Bin', 'recycle bin,trash,bin'], ['screenshots', 'Screenshots', 'screenshots'],
    ['thispc', 'This PC', 'this pc,my computer,drives'], ['home', 'Home folder', 'home folder,user folder'], ['onedrive', 'OneDrive folder', 'onedrive folder']];
  const KEYS = [['playpause', 'Play / pause', 'play,pause,play music,pause music,play pause', 'play'], ['next', 'Next track', 'next,next song,next track,skip', 'next'],
    ['prev', 'Previous track', 'previous,prev,previous song,previous track', 'prev'], ['mute', 'Mute / unmute', 'mute,unmute', 'mute'],
    ['volup', 'Volume up', 'volume up,louder,vol up', 'vol'], ['voldown', 'Volume down', 'volume down,quieter,vol down,softer', 'vol']];
  const phraseHit = (q, words, min = 3) => { const ph = words.split(','); if (ph.includes(q)) return 2; if (q.length >= 5 && min < 99 && ph.some(p => p.length >= 5 && dl(q, p) <= 1)) return 2; return q.length >= min && ph.some(p => p.startsWith(q)) ? 1 : 0; };
  const SETU = { wifi: 'network-wifi', network: 'network', bluetooth: 'bluetooth', display: 'display', sound: 'sound', battery: 'batterysaver', power: 'powersleep',
    update: 'windowsupdate', apps: 'appsfeatures', notifications: 'notifications', focus: 'quiethours', personalization: 'personalization', background: 'personalization-background',
    touchpad: 'devices-touchpad', mouse: 'mousetouchpad', keyboard: 'keyboard', storage: 'storagesense', privacy: 'privacy', accounts: 'yourinfo', time: 'dateandtime',
    language: 'regionlanguage', printers: 'printers', vpn: 'network-vpn', hotspot: 'network-mobilehotspot', nightlight: 'nightlight', about: 'about', colors: 'colors',
    'themes,theme': 'themes', taskbar: 'taskbar', defaultapps: 'defaultapps', startup: 'startupapps', gaming: 'gaming-gamebar', accessibility: 'easeofaccess' };
  function system(q) {
    const out = [], qq = q.replace(/^(open|go to|show)\s+/, '').replace(/\s+settings?$/, '').replace(/^settings?\s+/, '');
    FOLD.forEach(([k, name, w]) => { const h = phraseHit(qq, w); if (h) out.push({ ic: 'folder', t: name, s: 'Open in File Explorer', key: 'Open', pr: h === 2 && !appHit ? 2.5 : 1.2, run: () => { call('folder', { f: k }); hide(); } }); });
    KEYS.forEach(([k, name, w, ic]) => { if (phraseHit(q, w, 99) === 2) out.push({ ic, t: name, s: 'Media keys', key: 'Press', pr: 2.6, run: () => call('key', { k }), stay: true }); });
    if (/^(lock|lock (pc|screen|computer|laptop)|lock it)$/.test(q)) out.push({ ic: 'lock', t: 'Lock this PC', s: 'Windows + L', key: 'Lock', pr: 3, run: () => { hide(); setTimeout(() => call('lock'), 250); } });
    return out.length ? out : null;
  }

  // ---- fun & handy: coin, dice, random, password, uuid, colour ----
  const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const fixed = new Map();                         // keep the same roll while you look at it (re-rolls when you press Enter)
  function luck(q) {
    const memo = (k, f) => { if (!fixed.has(k)) fixed.set(k, f()); return fixed.get(k); };
    const again = k => () => { fixed.delete(k); onQuery(); return 'stay'; };
    if (/^(coin|flip|flip a coin|toss|coin flip|heads or tails|toss a coin)$/.test(q)) { const r = memo(q, () => rnd(2) ? 'Heads' : 'Tails'); return [{ ic: 'dice', t: r, s: 'Coin flip  ·  Enter flips again', key: 'Flip', pr: 3, hero: true, run: again(q) }]; }
    let m = q.match(/^(?:roll|dice|die|roll (?:a )?(?:die|dice))(?:\s+(\d+)?d(\d+))?$/) || q.match(/^(\d*)d(\d+)$/);
    if (m) { const n = Math.min(20, +(m[1] || 1)), s = Math.max(2, Math.min(1000, +(m[2] || 6))); const rolls = memo(q, () => Array.from({ length: n }, () => 1 + rnd(s)));
      return [{ ic: 'dice', t: n > 1 ? `${rolls.reduce((a, b) => a + b, 0)}` : String(rolls[0]), s: `${n}d${s}${n > 1 ? '  ·  ' + rolls.join(' + ') : ''}  ·  Enter rolls again`, key: 'Roll', pr: 3, hero: true, run: again(q) }]; }
    m = q.match(/^(?:random|rand|random number|pick a number)(?:\s+(?:between\s+)?(-?\d+)\s*(?:-|to|and|,)\s*(-?\d+))?$/);
    if (m) { const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : 100, lo = Math.min(a, b), hi = Math.max(a, b); const r = memo(q, () => lo + rnd(hi - lo + 1));
      return [{ ic: 'dice', t: String(r), s: `Random number ${lo} – ${hi}  ·  Enter picks again`, key: 'Again', pr: 3, hero: true, run: again(q) }]; }
    m = q.match(/^(?:password|pass|pw|generate password|new password)(?:\s+(\d+))?$/);
    if (m) { const len = Math.max(8, Math.min(64, +(m[1] || 18))); const C = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?-_';
      const pw = memo(q, () => Array.from({ length: len }, () => C[rnd(C.length)]).join(''));
      return [{ ic: 'key', t: pw, s: `${len}-character password  ·  Enter copies it`, copy: pw, pr: 3, hero: true, mono: true }]; }
    if (/^(uuid|guid)$/.test(q)) { const u = memo(q, () => crypto.randomUUID ? crypto.randomUUID() : Array.from({ length: 4 }, () => rnd(2 ** 32).toString(16)).join('-')); return [{ ic: 'hash', t: u, s: 'Random UUID', copy: u, pr: 3, hero: true }]; }
    m = q.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/) || q.match(/^rgb\(?\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/);
    if (m) {
      let r, g, b; if (m.length === 2) { let h = m[1]; if (h.length === 3) h = h.replace(/./g, c => c + c); [r, g, b] = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); } else [r, g, b] = [m[1], m[2], m[3]].map(Number);
      if ([r, g, b].some(v => v > 255)) return null;
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
      let h = 0; if (d) { const R = r / 255, G = g / 255, B = b / 255; h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h = Math.round(h * 60 + 360) % 360; }
      return [{ ic: 'swatch', sw: hex, t: hex, s: `rgb(${r}, ${g}, ${b})  ·  hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`, copy: hex, pr: 3, hero: true }];
    }
    return null;
  }

  // ---- battery ----
  let batt = null;
  function refreshBattery() { try { navigator.getBattery?.().then(b => { const upd = () => { batt = { level: b.level, charging: b.charging, t: b.charging ? b.chargingTime : b.dischargingTime }; }; upd(); if (!b.__shadow) { b.__shadow = 1; b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd); } }).catch(() => {}); } catch (_) {} }
  function battery(q) {
    if (!/^(battery|battery level|charge|how much battery|battery %|power)$/.test(q) || !batt) return null;
    const t = batt.t && isFinite(batt.t) ? `  ·  ${Math.floor(batt.t / 3600)} h ${Math.round(batt.t % 3600 / 60)} m ${batt.charging ? 'to full' : 'left'}` : '';
    return [{ ic: batt.charging ? 'bolt' : 'battery', t: `${Math.round(batt.level * 100)}%`, s: `${batt.charging ? 'Charging' : 'On battery'}${t}  ·  Enter opens battery settings`, key: 'Settings', pr: 3, hero: true, run: () => { call('settings', { p: 'battery' }); hide(); } }];
  }

  // ---- online look-ups: dictionary, wikipedia, weather (fetched as you type, cached) ----
  const net = new Map(), wanted = new Set();
  function look(key, fn) {                           // waits until you stop typing for a moment, then fetches once
    wanted.add(key);
    const c = net.get(key); if (c && (c.state !== 'ok' || Date.now() - c.at < 15 * 60e3)) return c;
    const e = { state: 'load', at: Date.now() }; net.set(key, e);
    setTimeout(() => {
      if (!wanted.has(key)) { net.delete(key); return; }
      fn().then(d => { e.state = d ? 'ok' : 'none'; e.data = d; e.at = Date.now(); }).catch(() => { e.state = 'none'; }).finally(() => { if (open && search.value) onQuery(); });
    }, /^(files:|av:|recent)/.test(key) ? 60 : 220);
    return e;
  }
  const getJ = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) return null; return r.json(); };
  async function spellFix(w) {                                         // best correctly-spelled word close to w
    const cands = [];
    for (const u of [`https://api.datamuse.com/sug?max=6&s=${encodeURIComponent(w)}`, `https://api.datamuse.com/words?max=6&sp=${encodeURIComponent(w[0] + '*')}&sl=${encodeURIComponent(w)}`]) {
      try { const j = await getJ(u); (j || []).forEach(x => x.word && cands.push(String(x.word).toLowerCase())); } catch (_) {}
    }
    const best = cands.filter(c => c !== w.toLowerCase()).map(c => [dl(w.toLowerCase(), c), c]).filter(([d]) => d <= Math.max(2, Math.round(w.length / 3))).sort((a, b) => a[0] - b[0])[0];
    return best ? best[1] : null;
  }
  const didYouMean = (fixed, prefix) => ({ ic: 'search', t: `Did you mean “${fixed}”?`, s: 'Enter searches for it instead', key: 'Fix', pr: 3.2,
    run: () => { search.value = prefix + fixed; lp.classList.add('typing'); onQuery(); try { search.setSelectionRange(search.value.length, search.value.length); } catch (_) {} placeCaret(); return 'stay'; } });
  function define(q) {
    const m = q.match(/^(?:define|def|meaning(?: of)?|what does (.+) mean|dictionary|dict)\s+(.+)$/) || q.match(/^what does (.+) mean$/);
    if (!m) return null; const w = (m[2] || m[1] || '').trim().replace(/[?.!]$/, ''); if (!w || w.split(' ').length > 3) return null;
    const open_ = () => { call('web', { q: w, e: 'define' }); hide(); };
    const e = look('def:' + w, async () => {
      const j = await getJ('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w)); if (Array.isArray(j)) return j[0];
      // not English: maybe another language ("define taapman" = Hindi तापमान). Translate it, then define the English word.
      const t = await translateText(w, 'en').catch(() => null);
      if (t && t.src && t.src !== 'en' && t.text.trim().toLowerCase() !== w.toLowerCase()) {
        const en = t.text.trim().replace(/[.!?]$/, ''); let d = null;
        if (t.native && dl(en.toLowerCase(), w.toLowerCase()) <= 2) return { miss: true, fix: en.toLowerCase() };   // just a misspelt English word heard as Hindi
        if (/^[a-z]+(?:[ -][a-z]+)?$/i.test(en)) { const j2 = await getJ('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(en.toLowerCase())).catch(() => null); if (Array.isArray(j2)) d = j2[0]; }
        return { foreign: true, en, src: t.src, native: t.native || null, d };
      }
      const fix = await spellFix(w); return fix ? { miss: true, fix } : null;                      // not a word: find the likely spelling
    });
    if (e.state === 'load') return [{ ic: 'book', t: w, s: 'Looking it up…', cls: 'load', pr: 3, hero: true, key: 'Open', run: open_ }];
    if (e.state === 'ok' && e.data.miss) return [didYouMean(e.data.fix, q.slice(0, q.length - w.length)), { ic: 'book', t: `Define “${w}”`, s: 'Search the web anyway', key: 'Search', pr: 3, run: open_ }];
    if (e.state !== 'ok') return [{ ic: 'book', t: `Define “${w}”`, s: 'Search the web for its meaning', key: 'Search', pr: 3, run: open_ }];
    if (e.data.foreign) {
      const f = e.data, rows = [{ ic: 'book', t: f.en, s: `${w}${f.native ? ' (' + f.native + ')' : ''}  ·  ${langName(f.src)} → English`, copy: f.en, pr: 3, hero: true, heroSmall: f.en.length > 26, key: 'Copy' }];
      (f.d?.meanings || []).flatMap(mm => (mm.definitions || []).slice(0, 2).map(df => [mm.partOfSpeech, df])).slice(0, 3)
        .forEach(([pos, df]) => rows.push({ ic: 'text', t: df.definition, s: [pos, df.example && `“${df.example}”`].filter(Boolean).join('  ·  '), copy: df.definition, pr: 3, wrapT: true }));
      return rows;
    }
    const d = e.data, out = [{ ic: 'book', t: d.word, s: [d.phonetic || d.phonetics?.find(p => p.text)?.text, d.meanings?.map(x => x.partOfSpeech).join(', ')].filter(Boolean).join('  ·  '), pr: 3, hero: true, key: 'More', run: open_ }];
    (d.meanings || []).flatMap(mm => (mm.definitions || []).slice(0, 2).map(df => [mm.partOfSpeech, df])).slice(0, 3)
      .forEach(([pos, df]) => out.push({ ic: 'text', t: df.definition, s: [pos, df.example && `“${df.example}”`].filter(Boolean).join('  ·  '), copy: df.definition, pr: 3, wrapT: true }));
    return out;
  }
  // Wikipedia: the exact article if there is one; otherwise Wikipedia's own search on the words that matter, skipping
  // disambiguation pages, and the result whose title best matches what you typed ("who invented the telephone" ->
  // Invention of the telephone, "mercury" -> Mercury (planet), "taj mahal agra" -> Taj Mahal)
  const WIKI_STOP = new Set('a an the of in on at to for from by with and or is are was were be been who what whats when where which why how does do did whom whose about tell me explain history please define meaning'.split(' '));
  const wikiWords = t => (t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]+/gu) || []).filter(w => !WIKI_STOP.has(w));
  const wordsMeet = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, Math.max(4, b.length - 3))) || b.startsWith(a.slice(0, Math.max(4, a.length - 3)))));
  function wikiLang(t) {                                               // the Wikipedia in the language you typed in
    return /[\u0900-\u097F]/.test(t) ? 'hi' : /[\u0980-\u09FF]/.test(t) ? 'bn' : /[\u0B80-\u0BFF]/.test(t) ? 'ta' : /[\u0C00-\u0C7F]/.test(t) ? 'te' : /[\u0A80-\u0AFF]/.test(t) ? 'gu' :
      /[\u0A00-\u0A7F]/.test(t) ? 'pa' : /[\u0600-\u06FF]/.test(t) ? 'ar' : /[\u3040-\u30FF]/.test(t) ? 'ja' : /[\uAC00-\uD7AF]/.test(t) ? 'ko' : /[\u4E00-\u9FFF]/.test(t) ? 'zh' : /[\u0400-\u04FF]/.test(t) ? 'ru' : 'en';
  }
  function wikiPick(pages, term) {                                     // the best-matching, non-disambiguation result
    const K = wikiWords(term); let best = null;
    pages.filter(pg => !pg.pageprops || !('disambiguation' in pg.pageprops)).forEach(pg => {
      const T = wikiWords(pg.title.replace(/\s*\(.*\)\s*$/, '')), hit = K.filter(k => T.some(t => wordsMeet(k, t))).length;
      const cover = K.length ? hit / K.length : 0, prec = T.length ? T.filter(t => K.some(k => wordsMeet(k, t))).length / T.length : 0;
      const sc = 2 * cover + prec - pg.index * .09 - (/^(List|Lists|Index|Outline|Timeline) of /.test(pg.title) ? .6 : 0);
      if (cover >= (K.length >= 3 ? .5 : 1) && prec >= .75 && (!best || sc > best.sc)) best = { title: pg.title, sc, cover };   // a clear match (its title adds nothing you didn't ask about), or none
    });
    return best;
  }
  function wiki(q) {
    const m = q.match(/^(?:wiki|wikipedia|w|who is|who's|whos|who was|who are|who were|what is|what's|whats|what are|what was|what were|tell me about)\s+(.+)$/); if (!m) return null;
    const term = m[1].replace(/[?.!]+$/, '').replace(/^(?:the|a|an)\s+/, '').trim(); if (!term || /^[\d\s+\-*/^().x]+$/.test(term)) return null;
    const isWiki = /^(wiki|wikipedia|w)\s/.test(q), lang = wikiLang(term), W = `https://${lang}.wikipedia.org`;
    const open_ = (t = term) => { if (lang === 'en') call('web', { q: t, e: 'wiki' }); else call('web', { q: t + ' wikipedia' }); hide(); };
    const e = look('wiki:' + lang + ':' + term.toLowerCase(), async () => {
      // one quick request each for the exact title and for the search, side by side; each brings the title, description, intro and picture
      const PROPS = 'prop=pageprops|description|pageimages|extracts&ppprop=disambiguation&exintro=1&explaintext=1&exlimit=20&piprop=thumbnail&pithumbsize=640&redirects=1&format=json&formatversion=2&origin=*';
      const pagesOf = x => (x?.query?.pages || []).filter(pg => !pg.missing && !pg.invalid);
      const words = wikiWords(term), sq = words.length >= 2 && words.length < term.split(/\s+/).length ? words.join(' ') : term;   // a sentence: just the words that matter
      const find = t => getJ(`${W}/w/api.php?action=query&generator=search&gsrlimit=8&gsrsearch=${encodeURIComponent(t)}&${PROPS}`).then(x => pagesOf(x).sort((a, b) => a.index - b.index)).catch(() => []);
      const exactP = getJ(`${W}/w/api.php?action=query&titles=${encodeURIComponent(term)}&${PROPS}`).then(x => pagesOf(x)[0]).catch(() => null), foundP = find(sq);
      const isDis = pg => pg.pageprops && 'disambiguation' in pg.pageprops;
      let pg = await exactP; if (pg && (isDis(pg) || !pg.extract)) pg = null;
      if (!pg) {
        let pages = await foundP;
        if (!pages.length && sq !== term) pages = await find(term);
        if (!pages.length) {                                           // nothing at all: Wikipedia's spelling suggestion
          const s2 = await getJ(`${W}/w/api.php?action=query&list=search&srinfo=suggestion&srlimit=1&format=json&origin=*&srsearch=${encodeURIComponent(term)}`).catch(() => null);
          const fix = s2?.query?.searchinfo?.suggestion;
          return fix && fix.toLowerCase() !== term.toLowerCase() ? { miss: true, fix } : null;
        }
        const best = wikiPick(pages, term);
        if (!best) return isWiki ? { list: pages.filter(x => !isDis(x)).slice(0, 4) } : null;
        pg = pages.find(x => x.title === best.title); if (!pg?.extract) return null;
      }
      const j = { title: pg.title, description: pg.description || '', extract: pg.extract, thumbnail: pg.thumbnail ? { source: pg.thumbnail.source } : null };
      (async () => {                                                    // the intro shows straight away; the rest of the article fills in when it arrives
        const x = await getJ(`${W}/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(j.title)}`);
        const f = x?.query?.pages?.[0]?.extract;
        if (f && f.length > j.extract.length) { j.full = f; if (open && search.value) onQuery(); }
      })().catch(() => {});
      return j;
    });
    if (e.state === 'load') return isWiki ? [{ ic: 'wiki', t: term, s: 'Reading Wikipedia…', cls: 'load', pr: 2.5, hero: true, run: () => open_() }] : null;
    if (e.state === 'ok' && e.data.miss) return isWiki ? [didYouMean(e.data.fix, q.slice(0, q.length - m[1].length)), { ic: 'wiki', t: `Search Wikipedia for “${term}”`, s: lang + '.wikipedia.org', key: 'Search', pr: 2.5, run: () => open_() }] : null;
    if (e.state !== 'ok') return isWiki ? [{ ic: 'wiki', t: `Search Wikipedia for “${term}”`, s: lang + '.wikipedia.org', key: 'Search', pr: 2.5, run: () => open_() }] : null;
    if (e.data.list) return isWiki ? [...e.data.list.map(pg => ({ ic: 'wiki', t: pg.title, s: pg.description || 'Wikipedia', key: 'Open', pr: 2.4, run: () => open_(pg.title) })),   // no one clear article: the likely ones, as rows
      { ic: 'search', t: `Search Wikipedia for “${term}”`, s: lang + '.wikipedia.org', key: 'Search', pr: 2.3, run: () => open_() }] : null;
    const d = e.data, full = (d.full || d.extract || '').trim();
    let text = full;
    {                                                                   // the article up to its reference sections; section titles kept as headings
      const stop = text.search(/\n=+\s*(See also|References|Notes|Footnotes|Citations|Sources|Bibliography|Further reading|External links)\s*=+/i);
      if (stop > 0) text = text.slice(0, stop);
    }
    const lim = 9000;
    let body = text.length > lim ? text.slice(0, lim).replace(/[^.!?]*$/, '') : text;               // end on a whole sentence
    return [{ ic: 'wiki', t: d.title, s: d.description || 'Wikipedia', key: 'Read', pr: isWiki ? 3 : 1.8, hero: true, heroSmall: true, copy: null, run: () => open_(d.title),
      big: { paras: body.split(/\n+/).filter(Boolean), img: d.thumbnail?.source || null } }];
  }
  const WMO = c => c === 0 ? ['Clear', 'sun'] : c <= 2 ? ['Partly cloudy', 'sun'] : c === 3 ? ['Overcast', 'cloud'] : c <= 48 ? ['Fog', 'cloud'] : c <= 57 ? ['Drizzle', 'rain'] : c <= 67 ? ['Rain', 'rain'] :
    c <= 77 ? ['Snow', 'snow'] : c <= 82 ? ['Showers', 'rain'] : c <= 86 ? ['Snow showers', 'snow'] : ['Thunderstorm', 'bolt'];
  function weather(q) {
    const m = q.match(/^(?:weather|forecast|temperature|temp)(?:\s+(?:in|at|for))?\s*(.*)$/) || q.match(/^(.+?)\s+(?:weather|forecast)$/); if (!m) return null;
    let city = (m[1] || '').replace(/[?.!]$/, '').trim(); if (/^(today|now|tomorrow)$/.test(city)) city = '';
    if (!city) city = store.get('shadowCity') || (HERE.split('/').pop() || '').replace(/_/g, ' ').replace(/^Calcutta$/, 'Kolkata');
    if (!city) return null;
    const e = look('wx:' + city.toLowerCase(), async () => {
      const g = await getJ(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(city)}`); const p = g?.results?.[0]; if (!p) return null;
      const w = await getJ(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&forecast_days=3&timezone=auto`);
      return w?.current ? { p, w } : null; });
    const openW = () => { call('web', { q: 'weather ' + city }); hide(); };
    if (e.state === 'load') return [{ ic: 'cloud', t: title(city), s: 'Checking the weather…', cls: 'load', pr: 3, hero: true, run: openW }];
    if (e.state !== 'ok') return [{ ic: 'cloud', t: `Weather in ${title(city)}`, s: 'Search the web', key: 'Search', pr: 2, run: openW }];
    if (m[1]) store.set('shadowCity', city);
    const { p, w } = e.data, c = w.current, [desc, ic] = WMO(c.weather_code), dl = w.daily;
    const out = [{ ic, t: `${Math.round(c.temperature_2m)}°  ${desc}`, s: `${p.name}${p.country ? ', ' + p.country : ''}  ·  feels ${Math.round(c.apparent_temperature)}°  ·  H ${Math.round(dl.temperature_2m_max[0])}° L ${Math.round(dl.temperature_2m_min[0])}°  ·  humidity ${c.relative_humidity_2m}%  ·  wind ${Math.round(c.wind_speed_10m)} km/h`, pr: 3, hero: true, key: 'More', run: openW }];
    [1, 2].forEach(i => { const [d2, ic2] = WMO(dl.weather_code[i]); out.push({ ic: ic2, t: `${new Date(dl.time[i] + 'T12:00').toLocaleDateString(LOC, { weekday: 'long' })}: ${Math.round(dl.temperature_2m_max[i])}° / ${Math.round(dl.temperature_2m_min[i])}°`, s: `${d2}${dl.precipitation_probability_max?.[i] != null ? '  ·  ' + dl.precipitation_probability_max[i] + '% chance of rain' : ''}`, pr: 3, run: openW }); });
    return out;
  }

  // ---- web: g / yt / wiki / maps / scholar / translate / gh / amazon, and well-known sites ----
  const ENG = { g: ['g', 'Google', 'web'], google: ['g', 'Google', 'web'], yt: ['yt', 'YouTube', 'yt'], youtube: ['yt', 'YouTube', 'yt'], maps: ['maps', 'Google Maps', 'pin'], map: ['maps', 'Google Maps', 'pin'],
    directions: ['maps', 'Google Maps', 'pin'], scholar: ['scholar', 'Google Scholar', 'book'], translate: ['translate', 'Google Translate', 'globe'], tr: ['translate', 'Google Translate', 'globe'],
    gh: ['gh', 'GitHub', 'search'], github: ['gh', 'GitHub', 'search'], amazon: ['amazon', 'Amazon', 'search'], amz: ['amazon', 'Amazon', 'search'] };
  const SITES = { gmail: 'Gmail', mail: 'Gmail', youtube: 'YouTube', drive: 'Google Drive', 'google drive': 'Google Drive', calendar: 'Google Calendar', github: 'GitHub', classroom: 'Google Classroom',
    docs: 'Google Docs', sheets: 'Google Sheets', slides: 'Google Slides', keep: 'Google Keep', netflix: 'Netflix', chatgpt: 'ChatGPT', 'claude.ai': 'Claude on the web', notion: 'Notion',
    instagram: 'Instagram', insta: 'Instagram', x: 'X', twitter: 'X', reddit: 'Reddit', linkedin: 'LinkedIn', photos: 'Google Photos', maps: 'Google Maps', translate: 'Google Translate',
    spotify: 'Spotify', 'whatsapp web': 'WhatsApp Web' };
  const SITE_KEY = { mail: 'gmail', 'google drive': 'drive', 'claude.ai': 'claude', insta: 'instagram', twitter: 'x', 'whatsapp web': 'whatsapp' };
  function web(q, raw) {
    const out = [], m = raw.match(/^(\S+)\s+(.+)$/);
    if (m && ENG[m[1].toLowerCase()] && !appHit) { const [e, name, ic] = ENG[m[1].toLowerCase()], term = m[2].trim();
      out.push({ ic, t: `Search ${name} for “${term}”`, s: name, key: 'Search', pr: appHit ? 1.1 : 3, run: () => { call('web', { q: term, e }); hide(); } }); return out; }
    if (SITES[q]) { const s = SITE_KEY[q] || q; out.push({ ic: 'web', t: SITES[q], s: 'Open in your browser', key: 'Open', pr: appHit ? 1.1 : 2.2, run: () => { call('site', { s }); hide(); } }); }
    return out;
  }

  /* ======================================= search, Windows-style =======================================
     While you type, the app grid steps aside for a two-pane panel: results sorted into groups on the left (Best match first,
     then Apps, Settings, Documents, Folders, Photos, Music, Videos, YouTube Music, Answers, the web, the Microsoft Store) and a
     large preview of the selected one on the right, with its own actions. Up / Down / Tab or resting the pointer on a result
     selects it; Enter or a click opens it. Files, thumbnails, Store apps, web suggestions and app actions come from the helper
     (Windows' own search index and icons). "docs: report", "settings: mouse", "store: spotify" ... narrow it to one kind. */
  Object.assign(ICON, {
    file: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4"/>',
    doc: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9.5 12.5h5M9.5 16h5"/>',
    img: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17 5-4.5 3.5 3 2.5-2 4 3.5"/>',
    film: '<rect x="4" y="5.5" width="16" height="13" rx="2.5"/><path d="M10 9.5v5l4.2-2.5z"/>',
    note: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="15.5" r="2"/>',
    recent: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.2h3.2"/><path d="M12 8v4l2.8 1.8"/>',
    store: '<path d="M4.5 8.5h15l-1.2 11h-12.6z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
    wifi: '<path d="M3.8 9.6a12 12 0 0 1 16.4 0M6.9 12.9a7.4 7.4 0 0 1 10.2 0M10 16.1a2.9 2.9 0 0 1 4 0"/><circle cx="12" cy="18.9" r=".9" fill="#fff"/>',
    bt: '<path d="M7.2 7.6 16.4 16.4 12 20.5V3.5l4.4 4.1-9.2 8.8"/>',
    display: '<rect x="3.5" y="4.5" width="17" height="11.5" rx="2.2"/><path d="M9 20h6M12 16v4"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5h-14zM10 20.3a2 2 0 0 0 4 0"/>',
    mouse: '<rect x="7" y="3.5" width="10" height="17" rx="5"/><path d="M12 7v3.5"/>',
    drive: '<rect x="3.5" y="7" width="17" height="10" rx="2.2"/><path d="M10 13.9h6.5"/><circle cx="7" cy="13.9" r=".8" fill="#fff"/>',
    person: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    shield: '<path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.5 7 9 4.1-1.5 7-4.7 7-9V6.2z"/>',
    update: '<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.4 0 1.8-1 1.3-2-.6-1.2.2-2.5 1.6-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9z"/><circle cx="7.8" cy="11.2" r="1.1"/><circle cx="10.6" cy="7.4" r="1.1"/><circle cx="15.1" cy="8" r="1.1"/>',
    appsgrid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.7"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.7"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.7"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.7"/>',
    pad: '<path d="M7.5 8h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.3a2.3 2.3 0 0 1-4 .7L14.5 16h-5l-1.3 1.8a2.3 2.3 0 0 1-4-.7l-1-3.3A4.5 4.5 0 0 1 7.5 8z"/><path d="M8 10.8v3.2M6.4 12.4h3.2"/><circle cx="16" cy="11.2" r=".8" fill="#fff"/><circle cx="17.6" cy="13.2" r=".8" fill="#fff"/>',
    access: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="7.6" r="1.2" fill="#fff"/><path d="M7.5 10.2 12 11l4.5-.8M12 11v3l-2 3.6M12 14l2 3.6"/>',
    keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2.2"/><path d="M8 14.2h8"/><circle cx="6.8" cy="10.2" r=".75" fill="#fff"/><circle cx="10.3" cy="10.2" r=".75" fill="#fff"/><circle cx="13.8" cy="10.2" r=".75" fill="#fff"/><circle cx="17.3" cy="10.2" r=".75" fill="#fff"/>',
    printer: '<path d="M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2M7 14h10v6H7z"/>',
    power: '<path d="M12 3.5v8M7.2 6.5a7.5 7.5 0 1 0 9.6 0"/>',
    laptop: '<rect x="5" y="5" width="14" height="10" rx="1.6"/><path d="M3 18.5h18"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r=".9" fill="#fff"/>',
    moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    open: '<path d="M14 4.5h5.5V10M19.5 4.5 11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    admin: '<path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.5 7 9 4.1-1.5 7-4.7 7-9V6.2z"/><path d="m9.2 12 2 2 3.8-3.8"/>',
    pinS: '<path d="M9.5 4h5l-.8 5.2 3.3 3.3H7l3.3-3.3zM12 12.5V20"/>',
    star: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
    mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.3"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.4"/><path d="M11 17.6h2"/>',
    reveal: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M10 13h5m-2-2 2 2-2 2"/>',
  });
  const HAS_HELPER = !!(window.LAUNCH && IN_LIVELY);
  const FILTERS = [['all', 'All'], ['apps', 'Apps'], ['docs', 'Documents'], ['folders', 'Folders'], ['photos', 'Photos'], ['music', 'Music'], ['videos', 'Videos'], ['settings', 'Settings'], ['web', 'Web'], ['store', 'Store']];
  const FPREFIX = { apps: 'apps', app: 'apps', docs: 'docs', doc: 'docs', documents: 'docs', files: 'files', file: 'files', folders: 'folders', folder: 'folders',
    photos: 'photos', photo: 'photos', pictures: 'photos', images: 'photos', music: 'music', songs: 'music', videos: 'videos', video: 'videos',
    settings: 'settings', setting: 'settings', web: 'web', store: 'store' };
  function splitFilter(raw) {                                           // "docs: report" -> { f: 'docs', q: 'report' }
    const m = raw.match(/^\s*([a-z]+):\s*(.*)$/i); const f = m && FPREFIX[m[1].toLowerCase()];
    return f ? { f, q: m[2] } : { f: 'all', q: raw };
  }
  const fileIcon = f => f.dir ? 'folder' : /^\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|svg|raw|cr2|nef|arw|dng)$/.test(f.x) ? 'img'
    : /^\.(mp4|mkv|mov|avi|wmv|webm|m4v|mts)$/.test(f.x) ? 'film' : /^\.(mp3|wav|flac|m4a|aac|ogg|wma|aiff?|opus)$/.test(f.x) ? 'note'
    : /^\.(docx?|pdf|txt|rtf|odt|xlsx?|pptx?|csv|md|pages|key|numbers|epub)$/.test(f.x) ? 'doc' : 'file';
  function when(iso, full) {                                            // "Today 10:42", "Yesterday", "12 Mar", "12 Mar 2023"
    const d = new Date(iso); if (!iso || isNaN(d)) return '';
    if (full) return d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const now = new Date(), day = 864e5;
    const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()), n0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()), diff = Math.round((n0 - d0) / day);
    if (diff === 0) return 'Today ' + d.toLocaleTimeString(LOC, { hour: 'numeric', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-GB', d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function where_(p, od) {                                              // "OneDrive › Documents › Work", "Downloads", "Desktop › Projects"
    const parts = p.split('\\'); parts.pop();
    const u = parts.findIndex((x, i) => i > 0 && parts[i - 1].toLowerCase() === 'users');
    let rest = u >= 0 ? parts.slice(u + 1) : parts;                    // drop C:\Users\<you>
    if (od) { const k = rest.findIndex(x => /^OneDrive/i.test(x)); if (k >= 0) rest = ['OneDrive', ...rest.slice(k + 1)]; }
    if (rest.length > 3) rest = [rest[0], '…', ...rest.slice(-2)];
    return rest.join(' › ') || (u >= 0 ? 'Home folder' : p.slice(0, 3));
  }
  const fmtSize = n => !n ? '' : n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;
  const helperJ = (path, o) => getJ(`${evBase}/${path}?${q2s(o)}`);
  const thumbUrl = (p, s, icon) => `${evBase}/thumb?${q2s({ p, s, i: icon ? 1 : 0 })}`;
  function copyText(t) { try { navigator.clipboard?.writeText(t).catch(() => {}); } catch (_) {} call('clip', { text: t }); }

  /* ---- icons: real ones where Windows has them (apps, files, Store logos), otherwise a coloured tile with a white glyph ---- */
  const TONE = { blue: ['#5aa8ff', '#2370ea'], sky: ['#4fd0ff', '#0d93e3'], teal: ['#46dccb', '#10a597'], green: ['#5be38b', '#1fae55'], lime: ['#9be15d', '#3fa34d'],
    orange: ['#ffb54d', '#ff7b0f'], yellow: ['#ffd84d', '#f2a100'], pink: ['#ff79b0', '#e2397c'], red: ['#ff7a6e', '#e33b32'], purple: ['#bd93ff', '#7c4dff'],
    indigo: ['#8a90ff', '#4f52e6'], slate: ['#8492a8', '#47536a'], gray: ['#a3abb7', '#5f6774'], graphite: ['#6f6f78', '#34343b'], google: ['#6aa6ff', '#2f6fe6'] };
  const ICOL = { calc: 'orange', money: 'green', unit: 'indigo', clock: 'graphite', globe: 'sky', cal: 'red', timer: 'orange', gear: 'gray', folder: 'yellow', play: 'pink',
    next: 'pink', prev: 'pink', vol: 'pink', mute: 'pink', lock: 'graphite', dice: 'pink', key: 'yellow', search: 'google', book: 'purple', wiki: 'graphite', sun: 'yellow',
    cloud: 'sky', rain: 'sky', snow: 'sky', bolt: 'green', battery: 'green', hash: 'slate', web: 'blue', yt: 'red', pin: 'red', text: 'gray', recent: 'blue', store: 'blue',
    file: 'gray', doc: 'blue', img: 'teal', film: 'purple', note: 'pink' };
  const glyph = (ic, tone) => ({ kind: 'tile', ic, tone: tone || ICOL[ic] || 'gray' });
  function iconHtml(ic, cls = '') {
    if (!ic) return `<div class="ri ${cls}"></div>`;
    if (ic.kind === 'img') return `<div class="ri img${ic.cover ? ' cover' : ''}${ic.round ? ' round' : ''}${ic.plate ? ' plate' : ''} ${cls}"><img src="${esc(ic.src)}" alt="" decoding="async" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden';this.parentNode.classList.add('nf')"></div>`;
    if (ic.kind === 'sw') return `<div class="ri sw ${cls}" style="background:${esc(ic.color)}"></div>`;
    const [a, b] = TONE[ic.tone] || TONE.gray;
    return `<div class="ri tile ${cls}" style="--t1:${a};--t2:${b}">${svg(ic.ic)}</div>`;
  }

  /* ---- every Settings page, and the deeper things people look for ("lid", "dns", "hidden files"), each with its own icon ---- */
  const ALLSET = [['display', 'Display', 'screen brightness resolution scale monitor hdr refresh rate'], ['nightlight', 'Night light', 'blue light warm'],
    ['display-advancedgraphics', 'Graphics', 'gpu graphics performance preference'], ['sound', 'Sound', 'audio output input speakers microphone'], ['apps-volume', 'Volume mixer', 'app volume'],
    ['sound-devices', 'Sound devices', 'audio devices'], ['notifications', 'Notifications', 'alerts banners'], ['quiethours', 'Focus', 'do not disturb dnd'],
    ['powersleep', 'Power & battery', 'power mode sleep screen timeout'], ['batterysaver', 'Energy saver', 'battery saver'], ['storagesense', 'Storage', 'disk space cleanup'],
    ['storagepolicies', 'Storage Sense', 'cleanup temporary files'], ['multitasking', 'Multitasking', 'snap windows alt tab desktops'], ['activation', 'Activation', 'product key license'],
    ['troubleshoot', 'Troubleshoot', 'fix problems'], ['recovery', 'Recovery', 'reset this pc advanced startup'], ['project', 'Projecting to this PC', 'miracast wireless display'],
    ['clipboard', 'Clipboard', 'clipboard history'], ['remotedesktop', 'Remote Desktop', 'rdp'], ['about', 'About', 'device specs ram processor rename pc name'],
    ['optionalfeatures', 'Optional features', 'features add'], ['crossdevice', 'Nearby sharing', 'nearby share'], ['deviceencryption', 'Device encryption', 'bitlocker'],
    ['bluetooth', 'Bluetooth & devices', 'bluetooth pair airpods headphones'], ['connecteddevices', 'Devices', 'add device'], ['printers', 'Printers & scanners', 'printer scanner'],
    ['mobile-devices', 'Mobile devices', 'phone link android iphone'], ['pen', 'Pen & Windows Ink', 'stylus'], ['autoplay', 'AutoPlay', 'autoplay'], ['usb', 'USB', 'usb'],
    ['devices-touchpad', 'Touchpad', 'trackpad gestures scroll'], ['mousetouchpad', 'Mouse', 'pointer speed scroll'], ['camera', 'Cameras', 'webcam'],
    ['network-status', 'Network & internet', 'network internet'], ['network-wifi', 'Wi-Fi', 'wifi wireless'], ['network-wifisettings', 'Manage known networks', 'saved wifi forget'],
    ['network-ethernet', 'Ethernet', 'cable lan'], ['network-vpn', 'VPN', 'vpn'], ['network-mobilehotspot', 'Mobile hotspot', 'hotspot tethering'], ['network-airplanemode', 'Airplane mode', 'flight mode'],
    ['network-proxy', 'Proxy', 'proxy'], ['network-advancedsettings', 'Advanced network settings', 'adapters dns reset'], ['datausage', 'Data usage', 'data limit'],
    ['personalization', 'Personalisation', 'personalization personalisation customise customize'],
    ['personalization-background', 'Background', 'wallpaper'], ['colors', 'Colours', 'dark mode light mode accent colour color'], ['themes', 'Themes', 'theme'],
    ['lockscreen', 'Lock screen', 'lock screen'], ['personalization-textinput', 'Text input', 'touch keyboard emoji'], ['personalization-start', 'Start', 'start menu'],
    ['taskbar', 'Taskbar', 'taskbar'], ['fonts', 'Fonts', 'fonts'], ['personalization-lighting', 'Dynamic Lighting', 'rgb lighting'],
    ['appsfeatures', 'Installed apps', 'uninstall programs apps'], ['advanced-apps', 'Advanced app settings', 'app sources'], ['defaultapps', 'Default apps', 'default browser open with'],
    ['maps', 'Offline maps', 'maps'], ['appsforwebsites', 'Apps for websites', 'links'], ['videoplayback', 'Video playback', 'hdr video'], ['startupapps', 'Startup', 'startup apps launch at sign in'],
    ['yourinfo', 'Your info', 'account profile picture'], ['emailandaccounts', 'Email & accounts', 'email accounts'], ['signinoptions', 'Sign-in options', 'pin password windows hello fingerprint face'],
    ['workplace', 'Access work or school', 'work school'], ['otherusers', 'Other users', 'add user'], ['family-group', 'Family', 'family'], ['backup', 'Windows Backup', 'backup sync onedrive'],
    ['dateandtime', 'Date & time', 'clock time zone'], ['regionlanguage', 'Language & region', 'language region country'], ['typing', 'Typing', 'autocorrect spell'],
    ['speech', 'Speech', 'voice'], ['keyboard', 'Advanced keyboard settings', 'input method keyboard layout'],
    ['gaming-gamebar', 'Game Bar', 'xbox game bar'], ['gaming-gamedvr', 'Captures', 'screen recording clips'], ['gaming-gamemode', 'Game Mode', 'game mode'],
    ['easeofaccess', 'Accessibility', 'accessibility'], ['easeofaccess-display', 'Text size', 'bigger text font size'], ['easeofaccess-visualeffects', 'Visual effects', 'transparency animations scrollbars'],
    ['easeofaccess-mousepointer', 'Mouse pointer and touch', 'cursor size colour'], ['easeofaccess-cursor', 'Text cursor', 'caret'], ['easeofaccess-magnifier', 'Magnifier', 'zoom'],
    ['easeofaccess-colorfilter', 'Colour filters', 'colour blind grayscale invert color'], ['easeofaccess-highcontrast', 'Contrast themes', 'high contrast'], ['easeofaccess-narrator', 'Narrator', 'screen reader'],
    ['easeofaccess-audio', 'Audio (accessibility)', 'mono audio'], ['easeofaccess-closedcaptioning', 'Captions', 'subtitles live captions'], ['easeofaccess-keyboard', 'Keyboard (accessibility)', 'sticky keys filter keys on-screen keyboard'],
    ['easeofaccess-mouse', 'Mouse keys', 'mouse keys'], ['easeofaccess-eyecontrol', 'Eye control', 'eye tracking'],
    ['privacy', 'Privacy & security', 'privacy permissions'], ['windowsdefender', 'Windows Security', 'antivirus defender firewall virus'], ['findmydevice', 'Find my device', 'lost laptop'],
    ['developers', 'For developers', 'developer mode sudo'], ['privacy-location', 'Location', 'gps location'], ['privacy-webcam', 'Camera permissions', 'camera access'],
    ['privacy-microphone', 'Microphone permissions', 'mic access'], ['privacy-general', 'General privacy', 'advertising id'], ['privacy-speech', 'Online speech recognition', 'speech privacy'],
    ['privacy-feedback', 'Diagnostics & feedback', 'telemetry diagnostic data'], ['privacy-activityhistory', 'Activity history', 'timeline'], ['privacy-searchpermissions', 'Search permissions', 'safesearch cloud search'],
    ['cortana-windowssearch', 'Searching Windows', 'search index indexing'], ['privacy-broadfilesystemaccess', 'File system access', 'files permission'], ['privacy-contacts', 'Contacts permissions', 'contacts'],
    ['privacy-calendar', 'Calendar permissions', 'calendar'], ['privacy-backgroundapps', 'Background apps', 'background'],
    ['windowsupdate', 'Windows Update', 'updates update'], ['windowsupdate-history', 'Update history', 'installed updates'], ['windowsupdate-options', 'Advanced update options', 'active hours'],
    ['windowsupdate-restartoptions', 'Restart options', 'restart'], ['windowsinsider', 'Windows Insider Program', 'insider preview beta'], ['delivery-optimization', 'Delivery Optimization', 'download bandwidth']];
  const SCAT = [[/^network|^datausage/, 'Network & internet', 'wifi', 'sky'],
    [/^bluetooth|^connecteddevices|^printers|^mobile-devices|^pen$|^autoplay|^usb|^devices-touchpad|^mousetouchpad|^camera$/, 'Bluetooth & devices', 'bt', 'blue'],
    [/^personalization|^colors|^themes|^lockscreen|^taskbar|^fonts/, 'Personalisation', 'palette', 'pink'],
    [/^apps|^defaultapps|^maps|^videoplayback|^startupapps|^advanced-apps|^optionalfeatures/, 'Apps', 'appsgrid', 'purple'],
    [/^yourinfo|^emailandaccounts|^signinoptions|^workplace|^otherusers|^family|^backup/, 'Accounts', 'person', 'green'],
    [/^dateandtime|^regionlanguage|^typing|^speech|^keyboard/, 'Time & language', 'globe', 'teal'],
    [/^gaming/, 'Gaming', 'pad', 'lime'], [/^easeofaccess/, 'Accessibility', 'access', 'blue'],
    [/^privacy|^windowsdefender|^findmydevice|^developers|^cortana/, 'Privacy & security', 'shield', 'slate'],
    [/^windowsupdate|^windowsinsider|^delivery/, 'Windows Update', 'update', 'sky'], [/./, 'System', 'laptop', 'blue']];
  const SGLYPH = { display: 'display', 'display-advancedgraphics': 'display', nightlight: 'moon', sound: 'vol', 'sound-devices': 'vol', 'apps-volume': 'vol', notifications: 'bell',
    quiethours: 'moon', powersleep: 'power', batterysaver: 'battery', storagesense: 'drive', storagepolicies: 'drive', multitasking: 'appsgrid', activation: 'key', troubleshoot: 'info',
    recovery: 'update', project: 'display', clipboard: 'copy', remotedesktop: 'display', about: 'info', crossdevice: 'phone', deviceencryption: 'lock', bluetooth: 'bt',
    connecteddevices: 'bt', printers: 'printer', 'mobile-devices': 'phone', pen: 'text', 'devices-touchpad': 'mouse', mousetouchpad: 'mouse', camera: 'camera', usb: 'drive',
    'network-wifi': 'wifi', 'network-wifisettings': 'wifi', 'network-ethernet': 'web', 'network-vpn': 'shield', 'network-mobilehotspot': 'wifi', 'network-proxy': 'web',
    'network-status': 'web', 'personalization-background': 'img', colors: 'palette', themes: 'palette', lockscreen: 'lock', 'personalization-textinput': 'keyboard',
    'personalization-start': 'appsgrid', taskbar: 'display', fonts: 'text', appsfeatures: 'appsgrid', defaultapps: 'appsgrid', startupapps: 'power', maps: 'pin',
    yourinfo: 'person', signinoptions: 'key', backup: 'update', dateandtime: 'clock', regionlanguage: 'globe', typing: 'keyboard', speech: 'mic', keyboard: 'keyboard',
    'gaming-gamebar': 'pad', 'gaming-gamedvr': 'camera', 'gaming-gamemode': 'pad', 'easeofaccess-display': 'text', 'easeofaccess-mousepointer': 'mouse',
    'easeofaccess-magnifier': 'search', 'easeofaccess-keyboard': 'keyboard', 'easeofaccess-mouse': 'mouse', 'easeofaccess-audio': 'vol', 'easeofaccess-narrator': 'vol',
    windowsdefender: 'shield', findmydevice: 'pin', developers: 'hash', 'privacy-location': 'pin', 'privacy-webcam': 'camera', 'privacy-microphone': 'mic',
    'cortana-windowssearch': 'search', windowsupdate: 'update' };
  const setMeta = u => { const [, cat, ic, tone] = SCAT.find(([re]) => re.test(u)); return { cat, ic: SGLYPH[u] || ic, tone }; };
  // tasks: [title, where it lives, words people type, what opens it ("ms:" a Settings page, "sys:" a Control Panel page or tool), icon]
  const DEEP = [
    ['Change what closing the lid does', 'Control Panel › Power Options', 'lid close closing laptop lid shut', 'sys:lid', 'laptop'],
    ['Choose what the power button does', 'Control Panel › Power Options', 'power button sleep button press', 'sys:lid', 'power'],
    ['Turn on hibernate', 'Control Panel › Power Options', 'hibernate hibernation fast startup', 'sys:lid', 'moon'],
    ['Choose or edit a power plan', 'Control Panel › Power Options', 'power plan high performance balanced power saver', 'sys:powerplan', 'power'],
    ['Change when the PC sleeps', 'Settings › System › Power & battery', 'sleep after sleep timeout when pc sleeps idle', 'ms:powersleep', 'moon'],
    ['Turn off the screen after…', 'Settings › System › Power & battery', 'screen timeout screen off display off turn off display', 'ms:powersleep', 'display'],
    ['Power mode', 'Settings › System › Power & battery', 'power mode best performance efficiency balanced', 'ms:powersleep', 'power'],
    ['Battery usage by app', 'Settings › System › Power & battery', 'battery usage drain apps using battery', 'ms:batterysaver-usagedetails', 'battery'],
    ['Change the screen resolution', 'Settings › System › Display', 'resolution screen size pixels', 'ms:display', 'display'],
    ['Change the size of text, apps and other items', 'Settings › System › Display', 'scale scaling zoom 125 150 bigger smaller', 'ms:display', 'display'],
    ['Change the refresh rate', 'Settings › System › Display › Advanced display', 'refresh rate hz 60hz 120hz 144hz', 'ms:display-advanced', 'display'],
    ['Use HDR', 'Settings › System › Display › HDR', 'hdr high dynamic range', 'ms:display-hdr', 'display'],
    ['Change brightness', 'Settings › System › Display', 'brightness dim brighter darker', 'ms:display', 'sun'],
    ['Rotate the screen', 'Settings › System › Display', 'rotate orientation portrait landscape flip screen', 'ms:display', 'display'],
    ['Extend or duplicate displays', 'Settings › System › Display', 'second monitor extend duplicate multiple displays projector external', 'ms:display', 'display'],
    ['Calibrate display colour', 'Control Panel › Display', 'calibrate colour color calibration gamma', 'sys:colorcal', 'palette'],
    ['Change the screen saver', 'Control Panel › Personalisation', 'screen saver screensaver', 'sys:screensaver', 'display'],
    ['Change the sound output device', 'Settings › System › Sound', 'output device speakers headphones audio output switch', 'ms:sound', 'vol'],
    ['Change microphone settings', 'Settings › System › Sound', 'microphone mic input volume level test', 'ms:sound', 'mic'],
    ['Sound Control Panel', 'Control Panel › Sound', 'sound control panel playback devices spatial audio enhancements', 'sys:soundcpl', 'vol'],
    ['Recording devices', 'Control Panel › Sound', 'recording devices microphone properties levels', 'sys:recording', 'mic'],
    ['Change system sounds', 'Control Panel › Sound', 'system sounds notification sound beep startup sound', 'sys:sounds', 'bell'],
    ['Change mouse pointer speed', 'Settings › Bluetooth & devices › Mouse', 'pointer speed mouse speed sensitivity dpi', 'ms:mousetouchpad', 'mouse'],
    ['Change the scrolling direction', 'Settings › Bluetooth & devices › Touchpad', 'scroll direction natural scrolling reverse scroll', 'ms:devices-touchpad', 'mouse'],
    ['Swap the left and right mouse buttons', 'Settings › Bluetooth & devices › Mouse', 'left handed primary button swap', 'ms:mousetouchpad', 'mouse'],
    ['Touchpad gestures', 'Settings › Bluetooth & devices › Touchpad', 'three finger four finger gestures swipe tap', 'ms:devices-touchpad', 'mouse'],
    ['Mouse properties', 'Control Panel › Mouse', 'double click speed pointer scheme cursor theme mouse properties', 'sys:mousecpl', 'mouse'],
    ['Change the key repeat speed', 'Control Panel › Keyboard', 'key repeat delay rate cursor blink', 'sys:keyboardcpl', 'keyboard'],
    ['Sticky keys', 'Settings › Accessibility › Keyboard', 'sticky keys filter keys toggle keys', 'ms:easeofaccess-keyboard', 'keyboard'],
    ['On-screen keyboard', 'Settings › Accessibility › Keyboard', 'on screen keyboard osk', 'ms:easeofaccess-keyboard', 'keyboard'],
    ['Add a keyboard layout or language', 'Settings › Time & language › Language & region', 'keyboard layout input language add language', 'ms:regionlanguage', 'keyboard'],
    ['Change DNS or IP settings', 'Control Panel › Network Connections', 'dns ip address static ip adapter ipv4', 'sys:ncpa', 'web'],
    ['Network adapters', 'Control Panel › Network Connections', 'network adapters connections ethernet adapter', 'sys:ncpa', 'web'],
    ['Forget a Wi-Fi network', 'Settings › Network & internet › Wi-Fi', 'forget wifi saved networks known networks', 'ms:network-wifisettings', 'wifi'],
    ['Network reset', 'Settings › Network & internet › Advanced', 'network reset reinstall adapters fix internet', 'ms:network-advancedsettings', 'update'],
    ['Internet Options', 'Control Panel › Internet Options', 'internet options certificates', 'sys:inetcpl', 'web'],
    ['Windows Defender Firewall', 'Control Panel › Firewall', 'firewall allow app through firewall', 'sys:firewall', 'shield'],
    ['Edit environment variables', 'Control Panel › System', 'environment variables path java_home', 'sys:envvars', 'hash'],
    ['Advanced system settings', 'Control Panel › System', 'advanced system settings system properties', 'sys:sysadv', 'laptop'],
    ['Adjust visual effects and performance', 'Control Panel › System › Performance', 'visual effects animations performance options best performance', 'sys:perf', 'display'],
    ['Change virtual memory (page file)', 'Control Panel › System › Performance', 'virtual memory page file pagefile swap', 'sys:perf', 'drive'],
    ['Create a restore point', 'Control Panel › System Protection', 'restore point system restore protection', 'sys:protection', 'update'],
    ['Remote Desktop settings', 'Control Panel › System › Remote', 'remote desktop remote assistance rdp allow', 'sys:remote', 'display'],
    ['Device Manager', 'Windows Tools', 'device manager drivers hardware', 'sys:devmgmt', 'laptop'],
    ['Disk Management', 'Windows Tools', 'disk management partitions format drive', 'sys:diskmgmt', 'drive'],
    ['Free up disk space (Disk Cleanup)', 'Windows Tools', 'disk cleanup free space delete temporary', 'sys:cleanmgr', 'drive'],
    ['Defragment and optimise drives', 'Windows Tools', 'defragment defrag optimise optimize trim', 'sys:defrag', 'drive'],
    ['System Information', 'Windows Tools', 'system information msinfo specs hardware bios', 'sys:sysinfo', 'info'],
    ['Services', 'Windows Tools', 'services background services', 'sys:services', 'gear'],
    ['Task Scheduler', 'Windows Tools', 'task scheduler scheduled tasks', 'sys:taskschd', 'clock'],
    ['Event Viewer', 'Windows Tools', 'event viewer logs errors crash', 'sys:eventvwr', 'info'],
    ['Resource Monitor', 'Windows Tools', 'resource monitor cpu memory disk network usage', 'sys:resmon', 'bolt'],
    ['Turn Windows features on or off', 'Control Panel › Programs', 'windows features hyper-v wsl sandbox net framework', 'sys:features', 'appsgrid'],
    ['Control Panel', 'Windows Tools', 'control panel', 'sys:control', 'gear'],
    ['Uninstall a program', 'Control Panel › Programs', 'uninstall program remove programs and features', 'sys:appwiz', 'appsgrid'],
    ['Credential Manager', 'Control Panel › User Accounts', 'credential manager saved passwords credentials windows credentials', 'sys:credman', 'key'],
    ['User accounts (netplwiz)', 'Control Panel › User Accounts', 'netplwiz user accounts automatic sign in auto login', 'sys:netplwiz', 'person'],
    ['Show file extensions', 'Control Panel › File Explorer Options', 'file extensions show extensions file types', 'sys:folderopts', 'folder'],
    ['Show hidden files and folders', 'Control Panel › File Explorer Options', 'hidden files show hidden folders', 'sys:folderopts', 'folder'],
    ['Change the time zone', 'Settings › Time & language › Date & time', 'time zone timezone', 'ms:dateandtime', 'clock'],
    ['Set the time automatically', 'Settings › Time & language › Date & time', 'set time automatically sync time clock wrong', 'ms:dateandtime', 'clock'],
    ['Change date and number formats', 'Control Panel › Region', 'date format number format region format 24 hour', 'sys:intl', 'globe'],
    ['Change the default browser', 'Settings › Apps › Default apps', 'default browser chrome edge firefox', 'ms:defaultapps', 'web'],
    ['Choose the app that opens a file type', 'Settings › Apps › Default apps', 'open with default app file type association', 'ms:defaultapps', 'appsgrid'],
    ['Snap windows', 'Settings › System › Multitasking', 'snap layouts snap windows split screen', 'ms:multitasking', 'appsgrid'],
    ['Virtual desktops', 'Settings › System › Multitasking', 'virtual desktops multiple desktops', 'ms:multitasking', 'display'],
    ['Clipboard history', 'Settings › System › Clipboard', 'clipboard history win v', 'ms:clipboard', 'copy'],
    ['Taskbar alignment', 'Settings › Personalisation › Taskbar', 'taskbar alignment center centre left start button position', 'ms:taskbar', 'display'],
    ['Automatically hide the taskbar', 'Settings › Personalisation › Taskbar', 'auto hide taskbar autohide', 'ms:taskbar', 'display'],
    ['Turn on dark mode', 'Settings › Personalisation › Colours', 'dark mode dark theme light mode', 'ms:colors', 'moon'],
    ['Transparency effects', 'Settings › Personalisation › Colours', 'transparency effects acrylic blur', 'ms:colors', 'palette'],
    ['Change the accent colour', 'Settings › Personalisation › Colours', 'accent colour color highlight', 'ms:colors', 'palette'],
    ['Change the lock screen picture', 'Settings › Personalisation › Lock screen', 'lock screen picture wallpaper spotlight', 'ms:lockscreen', 'lock'],
    ['Change your account picture', 'Settings › Accounts › Your info', 'account picture profile photo avatar', 'ms:yourinfo', 'person'],
    ['Set up a PIN or fingerprint', 'Settings › Accounts › Sign-in options', 'pin fingerprint windows hello face password change', 'ms:signinoptions', 'key'],
    ['Dynamic lock', 'Settings › Accounts › Sign-in options', 'dynamic lock lock when away phone', 'ms:signinoptions-dynamiclock', 'lock'],
    ['Check for updates', 'Settings › Windows Update', 'check for updates update windows', 'ms:windowsupdate', 'update'],
    ['Pause updates', 'Settings › Windows Update', 'pause updates stop updates', 'ms:windowsupdate', 'update'],
    ['Optional updates and drivers', 'Settings › Windows Update › Advanced', 'optional updates drivers', 'ms:windowsupdate-optionalupdates', 'update'],
    ['Reset this PC', 'Settings › System › Recovery', 'reset this pc factory reset reinstall windows', 'ms:recovery', 'update'],
    ['Advanced startup (BIOS / UEFI)', 'Settings › System › Recovery', 'advanced startup bios uefi boot menu safe mode', 'ms:recovery', 'power'],
    ['Activate Windows', 'Settings › System › Activation', 'activate windows product key license', 'ms:activation', 'key'],
    ['Developer mode', 'Settings › System › For developers', 'developer mode sideload sudo', 'ms:developers', 'hash'],
    ['Location access', 'Settings › Privacy & security', 'location gps', 'ms:privacy-location', 'pin'],
    ['Camera access', 'Settings › Privacy & security', 'camera webcam permission', 'ms:privacy-webcam', 'camera'],
    ['Microphone access', 'Settings › Privacy & security', 'microphone mic permission', 'ms:privacy-microphone', 'mic'],
    ['Find my device', 'Settings › Privacy & security', 'find my device lost stolen locate', 'ms:findmydevice', 'pin'],
    ['Game Mode', 'Settings › Gaming', 'game mode gaming performance', 'ms:gaming-gamemode', 'pad'],
    ['Pair a Bluetooth device', 'Settings › Bluetooth & devices', 'pair connect add device airpods headphones bluetooth', 'ms:connecteddevices', 'bt'],
    ['Phone Link', 'Settings › Bluetooth & devices › Mobile devices', 'phone link android iphone your phone', 'ms:mobile-devices', 'phone'],
    ['Add a printer or scanner', 'Settings › Bluetooth & devices › Printers', 'add printer scanner print', 'ms:printers', 'printer'],
    ['Nearby sharing', 'Settings › System › Nearby sharing', 'nearby sharing share files', 'ms:crossdevice', 'phone'],
    ['Delete temporary files', 'Settings › System › Storage', 'temporary files temp delete cleanup cache', 'ms:storagesense', 'drive'],
    ['Add an optional feature', 'Settings › System › Optional features', 'optional features add feature', 'ms:optionalfeatures', 'appsgrid'],
    ['Windows Mobility Center', 'Control Panel', 'mobility center brightness volume battery presentation', 'sys:mobility', 'laptop'],
    ['Fonts', 'Control Panel › Fonts', 'install fonts fonts folder', 'sys:fonts', 'text']];
  const SETX = {};                                                      // the old quick list's words ("airpods", "dnd" ...) join the matching page
  SET.forEach(([k, name, w]) => { const u = SETU[k] === 'network' ? 'network-status' : SETU[k]; if (u) SETX[u] = (SETX[u] || '') + ' ' + name + ' ' + w.replace(/,/g, ' '); });
  const mkSet = (t, where, kw, go, ic, tone, page) => ({ t, where, go, ic, tone, page, kwText: wordsOf(kw).join(' '), kw: new Set(wordsOf(kw)), words: wordsOf(t + ' ' + kw) });
  const SETIX = [...ALLSET.map(([u, name, kw]) => { const m = setMeta(u); return mkSet(name, 'Settings › ' + m.cat, kw + ' ' + (SETX[u] || ''), 'ms:' + u, m.ic, m.tone, true); }),
    ...DEEP.map(([t, where, kw, go, ic]) => mkSet(t, where, kw, go, ic, go.startsWith('sys:') ? 'graphite' : setMeta(go.slice(3)).tone, false))];
  function settingsRows(q, f) {
    const qq = q.replace(/^(open|go to|show|change|how (?:to|do i))\s+/, '').replace(/\s+settings?$/, '').replace(/^settings?\s+/, '');
    const qw = wordsOf(qq); if (!qw.length || (f === 'all' && qq.length < 2)) return null;
    const joined = qw.join(' '), hits = [];
    for (const s of SETIX) {
      if (!qw.every(w => s.words.some(x => x.startsWith(w) || (w.length >= 5 && dl(w, x) <= 1)))) continue;
      const tn = wordsOf(s.t).join(' ');
      const sc = tn === joined ? 4 : (qw.length === 1 && qw[0].length >= 3 && s.kw.has(qw[0])) ? 3 : tn.startsWith(joined) ? 2.6 : joined.length >= 4 && s.kwText.includes(joined) ? 2.4 : 1.5;
      hits.push([sc + (s.page ? .05 : 0), s]);
    }
    hits.sort((a, b) => b[0] - a[0] || a[1].t.length - b[1].t.length);
    return hits.slice(0, f === 'settings' ? 40 : 6).map(([sc, s], i) => ({
      id: 'set:' + s.go + ':' + s.t, g: 'Settings', kind: 'set', t: s.t, s: s.where, sys: s.go.startsWith('sys:'), icon: glyph(s.ic, s.tone), key: 'Open',
      pr: (f === 'settings' ? 2 + sc / 10 : sc >= 3 ? 2.35 : sc >= 2.4 ? 1.55 : 1.1) - i * .001,
      run: () => { if (s.go.startsWith('sys:')) call('sys', { id: s.go.slice(4) }); else call('mss', { u: 'ms-settings:' + s.go.slice(3) }); hide(); } }));
  }

  /* ---- apps: Launchpad's own list, with Windows' actions for each (run as administrator, file location, pin to Start) ---- */
  function appRows(q, f) {
    return matchApps(q).slice(0, f === 'apps' ? 60 : 6).map((a, i) => ({ id: 'app:' + a.k, g: 'Apps', kind: 'app', app: a, t: a.name, s: 'App', icon: { kind: 'img', src: iconUrl(a.k) }, key: 'Open',
      pr: (a.r <= 1.2 ? 2.45 : a.r <= 2.4 ? 1.7 : 1.15) + (a.u < 14 ? .04 : 0) - i * .002, run: () => launch(tile(a)) }));
  }
  function appInfo(a) {
    if (!HAS_HELPER) return null;
    return look('av:' + a.k, async () => {
      const [v, r] = await Promise.all([getJ(`${base}/appverbs?${q2s({ k: a.k })}`).catch(() => null), getJ(`${base}/apprecent?${q2s({ k: a.k })}`).catch(() => null)]);
      return { verbs: (v && v.verbs) || [], recent: Array.isArray(r) ? r : [] };
    });
  }

  /* ---- your files: Windows' own index (OneDrive too), with the icons and thumbnails Explorer shows ---- */
  const FGROUP = { folder: 'Folders', img: 'Photos', note: 'Music', film: 'Videos', doc: 'Documents', file: 'Files' };
  const FLABEL = { docs: 'Documents', folders: 'Folders', photos: 'Photos', music: 'Music', videos: 'Videos', files: 'Files' };
  function fileItem(f, pr, extra) {
    const t = fileIcon(f), media = t === 'img' || t === 'film';
    return { id: 'f:' + f.p, g: FGROUP[t], kind: 'file', f, t: f.n, s: [extra, where_(f.p, f.od), when(f.d)].filter(Boolean).join('  ·  ') + (f.c ? '  ·  mentions it' : ''),
      icon: HAS_HELPER ? { kind: 'img', src: thumbUrl(f.p, media ? 160 : 128, !media), cover: media } : glyph(t), pr, key: 'Open',
      run: () => { call('openf', { p: f.p }); hide(); }, alt: () => { call('reveal', { p: f.p }); hide(); } };   // Shift+Enter: show it in its folder
  }
  function files(q, f, ext) {
    if (!HAS_HELPER || q.length < 2) return null;
    const kind = f === 'files' || f === 'all' ? '' : f, G = FLABEL[f], n = f === 'all' ? 14 : 30;
    const get = ph => () => helperJ('files', { q, kind, n, ph }).then(j => Array.isArray(j) ? j : []);
    const quick = look(`files:n:${kind}:${q}`, get('n')), more = look(`files:c:${kind}:${q}`, get('c'));   // both start at once; each shows the moment it lands
    const seenP = new Set(), merged = [];
    for (const e of [quick, more]) if (e.state === 'ok') for (const x of e.data) if (!seenP.has(x.p)) { seenP.add(x.p); merged.push(x); }
    const e = { data: merged };
    if (!merged.length) {
      if (quick.state === 'load' || more.state === 'load') return f !== 'all' ? [{ id: 'msg', g: G, ic: 'search', t: 'Searching your files…', s: q, pr: 1, cls: 'load' }] : null;
      return f !== 'all' ? [{ id: 'msg', g: G, ic: 'search', t: 'No files found', s: `Nothing named or mentioning “${q}”`, pr: 1 }] : null;
    }
    const ql = q.toLowerCase(), wordStart = new RegExp('(^|[^a-z0-9])' + ql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    let data = ext ? e.data.filter(x => x.x === ext) : e.data;
    if (!data.length) return f !== 'all' ? [{ id: 'msg', g: G, ic: 'search', t: 'No files found', s: `No ${ext ? ext.slice(1).toUpperCase() + 's' : 'files'} named “${q}”`, pr: 1 }] : null;
    const list = f === 'all' ? data.filter(x => (!x.c || /^\.(docx?|pdf|pptx?|xlsx?|odt|rtf|pages|key|numbers|epub)$/.test(x.x)) && (ql.length > 3 || x.c || wordStart.test(x.n))) : data;
    if (!list.length) return null;
    return list.map((x, i) => {
      const nm = x.n.toLowerCase(), it = fileItem(x, f !== 'all' ? 2 - i * .01 : (nm.replace(/\.[^.]+$/, '') === ql ? 2.4 : nm.startsWith(ql) ? 1.3 : .9) - i * .01);
      if (G) it.g = G; return it;
    });
  }
  function recent(q) {                                                  // "recent", "recent files"
    if (!HAS_HELPER || !/^(recent|recents|recent files|recent documents|recently opened|last opened)$/.test(q)) return null;
    const e = look('recent', () => helperJ('recent', { n: 16 }).then(j => Array.isArray(j) ? j : []));
    if (e.state !== 'ok') return [{ id: 'msg', g: 'Recent', ic: 'recent', t: 'Recent files…', s: 'Looking', pr: 3, cls: 'load' }];
    return e.data.slice(0, 14).map((x, i) => { const it = fileItem(x, 3 - i * .01); it.g = 'Recent'; return it; });
  }

  /* ---- the web (Google's suggestions, DuckDuckGo's instant answer) and the Microsoft Store ---- */
  const webItem = (t, wq, pr, s) => ({ id: 'web:' + wq, g: 'Search the web', kind: 'web', wq, t, s: s || 'Search the web', icon: glyph('search', 'google'), key: 'Search', pr,
    run: () => { call('web', { q: wq }); hide(); } });
  function webSuggest(q, f, raw) {
    if (!HAS_HELPER || q.length < 2 || (f === 'all' && q.length < 3)) return null;
    const e = look('sug:' + q, () => helperJ('suggest', { q: raw }).then(j => j || null));
    if (e.state !== 'ok') return null;
    const out = [], d = e.data.d, g = e.data.g;
    const ans = d && typeof d.Answer === 'string' ? d.Answer.trim() : '';
    if (ans) out.push({ id: 'ddg:' + ans, g: 'Answers', ic: 'web', t: ans, s: `DuckDuckGo  ·  ${d.AnswerType || 'answer'}`, copy: ans, pr: f === 'web' ? 3 : 1.6 });
    if (d && d.AbstractText && (f === 'web' || !appHit)) out.push({ id: 'ddga:' + d.Heading, g: 'Answers', ic: 'book', t: d.Heading || raw, s: d.AbstractSource || 'DuckDuckGo', key: 'Read', pr: f === 'web' ? 2.5 : 1.25,
      big: { paras: [d.AbstractText], img: d.Image ? (/^https?:/.test(d.Image) ? d.Image : 'https://duckduckgo.com' + d.Image) : null }, run: () => { call('web', { q: raw }); hide(); } });
    const sugg = (Array.isArray(g) && Array.isArray(g[1]) ? g[1] : []).filter(s => s.toLowerCase() !== q).slice(0, f === 'web' ? 8 : 3);
    sugg.forEach((s, i) => out.push(webItem(s, s, (f === 'web' ? 2 : .5) - i * .01)));
    return out;
  }
  function storeApps(q, f) {
    if (!HAS_HELPER || q.length < 3 || (f === 'all' && appHit)) return null;
    const e = look('store:' + q, () => helperJ('store', { q, n: f === 'store' ? 8 : 3 }).then(j => Array.isArray(j) ? j : []));
    if (e.state !== 'ok') return f === 'store' && e.state === 'load' ? [{ id: 'msg', g: 'Microsoft Store', ic: 'store', t: 'Searching the Microsoft Store…', s: q, pr: 1, cls: 'load' }] : null;
    if (!e.data.length) return f === 'store' ? [{ id: 'msg', g: 'Microsoft Store', ic: 'store', t: 'Nothing in the Microsoft Store', s: q, pr: 1 }] : null;
    return e.data.slice(0, f === 'store' ? 8 : 3).map((x, i) => ({ id: 'store:' + x.id, g: 'Microsoft Store', kind: 'store', x, t: x.name, s: x.pub || 'Microsoft Store',
      icon: x.logo ? { kind: 'img', src: x.logo, plate: true } : glyph('store', 'blue'), key: 'Get', pr: (f === 'store' ? 2 : .6) - i * .01,
      run: () => { call('storeopen', { id: x.id }); hide(); } }));
  }

  /* ---- put it together ---- */
  let ansList = [], sel = 0, appHit = false, liveT = 0, filt = 'all', resView = [], lastQ = null, userMoved = false, hero = null;
  // [module, group its rows go in] (rows without a group become Answers, or Folders for the known folders)
  const MODS = [[q => mine(q, false), 'YouTube Music'], [q => music(q, false), 'YouTube Music'], [timer], [stopwatch], [funFact], [translate], [calc_], [currency], [units], [bases],
    [worldClock], [dates], [battery], [luck], [system], [define], [wiki], [weather]];
  function calc_(q) {
    q = q.replace(/^(what(?:'s| is)|calculate|calc|compute|solve|=)\s*/, '').replace(/\?$/, '');
    if (/^\d+(\.\d+)?$/.test(q)) return null;                       // a bare number is not a sum
    const v = calc(q); if (v == null) return null;
    return [{ ic: 'calc', t: nf(v), s: q.replace(/\s+/g, ' ').replace(/\*/g, '×').replace(/\//g, '÷') + ' =', copy: raw(v), pr: 3.2, hero: true }];
  }
  // the first word of a command forgives typos too: "defne happy", "dfine", "wikki", "wether dubai", "timr 25"
  const KEYWORDS = ['define', 'definition', 'meaning', 'dictionary', 'wiki', 'wikipedia', 'weather', 'forecast', 'temperature', 'timer', 'pomodoro', 'translate',
    'calculate', 'random', 'password', 'stopwatch', 'fact', 'facts', 'scholar', 'youtube', 'amazon', 'github', 'directions', 'countdown', 'battery'];
  const PLAIN = new Set(['time', 'times', 'date', 'dates', 'day', 'days', 'week', 'weeks', 'what', 'who', 'how', 'when', 'clock', 'roll', 'coin', 'lock', 'play', 'next', 'mute', 'pause', 'stop', 'tell', 'random', 'focus', 'study', 'break', 'today', 'tomorrow']);
  function fixKeyword(q) {
    const m = q.match(/^([a-z]{3,12})(\s.*)?$/); if (!m || KEYWORDS.includes(m[1]) || PLAIN.has(m[1])) return q;
    if (!m[2] && !['weather', 'timer', 'pomodoro', 'battery', 'password', 'random', 'forecast', 'stopwatch', 'fact', 'facts'].includes(KEYWORDS.find(k => dl(m[1], k) <= 1) || '')) return q;   // a lone word is probably an app name
    let best = null, bd = 9;
    for (const k of KEYWORDS) { const d = dl(m[1], k), tol = k.length >= 7 ? 2 : 1; if (d <= tol && d < bd) { bd = d; best = k; } }
    return best ? best + (m[2] || '') : q;
  }
  function normalize(a, grp) {                                          // the instant answers' rows, made into results like the rest
    if (!a.icon) a.icon = a.sw ? { kind: 'sw', color: a.sw } : a.art ? { kind: 'img', src: a.art, cover: true, round: a.round } : glyph(a.ic || 'search');
    if (!a.g) a.g = grp || (a.ic === 'folder' ? 'Folders' : 'Answers');
    if (!a.kind) a.kind = 'ans';
    if (!a.id || a.id === 'msg') a.id = a.g + ':' + a.t;
    return a;
  }
  // group, how many show in "All", and the filter its "See all" opens
  const GROUPS = [['Recent', 14], ['Apps', 4, 'apps'], ['Settings', 4, 'settings'], ['Documents', 4, 'docs'], ['Folders', 3, 'folders'], ['Photos', 4, 'photos'], ['Music', 3, 'music'],
    ['Videos', 3, 'videos'], ['Files', 3, 'files'], ['YouTube Music', 4], ['Answers', 4], ['Search the web', 4, 'web'], ['Microsoft Store', 3, 'store']];
  let curRaw = '';
  function answers(rawQ) {
    const sf = splitFilter(rawQ); filt = sf.f; rawQ = sf.q;                 // "docs: report", "settings: mouse", "store: spotify" ...
    let ext = '';
    if (filt === 'all') {                                               // "jeet photos", "photos of jeet", "jeet pdf", "claude folder": that kind of file
      const t = rawQ.trim(), KW = '(photos?|pictures?|pics?|images?|videos?|movies?|clips?|docs?|documents?|pdfs?|folders?|files?|apps?|applications?|programs?|settings?|songs?|music|audio|tracks?|store|web|online)';
      const m = t.match(new RegExp('^(.+?)\\s+' + KW + '$', 'i')) || t.match(new RegExp('^' + KW + '\\s+(?:of|named|called|with|about|from|for)?\\s*(.+)$', 'i'));
      if (m) {
        const word = (/^(.+?)\s+\S+$/.test(t) && m[2] && new RegExp(KW + '$', 'i').test(t) ? m[2] : m[1]).toLowerCase(), term = (word === m[1].toLowerCase() ? m[2] : m[1]).trim();
        const kind = /^(photo|picture|pic|image)/.test(word) ? 'photos' : /^(video|movie|clip)/.test(word) ? 'videos' : /^(doc|pdf)/.test(word) ? 'docs' : /^folder/.test(word) ? 'folders'
          : /^(app|application|program)/.test(word) ? 'apps' : /^setting/.test(word) ? 'settings' : /^(song|music|audio|track)/.test(word) ? 'music' : word === 'store' ? 'store' : /^(web|online)$/.test(word) ? 'web' : 'files';
        const fullIsApp = matchApps(t.toLowerCase()).some(a => a.r <= 1.2);            // "google photos", "microsoft store" are apps
        const leading = t.toLowerCase().startsWith(word), command = /^(play|ytm|yt music|youtube music|listen to|put on)\b/i.test(t);   // "music arijit" stays a YouTube Music search
        if (term && !fullIsApp && !command && !(leading && kind === 'music') && !/^(recent|recents|my|all)$/i.test(term)) { filt = kind; rawQ = term; if (/^pdf/.test(word)) ext = '.pdf'; }
      }
    }
    curRaw = rawQ.trim().replace(/\s+/g, ' ');
    const q = fixKeyword(rawQ.trim().toLowerCase().replace(/\s+/g, ' '));
    resView = []; hero = null;
    if (!q) return [];
    wanted.clear();
    let out = [];
    const add = (f, grp) => { try { const r = f(); if (r && r.length) out.push(...r.map(a => normalize(a, grp))); } catch (err) { console.warn('search', err); } };
    if (filt === 'all') {
      add(() => appRows(q, filt));
      for (const [f, grp] of MODS) add(() => f(q), grp);
      add(() => recent(q)); add(() => files(q, 'all')); add(() => settingsRows(q, 'all'));
      if (!out.some(a => a.pr >= 2.3) && !appHit && q.length >= 3 && /[a-z\u00c0-\uffff]/i.test(q) && !ENG[q.split(' ')[0]] && !SITES[q])
        add(() => [...(mine(q, true) || []), ...(music(q, true) || [])], 'YouTube Music');
      if (!out.some(a => a.hero && a.pr >= 3)) add(() => webSuggest(q, 'all', curRaw));
      add(() => storeApps(q, 'all')); add(() => web(q, rawQ.trim()));
    } else if (filt === 'apps') add(() => appRows(q, 'apps'));
    else if (filt === 'settings') add(() => settingsRows(q, 'settings') || [{ id: 'msg', g: 'Settings', ic: 'gear', t: 'No settings found', s: `Nothing matches “${curRaw}”`, pr: 1 }]);
    else if (filt === 'web') add(() => webSuggest(q, 'web', curRaw));
    else if (filt === 'store') add(() => storeApps(q, 'store'));
    else add(() => q === 'recent' ? recent(q) : files(q, filt, ext));        // docs / folders / photos / music / videos / files
    if ((filt === 'all' || filt === 'web') && q.length > 1 && !out.some(a => a.kind === 'ans' && a.run && /^Search /.test(a.t)))   // always: search the web for it
      out.push(normalize({ ...webItem(`Search Google for “${rawQ.trim()}”`, rawQ.trim(), 0, 'Opens in your browser'), id: 'web:google' }));   // one steady row: it updates in place as you type
    const seen = new Set(); out = out.filter(a => !seen.has(a.id) && seen.add(a.id));
    out.sort((a, b) => b.pr - a.pr);
    const lead = out.find(a => !a.cls || a.pr >= 2.5);                 // a loading row leads only if it's a strong one (weather, wiki ...)
    hero = filt === 'all' && lead && lead.kind === 'ans' && (lead.hero || lead.big || lead.pr >= 2.5) ? lead : null;
    if (hero) hero.id = 'hero:' + (hero.ic || hero.g);                // the card updates in place as you type (2+2 -> 2+23), it doesn't re-enter
    const known = new Set(GROUPS.map(g => g[0]));
    out.forEach(a => { if (!known.has(a.g)) a.g = 'Answers'; });
    const view = [];
    for (const [g, , see] of GROUPS) {
      const all = out.filter(a => a !== hero && a.g === g); if (!all.length) continue;
      const pills = g === 'Search the web' || g === 'Answers', n = filt !== 'all' ? 70 : pills ? 5 : COLS;
      view.push({ g, pills, items: all.slice(0, n), top: all[0].pr,
        see: filt === 'all' && see && (all.length > n || /^(Apps|Documents|Folders|Photos|Music|Videos|Files|Microsoft Store)$/.test(g)) ? see : null });
    }
    if (filt === 'all') view.sort((a, b) => (a.g === 'Search the web') - (b.g === 'Search the web') || b.top - a.top);   // the strongest kind first, the web last
    resView = view;
    return [...(hero ? [hero] : []), ...view.flatMap(v => v.items)];
  }

  /* ---- ShadowUI: drawing the results ----
     Everything found is a Launchpad tile, in a row per kind (the strongest kind first); a strong answer is a card across the top;
     web searches and one-line answers are pills. The highlight is Launchpad's own and moves like it: down / up between rows, Tab
     along them. The caption at the bottom says what's selected and what you can do (Enter = the first action, Shift+Enter = show
     it in its folder, Ctrl+Shift+Enter = run an app as administrator). */
  let capActs = [], freshT = 0, shownIds = new Set(), capFocus = -1;
  const loadedImg = window.__lpLd = window.__lpLd || new Set();              // pictures already shown once: no fade next time
  const imgA = src => loadedImg.has(src) ? ' class="ld"' : ` onload="__lpLd.add(this.src);this.classList.add('ld')"`;
  function icHtml(a) {                                                  // a result's picture, at Launchpad's icon size
    const c = a.icon || glyph('search');
    if (a.kind === 'file' && HAS_HELPER) {
      const t = fileIcon(a.f), media = t === 'img' || t === 'film';
      const u = thumbUrl(a.f.p, media ? 160 : 256, !media);
      return `<div class="ic sxim${media ? ' cover' : ''}"><img alt="" decoding="async" draggable="false"${imgA(u)} src="${esc(u)}" onerror="this.style.visibility='hidden';this.parentNode.classList.add('nf')"></div>`;
    }
    if (c.kind === 'img') return `<div class="ic sxim${c.cover ? ' cover' : ''}${c.round ? ' round' : ''}${c.plate ? ' plate' : ''}"><img alt="" decoding="async" draggable="false" referrerpolicy="no-referrer"${imgA(c.src)} src="${esc(c.src)}" onerror="this.style.visibility='hidden';this.parentNode.classList.add('nf')"></div>`;
    if (c.kind === 'sw') return `<div class="ic sxsw" style="background:${esc(c.color)}"></div>`;
    const [t1, t2] = TONE[c.tone] || TONE.gray;
    return `<div class="ic sxgl" style="--t1:${t1};--t2:${t2}">${svg(c.ic)}</div>`;
  }
  function tileHtml(a, k, i) {
    let ic;
    if (a.kind === 'app') {                                             // an app: exactly its Launchpad tile (same icon, same tint)
      const st = tiles.get(a.app.k)?.firstChild?.getAttribute('style') || '';
      ic = `<div class="ic" style="${esc(st)}"><img alt="" draggable="false" decoding="async"${imgA(iconUrl(a.app.k))} src="${esc(iconUrl(a.app.k))}"></div>`;
    } else ic = icHtml(a);
    return `<div class="lpi sx${a.kind === 'app' ? ' sxapp' : ''}${shownIds.has(a.id) ? '' : ' nw'}${k === sel ? ' sel' : ''}${a.cls ? ' ' + a.cls : ''}" data-a="${k}" style="--i:${i}" role="option" aria-selected="${k === sel}" aria-label="${esc(a.t + (a.s ? ', ' + a.s : ''))}">${ic}<span>${esc(a.t)}</span></div>`;
  }
  function pillHtml(a, k, i) {
    const ans = a.kind !== 'web';
    return `<div class="sxpl${ans ? ' ans' : ''}${shownIds.has(a.id) ? '' : ' nw'}${k === sel ? ' sel' : ''}${a.cls ? ' ' + a.cls : ''}" data-a="${k}" style="--i:${i}" role="option" aria-selected="${k === sel}" aria-label="${esc(a.t + (a.s ? ', ' + a.s : ''))}">${ans ? iconHtml(a.icon) : svg('search')}` +
      `<span><b>${esc(a.t)}</b>${ans && a.s ? `<small>${esc(a.s)}</small>` : ''}</span></div>`;
  }
  function heroHtml(a, k) {
    const cls = a.big || a.heroSmall || String(a.t).length > 22 ? ' long' : a.mono ? ' mono' : a.wrapT ? ' free' : '';
    const article = a.big ? `<div class="aw">${a.big.img ? `<img src="${esc(a.big.img)}" alt="">` : ''}${a.big.paras.map(t => { const h = t.match(/^=+\s*(.*?)\s*=+$/); return h ? (h[1] ? `<h4>${esc(h[1])}</h4>` : '') : `<p>${esc(t)}</p>`; }).join('')}</div>` : '';
    return `<div class="sxh${shownIds.has(a.id) ? '' : ' nw'}${k === sel ? ' sel' : ''}${a.cls ? ' ' + a.cls : ''}" data-a="${k}" role="option" aria-selected="${k === sel}" aria-label="${esc(a.t + (a.s ? ', ' + a.s : ''))}"><div class="sxhh">${icHtml(a)}<div class="sxhx">` +
      `<div class="sxht${a.wrapT ? ' free' : cls}">${esc(a.t)}</div>${a.s ? `<div class="sxhs">${esc(a.s)}</div>` : ''}</div></div>${article}</div>`;
  }
  function renderAns() {
    const on = !!search.value.trim();
    ansEl.classList.toggle('on', on);
    let html = '', k = 0;
    if (hero) html += heroHtml(hero, k++);
    for (const grp of resView) {
      html += `<section class="sxg" role="group" aria-label="${esc(grp.g)}"><h6>${esc(grp.g)}${grp.see ? `<b data-f="${grp.see}">See all</b>` : ''}</h6>`;
      html += grp.pills ? `<div class="sxp">${grp.items.map((a, i) => pillHtml(a, k++, i)).join('')}</div>`
                        : `<div class="sxr">${grp.items.map((a, i) => tileHtml(a, k++, i)).join('')}</div>`;
      html += '</section>';
    }
    if (!html && on) { const lbl = (FILTERS.find(([f]) => f === filt) || [, ''])[1]; html = `<div class="lpNo">${filt === 'all' ? 'Type to search' : 'Type to search ' + esc(lbl.toLowerCase())}</div>`; }
    if (ansRows.dataset.h !== html) {                                   // late look-ups only redraw when something changed - and without flashing the highlight
      ansRows.classList.add('rr'); ansRows.innerHTML = html; ansRows.dataset.h = html;
      requestAnimationFrame(() => requestAnimationFrame(() => ansRows.classList.remove('rr')));
    }
    shownIds = new Set(ansList.map(a => a.id));                         // what's on screen now: if it's still there after the next letter, it won't move
    renderCap();
  }
  function capFor(a) {                                                  // the caption: title, a line about it, and its actions
    const acts = []; let sub = a.s || '';
    const A = (ic, label, run, primary, kbd) => acts.push({ ic, label, run, primary, kbd });
    if (a.kind === 'app') {
      sub = 'App'; A('open', 'Open', a.run, true, '↵');
      const e = appInfo(a.app), VI = { 'Run as administrator': 'admin', 'Open file location': 'reveal', 'Pin to Start': 'pinS', 'Unpin from Start': 'pinS' };
      if (e && e.state === 'ok') {
        e.data.verbs.forEach(v => A(VI[v] || 'open', v, () => {
          call('appverb', { k: a.app.k, v });
          if (/Pin/.test(v)) { net.delete('av:' + a.app.k); setTimeout(() => { if (open && search.value) onQuery(); }, 700); return 'done'; }
          hide();
        }, false, v === 'Run as administrator' ? 'Ctrl Shift ↵' : ''));
        if (e.data.recent[0]) sub = `App  ·  last opened ${e.data.recent[0].n}`;
      }
    } else if (a.kind === 'file') {
      const f = a.f, ext = (f.x || '').slice(1).toUpperCase();
      sub = [f.dir ? 'Folder' : ext ? `${ext} ${(f.k || 'file').toLowerCase()}` : (f.k || 'File'), !f.dir && f.s ? fmtSize(f.s) : '', f.d ? when(f.d) : '', where_(f.p, f.od)].filter(Boolean).join('  ·  ');
      A('open', 'Open', a.run, true, '↵'); A('reveal', 'Show in folder', a.alt, false, 'Shift ↵'); A('copy', 'Copy path', () => { copyText(f.p); return 'copied'; });
    } else if (a.kind === 'set') A('open', a.sys ? 'Open' : 'Open in Settings', a.run, true, '↵');
    else if (a.kind === 'store') {
      const x = a.x; sub = [x.pub, +x.rating ? `★ ${(+x.rating).toFixed(1)}` : '', x.cat].filter(Boolean).join('  ·  ');
      A('store', 'Get', a.run, true, '↵'); A('search', 'Search the web', () => { call('web', { q: x.name }); hide(); });
    } else if (a.kind === 'web') {
      sub = 'Search the web'; A('search', 'Google', a.run, true, '↵'); A('yt', 'YouTube', () => { call('web', { q: a.wq, e: 'yt' }); hide(); });
      A('copy', 'Copy', () => { copyText(a.wq); return 'copied'; });
    } else {
      if (a.run) A(a.art ? 'play' : a.key === 'Search' ? 'search' : 'open', a.key || 'Open', a.run, true, '↵');
      if (a.copy != null) A('copy', 'Copy', () => { copyText(String(a.copy)); return 'copied'; }, !a.run, a.run ? '' : '↵');
    }
    return { title: a.t, sub, acts };
  }
  function renderCap() {
    const a = search.value.trim() ? ansList[sel] : null;
    capEl.classList.toggle('on', !!a);
    if (!a) { capEl.innerHTML = ''; capEl.dataset.h = ''; capActs = []; return; }
    const c = capFor(a); capActs = c.acts;
    const html = `${iconHtml(a.kind === 'app' ? { kind: 'img', src: iconUrl(a.app.k) } : a.icon)}<div class="sxct"><b>${esc(c.title)}</b>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}</div>` +
      `<div class="sxa" role="toolbar" aria-label="Actions">${c.acts.map((x, i) => { const kb = x.kbd || (i < 9 ? 'Ctrl ' + (i + 1) : '');
        return `<div class="sxab${x.primary ? ' primary' : ''}" data-i="${i}" role="button" tabindex="-1" aria-keyshortcuts="${esc(kb.replace(/ ↵/, '+Enter').replace(/ /g, '+'))}">${svg(x.ic)}<span>${esc(x.label)}</span>${kb ? `<kbd>${kb}</kbd>` : ''}</div>`; }).join('')}</div>`;
    if (capEl.dataset.h === html) return;
    capEl.classList.toggle('still', capEl.dataset.id === a.id);          // the same result, updated: no re-entrance
    capEl.dataset.h = html; capEl.dataset.id = a.id; capEl.innerHTML = html; markCap();
  }
  function runAns(k, alt) {
    const a = ansList[k]; if (!a) return;
    if (alt && a.alt) { a.alt(); return; }
    if (a.copy != null && (!a.run || alt)) { copyText(String(a.copy)); flashRow(k, 'Copied'); return; }
    if (a.run) { const r = a.run(); if (a.stay || r === 'stay') flashRow(k); }
  }
  function flashRow(k, msg) {
    const el = ansRows.querySelector(`[data-a="${k}"]`); el?.classList.add('done'); setTimeout(() => el?.classList.remove('done'), 500);
    if (msg && k === sel) { const b = capEl.querySelector('.sxab.primary span') || capEl.querySelector('.sxab span'); if (b) { const o = b.textContent; b.textContent = msg; setTimeout(() => { b.textContent = o; }, 900); } }
  }
  function runAct(i, el) {
    const x = capActs[i]; if (!x || !x.run) return;
    const r = x.run();
    if (r === 'copied' || r === 'done' || r === 'stay') { el.classList.add('done'); if (r === 'copied') el.querySelector('span').textContent = 'Copied'; setTimeout(() => { el.classList.remove('done'); renderCap(); }, 900); }
  }
  function markCap() {
    capEl.querySelectorAll('.sxab').forEach((b, i) => b.classList.toggle('kf', i === capFocus));
    capEl.classList.toggle('kfo', capFocus >= 0); ansRows.classList.toggle('capf', capFocus >= 0);
  }
  function setSel(k, quiet) {
    capFocus = -1;
    const n = ansList.length; if (!n) { sel = 0; renderCap(); return; }
    userMoved = true;                                                   // you picked this one: a late look-up won't move you off it
    sel = Math.max(0, Math.min(n - 1, k));
    ansRows.querySelectorAll('[data-a]').forEach(el => { const on = +el.dataset.a === sel; el.classList.toggle('sel', on); el.setAttribute('aria-selected', on); });
    if (!quiet) {                                                       // keep it in view (with its row's label, when it starts the row)
      const el = ansRows.querySelector(`[data-a="${sel}"]`);
      if (el) {
        const sec = el.closest('.sxg'), first = sec && sec.querySelector('[data-a]') === el, cr = ansRows.getBoundingClientRect(), r = (first ? sec : el).getBoundingClientRect(), er = el.getBoundingClientRect();
        if (r.top < cr.top + 4) ansRows.scrollTop -= cr.top + 4 - r.top; else if (er.bottom > cr.bottom - 30) ansRows.scrollTop += er.bottom - cr.bottom + 30;
      }
    }
    renderCap();
  }
  function moveSel(dir) {                                               // down / up: the nearest result in the next row, under the highlight
    const cur = ansRows.querySelector(`[data-a="${sel}"]`); if (!cur) return setSel(0);
    const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bdy = Infinity, bdx = Infinity;
    for (const el of ansRows.querySelectorAll('[data-a]')) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect(), dy = (r.top + r.height / 2 - cy) * dir; if (dy < Math.min(r0.height, r.height) * .45) continue;
      const dx = Math.abs(r.left + r.width / 2 - cx);
      if (dy < bdy - 6 || (Math.abs(dy - bdy) <= 6 && dx < bdx)) { best = el; bdy = dy; bdx = dx; }
    }
    if (best) setSel(+best.dataset.a);
    else if (dir > 0 && capActs.length) { capFocus = 0; markCap(); }      // past the last row: into the caption's buttons
    else if (dir < 0) ansRows.scrollTop = 0;
  }
  function moveSelH(dir) {                                              // left / right: the neighbour in the same row; at a row's end, on to the next one
    const cur = ansRows.querySelector(`[data-a="${sel}"]`); if (!cur) return setSel(0);
    const r0 = cur.getBoundingClientRect(), cy = r0.top + r0.height / 2, cx = r0.left + r0.width / 2;
    let best = null, bdx = Infinity;
    for (const el of ansRows.querySelectorAll('[data-a]')) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect(); if (Math.abs(r.top + r.height / 2 - cy) > Math.max(r0.height, r.height) * .45) continue;
      const dx = (r.left + r.width / 2 - cx) * dir; if (dx > 2 && dx < bdx) { best = el; bdx = dx; }
    }
    setSel(best ? +best.dataset.a : sel + dir);
  }
  function renderFilt() {
    const on = !!search.value.trim();
    filtEl.classList.toggle('on', on); if (!on) return;
    const html = FILTERS.map(([f, label]) => `<span class="fc${f === filt || (f === 'docs' && filt === 'files') ? ' cur' : ''}" data-f="${f}">${label}</span>`).join('');
    if (filtEl.dataset.h !== html) { filtEl.innerHTML = html; filtEl.dataset.h = html; }
  }
  function applyFilter(f) {                                             // a filter or "See all": writes the prefix, like typing "docs:"
    const rest = splitFilter(search.value).q.trimStart();
    search.value = f === 'all' ? rest : `${f}: ${rest}`;
    try { search.setSelectionRange(search.value.length, search.value.length); } catch (_) {}
    onQuery(); placeCaret();
  }
  filtEl.addEventListener('click', e => { const c = e.target.closest('.fc'); if (c) applyFilter(c.dataset.f); });
  function onQuery() {
    const rawQ = search.value, sf = splitFilter(rawQ), q = sf.q.trim().toLowerCase(); filt = sf.f;
    const was = lp.classList.contains('q') || lp.classList.contains('typing');
    lp.classList.toggle('q', !!rawQ.trim()); if (rawQ) lp.classList.add('typing'); lp.classList.toggle('wide', !!rawQ); if (rawQ.trim()) { exitWiggle(); if (folderOpenId) { folderOpenId = null; lp.classList.remove('fopen'); } }
    if (was !== (lp.classList.contains('q') || lp.classList.contains('typing'))) glass?.animate(650);   // capsule is changing width
    placeCaret();
    appHit = !!q && matchApps(q).some(a => a.r <= 1.2 || (a.r <= 3.6 && a.u < 14));     // a clear app match: name starts with it, or a favourite app
    if (rawQ !== lastQ) userMoved = false;
    const fresh = rawQ !== lastQ;
    const keep = rawQ === lastQ && userMoved ? ansList[sel]?.id : null; lastQ = rawQ;  // the same search, refreshed by a look-up: stay on the result you picked (otherwise the best leads)
    ansList = rawQ.trim() ? answers(rawQ) : []; if (!rawQ.trim()) { resView = []; hero = null; shownIds = new Set(); }
    page = 0; builtFor = null; build(q, rawQ.trim() ? -1 : 0);          // while searching, Launchpad itself becomes the results
    renderFilt();                                                       // (shows the kind understood from "jeet photos" too)
    const ks = keep ? ansList.findIndex(a => a.id === keep) : -1;
    sel = ks >= 0 ? ks : 0;
    if (fresh) ansRows.scrollTop = 0;
    renderAns();
    clearInterval(liveT); liveT = ansList.some(a => a.live) ? setInterval(() => {
      if (!open) return clearInterval(liveT);
      const id = ansList[sel]?.id; ansList = answers(search.value); const i = ansList.findIndex(a => a.id === id); sel = i >= 0 ? i : 0; renderAns();
    }, 1000) : 0;
  }

  /* ============================================================== input ============================================================== */
  track.addEventListener('click', e => { if (suppressClick) { suppressClick = false; return; } const it = e.target.closest('.lpi'); if (it && !e.target.closest('.x')) activate(it); });
  fgrid.addEventListener('click', e => { if (suppressClick) { suppressClick = false; return; } const it = e.target.closest('.lpi'); if (it && !e.target.closest('.x') && !wiggle) launch(it); });
  lp.addEventListener('click', e => { const x = e.target.closest('.x'); if (x && wiggle) { e.stopPropagation(); openMenu(x.closest('.lpi')); } });
  $('lpDone').addEventListener('click', () => { gDone?.squish(); setTimeout(exitWiggle, 90); });
  $('lpRestore').addEventListener('click', () => restoreHidden());
  ansEl.addEventListener('click', e => {
    const see = e.target.closest('.sxg > h6 b'); if (see) { applyFilter(see.dataset.f); return; }
    if (e.target.closest('.aw')) return;                                // reading an article: clicks in it don't open it
    const el = e.target.closest('#lpAnsRows [data-a]'); if (!el) return;
    if (+el.dataset.a !== sel) setSel(+el.dataset.a, true);
    if (el.classList.contains('lpi')) el.classList.add('press');
    runAns(+el.dataset.a, e.shiftKey);
  });
  capEl.addEventListener('click', e => { const b = e.target.closest('.sxab'); if (b) runAct(+b.dataset.i, b); });
  dots.addEventListener('click', e => { const d = e.target.closest('i'); if (d) goPage(+d.dataset.p); });
  lp.addEventListener('mousedown', e => {        // click on empty space closes; nothing reaches the wallpaper underneath
    e.stopPropagation();
    if (e.target.closest('#lpPwr,#lpPwrMenu')) return;
    if (e.target.closest('#lpMenu,#lpDlgBox,#lpBar,#lpSizeBar,#lpFPanel,.lpi,#lpSB,#lpDots,#lpAns,#lpFilt,#lpCap')) { if (!e.target.closest('#lpMenu,.x')) closeMenu(); return; }
    e.preventDefault();
    if (dlg) closeDlg(false); else if (menuFor) closeMenu(); else if (folderOpenId) closeFolder(); else if (wiggle) exitWiggle(); else if (!window.OVERLAY) hide();   // over your apps: only a click outside Launchpad closes it
  });
  search.addEventListener('input', onQuery);
  document.addEventListener('selectionchange', () => { if (open && document.activeElement === search) placeCaret(); });
  let wAcc = 0, wT = 0;
  lp.addEventListener('wheel', e => {            // mouse wheel / trackpad scroll (browsers; Lively doesn't pass these on)
    if (search.value) return; e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (performance.now() - wT < 260) return;
    wAcc += d; if (Math.abs(wAcc) > 60) { goPage(page + Math.sign(wAcc)); wAcc = 0; wT = performance.now(); }
  }, { passive: false });

  // keyboard. Two sources: keys the helper hands over directly (always works, no click needed), and ordinary
  // key events from Lively (used when the helper isn't running). Lively hands each key over twice: ignore the copy.
  const VK = { 8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 46: 'Delete' };
  function edit(fn) {                                                  // change the text by hand (search, or a folder name), keeping the caret right
    const f = renaming ? fname : search;
    const v = f.value; let a = f.selectionStart ?? v.length, b = f.selectionEnd ?? v.length;
    const r = fn(v, a, b); if (!r) return;
    if (r[0] !== v && !fn.noUndo) remember();
    f.value = r[0]; try { f.setSelectionRange(r[1], r[1]); } catch (_) {}
    if (f === fname) { if (r[0] !== v) renameFolder(r[0]); return; }
    if (r[0] !== v) { placeCaret(); queueQuery(); } else placeCaret();
  }
  // several keys can arrive in one batch: search once per frame, not once per key
  let qPending = 0;
  function queueQuery() { if (!qPending) qPending = requestAnimationFrame(() => { qPending = 0; onQuery(); }); }
  function flushQuery() { if (qPending) { cancelAnimationFrame(qPending); qPending = 0; onQuery(); } }
  // text-field shortcuts, done by hand because the field rarely has real focus inside the wallpaper
  const undo = [];
  function remember() { const f = renaming ? fname : search; if (undo[undo.length - 1] !== f.value) { undo.push(f.value); if (undo.length > 50) undo.shift(); } }
  const wordLeft = (v, i) => { while (i > 0 && /\s/.test(v[i - 1])) i--; while (i > 0 && !/\s/.test(v[i - 1])) i--; return i; };
  const wordRight = (v, i) => { while (i < v.length && /\s/.test(v[i])) i++; while (i < v.length && !/\s/.test(v[i])) i++; return i; };
  function select(a, b) { const f = renaming ? fname : search; try { f.setSelectionRange(Math.min(a, b), Math.max(a, b), a > b ? 'backward' : 'forward'); } catch (_) {} if (f === search) placeCaret(); }
  function shortcut(k) {
    const f = renaming ? fname : search, v = f.value, a = f.selectionStart ?? v.length, b = f.selectionEnd ?? v.length, back = f.selectionDirection === 'backward';
    const key = k.key.length === 1 ? k.key.toLowerCase() : k.key, anchor = back ? b : a, head = back ? a : b;
    if (k.ctrlKey && key === 'a') { select(0, v.length); return true; }
    if (k.ctrlKey && (key === 'c' || key === 'x')) {
      const t = v.slice(a, b); if (!t) return true;
      try { navigator.clipboard?.writeText(t).catch(() => {}); } catch (_) {} call('clip', { text: t });
      if (key === 'x') { remember(); edit(() => [v.slice(0, a) + v.slice(b), a]); }
      return true;
    }
    if (k.ctrlKey && key === 'z') { if (undo.length) { const prev = undo.pop(); edit(() => [prev, prev.length]); } return true; }
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End') {
      let to = key === 'Home' ? 0 : key === 'End' ? v.length
        : k.ctrlKey ? (key === 'ArrowLeft' ? wordLeft(v, head) : wordRight(v, head))
        : (!k.shiftKey && a !== b) ? (key === 'ArrowLeft' ? a : b) : Math.max(0, Math.min(v.length, head + (key === 'ArrowLeft' ? -1 : 1)));
      if (k.shiftKey) select(anchor, to); else select(to, to);
      return true;
    }
    if (k.ctrlKey && (key === 'Backspace' || key === 'Delete')) return false;   // word delete is handled below
    return k.ctrlKey && key.length === 1;                                       // swallow other Ctrl+letter combos
  }
  function insertText(t) { if (!open || !t) return; edit((v, a, b) => [v.slice(0, a) + t + v.slice(b), a + t.length]); }
  function handleKey(k, native) {                                      // k: { key, ctrlKey, shiftKey }
    if (!open) return false;
    if (k.key.length > 1 && k.key !== 'Backspace' && k.key !== 'Delete') flushQuery();   // Enter / arrows act on the latest results
    const tiles = () => [...track.querySelectorAll('.lpPage.cur .lpi')], key = k.key;
    if (dlg) { if (key === 'Enter') closeDlg(true); else if (key === 'Escape') closeDlg(false); return false; }
    if (renaming) {
      if (key === 'Enter' || key === 'Escape') stopRename();
      else if (key === 'Backspace' || key === 'Delete') edit((v, a, b) => { if (a === b) { if (key === 'Backspace') a = Math.max(0, a - 1); else b = Math.min(v.length, b + 1); } return [v.slice(0, a) + v.slice(b), a]; });
      else if (key === 'ArrowLeft' || key === 'ArrowRight') edit((v, a) => [v, Math.max(0, Math.min(v.length, a + (key === 'ArrowRight' ? 1 : -1)))]);
      else if (key.length === 1 && !k.ctrlKey) { if (native) return true; insertText(key); }
      return false;
    }
    if (search.value && k.ctrlKey && !k.shiftKey && /^[1-9]$/.test(key)) { const b = capEl.querySelectorAll('.sxab')[+key - 1]; if (b) runAct(+key - 1, b); return false; }
    if (search.value && k.ctrlKey && (key === 'ArrowDown' || key === 'ArrowUp')) {
      const i = FILTERS.findIndex(([f]) => f === filt), n = FILTERS.length; applyFilter(FILTERS[((i < 0 ? 0 : i) + (key === 'ArrowDown' ? 1 : -1) + n) % n][0]); return false;
    }
    if (k.ctrlKey || k.shiftKey) { if (shortcut(k)) return false; }
    if (key === 'Escape' && capFocus >= 0) { capFocus = -1; markCap(); return false; }
    if (key === 'Escape') { if (menuFor) closeMenu(); else if (folderOpenId) closeFolder(); else if (wiggle) exitWiggle(); else if (search.value) { search.value = ''; onQuery(); lp.classList.remove('wide'); } else hide(); }
    else if (search.value && capFocus >= 0 && !k.ctrlKey && !k.shiftKey && /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Enter)$/.test(key)) {   // in the caption's buttons
      if (key === 'ArrowUp') capFocus = -1;
      else if (key === 'Enter') { const b = capEl.querySelectorAll('.sxab')[capFocus]; if (b) runAct(capFocus, b); return false; }
      else if (key !== 'ArrowDown') capFocus = Math.max(0, Math.min(capActs.length - 1, capFocus + (key === 'ArrowRight' ? 1 : -1)));
      markCap();
    }
    else if (search.value && !k.shiftKey && !k.ctrlKey && (key === 'ArrowLeft' || key === 'ArrowRight') && ansList.length) moveSelH(key === 'ArrowRight' ? 1 : -1);   // results: left / right between them
    else if (key === 'Backspace' && search.selectionStart === 0 && search.selectionEnd === 0) glass?.pull(-1);     // nothing left to delete: the bar stretches left, like iOS
    else if (key === 'Delete' && search.selectionStart === search.value.length && search.selectionEnd === search.value.length) glass?.pull(1);
    else if (key === 'ArrowLeft' && search.value && search.selectionStart === 0 && search.selectionEnd === 0 && !k.shiftKey) glass?.pull(-1);
    else if (key === 'ArrowRight' && search.value && search.selectionStart === search.value.length && search.selectionEnd === search.value.length && !k.shiftKey) glass?.pull(1);
    else if (!search.value && /^Arrow(Left|Right|Up|Down)$/.test(key) && homeKey(key)) {}     // the home grid: move the highlight
    else if ((key === 'ArrowRight' || key === 'ArrowLeft') && !search.value) goPage(page + (key === 'ArrowRight' ? 1 : -1));
    else if (key === 'ArrowLeft' || key === 'ArrowRight') edit((v, a, b) => [v, a === b ? Math.max(0, Math.min(v.length, a + (key === 'ArrowRight' ? 1 : -1))) : key === 'ArrowRight' ? b : a]);
    else if (key === 'Home' || key === 'End') edit(v => [v, key === 'Home' ? 0 : v.length]);
    else if (key === 'PageDown' || key === 'PageUp') { if (!search.value) goPage(page + (key === 'PageDown' ? 1 : -1)); else window.__lpScrollAns?.(key === 'PageDown' ? 1 : -1); }
    else if (search.value && key === 'ArrowDown') moveSel(1);
    else if (search.value && key === 'ArrowUp') moveSel(-1);
    else if (search.value && key === 'Tab') setSel(sel + (k.shiftKey ? -1 : 1));
    else if (key === 'Enter' && k.ctrlKey && k.shiftKey && search.value) {           // like Windows: Ctrl+Shift+Enter runs an app as administrator
      const a = ansList[sel]; if (a && a.kind === 'app') { call('appverb', { k: a.app.k, v: 'Run as administrator' }); hide(); }
    }
    else if (key === 'Enter') {
      if (!search.value) { const t = homeSel >= 0 ? homeTiles()[homeSel] : tiles()[0]; if (t) activate(t); }
      else runAns(sel, k.shiftKey || k.ctrlKey);
    }
    else if (key === 'Backspace' || key === 'Delete') edit((v, a, b) => {
      if (a === b) {
        if (key === 'Backspace') a = k.ctrlKey ? v.slice(0, a).replace(/\S+\s*$|\s+$/, '').length : Math.max(0, a - 1);
        else b = k.ctrlKey ? v.length - v.slice(b).replace(/^\s*\S+/, '').length : Math.min(v.length, b + 1);
      }
      return [v.slice(0, a) + v.slice(b), a];
    });
    else if (key === 'a' && k.ctrlKey) { try { search.focus({ preventScroll: true }); search.select(); } catch (_) {} placeCaret(); }
    else if (key.length === 1 && !k.ctrlKey) { if (native) { if (document.activeElement !== search) search.focus(); return true; } insertText(key); }   // native: let the field type it
    return false;
  }
  function onHelperEvent(ev) {
    if (ev.t === 'toggle') toggle();
    else if (ev.t === 'page') { const mm = window.__musicMode; if (!open && mm && mm.canToggle() && mm.on() !== (ev.to === 'np')) mm.toggle(); }   // scroll / Alt+arrows: Clock <-> Now Playing
    else if (ev.t === 'swipe' && !open && ev.dir === 'right' && window.__musicMode?.canToggle?.()) window.__musicMode.toggle();   // the other way from Launchpad: Now Playing <-> clock
    else if (ev.t === 'swipe') { if (ev.dir === 'left') open ? (search.value ? null : goPage(page + 1)) : show(); else if (open) { page > 0 && !search.value ? goPage(page - 1) : hide(); } }
    else if (ev.t === 'key') handleKey({ key: VK[ev.vk] || (ev.ch ? String.fromCharCode(ev.ch) : (ev.vk >= 0x41 && ev.vk <= 0x5A ? String.fromCharCode(ev.vk + 32) : ev.vk >= 0x30 && ev.vk <= 0x39 ? String.fromCharCode(ev.vk) : '')), ctrlKey: !!ev.ctrl, shiftKey: !!ev.shift });   // Ctrl+letter arrives without a character
    else if (ev.t === 'paste') insertText(String(ev.text || '').replace(/[\r\n\t]+/g, ' ').trim());
  }
  let lastKey = '', lastKeyT = 0;
  addEventListener('keydown', e => {
    const now = performance.now();
    if (e.key === lastKey && now - lastKeyT < 60) { e.stopPropagation(); e.preventDefault(); return; }
    lastKey = e.key; lastKeyT = now;
    if (e.key === 'F4' || e.key === 'F16') { e.preventDefault(); e.stopPropagation(); if (!helperLive) toggle(); return; }
    if (e.key === 'F13' || e.key === 'F14') { e.preventDefault(); e.stopPropagation(); onHelperEvent({ t: 'swipe', dir: e.key === 'F13' ? 'left' : 'right' }); return; }
    if (!open) return;
    e.stopPropagation();
    if (helperLive) { e.preventDefault(); return; }                   // the helper already delivered this key
    if (!handleKey(e, true)) e.preventDefault();
  }, true);

  // prepare everything ahead of time (last list from storage paints instantly, then the fresh one)
  const cached = store.get('lpApps'); if (Array.isArray(cached) && cached[0]?.k) { apps = cached; build(''); warmIcons(); }
  loadApps().then(() => { build(''); warmIcons(); });
  setInterval(() => { if (!open) loadApps().then(() => { if (!open) { build(''); warmIcons(); } }); }, 300000);
  addEventListener('resize', () => open && glasses.forEach(g => g.animate(200)));
  fetchRates(); refreshBattery(); fastState(0); loadLayout();
})();
