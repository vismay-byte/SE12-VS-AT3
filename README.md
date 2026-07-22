# VFR NAVLOG Trainer (HSC Software Engineering sample PWA)

Educational, browser-based VFR navigation log generator and pre-flight trainer for
student pilots (RPL/PPL) training around Bankstown, Camden and the Sydney Basin.
**Not a certified navigation tool** — a training/demonstration exemplar only. It does
not use certified aviation data, must never replace official charts, ERSA/AIP entries,
NOTAMs or a real weather briefing, and does not include SARTIME lodging or any
search-and-rescue integration. The in-app logbook is a training convenience, not a
legally recognised pilot logbook. (This scope statement previously lived on an in-app
About page; it's been moved here since it's meant for you to explain/quiz on, not for
the live site.) See `VFR_NAVLOG_PWA_Project_Plan (2).md` for the original requirements
and stage-by-stage build plan, and `UPDATE.md` for the current build status.

All 17 planned stages (0–16) are complete.

## Running locally

Service workers require the app to be served over `http://` (not opened directly as a
`file://` path), so use any simple static server from this folder, for example:

```bash
# Python 3
python -m http.server 8080

# Node (if you have npx available)
npx serve .
```

Then open `http://localhost:8080` in a browser. The app is offline-capable regardless
of installing — the service worker caches the shell on first visit. On a tablet, use
"Add to Home Screen" or the browser's own install prompt (Chrome/Edge) if you also
want it to behave like a standalone app; there's no custom in-app install button —
Safari/iOS and Firefox never fire the event needed to offer one, so it was removed
rather than only working in some browsers.

## One-time Supabase setup (accounts + logbook)

The app already ships wired up to a working Supabase project (`js/supabase-client.js`)
— the schema has been run and login/logbook are live. You only need to redo this if
you want to point the app at your **own** Supabase project (e.g. a fresh copy for a
different class):

1. Create a free project at [supabase.com](https://supabase.com) (no credit card
   needed).
2. In the Supabase dashboard, go to **Project Settings → API** and copy the **Project
   URL** and the **anon / publishable key**. These are safe to ship in client-side
   code — real access control is enforced entirely by Row Level Security (RLS)
   policies, not by keeping this pair secret.
3. Paste them into `js/supabase-client.js` as `SUPABASE_URL` and `SUPABASE_KEY`.
   Never put the **service_role/secret** key here — that one must never reach the
   browser.
4. Open **SQL Editor → New query**, paste in the contents of `supabase/schema.sql`,
   and run it. It's idempotent (`if not exists`/`or replace` throughout), so re-running
   it is always safe. Verify in **Table Editor** that `pilots` and `flights` both show
   the RLS padlock as enabled.
5. Under **Authentication → URL Configuration → Redirect URLs**, add the URL you're
   serving the app from (e.g. `http://localhost:8080`) — required for the
   "forgot password" reset-email link to work.
6. Under **Authentication → Providers → Email**, review the password policy and the
   "Confirm email" setting to match what you want students to experience (the app's
   own client-side password checklist in `js/auth.js` mirrors a reasonable default,
   but Supabase's server-side setting is the real enforcement).

**Free-tier note:** an inactive free Supabase project can pause itself automatically
(e.g. over a school holiday). Un-pausing is a one-click action in the dashboard and
takes about a minute — if login suddenly stops working after a long gap, check this
before assuming it's a bug.

## Deploying online (GitHub Pages)

This app is fully static (no build step, no server-side code — Supabase is called
directly from the browser), which makes GitHub Pages the simplest free host. Every
path in the app (`./js/...`, `./css/...`, `./data/...`) and `manifest.json`'s
`start_url`/`scope` are already relative, so it works correctly whether it ends up at
a root domain or a `/repo-name/` sub-path — no code changes needed for this step.

1. **Upload the right folder as the repo.** The live app's files (`index.html`,
   `js/`, `css/`, `data/`, `manifest.json`, `service-worker.js`, `supabase/`, this
   README, etc.) must be the **root** of the GitHub repo — not wrapped in an extra
   folder — or GitHub Pages won't find `index.html`. If you're working from this
   exact folder on disk, upload/push the *contents* of this folder, not the folder
   itself.
   - Easiest path (no git experience needed): on GitHub, create a new repository,
     then use **Add file → Upload files** on its main page and drag in everything
     from this folder.
   - Git path: from inside this folder,
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/<your-username>/<repo-name>.git
     git push -u origin main
     ```
2. **Turn on Pages.** In the repo on GitHub: **Settings → Pages** (left sidebar,
   under "Code and automation") → under **Build and deployment**, set **Source** to
   **"Deploy from a branch"** → **Branch**: `main`, folder `/ (root)` → **Save**.
   GitHub will show a green banner with your live URL shortly after
   (`https://<your-username>.github.io/<repo-name>/`) — the first deploy can take a
   minute or two.
