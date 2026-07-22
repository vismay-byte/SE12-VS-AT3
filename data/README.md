# /data

Static, hand-built JSON datasets:

- `aerodromes.json` — **added in Stage 3.** 8 Sydney Basin aerodromes (YSBK, YSCN, YSSY,
  YWOL, YWVA, YWBN, YOAS, YGLB) with position, elevation, runways, frequencies, circuit
  info, a plain-English restriction summary, and a simplified control-zone boundary
  polygon for the two Class D fields plus a single-ring stand-in for the Sydney Class C
  shelf. See the `_meta` block at the top of the file for sourcing/accuracy notes.
- `waypoints.json` — **added in Stage 4.** 14 common Sydney Basin VFR reporting
  points/landmarks, each tagged with `nearAerodromes` (ICAO codes from
  `aerodromes.json`) so they can be filtered per aerodrome. See its `_meta` block
  for sourcing/accuracy notes.
- `checklists.json` — added in Stage 11

All data here is manually compiled reference data for training/demo purposes only —
not a live feed, not certified for real navigation. See each file's own `_meta`/header
notes for what it was compiled from and how it may be inaccurate or out of date.
