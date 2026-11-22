# Shadow Wallpaper

A live wallpaper for Windows 10/11: monochrome stripes that move with your mouse and bounce to your music, a liquid-glass clock, a Mac-style Launchpad with a smart search bar, and Apple Music-style live lyrics.

Runs on [Lively Wallpaper](https://www.rocksdanister.com/lively/) (installed for you if it's missing).

## Install

```powershell
winget install jeetkapiljain5-max.ShadowWallpaper
```

Or download `Shadow-Wallpaper-Setup.exe` from [Releases](../../releases) and run it. It installs for your user only (no admin).

> **Tip:** for the cleanest look, pair it with [TranslucentTB](https://github.com/TranslucentTB/TranslucentTB), which makes the taskbar see-through:
> `winget install CharlesMilette.TranslucentTB`

## What it does

**Wallpaper**
- Stripes that drift with the mouse, ripple when clicked and bounce with whatever is playing.
- A liquid-glass clock and date. Click the clock for a focus timer.

**Launchpad** — on the desktop, double-tap Space, press F4, or swipe sideways with two fingers
- All your apps in a grid, sorted by how much you use them. Drag to rearrange, make folders, uninstall.
- The search bar answers things: maths, currency (`200 aed in inr`), units, world time, weather, `define`, `wiki`,
  translation (`hello in japanese`), timer, stopwatch, settings, media keys, web search.
- Music: `play` + any song, album or playlist plays it in YouTube Music.

**The Windows key** — opens Launchpad right over whatever you're doing (Win + any other key still works as normal)
- It pours up out of the bottom of the screen like the macOS genie, on its own live frosted glass; click outside it to close.
- Hover its bottom-right corner for power: sleep, lock, restart, shut down.
- Want Start back? Hover the bottom-right corner of the desktop Launchpad and click the Windows logo
  (blue = Windows' own Start, soft black = Launchpad). Ctrl + Esc always opens Start.

**Now Playing** — pick a song in the search (or just play one in YouTube Music, Spotify, ...)
- The clock turns into the cover, with time-synced lyrics underneath: YouTube Music's own synced lyrics for
  YouTube Music, [LRCLIB](https://lrclib.net) for everything else.
- Music videos and live performances play as the video itself (muted, in step with the music) in the middle,
  shaped to the video with no black bars.
- The light in the stripes takes the colours of the cover - or, for a video, of what's on screen right now, stripe by stripe,
  like the LEDs behind a TV.
- Play / pause / next / previous on hover. Swipe the other way from Launchpad to switch between the clock and Now Playing.

**Optional: your own YouTube Music library** — playlists and likes in the search. You create a free Google OAuth
"Desktop app" client (YouTube Data API v3), save its JSON as `google-client.json` in the app's `helper` folder,
then search `sign in to youtube music`. Your sign-in stays on your PC, encrypted with your Windows account.

## Fonts

The clock and Launchpad use Apple's SF Pro. It is **not** included: after install the app downloads it from
Apple onto your PC (about 220 MB, in the background). Until then, similar Windows fonts are used.

## Privacy

Everything runs on your PC. The helper listens only on `localhost`, protected by a random key made at install.
Network use: lyrics (LRCLIB), currency rates, weather, dictionary/Wikipedia/translation look-ups you type,
YouTube Music search and lyrics, YouTube (video player, preview frames), Apple (font download), and Google only if you sign in.

## Uninstall

Windows Settings → Apps → Shadow Wallpaper → Uninstall (or `winget uninstall jeetkapiljain5-max.ShadowWallpaper`).