3. **Add the new URL to Supabase**, or login/password-reset will silently fail on
   the live site: Supabase dashboard → **Authentication → URL Configuration →
   Redirect URLs** → add `https://<your-username>.github.io/<repo-name>/` (exact
   URL, trailing slash included, matching what Pages actually serves).
4. **Verify on the live URL**, not just locally:
   - Open the site, open DevTools → **Application → Service Workers**, confirm one
     is registered and **Application → Cache Storage** shows a
     `vfr-navlog-shell-vNN` cache populated with the app-shell files.
   - Try the browser's own install prompt (Chrome/Edge show one automatically
     once the manifest + service worker are both valid; there's no in-app button).
   - Try signing up / logging in for real (this is the first environment where
     that can actually be tested end-to-end — see the testing checklist below).
   - Reload the page, then go offline (DevTools → Network → "Offline", or turn off
     Wi-Fi) and confirm the shell still loads and pages you've already visited
     still work.

GitHub Pages serves everything over HTTPS automatically (required for service
workers to register at all — they refuse to run over plain `http://` except on
`localhost`), so no separate certificate setup is needed.

**Every future update**: after editing files locally, `git add . && git commit -m "..."
&& git push` (or re-upload changed files via the web UI) — Pages redeploys
automatically within a minute or two of a push to `main`. Remember `service-worker.js`'s
`CACHE_NAME` should be bumped for any change to a precached file (see `CLAUDE.md`'s
working agreements), or returning visitors may keep seeing the old cached version
until the browser's own periodic service-worker update check catches up.

**Optional — custom domain:** Settings → Pages → **Custom domain**, enter your
domain, and add the DNS records GitHub shows you (a `CNAME` record pointing at
`<your-username>.github.io` for a subdomain, or `A`/`AAAA` records for an apex
domain) at your domain registrar. If you do this, also update the Supabase
redirect URL (step 3) to the custom domain instead.

## Testing

Every calculation module (wind triangle/time-ETE/fuel/save-load and route-planner in
`js/route-planner-bundle.js`; NAVLOG/callouts in `js/navlog-bundle.js`; `js/gonogo.js`,
`js/checklists.js`, `js/logbook.js`) ships its own hand-checkable self-test panel,
visible as a collapsible "Self-test" section on that feature's page. Each case's
expected value is worked out by hand (e.g. `asin`/`cos` of "nice" angles), not copied
from a table, and the panel shows a pass/fail count plus per-field diffs for any failure.

Quick sanity checks used during development (from this folder):

```bash
# Syntax-check every JS file (they're ES modules, so use --input-type=module)
for f in js/*.js; do node --input-type=module --check < "$f" || echo "FAILED: $f"; done

# CSS brace balance, per stylesheet
for f in css/*.css; do [ "$(grep -c '{' "$f")" = "$(grep -c '}' "$f")" ] || echo "UNBALANCED: $f"; done

# No duplicate element ids
grep -o 'id="[^"]*"' index.html | sort | uniq -d
```

## Known limitations

- Educational/demo only — not for real navigation. No SARTIME, no certified
  ERSA/AIP/METAR-TAF data feed, and the logbook is not a legally recognised pilot
  record.
