# VFR NAVLOG Trainer

A PWA built to help student pilots plan and fly Visual Flight Rules (VFR) training flights around the Sydney Basin, without needing to juggle several separate paper-based tools.

## What It Does

Student pilots normally rely on a mix of paper NAVLOGs, wind calculations, checklists, and personal weather minimums spread across different tools. This app brings all of that into one web app that works on a phone, tablet, or laptop, both on the ground before a flight and, where relevant, in the cockpit.

## Key Features

1.  **Route Planner** - enter a route and get the wind triangle solved automatically (wind correction angle, true and magnetic heading, groundspeed) for each leg.
2.  **NAVLOG and PDF Export** - assembles a full NAVLOG table from the planned route and exports it as a printable PDF.
3.  **Nav Page** - look up an aerodrome by ICAO code and find nearby aerodromes and waypoints.
4.  **Go/No-Go** - compares live weather via Open-Meteo or manually entered conditions against the pilot's own personal minimums.
5.  **Checklists** - simple, tap-to-tick checklists for each phase of flight.
6.  **Logbook** - saves completed flights to a personal, account-secured logbook, including an offline queue so a flight logged without signal is not lost.

## Technology

Built as a client-side PWA (HTML, CSS, JavaScript) with a service worker for offline caching, Supabase for authentication and flight data storage (with Row Level Security), and the free Open-Meteo API for live weather.

## Project Structure

- `Documentation/` - the full SE12 AT3 process portfolio (Identifying and Defining, Researching and Planning, Producing and Implementing, Testing and Evaluating).
- `vfr-navlog-pwa/` - the actual application source code.
- `Journal.md` - weekly development journal.


---

##### Vismay Swami Software Engineering AT3

**Email** · vismay.swami@education.nsw.gov.au

