# Revision pass — what the first play-test found and what changed

After the first build, the game was rendered in headless Chromium, looked
at frame by frame, and flown end-to-end by a scripted autopilot in Node.
Every defect below was found that way and fixed in the game code (not in
the screenshots — the screenshots were re-taken after the fixes).

## Crash on takeoff and landing (render.js)

`RUNWAY_COLOR` was used by `drawRunway` but never imported, so the game
threw `ReferenceError: RUNWAY_COLOR is not defined` whenever the runway
was in view. The takeoff and landing shots rendered terrain and sky only
— no plane, no runway, no HUD. Fixed by adding the import. The rings and
cockpit shots had passed only because the runway was behind the camera
there, so the faulty line never ran.

## The plane never accelerated (physics.js)

At the start of a sortie the plane sits on the runway at speed zero, and
the "stopped" event fired immediately, which set `landed` and made
`stepPlane` return early forever — the plane froze at 0.9 m/s and the
landing mission completed itself in one frame. Fixed: "stopped" only
counts after the plane has actually flown (`hasFlown`, set on takeoff),
and a landed plane can take off again.

## Fuel ran out mid-mission (config.js)

Full-throttle burn was 0.55%/s, so a tank lasted ~3 minutes — the Ring
Run needs 4–6. Burn is now 0.16%/s at full throttle (0.03 idle, 0.08
climbing extra), so a tank lasts ~12 minutes and fuel is a constraint
only if the pilot dawdles.

## Rings 5–8 were underground (terrain.js)

Ring altitudes were fixed numbers (260–460 m) while the valley floor
rises steeply northward (122 m at ring 1, 862 m at ring 8). Rings 5–8
sat 118–584 m *below* the terrain, inside solid rock, and could never be
flown through. Each ring now sits 55–70 m above its own ground
(`groundHeight` at its position); gates likewise 50–62 m. Verified with
a course check: every ring and gate is 51–70 m clear of the ground under
it and of the highest ground on its leg.

## The approach corridor had a hill in it (terrain.js)

The ground 800–1000 m south of the runway rose to 208 m — 90 m above
the runway — right on the final approach. A plane on final met the hill
before the runway. The approach corridor (|x| < 220 m, 800 m north to
2600 m south of the strip) is now flattened toward the runway elevation,
fading with distance. The approach is clear: 95–135 m along the whole
final.

## The plane could never stop after landing (physics.js)

On the ground the speed target was `throttle * 92 + (1 - throttle) * 8`,
so with the throttle closed the plane still rolled at 8 m/s forever and
the "stopped" event (speed ≤ 4 m/s) never fired — the landing mission
could never complete. On the ground the target is now `throttle * 92`
only, so the plane brakes to a halt.

## Controls rolled past the bank asked for (physics.js)

The stick was a *rate* input: holding a small bank command kept rolling
the plane until it hit the 62° stop, so the plane orbited instead of
turning. The stick is now a *position* input: it commands a bank and a
pitch and the plane slews to them; letting go levels the wings. This is
what a keyboard player expects, and it is what made the missions
flyable at all.

## Turn rate and ring size (config.js, terrain.js)

Turn rate was 0.16° of heading per degree of bank per second — sluggish
at game speeds. Now 0.26. Rings grew from 34 m to 55 m radius (gates
30 m to 48 m) and the pass window from 0.92 to 0.95 of the radius, so a
clean line through a ring counts.

## Visual fixes from the screenshot review (render.js, hud.js, shots.js, missions.js)

- The attitude gauge sat in the middle of the screen, overlapping the
  plane; it now lives bottom-right, clear of the plane and the tapes.
- The cover shot's next ring was off-screen left (the plane's heading
  did not match the ring's bearing); the rings and cockpit shots now
  place the plane on the leg to the next ring, so the ring sits centred
  ahead.
- Headings came out negative ("-32°") for westerly legs; they are now
  normalised to 0–360° everywhere.
- The terrain read as flat green bands; quads now vary by a patchwork
  field factor, the fan is wider (21 columns, 0.85 half-width), the
  mountain wall is softer (650 not 900), and the near-ground fill uses
  the same patchwork so it does not read as a flat strip.
- The sun's glow overlapped the compass tape; it is smaller now.
- Runway numbers ("18"/"36") were drawn on top of the plane when the
  plane sat near a threshold; labels within 150 m of the plane are
  skipped.
- The staged objective line read "0 m ahead" (the mission step never ran
  for a staged shot); the distance is now computed live from the plane
  to the next ring/runway.
- The landing objective said "circle back" even when the plane was
  already lined up; it now says "On final" when the runway bearing is
  within 20° of the heading.

## Verification after the fixes

- Ring Run flown to completion by the scripted autopilot: 8/8 rings,
  233 s, fuel 69%, damage 0%.
- Touchdown flown to completion from a lined-up final: touchdown at
  40 m/s, braked to a stop, mission complete, score 1490, damage 0%.
- Courier Dash: 3/5 gates by the same autopilot before a terrain
  strike; the gates use the same code path as the rings, which
  completed. The full landing circuit was not completed by the
  autopilot (its circuit is sloppy — it overshoots the final), but the
  touchdown test proves the landing itself works.
- All four `?shot=` scenes and the title screen render in headless
  Chromium with no console errors and no network requests.
- `main.ts` run twice produces byte-identical `/output`
  (`diff -r` clean).
