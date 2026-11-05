# Exchange Rates launch film

**Idea (one sentence):** The Bank of Tanzania's daily rates, which everyone copies by hand, become one free API call, so developers and bureaus see they can plug real BOT rates into anything today.
**Promise (on screen by 3 s):** "BOT exchange rates. Now a free API."
**Hook (0–3 s, sound off):** "BOT exchange rates" / "Now a free API" at 104 px (1:1) · CTA "driftmark.co.tz/exchange-rates" at 48 px, on screen from 0.6 s
**Terms (shown):** BOT exchange rates · USD to TZS · free API
**Audience · channel:** Tanzanian developers, fintech, bureau owners · X, LinkedIn, Instagram feed + Reels · muted autoplay on phones
**Spec:** 1080×1080 and 1080×1920, 30 fps, 30.0 s = 900 frames · deliverables: two MP4s, poster PNGs, a silent version

## Benchmark
- Polymarket Perps launch (the user's reference): learn the grammar — a cut every 1–2 beats, giant condensed slams, white product cards gliding in, a radial dial counting up, the paper receipt, a quiet logo end with legal small print. Don't take: their blue, their copy, their UI, their audio.
- Swiss rail departure boards / exchange tickers: learn the rolling-number rhythm and the one-line-per-item order. Don't take: split-flap kitsch.

## Structures considered
1. **Kinetic list on the beat** (slam → number → cards → code → dial → receipt → CTA), cut on beats, chapters on bars.
2. One-shape morph: the receipt never leaves; it becomes card, JSON, widget and converter.
3. Before/after: a clerk copying rates off bot.go.tz by hand, then one API call.
**Chosen:** 1, with the receipt as the bridge object in the second half, because the product is a list of capabilities and the reference the user loves is a beat-cut list. Rejected 2: too slow for a 30 s feed ad with five things to say. Rejected 3: would need a convincing person/scene we can't film.

## Dials
Clock: designed music grid, 120 BPM, 4/4, 15 bars = 30.0 s (beat 0.5 s, bar 2.0 s)
Continuity: chaptered, cut on beats inside chapters, hard cut + hit between chapters
Register: kinetic in Driftmark monochrome — 30 fps, snaps land on beats, ζ 0.8, one overshoot per chapter
Text policy: type as hero
Constant the eye holds: the black ticker strip of flags and rates along the bottom edge (1:1) / top (9:16)
Accent: there is none in the chrome; the round flags are the only colour and mean "a real currency". Rises/falls use the site's green/red only inside cards.
Type: Inter 600 for slams (tight −0.045em), Geist Mono for every number

## Arc
Hook 0–3 s: "BOT exchange rates / Now a free API" + URL
Turn at 10.0 s: from "what it has" to "how simple it is": `GET /api/latest.json`
Hero moment = payoff at 20.0 s: the receipt prints the real latest rates and the BOT date stamp thunks onto it (the one native move: the receipt tears off and becomes the bureau's website widget at 22.5 s)
Arc quantity: USD/TZS on the dial, 740.00 (24 Jun 1999) → 2,640.37 (5 Nov 2026)
Ending answers the opening: the opening promised "free API"; the ending shows the one URL and "Free. No key." on the same black ground
Actions that must be seen: the API call typed, the JSON arriving, the counter rolling, the receipt printing, the stamp landing, the widget appearing, the converter computing

## Beat sheet
| # | t | What happens | Reads | Cued to | Transition out | Sound |
|---|---|---|---|---|---|---|
| 1 | 0.0–2.0 | Black. "BOT exchange rates" / "Now a free API" slam in; URL beneath; ticker strip starts | hook, URL | bar 1 beat 1 | hard cut | kick + sub hit |
| 2 | 2.0–4.0 | "44 currencies" — the number rolls 0→44 while round flags pop into a grid | 44 currencies | beats 5–8 | cut | ticks on flag pops |
| 3 | 4.0–6.0 | White. "Every day from bot.go.tz" and the BOT stamp | source | bar 3 | cut | stamp thunk (soft) |
| 4 | 6.0–10.0 | Rate cards glide past (USD, EUR, GBP, KES, UGX) with real values + 30-day lines | each card ~0.8 s | beats | cut | whoosh per card (every other) |
| 5 | 10.0–12.0 | Black. `GET /api/latest.json` types out | the call | bar 6 (turn) | cut | key clicks |
| 6 | 12.0–14.0 | JSON streams in; the USD row lights up | JSON | beats | cut | data blips |
| 7 | 14.0–19.5 | Radial dial: USD/TZS counts 740.00 → 2,640.37, "since 1999" | dial value, label after stop | bars 8–10, build | cut to silence | riser |
| — | 19.5–20.0 | Silence | | | | none |
| 8 | 20.0–22.5 | HERO: receipt prints latest BOT rates; stamp lands at 20.5 | receipt, stamp date | drop | tear | loudest hit + print chatter |
| 9 | 22.5–24.5 | The receipt tears off and becomes the widget on a bureau site ("We buy / We sell") | widget | bar 12 | cut | paper tear |
| 10 | 24.5–26.0 | Converter: 100 USD = 264,037.38 TZS | conversion | beats | cut | ticks |
| 11 | 26.0–28.0 | Black. "Free. No key." + driftmark.co.tz/exchange-rates | CTA | bar 14 | cut | final hit |
| 12 | 28.0–30.0 | Driftmark mark + disclaimer small print, still | brand, disclaimer | bar 15 | end | tail |

## Sound plan
Source: score synthesized from the timeline (designed grid, owned outright) + sound design, OR a royalty-free track the user approves.
Silence 19.5–20.0 · loudest hit 20.0 (payoff) · build bars 8–10 · SFX: kick/sub (slams), clicks (typing, ticks), paper (print, tear), stamp thunk.

## Truth
On-screen numbers from FACTS.md; rates are the real BOT values for the latest date at render time. Bureau widget is labelled "Example". Disclaimer on the final card.

## Risks / least-sure-about
Synthesized music will sound clean but simpler than a produced track. The 9:16 layout needs its own composition for the cards and dial.
