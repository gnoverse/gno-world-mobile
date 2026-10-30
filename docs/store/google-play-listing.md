# Google Play: category, contact details and store listing

Play Console → "Gérer l'organisation et la présentation de votre application". The temporary name
"world.gno.app (unreviewed)" and the missing icon on the Play page last until this listing is saved and its
review passes: send it from "Vue d'ensemble de la publication" (publishing overview).

## Catégorie et coordonnées (category and contact details)

- **Type:** Jeu (game), unless the gambling decision (B2 in the [README](README.md)) says otherwise.
- **Category:** decision needed with B2. "Casino" if boops are treated as real-money gambling, otherwise a game
  category such as "Stratégie" or "Arcade".
- **Tags:** pick up to 5 in the console after the category.
- **Email (public, required):** a shared support address, not a person's.
- **Website:** `https://gno.world`.
- **Phone:** leave empty.

## Fiche Play Store principale (main store listing)

Language: English (United States) as the default. Play's blockchain policy forbids promising earnings: no "earn",
"win money" or "profit" in any text or graphic.

**App name** (30 max):

```
gno.world
```

**Short description** (80 max):

```
Play gno.world bubbles on gno.land and chat with the players.
```

**Full description** (4000 max):

```
Play the gno.world bubbles on your phone.

Follow every pool live: its clock, its boops, its roster and its rules. Boop with your flag, pick your clock, and
claim or withdraw when a bubble ends, all signed in the app.

Your gno.land account authorises this app's own session key once, with an hourly budget and an expiry you choose,
for gno.world realms only. Your main key never enters the app: you authorise the session with a gnokey command on
your computer, and you can renew or end it at any time.

Also in the app:
- the GNOT price and the players who are here right now;
- the gno.world chat: reserve your name, set a picture, reply, react and vote in polls;
- pair with your browser to bring your name and rooms along.

Play is not offered to visitors from the United States.
For players 18 and over.
```

Keep the description in step with the app: when a feature lands or goes (wallet path, rooms, notifications),
update both this text and the console.

## Graphics

| Asset | Spec (Play) | File | Status |
|---|---|---|---|
| App icon | 512×512 PNG, 32-bit with alpha, ≤ 1 MB | `assets/play-icon-512.png` | done |
| Feature graphic | 1024×500 JPEG or 24-bit PNG, no alpha | `assets/feature-graphic.png` | done |
| Phone screenshots | 2 to 8, JPEG or 24-bit PNG, sides 320–3840 px, long side ≤ 2× short side | `assets/phone-1-home.png` … `phone-5-session.png` (1080×1920) | done |
| Tablet screenshots | optional (7" and 10") | — | skip for now |

Upload the phone screenshots in their number order. All of them come from 2026-10-30; retake them when a screen
they show changes.

### Icon

The app icon resized, so the Play page matches the launcher:

```sh
sips -z 512 512 assets/images/icon.png --out docs/store/assets/play-icon-512.png
python3 -c "from PIL import Image; p='docs/store/assets/play-icon-512.png'; Image.open(p).convert('RGBA').save(p)"
```

Redo it whenever `assets/images/icon.png` changes.

### Feature graphic

The globe from `assets/brand/gno-bubble-1280.png` with the name and a tagline:

```sh
python3 scripts/store-feature-graphic.py
```

### Phone screenshots

Home, Pools, a pool, Chat and Session, taken on the Android emulator (`Medium_Phone`, 1080×2400) and framed at
1080×1920 under a caption: Play refuses a long side more than twice the short side, and 2400 is 2.22× 1080.

1. Serve the JS like a store build: `EXPO_PUBLIC_WALLET=off npx expo start --no-dev --minify` (no dev overlays, the
   wallet path shows "coming soon"), with a debug build installed and `adb reverse tcp:8081 tcp:8081`.
2. Stage the chat: `node scripts/store-shot-proxy.mjs` forwards everything to gno.world except the chat, which it
   replaces with made-up players, so no real player's name or position appears. `adb reverse tcp:8791 tcp:8791`,
   then Settings → Server URL `http://127.0.0.1:8791` → Save. Home's price, "here now" and the pools stay live (pool
   cards show shortened on-chain addresses, which are public).
3. Clean status bar: `adb shell settings put global sysui_demo_allowed 1`, then
   `adb shell am broadcast -a com.android.systemui.demo -e command enter` and `… -e command clock -e hhmm 0941`.
4. Capture each screen with `adb exec-out screencap -p > <raw-dir>/<name>.png` (names in the script), then
   `python3 scripts/store-screenshot-frames.py <raw-dir>`.
5. Put Settings back to `https://gno.world` and leave demo mode (`… -e command exit`).

No balances or payouts presented as earnings in the captions.
