# The YOURS guide

> This is the deep dive: how every window, widget and secret works, and the
> reasoning behind it. For the short version — what the project is and how to run
> it — see the [README](../README.md).

It is a **safe space on the web**: hand-built, a little hacky, vibrant neon on
a deep dark background, with a solarpunk heart — and a settings file, because a
place only feels like yours when you can rearrange the furniture.

Built with **Svelte 5** + **Vite**, styled with plain CSS (custom properties,
`color-mix`, gradients — no CSS framework). Two small runtime dependencies
beyond Svelte: **perfect-freehand** (the doodle pad's tapered strokes) and
**Trystero** (the sticky notes' peer-to-peer link, pulled in as a lazy chunk).

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
npm run preview  # serve the build
```

## Deploy it

The page is fully static, so hosting it is just "serve some files". The
`Dockerfile` builds the app once and ships only nginx plus the built output —
nothing runs node at runtime.

```sh
docker build -t yours-home .
docker run --rm -p 8080:80 yours-home
```

The image is just nginx plus the built output — small on disk, and quiet when
idle.

`nginx.conf` fingerprints the cache: everything under `/assets/` is
`immutable` for a year, while `index.html` always revalidates. A repeat visit
costs a conditional request and nothing else.

### On a server

The container speaks plain HTTP on port 80 and expects something in front of it
to terminate TLS — a reverse proxy, a PaaS, or a load balancer. There is no
certificate handling inside the container, so point your proxy at port **80**.

A few things worth knowing:

- Give the container a little headroom: ~64 MB of memory and 0.25 CPU is plenty.
  nginx will never come close.
- The `HEALTHCHECK` in the Dockerfile lets a host tell "serving" apart from
  "started".
- If you build on a small box, note that `npm ci` plus a Vite build peaks at a
  few hundred MB of RAM for a few seconds. Build the image in CI and pull it
  from a registry if that is tight.
- The fonts are self-hosted, so your server serves them too — no third-party
  request, no second TLS handshake. That is the intended trade-off: a little
  more traffic through your box in exchange for owning every byte and depending
  on nobody.

## What's on the page

The layout is a **frameset**, not a landing page: a persistent left rail beside a
scrolling column of windows, the way a personal homepage was shaped from 1996 to 2003. Everything is dense, bordered, and visible at once — no scroll-reveal, no
hero-then-sections rhythm.

- **Boot screen** — a fake `YOURS-OS` POST sequence. It types itself out and
  then waits: **space**, **enter**, or a click lets you in.
- **Status strip** — a thin bar with the live clock and a solar tag.
- **Masthead** — the name `YOURS` as a banner with a hover glitch, beside an
  animated sun-and-vine emblem. A small `weather.dat` gadget is parked to the
  right of the name; it reads the sky from Open-Meteo — on click, or quietly on
  arrival once a place is already set.
- **Marquee** — the classic scrolling announcement ticker. It is two tracks of
  one copy each rather than one track of two copies, so the composited layer
  stays small.
- **The light** — the room follows your clock: a warm wash at dawn, a clear
  light through the day, a magenta dusk, a deep violet night. It is mixed from
  the **theme's own** accents, so it retints with the palette rather than
  fighting it. Turn it off in `settings.cfg`.
- **The rail** — the site map and a `currently` box.
- **welcome.txt** — the point of the page: a note to whoever arrives, and a
  button that opens the settings file. Come back after a while and it also says
  how long it has been — a warm nod, nothing more.
- **whats_new.txt** — a dated changelog window.
- **wild_encounter.dat** — one random Pokémon a day, rolled from PokéAPI on
  click, with a 1-in-4096 chance it is shiny. It arrives as a **silhouette**
  first: name it before you peek, and a right guess grows a streak (a wrong one
  starts it over). What you meet can be kept in a party of six (replace one when
  it is full), stored in your browser only and shown open by default.
- **pokedex.dat** — every Pokémon you have met, as a small grid of 1025,
  opened as a **modal from `wild_encounter.dat`** rather than a section of its
  own: the dex only means anything next to the grass you roll in. An unseen
  entry is a `?`; a met one shows its sprite, with a green corner if you kept it
  and a gold glow if it was shiny. Filter by generation, or show only what you
  have seen, caught or met shiny. It fills one encounter a day, so it is a slow
  record rather than a checklist.
- **trivia.dat** — one question at a time from Open Trivia DB, on click. It can
  ask multiple-choice or true/false questions (or mix the two), marks your answer
  right or wrong, and pulls a fresh one whenever you like.
- **doodle.dat** — a small pad you can draw on, with a few colours, three nibs,
  an eraser, undo, and a save-as-png. It keeps your drawing in this browser, and
  it is stored as **strokes** rather than an image, so it retints with the theme
  and survives a resize.
- **The cassette deck** — a small tape player docked in the bottom-left corner,
  and it plays **your** music: paste a youtube link and the deck frames youtube's
  own player. Nothing loads until you press play, so a visitor who never touches
  it pulls zero third-party bytes. Press `✕` to forget the link and the frame goes
  with it.
- **fingerprint.txt** — what a tracker could learn about you, laid out plainly,
  then a note that none of it left the tab. See below.
- **The cat** — a GIF cat parked in the bottom-right corner. It pads along in
  place and every so often breaks into a run; click it and it tells you a cat
  fact.
- **The notebook** — a notebook tucked under the left edge of the screen. Only
  its fore-edge shows until you hover, and clicking it opens a drawer with a
  ruled page you can write on. It autosaves, and any page can be **sealed** —
  hidden until a future day you choose. It is _not_ part of the config — see
  below.
- **The sticky notes** — a sticky note stuck to the **right** edge of the
  screen. The page joins the room on arrival, so you can pass one short
  anonymous note a day to a random person who is on the page at the same time;
  it travels browser to browser and no server keeps it. See below.
- **Footer** — colophon, a hint that something is hidden, and the page-weight
  badge.

## The windows

Every panel carries the little `_ □ ✕` cluster in its title bar, and they are
real buttons now. `_` reduces a window to its bar alone, `□` restores it, and
`✕` closes it — the section leaves the column entirely.

The state lives in the config (`windows`), so it is remembered across reloads,
travels with an exported "home", and — the point of it — a closed section is
never lost: `settings.cfg` lists every window with its state and a **restore**
button. Unknown values fall back to `open` when a config is read, so a
hand-edited file can never leave a section stuck invisible.

The column is yours to arrange too. Take a window by its title bar and drag it:
it follows the pointer past its neighbours, and the order is kept in the config
(`order`) beside the window states. `settings.cfg` has a **reset** for it. The
drag swaps one neighbour per pointermove — a single step can never bounce back,
because the neighbour it has just passed has moved out of the way — and the
update is flushed synchronously, so the next move reads the new geometry rather
than the old. Touch keeps its scroll: the bar is too big a target to swallow it.

The site map in the rail follows the column: the same order, and nothing that has
been closed. So the map is never a list of places that are no longer there.

`synth.exe` keeps its inert `_ □ ✕` marks: it is a separate page, so there is
nothing there to reduce, close, or move.

## The page-weight badge

There is no library for this: a library that measures how light your page is
makes your page heavier. So the meter is split in two.

**At build time** (`vite-plugin-weight.js`) a Vite plugin measures every
emitted asset — raw and gzipped — and bakes the total into the bundle as a
virtual module (`virtual:weight`). Because the number lives inside the bundle
it measures, writing it changes it; the plugin settles that with a few
fixed-point passes (write, re-measure, repeat) instead of guessing at the
delta. It also prints a table at the end of `npm run build`.

**At runtime** (`src/lib/weight.js`) the badge reads the browser's own Resource
Timing ledger — `transferSize` per request — and buckets it into
html / css / js / fonts / other. The fonts are self-hosted, so they are
same-origin and always measurable. A cached resource reports `0`, so a warm
reload reads lighter than a cold one; that is why the badge falls back to the
build-time number when nothing has been measured yet.

The badge sits in the footer colophon. Click it for the per-bucket breakdown.

## The notebook

The notebook (`src/lib/Notebook.svelte`) is the one thing on the page that is
**not** part of the config. A config is meant to be downloaded and handed to a
friend, and your notes should not go with it. So the notes live under their own
`localStorage` key (`yours.notes`) and are never touched by export, import, or
reset.

It is a single freeform page with a debounced autosave and a `saved ✓` that
fades out. The ruled lines are a `repeating-linear-gradient` on the textarea
with `background-attachment: local`, so they scroll with the words instead of
sitting still under them. The whole thing is CSS and one `<textarea>` — no
editor library, no dependencies.

A page can also be **sealed**. Write something, hit _seal this page for later_,
pick a day, and the page is moved out of the textarea and into a locked card
that shows only its date and a countdown. On the chosen day the card opens by
itself and reveals the words, with two ways out: _move to the page_ (it goes
back into the textarea) or _burn it_ (a two-tap delete, the same courtesy as
clearing the page). A sealed card can be burned at any time, even before it
opens — the countdown is only a promise. Sealed pages ride in the same
`yours.notes` payload, so the whole notebook stays one key. The payload is
`{ body, sealed }`; the very first version stored the page as a bare string, and
`load()` still adopts that shape, so an older notebook is not lost.

The tab is a fixed element parked at `left: 0` and pushed 98px of its 132px
width off-screen, so only the fore-edge shows; hovering slides it out with a
`transform`, which keeps it on the compositor. Below 1200px the tab would
collide with the rail, so it hides itself and the site map carries a `notes ✎`
entry instead.

## Sticky notes

The sticky notes (`src/lib/StickyNotes.svelte`, `src/lib/notes-net.svelte.js`)
are the one part of the page that talks to **another browser**. A sticky note is
a short anonymous message — up to 280 characters — that you can pass to one
random person who happens to be on the page at the same moment. One a day. It
goes straight from your browser to theirs and is never stored on a server,
because there is no server.

The tab is a sticky note stuck to the **right** edge of the screen — a square of
paper, folded at the corner, most of it off-screen until you reach for it.
Clicking it opens a **modal** built around the note itself: a square of yellow
paper, taped at the top, that you write on and send. Below it sit the notes that
found you, each a small sticky note of its own; click one and it opens on its
own as a single read-only note — the same paper, no chrome around it. When a
note lands, a toast slides in at the top-right; click it and the modal opens on
the note. A note you have not read yet shows as a count on the tab.

The page joins the room **on arrival** — there is no **go online** button to
press. Joining means the page reaches **Trystero** (`trystero`), which uses the
public **Nostr** network as a signalling relay to introduce two browsers, then
hands the actual conversation to **WebRTC** — a direct connection between the
two. Trystero shuffles its own default relay pool by the app id and dials a
handful of them, so every browser lands on the same relays without the app
naming any; a relay that is down is retired and the next one tried. The relay
only carries the handshake; the note itself never touches it. Trystero is a lazy
chunk of its own, pulled in when the page joins, so the rest of the page still
loads without it. If you would rather not be reachable, the **step away**
button in the modal's foot leaves the room.

A room is a **full mesh** — every peer connects to every other — so it is
**capped at twenty peers**, and a bigger crowd spills into the next shard
(`lobby-0`, `lobby-1`, …). Everyone tries `lobby-0` first, so a small crowd
still lands in one room together and only a real crowd spreads out.

Your identity is a **keypair**, not an account. On first use the page makes an
ECDSA P-256 key in the browser (`crypto.subtle`) and keeps it in `localStorage`
(`yours.sticky.key`). The public key is the whole of who you are here: no name,
no email, no sign-in. Every note is signed with it, and a receiver checks the
signature before it shows anything — so a note cannot be forged, moved to
another day, or edited in flight. The key survives reloads; the peer id does
not. (`crypto.subtle` needs a secure context, so this works on `https` and on
`localhost`; anywhere else the modal says so and stays offline.)

The rules are all the **receiver's**, because there is no server to hold anyone
to them:

- a note must be signed, and dated today (UTC, so two people in different
  timezones agree on what "today" means);
- a note must be 280 characters or fewer;
- one note per sender per day — a second one from the same key is dropped;
- a receiver takes at most **three** notes a day, which bounds how much can
  arrive at once;
- a sender who has told the room they are already spent is not believed if a
  note arrives anyway;
- anyone you **block** is ignored from then on, and their notes leave the inbox.

The inbox keeps the last fifty notes, newest first, each with a **block** button
and the first few characters of the sender's key so two strangers can be told
apart. Notes are rendered as text only — never as markup — so a note cannot
inject anything into the page. The whole thing lives under `yours.sticky.state`
and, like the notebook and the trophies, is not part of the config.

### What this cannot do

The honest list, because a backend-less design buys its freedom with limits:

- **The one-a-day rule is a soft limit.** It is enforced by the receiver, and a
  modified client can simply make a fresh keypair — a new identity, a new quota
  — as many times as it likes. A signature proves a note is _from_ a key; it
  cannot prove the key is a person.
- **The receiver cap bounds the volume, not the sender.** Three notes a day is
  the most any one browser will accept, but nothing stops a determined sender
  from writing to many browsers.
- **Peers can see each other's IP addresses.** That is inherent to WebRTC — a
  direct connection needs a direct address. The relay never learns the note, but
  the two browsers do learn where each other are.
- **Roughly 10–20% of people may not connect at all**, behind strict NATs and
  firewalls that refuse a direct path. A TURN relay fixes this, but a free one
  is not configured here; without it, those visitors simply see nobody online.
- **Peer ids change on every load.** Only the keypair is continuous, so a
  "sender" is remembered by their key, not by their connection.
- **The "spent" broadcast is only heard by whoever is online at that moment.**
  Someone who joins later never learns that a peer already sent their note
  today; the receiver-side rules are what actually hold the line.
- **A crowd is spread across shards, so you may not meet everyone.** A room is
  a full mesh — every peer connects to every other — so it is capped at twenty
  peers and a bigger crowd spills into the next shard. Everyone tries the first
  shard, so a small crowd stays together; but once rooms fill, two people on the
  page at the same time can land in different shards and never meet. Without a
  matchmaking server there is no way to have both a small mesh and a single
  room.

## The trophy cabinet

The cabinet (`src/lib/Trophies.svelte`, `src/lib/achievements.svelte.js`) is a
quiet set of achievements for the things you can do here — arriving,
poking the sun, finding `VINE.EXE`, cutting a take on the synth tape, meeting a
shiny, meeting a legendary or a mythical or a baby, filling a party, naming one
of them, answering a trivia question, keeping a trivia day-streak, naming a
silhouette (and five or ten in a row), drawing on the doodle pad and rubbing it
out, passing a note to a stranger, receiving one, and so on. A shelf in the left
rail shows the icons you have lit and a count; opening it shows the whole
cabinet.

Like the notebook and the party, trophies are **not** part of the config. They
live under their own key (`yours.ledger.v1`) and are never touched by export,
import, or reset — handing your "home" to a friend does not hand over your
history in it.

The list is **signed**, the same way the party is (see `sign.js`): the stored
payload is `{ d, s }`, where `d` is the JSON string of the ids and `s` is an
HMAC over it. A hand-edit in devtools that adds a trophy breaks the signature,
and the whole list is then treated as tampered and read as empty. The key name
is unrelated to "trophy", and the ids are not even a readable array in storage.
It is a lock on a cupboard, not a vault — but the casual edit no longer sticks.
The list is also filtered to known ids on read, so an unknown name is dropped
even if it were signed.

The cabinet window itself is teleported to `<body>` (a small `portal`
action), because the rail is `position: sticky` and would otherwise trap the
fixed veil behind the main column.

A trophy you have not earned is shown **dark**: its icon is dimmed and its name
is visible, but its description is hidden and only a one-line hint is offered.
Earning one lights it up, reveals the flavour text, and slides a small toast in
at the bottom-left. `unlock()` is idempotent, so any feature can call it freely
without worrying about double-counting.

Hydration is **async** — the list is signed, and the HMAC is async — so the
stored ids are not there for the first moments after load. An unlock that
arrives in that window (the cached weather reading, the small-hours visit) is
held in a small queue rather than acted on against the still-empty list, and is
decided once the stored list lands: if the id is already in storage it is
dropped silently, otherwise it is added and toasted. Without this, an unlock
fired before hydration saw an empty list and toasted a trophy you had earned
long ago on every single load.

## The widgets

Several small things are worth documenting here. Most of them reach outside the
page, and every one of those is **click-to-load**: nothing is requested until you
ask for it.

- **The cat** (`Cat.svelte`) is two GIFs (`cat-walk.gif`, `cat-run.gif`) and
  some CSS — no library. The walk cycle loops as the resting pose; a timer swaps
  in the run cycle for a second or two every 5–16s. Clicking it fetches one cat
  fact from `catfact.ninja` and shows it in a speech bubble. The run sprite is
  warmed on idle so the first burst doesn't flash, which keeps it off the
  critical path.
- **wild_encounter.dat** (`WildEncounter.svelte`) rolls a random Pokémon. It
  fetches the PokéAPI _list_ endpoint (`?limit=1025`, ~50 kB of names) once and
  caches it, then builds the sprite URL from the id in the entry. It never touches
  `/pokemon/{id}` — that response is ~50 kB _per Pokémon_, which would dwarf this
  whole page.

  It is **one encounter a day**: the roll is stamped with the visitor's local
  date and kept in `localStorage`, so a reload shows the same Pokémon and the
  button reads "met today's pokemon" until tomorrow. Each roll has a **1-in-4096**
  chance of being shiny, which swaps the sprite for the `shiny/` variant and
  turns the encounter screen gold.

  The encounter is a **guessing game**: it arrives as a pale silhouette (the
  sprite run through `brightness(0) invert(1)`), and you type a name before you
  peek. The comparison is loose — lowercase, punctuation and spacing stripped —
  so `mr. mime`, `Mr-Mime` and `mrmime` all count. A right guess grows a
  **streak**, a wrong one resets it, and the best run is kept; the streak
  survives the day turning, because it is a run of days, not of one visit. The
  verdict itself is visit-only. `reveal` gives up and shows the answer.

  What you meet can be **kept in a party of six**, under its own
  `localStorage` key — like the notebook, it is not part of the config, so
  exporting your "home" never carries your pokémon with it. When the party is
  full, keeping a new one asks which to let go. The party is **open by
  default**; its sprites load lazily as you reach them, so a saved party never
  breaks the "nothing loads on its own" rule.

  A party member can be **renamed** — click its name in the slot and type. The
  nickname is a separate field from the species name, so it survives the signed
  round-trip without touching the dex number or the shiny flag (both re-derived
  from the seed). Clearing the field, or typing the species name back, drops the
  nickname and the slot shows the species again.

  The storage (`encounter-store.js`) is awkward to hand-edit. The shiny flag
  and the dex number are **never read back** — only a random _seed_ is stored,
  and the encounter is re-derived from it, so flipping `shiny: true` in devtools
  does nothing. The party and the name are covered by an **HMAC**
  (`crypto.subtle`, the helper shared with the trophy store in `sign.js`), so
  appending or editing a pokémon without re-signing the whole payload fails
  verification and the store is treated as tampered and wiped. The key is in the
  bundle, so anyone who reads the source can reproduce it. The goal is only that
  a casual `localStorage` edit no longer sticks. Where `crypto.subtle` is
  unavailable (an insecure context) it falls back to unsigned reads rather than
  break the page.

- **pokedex.dat** (`Pokedex.svelte`) is the record of every Pokémon you have met,
  opened as a **modal from `wild_encounter.dat`** (the settings.cfg dialog
  pattern: a veil, a Tab trap, Escape to close, the page behind held still). It
  shares the encounter's storage and its reactive state (`encounter.svelte.js`),
  so a roll in `wild_encounter.dat` appears here without a reload. Three sets of
  dex numbers are kept — **seen**, **caught** (ever kept in the party) and
  **shiny** — each stored as a **bitset**: one bit per dex number, base64'd, so
  all 1025 entries cost about 172 characters rather than a few kilobytes of json.
  They are covered by the same HMAC as the party.

  Drawing the grid costs **no requests**: a sprite is derived from its dex number,
  and an unseen entry renders a plain `?`, so the number of image requests equals
  how many you have actually met, not 1025. The one request is the PokéAPI _list_
  endpoint, shared with the encounter window and used only for the tooltips. The
  filters are free too: generation is not in the list response, but it is just a
  range of national-dex ids (`1–151`, `152–251`, …), so it is derived rather than
  fetched. The grid is capped in height and scrolls, and sprites load lazily, so
  opening the dex never pulls the whole dex down at once.

- **trivia.dat** (`Trivia.svelte`) asks one question at a time from **Open Trivia
  DB**, picked for the same reason as Open-Meteo: no key, no account, no signup.
  It serves both kinds of question — `multiple` (four answers) and `boolean`
  (true / false) — so the widget has a small switch for the type, plus a mixed
  mode that picks one at random each time. A question is about a kilobyte, and
  nothing is fetched until you press the button.

  The API answers in html entities by default; the widget asks for
  `encode=url3986` instead and unwraps it with `decodeURIComponent`, so an
  apostrophe or an ampersand arrives intact. It rate-limits to roughly one
  request a second and reports that as `response_code 5`, which the widget shows
  as a friendly "slow down" rather than an error. The running tally is per visit
  and not stored, so the streak and the "ten right" trophy are earned in a single
  sitting rather than accumulated. The **day-streak** is the one thing kept
  between visits: the run of days on which you got at least one right, under
  `yours.trivia`. A wrong answer does not break it — only a missed day does — and
  the chip goes quiet once the run has lapsed, so it reads as a reason to come
  back rather than a number you did not keep.

- **doodle.dat** (`Doodle.svelte`) is a small drawing pad, and it makes **no
  network requests at all**. It stores **strokes**, not a bitmap: each is a
  colour token, a width, an eraser flag, and a list of points in 0..1 space, so
  the drawing survives a resize and a theme change retints it (the token is
  resolved to the live CSS variable at paint time). It lives under its own key
  (`yours.doodle`) and is **not signed** — it is your own art, and the only
  thing a hand-edit could do is change what you drew. Strokes and points are
  capped, and every stroke is sanitised on load, so a corrupt payload cannot
  wedge the pad. `save png` rasterises the canvas to a download.

- **weather.dat** (`Weather.svelte`) reads the sky from **Open-Meteo**, picked
  because it needs no key, no account and no signup — so there is no secret to
  leak and no dashboard quietly watching usage. It is one GET, and the response is
  under a kilobyte. The location comes from the browser's own geolocation,
  requested only when you click the widget, so the permission prompt never appears
  on its own; decline it and the widget falls back to typing a city (Open-Meteo's
  geocoding endpoint). The last reading, and the coordinates behind it rounded to
  two decimals (~1 km), are kept in `localStorage` under `yours.weather`.

  Once a place is set, the sky is read again **on arrival** — quietly, with the
  cached reading still on screen until the fresh one lands, and if the request
  fails the old number stays rather than blanking to an error. This is the one
  widget that reaches the network on load, and only because a place is already
  known: with nothing set, it stays click-to-load and the permission prompt never
  appears on its own.

- **synth.exe** (`Synth.svelte`) is the odd one out: it makes **no network
  requests at all**. It is a playable one-octave synth built on the Web Audio API,
  which ships with the browser, so it costs zero dependencies and zero bytes over
  the wire. The `AudioContext` is created lazily on the first note, never on
  mount, because browsers block autoplay. It also has a **tape**: hit `rec`, play,
  and it stores the notes you played as `{ n, t, d }` events under `synth.tape`,
  then replays them through the live voices. It is a re-performance, not an audio
  recording — a take is a few hundred bytes, and it plays through whatever the
  knobs say now.
- **The cassette deck** (`Cassette.svelte`, `music.js`) is the one widget that
  plays **the visitor's own music**, and the one place the page will frame a
  third party — but only ever because someone asked it to. You paste a youtube
  link; we parse it down to a kind and an id and rebuild the embed url ourselves,
  so a hand-edited config can never point at an arbitrary iframe. The frame is
  **not in the page until you press play**, and `✕` takes it back out, so the deck
  costs nothing until you use it. The transport keys stand on top of the deck
  (play, stop, change, forget), the shell holds the screen, the reels turn while
  it plays, and the deck publishes its height as `--deck-h` so the trophy toasts
  stack above it rather than behind it. The `▾` key folds the deck down to its
  head bar — the frame is clipped, not removed, so the music keeps playing while
  it is tucked away. Youtube plays in full, no sign-in needed, and the embed uses
  the `youtube-nocookie` host so it holds off on cookies until playback.

This is a real tension with the "own every byte" principle above, so it is worth
being precise about the trade-off:

- The requests are **opt-in**, so a visitor who never clicks still pulls zero
  third-party bytes.
- The cat fact is tiny. The Pokémon list is not, but it is fetched once per
  session and cached in memory.
- The sprite image comes from a **GitHub mirror** (`raw.githubusercontent.com`),
  not from PokéAPI itself. That is a third-party image request, and it is the
  one place the page reaches outside its own origin without you asking. (The
  cassette deck reaches further, but only to youtube and only when you press
  play.) If you would rather not, the widget can render the name and dex number
  as text only.
- The page-weight badge counts all of this in its `other` bucket, which is the
  honest outcome: the badge measures what actually happened on your visit.
- The weather widget is the only thing on the page that learns _where_ you are,
  and it only does so after you ask. Those coordinates go to Open-Meteo and
  nowhere else, are rounded two decimals before they are stored, and sit in this
  browser's `localStorage` — never on a server of ours, because there isn't one.

## fingerprint.txt

`fingerprint.txt` (`src/lib/Fingerprint.svelte`) is the mirror held up to the
page's own promises. It reads a handful of things every browser hands over
without a prompt — core count, screen size and pixel ratio, timezone and locale,
colour depth, HDR and wide-gamut support, the reduced-motion and colour-scheme
preferences, the network shape, the rendering engine, and the `DNT` / `GPC`
signals — and lays them out as a table of contents.

Each line is dull alone; together they add up to a short **fingerprint id**,
computed from the stable signals (FNV-1a is enough — a fingerprint only needs
to be stable) and shown in the pixel font. The window then says plainly that
none of it left the tab. There is no request, no cookie, and no server to
receive it — the id is recomputed on every visit and never stored.

It is **not** click-to-load, unlike the widgets above, because it makes no
request at all. Rows the browser cannot answer simply drop out —
`deviceMemory` and `navigator.connection` are Chromium-only, and Firefox removed
the battery and network APIs — so the list comes up shorter rather than showing
a column of `n/a`. The one asynchronous value, `navigator.storage.estimate()`,
fills in a beat after mount.

It is a window like any other: it carries the `_ □ ✕` cluster, can be dragged up
or down the column, and can be closed and restored from `settings.cfg`.

## Make it yours

The page is a shared room, but the furniture is yours. Almost every word and
colour on it comes from a single config object (`src/lib/config.svelte.js`),
which the visitor can open from the **⚙ cfg** button in the status strip, from
**customize** in the site map, or from the button in `welcome.txt`.

Editing writes straight into that object and the page updates as you type —
which means there is no "save" button, no form submission, and no round trip.
Everything is kept in one `localStorage` key (`yours.config`) and never leaves
the browser.

What is editable:

- **identity** — the big name, the page title, the slogan, the tagline, and the
  status line. Wrapping a word in the tagline in `*stars*` tints it.
- **welcome** — the heading and the note that greets whoever arrives.
- **marquee** — the phrases that scroll across the top. Clear them all and the
  strip disappears entirely.
- **currently** — the rows in the sidebar box (each one a `label: value` line),
  or clear them all to hide the box.
- **theme** — five palettes: `sunrise`, `tidepool`, `blossom`, `ember`,
  `midnight`.
- **arrival** — a switch that plays your synth tape when you next arrive. It
  fires on the same gesture that dismisses the boot screen, because browsers
  won't start audio before one.

A palette is only ever seven hex codes plus one surface hue (`src/lib/theme.js`)
written onto `:root`. The hue (`--sh`) builds every dark surface — backgrounds,
panels, borders and ink — while the seven accents drive the glows, panel bars and
badges. Everything is derived in CSS with `color-mix` and `hsl()`, so re-tinting
the whole page costs no JavaScript and no new bytes.

The config can also be **downloaded** as a small json file, **re-imported** into
another browser, or **reset** to the defaults. Imports are sanitised rather than
trusted: unknown keys are dropped, every string is capped and stripped of control
characters, and an unknown palette falls back to `sunrise`. A file that isn't a
config at all is rejected outright.

At the bottom of the window is a **storage ledger** (`src/lib/storage.js`): every
`localStorage` key the page owns, under a friendly name, with what each one costs
and a bar against the roughly 5 mb a browser allows. The config is fed in from the
live object rather than read back, so the number moves as you type instead of
waiting for the debounced write. Sizes are counted as UTF-16 — two bytes a
character, plus the key — because that is how the browser counts them against the
quota. It is the same story the page-weight badge tells, one layer down: the page
is small, and it stays small.

The handler in `App.svelte` is three lines:

```js
$effect(() => (document.title = `${config.identity.title} ~ home`));
$effect(() => applyTheme(config.theme));
$effect(() => persist(JSON.stringify(config)));
```

The `JSON.stringify` looks redundant, but it is what subscribes the effect to
every field; `persist()` itself only debounces the write.

## Share a room

A room can travel. In `settings.cfg` there is a **make a link** button: it packs
the config, plus the small personal stores that make the room feel lived-in,
into the url **fragment** (`#share=…`). The payload is json, deflated with the
browser's own `CompressionStream`, then base64url'd — so it is never sent to a
server, and the page's promise that nothing leaves the browser still holds.

Opening such a link puts the page into **guest mode**: the sharer's room is
rendered, but nothing is written to the visitor's `localStorage`, so their own
room is untouched. A banner offers **make it mine** (adopt the config and the
opt-in stores) or **go home** (leave, unchanged).

Two kinds of store travel, and the difference is the point:

- **view-only** — the trophy cabinet, the party and dex, the trivia streak, the
  cat's spot, the VINE.EXE high score, the synth knobs and layout. You can _see_
  someone's trophies; you cannot claim them.
- **opt-in** — the notebook and the doodle, and only if the sharer ticks the box.
  The notebook is shared **without its sealed pages**: a seal is a promise to keep
  something hidden until a day, and a url would break it.

One thing travels because it lives in the config: the cassette deck's music link.
A guest sees the track you set and can press play on it — the same opt-in the deck
asks of anyone.

A payload from a stranger is not trusted: the fragment is capped before it is
decoded, the decoded bytes are capped while they stream out (so a small
compressed payload cannot expand into a decompression bomb), and only known keys
of the right shape survive.

## The hidden things

There are two secrets. The first is reachable three ways. (The trophy cabinet
is not one of them — it is on the shelf in the left rail, in plain sight.)

### `VINE.EXE` — a minimal game

1. The old cheat code, typed anywhere: `↑ ↑ ↓ ↓ ← → ← → B A`
2. Click the little **sun** in the hero **three times**.
3. Click the **❧ leaf** in the footer **three times**.

A snake-like game where you grow a vine and eat the sun. The arena wraps
around at the edges. Controls: arrows / `WASD`, `space` to pause, `R` to
restart, `Esc` to exit. Best score is kept in `localStorage`. There's an
on-screen D-pad on touch devices.

> Spoiler: the triggers are also left as a comment in `index.html`, because
> that is exactly what the old web would have done.

### `synth.exe` — a tiny synth, on its own page

1. **Type the word** `synth` anywhere on the page.
2. Click the **♪** in the footer.

Unlike `VINE.EXE`, this one swaps the whole view for its own page at `#synth`,
so it has a real address, the back button works, and the brand link in the
status strip takes you home. It is a one-octave keyboard with a waveform
selector, attack, release, a lowpass cutoff, and a master volume. Hold a key
and turn the knobs — the properties are live.

There is a **tape** under the output meter. Hit `● rec`, play something, hit
`■ stop`, and `▶ play` performs it back; `↻ loop` keeps it going and `✕ clear`
wipes it. The clock starts on your first note rather than on the button, so
there is no dead air in front of the take. The take is drawn as a small tracker
strip — time across, pitch up, white notes in lime and black keys in cyan.
Nothing is captured as audio: the tape only remembers _which_ notes you played
and _when_, so it stays a few hundred bytes, survives a reload under
`synth.tape`, and plays through whatever the knobs say at the time.

The knobs themselves are remembered too (`synth.sound`), so the take sounds the
same next time. That is what lets the **arrival greeting** work: turn it on in
`settings.cfg` and the tape plays as you come in. Browsers block audio before a
gesture, so it fires on the same space / enter / click that dismisses the boot
screen — which is why the boot screen waits for one instead of letting itself
in. It is a small way to leave a sound for yourself at the door.

The keyboard follows the classic tracker layout, which is about _physical_ key
positions rather than letters, so it ships in two mappings: **AZERTY**
(`q z s e d f t g y h u j k`, the default) and **QWERTY**
(`a w s e d f t g y h u j k`). Both play the same keys in the same shape — only
the printed letters differ. The switch sits next to the waveform selector and
the choice is remembered in `localStorage`.

> Clues: `whats_new.txt` mentions it, and the **♪** in the footer has a
> `title` that gives it away.

## Structure

```
index.html
Dockerfile             # multi-stage: node build → nginx serve
nginx.conf             # gzip, cache headers, security headers
.dockerignore
vite.config.js
svelte.config.js
vite-plugin-weight.js  # build-time page-weight meter (virtual:weight)
src/
  main.js
  app.css              # design tokens, frameset layout, window chrome, CRT FX
  fonts.css            # @font-face declarations for the self-hosted fonts
  fonts/               # the latin woff2 subsets, committed
  images/              # the two cat GIFs, committed
  App.svelte           # layout + secret-trigger wiring
  lib/
    config.svelte.js   # the editable config: defaults, sanitising, import/export
    share.svelte.js    # share links: the payload, guest mode, the store door
    windows.svelte.js  # the window state: reduce / restore / close, kept in the config
    WinBtns.svelte     # the _ □ ✕ cluster, as real buttons
    drag.js            # the sortable action: drag a window by its bar to move it
    scroll-lock.js     # holds the page still behind an open modal or drawer
    scroll.js          # in-page section links that leave the url alone
    focus-trap.js      # keeps Tab inside an open dialog, restores focus on close
    theme.js           # the five palettes
    timeofday.svelte.js # the room's light: dawn, day, dusk, night, from the clock
    secret.js          # pub/sub + Konami / typed-word watchers
    weight.js          # runtime Resource Timing measurement
    storage.js         # the localStorage ledger: what the page keeps, and how much
    tape.js            # the synth tape: notes, storage, and the arrival player
    notes-net.svelte.js # the sticky-notes network: identity, room, inbox, rules
    BootScreen.svelte
    TopBar.svelte      # the thin status strip
    Masthead.svelte    # the name banner
    Weather.svelte     # weather.dat — Open-Meteo, on click, next to the title
    Marquee.svelte
    Sidebar.svelte     # the persistent rail: the site map and currently
    Welcome.svelte     # welcome.txt — the greeting and the settings button
    Settings.svelte    # settings.cfg — the customization window
    News.svelte        # whats_new.txt
    WildEncounter.svelte # wild_encounter.dat — a random Pokémon, on click
    encounter-store.js # the encounter's seed, party and dex sets, signed
    encounter.svelte.js # the shared reactive encounter state + dex milestones
    pokeapi.js         # the shared PokéAPI list, sprites and generation ranges
    Pokedex.svelte     # pokedex.dat — every Pokémon met, as a grid (a modal)
    Doodle.svelte      # doodle.dat — a small drawing pad, stored as strokes
    Trivia.svelte      # trivia.dat — a question at a time, from Open Trivia DB
    Cassette.svelte    # the cassette deck — plays the visitor's own music
    music.js           # parse a youtube link into a kind + id, and back to an embed
    Cat.svelte         # the GIF cat parked in the bottom-right corner
    Notebook.svelte    # the notebook — private notes, its own storage key
    StickyNotes.svelte # the sticky notes — anonymous notes, browser to browser
    StickyNote.svelte  # the paper itself — the compose pad and the read view
    NoteToast.svelte   # the small toast that slides in when a note arrives
    sign.js            # the shared HMAC helper for the party and the trophies
    achievements.svelte.js # the trophy store: the list, the unlock, the storage
    Trophies.svelte    # the trophy cabinet — the rail shelf and the window
    TrophyToast.svelte # the small toast that slides in on an unlock
    Fingerprint.svelte # fingerprint.txt — what a tracker could see, kept local
    PageWeight.svelte  # the 88×31 weight badge
    Footer.svelte
    SecretGame.svelte  # VINE.EXE
    Synth.svelte       # synth.exe — a Web Audio synth, on its own view
```

## Notes

- Fonts (Space Grotesk, JetBrains Mono, VT323) are self-hosted `woff2` latin
  subsets committed under `src/fonts/`. No third-party request, no second TLS
  handshake, works offline, nothing phones home.
- Motion respects `prefers-reduced-motion`.
- No trackers, no cookies, and no requests on page load — with two exceptions.
  Once you have set a place, `weather.dat` reads the sky again on arrival; and
  the sticky notes join the room on arrival, so a note can find you (see **The
  widgets** and **Sticky notes** for the exact trade-off). The other network
  widgets (cat fact, wild encounter, trivia) fetch from public APIs, but only
  when you click them; the pokédex shares the encounter's one list request and
  its sprites, and makes none of its own; the synth, the doodle pad and the
  time-of-day light make no requests at all. The cassette deck is the one widget
  that can frame a third party — but only youtube, and only after you press play,
  so it too asks nothing of a visitor who leaves it alone.
  The config is `localStorage` only: nothing about a visit is ever sent anywhere.
- The app is html, css and js, with two runtime dependencies beyond Svelte:
  **perfect-freehand** (MIT, no transitive deps), which turns the doodle pad's
  points into tapered strokes, and **Trystero**, which the sticky notes pull in
  as a lazy chunk only when the page joins the room. The three self-hosted fonts
  are the single biggest weight lever, roughly the same as the app. Subsetting
  them further (needs `fonttools`) or dropping a family is the remaining lever.
- Section links (the rail, the masthead buttons) scroll without touching the
  address bar, so a reload always starts at the top instead of wherever you last
  clicked. The page keeps two hashes: `#synth`, a real address you can reload or
  share, and `#share=…`, the fragment a shared room travels in (see **Share a
  room**).
- "Lightweight" has a runtime dimension the badge does not capture: the
  blueprint grid, the radial gradients, and the SVG feTurbulence grain are paint
  cost, not transfer cost.

## License

GPL-3.0 — see [LICENSE](LICENSE).