- The authenticated logbook round trip needs a real browser session with a real
  account to exercise end-to-end (built and covered by self-tests as far as a
  sandboxed headless browser allows — see `UPDATE.md` for exactly what's been
  verified live vs. what still needs a human).
- One cosmetic pre-existing note: none currently open — see `UPDATE.md`'s "Known
  issues" section for the current, authoritative list.

## Project structure

```
index.html               Single-page app shell: header, all views (home, Route
                          Planner, NAVLOG, Nav Page, Go/No-Go, Checklists, Logbook),
                          and the auth dialog. Views are plain <div class="view">
                          siblings shown/hidden by js/shell.js's window.showView().
manifest.json             PWA manifest
service-worker.js          Offline app-shell caching (cache-first for local static
                           assets; live network for Supabase/Open-Meteo/jsPDF)

css/style.css              Design system: tokens (colour, spacing, type), buttons,
                            cards, chips, switch, skip link, focus-visible, reduced-motion
css/planning.css            Bundle: route-planner + nav-page + save-load panel styles
css/calculators.css          Bundle: wind-triangle + time-ete + fuel + navlog panel styles
css/features.css              Bundle: gonogo + checklists + callouts + logbook + about
                               page styles
                               (all three bundles are straight concatenations of what
                               were previously 12 separate per-feature stylesheets —
                               merged in the Phase 1 file-count reduction pass; each
                               original section is still marked with a comment banner)

js/shell.js               App shell (Session 15 merge of theme.js/app.js —
                           install-prompt.js's custom "Install app" button was
                           removed in Session 17, see UPDATE.md/BUG-04): panel-
                           lighting toggle, feature-card nav, window.showView()
                           incl. lazy-loading each view's own module(s) via
                           VIEW_MODULES, service worker registration
js/shared-utils.js          Shared low-level helpers (Session 15 merge of dom-utils.js/
                             self-test-utils.js/route-draft.js/geo.js): escapeHtml(),
                             applyFieldCheck(), numericFieldCheck(), approxEqual(),
                             renderSelfTestList(), the sessionStorage route-draft key +
                             reader, and great-circle distance/bearing maths
js/supabase-client.js        Supabase client init (public URL + publishable key)
js/auth.js                    Login/sign-up/forgot/reset dialog + auth state wiring
                               (stays eagerly loaded — see js/shell.js's header comment)
js/nav-page.js                   Nav Page: SVG map, nearby-aerodrome/waypoint lists
js/route-planner-bundle.js          Route Planner page bundle (Session 15 merge of
                                     route-planner.js/wind-triangle.js/time-ete.js/
                                     fuel-calc.js/save-load.js — the five panels that
                                     already always load together on that one page):
                                     leg table, wind-triangle solveLeg() (WCA/TH/MH/GS),
                                     ETE/ETA dead reckoning, fuel/reserve engine +
                                     loadAircraftList(), named route save/load — each
                                     with its own self-tests
js/navlog-bundle.js                  NAVLOG page bundle (Session 15 merge of navlog.js/
                                      callouts.js — both always load together on that
                                      page): table assembly, jsPDF export
                                      (loadJsPdfConstructor()/buildNavlogPdfDoc()), flight
                                      snapshot build/reconstruct, offline save queue, and
                                      the Web Speech API timed callouts panel + self-tests
js/gonogo.js                            Personal minimums, Open-Meteo fetch,
                                         Go/Caution/No-Go decision logic + self-tests
js/checklists.js                          Aircraft checklist data-shape self-test
                                           + tick-state UI
js/logbook.js                               Flight history list, running hours,
                                             delete, re-export PDF + self-tests

supabase/schema.sql        Run once in the Supabase SQL Editor: pilots + flights
                           tables, RLS policies, auto-provisioning trigger

data/aerodromes.json       Sydney Basin aerodromes: position, elevation, runways,
                           frequencies, circuit info, restrictions, simplified
                           control-zone boundaries
data/waypoints.json         Sydney Basin VFR waypoints/landmarks tagged to aerodromes
data/aircraft.json           Trainer aircraft profiles: fuel burn/tank size + the
                              per-phase checklist data used by js/checklists.js

assets/icons/               App icon(s)
```
