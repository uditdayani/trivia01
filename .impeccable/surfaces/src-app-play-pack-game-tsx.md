---
version: 1
slug: "src-app-play-pack-game-tsx"
primary_target: "src/app/play/[pack]/game.tsx"
related_targets: ["src/app/play/[pack]/results.tsx","src/app/page.tsx"]
---

# Play screen: the daily climb

Scope: /play/[pack] while a puzzle is in progress, plus the route on home and results. Mode: Experience inside an Operate loop (answer, see result, move on). Extension of the established dusk-mountain world; no DESIGN.md change.

Audience and job: daily-puzzle, IPL and geography players answering 7 timed questions and seeing how far an unexpected answer carries them.

Constraints: question and input stay readable at all times, including under clouds; points never change after answering; route data must be real and sourced (src/lib/routes.ts).

## Direction contract

THESIS: Each day is a real climb on a real mountain, seen side-on; your answers are the effort that moves you up it, and the land itself changes underfoot. It refuses the category default of a progress bar plus a score counter, and refuses Boreen's top-down road map.

OWN-WORLD: The existing dusk palette (night, ridge blues, glacier, sign yellow, flag red, tier colours) with Big Shoulders Stencil and Commissioner. New material: vegetation bands drawn as flat silhouette layers (conifer forest, heath, scree, glacier, death-zone sky) that recolour the scene as altitude rises; camps as small tent/hut marks with stencil labels like painted trail signs; a brass-free, line-drawn field compass.

STORY: The player sees today's mountain and route by name, understands that points move the climber up the real trail, watches each answer carry them past named camps into new terrain, and leaves knowing where they stopped and what that place is.

FIRST VIEWPORT: Top band (about 40% of a phone screen): the day's mountain in profile with zig-zag trail, camps at real heights, climber at current altitude, zone name and altitude readout. Below: the question at full reading size, then a row with the answer field, Answer button and the compass timer at right. Clouds drift in over the whole screen as time runs out but sit behind text.

FORM: Side-on route profile with a camera that pans up with the climber; position 1 of 1 (pinned by the user). seed: none (pinned) "A side-on climb instead of a top-down map... Scenery that changes as you climb... make the timer in a compass and as timer runs down start clouds coming in but make sure the text is visible in front of us".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
