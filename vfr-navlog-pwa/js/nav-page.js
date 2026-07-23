// Renders the reference map and the nearby aerodrome/waypoint lists from local data.

import { toRad, distanceNm, bearingTrue, escapeHtml } from "./shared-utils.js";

(async function () {
  "use strict";

  const svgRoot = document.getElementById("nav-map");
  const mapContent = document.getElementById("nav-map-content");
  const legendEl = document.getElementById("nav-map-legend");
  const selectEl = document.getElementById("nav-aerodrome-select");
  const nearbyListEl = document.getElementById("nearby-aerodrome-list");
  const waypointListEl = document.getElementById("waypoint-list");
  const detailBody = document.getElementById("selected-detail-body");

  // Defensive — if the Nav Page markup isn't present (e.g. a future page
  // reuses this script by mistake), do nothing rather than throw.
  if (!svgRoot || !mapContent) {
    return;
  }

  const VIEW_W = 800;
  const VIEW_H = 640;
  const PADDING = 48;

  const ROLE_LABEL = {
    "primary-training": "Primary training aerodrome",
    "regional-destination": "Regional destination",
    "training-area": "Training/hazard area",
    "avoid": "Avoid. This is a controlled airspace"
  };

  // Shape and colour per role where the dark theme reuses the same hex for
  // --c-accent and --c-caution, so colour alone can't separate
  // primary-training from training-area — shape carries that distinction.
  const ROLE_SHAPE = {
    "primary-training": "circle",
    "regional-destination": "circle",
    "training-area": "triangle",
    "avoid": "diamond"
  };

  // Loads the local aerodrome and waypoint data and falls back cleanly on errors.
  let aerodromes = [];
  let waypoints = [];
  let selectedIcao = "YSBK";

  try {
    const [aeroRes, wptRes] = await Promise.all([
      fetch("./data/aerodromes.json"),
      fetch("./data/waypoints.json")
    ]);
    // Both data fetches must succeed before the page can render its map.
    if (!aeroRes.ok || !wptRes.ok) {
      throw new Error("Data fetch failed: " + aeroRes.status + " / " + wptRes.status);
    }
    const aeroData = await aeroRes.json();
    const wptData = await wptRes.json();
    aerodromes = aeroData.aerodromes || [];
    waypoints = wptData.waypoints || [];
  } catch (err) {
    console.error("Nav Page: failed to load static data", err);
    mapContent.innerHTML = "";
    if (nearbyListEl) {
      nearbyListEl.innerHTML =
        '<li class="nav-list__item nav-list__item--empty">Couldn\u2019t load aerodrome/waypoint data. Try reloading the app.</li>';
    }
    return;
  }

  if (aerodromes.length === 0) {
    return;
  }
  if (!aerodromes.some((a) => a.icao === selectedIcao)) {
    selectedIcao = aerodromes[0].icao;
  }

  // The map projection is local; the distance and bearing helpers come from shared utilities.

  /* Scans every aerodrome, way point, and control zone to find the min/max
    latitude/longtitude. Thsi forms the box that we use to project
  */
  function computeBounds() {
    const lats = [];
    const lons = [];
    aerodromes.forEach((a) => {
      lats.push(a.position.lat);
      lons.push(a.position.lon);
      if (a.controlZone && a.controlZone.boundary) {
        a.controlZone.boundary.forEach(([lat, lon]) => {
          lats.push(lat);
          lons.push(lon);
        });
      }
    });
    waypoints.forEach((w) => {
      lats.push(w.position.lat);
      lons.push(w.position.lon);
    });
    return {
      latMin: Math.min(...lats),
      latMax: Math.max(...lats),
      lonMin: Math.min(...lons),
      lonMax: Math.max(...lons)
    };
  }

  /* Equirectangular-style projector: longitude scaled by cos(midLatitude)
   so shapes/spacing look right despite the basin's north-south spread.
   Builds a flat projection of otherwise spherical coords (SVG)
   */
  function makeProjector(bounds) {
    const latMid = (bounds.latMin + bounds.latMax) / 2;
    const cosLat = Math.cos(toRad(latMid)); // near the equator, there is 1 degree of long. and lat. cover because lines converge towards poles
    const lonSpan = Math.max((bounds.lonMax - bounds.lonMin) * cosLat, 0.0001);
    const latSpan = Math.max(bounds.latMax - bounds.latMin, 0.0001);
    const availW = VIEW_W - PADDING * 2;
    const availH = VIEW_H - PADDING * 2;
    const scale = Math.min(availW / lonSpan, availH / latSpan); // This is used to scale the map so that it fits within the screen without distortion
    const usedW = lonSpan * scale;
    const usedH = latSpan * scale;
    const offsetX = PADDING + (availW - usedW) / 2;
    const offsetY = PADDING + (availH - usedH) / 2;
    return function project(lat, lon) {
      return {
        x: offsetX + (lon - bounds.lonMin) * cosLat * scale,
        y: offsetY + (bounds.latMax - lat) * scale
      };
    };
  }

  // The marker helpers build the SVG shapes used for the map.

  // the document is where the SVG elements are created
  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
    return el;
  }

  /* Triangles and diamongs are regular polygons which are created by moving a pen arount evenly-spaced angles around a centre
    This builds the shapes within a circle */
  function polygonPoints(cx, cy, r, sides, rotationDeg) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const angle = toRad(rotationDeg + (360 / sides) * i);
      pts.push(cx + r * Math.sin(angle) + "," + (cy - r * Math.cos(angle)));
    }
    return pts.join(" ");
  }

  // decides whether to create a circle, triangle, or diamond based on the role of the element using the lookup table
  function buildMarkerShape(shape, cx, cy, r) {
    if (shape === "triangle") {
      return svgEl("polygon", {
        points: polygonPoints(cx, cy, r * 1.15, 3, 0),
        class: "nav-marker__shape"
      });
    }
    if (shape === "diamond") {
      return svgEl("polygon", {
        points: polygonPoints(cx, cy, r * 1.05, 4, 0),
        class: "nav-marker__shape"
      });
    }
    return svgEl("circle", { cx, cy, r, class: "nav-marker__shape" });
  }

  // The map render order keeps the airspace layers behind the clickable markers.

  // The components are drawn in back-to-front so aesthetically, there is appropriate layering present
  function renderMap() {
    const bounds = computeBounds();
    const project = makeProjector(bounds);
    mapContent.innerHTML = "";

    // Control-zone/airspace boundaries first, so markers sit on top.
    aerodromes.forEach((a) => {
      if (!a.controlZone || !a.controlZone.boundary) {
        return;
      }
      const points = a.controlZone.boundary
        .map(([lat, lon]) => {
          const p = project(lat, lon);
          return p.x + "," + p.y;
        })
        .join(" ");
      const zoneClass =
        a.role === "avoid" ? "nav-zone--avoid" : "nav-zone--primary-training";
      mapContent.appendChild(
        svgEl("polygon", { points, class: "nav-zone " + zoneClass })
      );
    });

    // Waypoints which will be small quiet chart-style flags underneath aerodromes.
    waypoints.forEach((w) => {
      const p = project(w.position.lat, w.position.lon);
      const g = svgEl("g", { class: "nav-waypoint" });
      g.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: 3, class: "nav-waypoint__dot" }));
      const label = svgEl("text", {
        x: p.x + 6,
        y: p.y + 3,
        class: "nav-waypoint__label"
      });
      label.textContent = w.name;
      g.appendChild(label);
      mapContent.appendChild(g);
    });

    // Aerodrome markers on top, clickable to select.
    aerodromes.forEach((a) => {
      const p = project(a.position.lat, a.position.lon);
      const shape = ROLE_SHAPE[a.role] || "circle";
      const isSelected = a.icao === selectedIcao;
      const g = svgEl("g", {
        class:
          "nav-marker nav-marker--" +
          a.role +
          (isSelected ? " nav-marker--selected" : ""),
        tabindex: "0",
        role: "button",
        "aria-pressed": isSelected ? "true" : "false",
        "aria-label": a.icao + " " + a.name + " — " + (ROLE_LABEL[a.role] || a.role),
        "data-icao": a.icao
      });
      if (isSelected) {
        g.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: 11, class: "nav-marker__ring" }));
      }
      g.appendChild(buildMarkerShape(shape, p.x, p.y, 6));
      const label = svgEl("text", {
        x: p.x + 9,
        y: p.y - 8,
        class: "nav-marker__label"
      });
      label.textContent = a.icao;
      g.appendChild(label);

      g.addEventListener("click", () => selectAerodrome(a.icao));
      g.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectAerodrome(a.icao);
        }
      });

      mapContent.appendChild(g);
    });
  }

  function renderLegend() {
    const items = [
      { swatchClass: "primary-training", label: "Primary training \u25CF" },
      { swatchClass: "regional-destination", label: "Regional destination \u25CF" },
      { swatchClass: "training-area", label: "Training/hazard area \u25B2" },
      { swatchClass: "avoid", label: "Avoid \u2014 controlled airspace \u25C6" },
      { swatchClass: "waypoint", label: "Waypoint / landmark" },
      { swatchClass: "zone", label: "Simplified control-zone boundary" }
    ];
    legendEl.innerHTML = items
      .map((item) => {
        const swatch =
          item.swatchClass === "waypoint"
            ? '<span class="nav-map__legend-swatch" style="background:var(--c-bg);border:1.5px solid var(--c-text-muted);"></span>'
            : item.swatchClass === "zone"
            ? '<span class="nav-map__legend-swatch" style="background:transparent;border:1.5px dashed var(--c-text-muted);"></span>'
            : '<span class="nav-map__legend-swatch nav-marker--' +
              item.swatchClass +
              '" style="background:var(--marker-color,var(--c-accent));"></span>';
        return "<li>" + swatch + "<span>" + item.label + "</span></li>";
      })
      .join("");
    // The generic swatch above can't reach the role colour via CSS class
    // alone (it's not inside an SVG), so set each one explicitly.
    const colourByRole = {
      "primary-training": "var(--c-accent)",
      "regional-destination": "var(--c-go)",
      "training-area": "var(--c-caution)",
      avoid: "var(--c-nogo)"
    };
    legendEl.querySelectorAll(".nav-map__legend-swatch").forEach((el) => {
      const cls = [...el.classList].find((c) => c.startsWith("nav-marker--"));
      if (cls) {
        const role = cls.replace("nav-marker--", "");
        el.style.background = colourByRole[role] || "var(--c-accent)";
      }
    });
  }

  /* Side-panel renderers: selected-aerodrome detail, nearby lists, formatting helpers. */

  function fmtNm(nm) {
    return nm.toFixed(1) + " NM";
  }
  function fmtBearing(deg) {
    return String(Math.round(deg)).padStart(3, "0") + "\u00B0T";
  }

  function renderSelectOptions() {
    selectEl.innerHTML = aerodromes
      .map(
        (a) =>
          '<option value="' +
          escapeHtml(a.icao) +
          '"' +
          (a.icao === selectedIcao ? " selected" : "") +
          ">" +
          escapeHtml(a.icao) +
          " \u2014 " +
          escapeHtml(a.name) +
          "</option>"
      )
      .join("");
  }

  function renderDetail() {
    const a = aerodromes.find((x) => x.icao === selectedIcao);
    if (!a) {
      detailBody.innerHTML = "";
      return;
    }
    const freqEntries = Object.entries(a.frequencies || {}).filter(
      ([key]) => key !== "note"
    );
    const freqText = freqEntries
      .map(([key, val]) => escapeHtml(key) + ": " + escapeHtml(val))
      .join(" \u00B7 ");

    detailBody.innerHTML =
      "<dt>Role</dt><dd>" +
      escapeHtml(ROLE_LABEL[a.role] || a.role) +
      "</dd>" +
      "<dt>Airspace</dt><dd>Class " +
      escapeHtml(a.airspaceClass) +
      (a.towered ? ", towered" : ", non-towered") +
      "</dd>" +
      "<dt>Elevation</dt><dd class=\"data-inline\">" +
      a.elevationFt +
      " ft AMSL</dd>" +
      "<dt>Frequencies</dt><dd class=\"data-inline\">" +
      (freqText || "\u2014") +
      "</dd>" +
      "<dt>Circuit</dt><dd>" +
      escapeHtml(a.circuit.direction) +
      (a.circuit.altitudeFt ? ", " + a.circuit.altitudeFt + " ft" : "") +
      "</dd>" +
      '<dd class="nav-detail__note">' +
      escapeHtml(a.restrictions) +
      "</dd>";
  }

  // Reuses distanceNm and bearinTrue functions established in the functions above due to the same math required 
  function renderNearby() {
    const a = aerodromes.find((x) => x.icao === selectedIcao);
    if (!a) {
      nearbyListEl.innerHTML = "";
      return;
    }
    const others = aerodromes
      .filter((x) => x.icao !== selectedIcao)
      .map((x) => ({
        aerodrome: x,
        nm: distanceNm(a.position, x.position),
        brg: bearingTrue(a.position, x.position)
      }))

      // These are sorted by distances and only the top 6 are shown
      .sort((p, q) => p.nm - q.nm)
      .slice(0, 6);

    nearbyListEl.innerHTML = others
      .map(
        (o) =>
          '<li class="nav-list__item">' +
          '<div class="nav-list__main">' +
          '<div class="nav-list__title-row">' +
          '<button type="button" class="nav-list__select-btn" data-icao="' +
          escapeHtml(o.aerodrome.icao) +
          '">' +
          escapeHtml(o.aerodrome.icao) +
          " \u2014 " +
          escapeHtml(o.aerodrome.name) +
          "</button>" +
          "</div>" +
          '<span class="nav-list__note">' +
          escapeHtml(ROLE_LABEL[o.aerodrome.role] || o.aerodrome.role) +
          "</span>" +
          "</div>" +
          '<span class="nav-list__meta data-inline">' +
          fmtNm(o.nm) +
          " @ " +
          fmtBearing(o.brg) +
          "</span>" +
          "</li>"
      )
      .join("");

    nearbyListEl.querySelectorAll(".nav-list__select-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectAerodrome(btn.dataset.icao));
    });
  }

  function renderWaypoints() {
    const a = aerodromes.find((x) => x.icao === selectedIcao);
    if (!a) {
      waypointListEl.innerHTML = "";
      return;
    }
    const near = waypoints
      .filter((w) => w.nearAerodromes.includes(selectedIcao))
      .map((w) => ({
        waypoint: w,
        nm: distanceNm(a.position, w.position),
        brg: bearingTrue(a.position, w.position)
      }))
      .sort((p, q) => p.nm - q.nm);

    if (near.length === 0) {
      waypointListEl.innerHTML =
        '<li class="nav-list__item nav-list__item--empty">No tagged waypoints for this aerodrome yet.</li>';
      return;
    }

    waypointListEl.innerHTML = near
      .map(
        (o) =>
          '<li class="nav-list__item">' +
          '<div class="nav-list__main">' +
          '<span class="nav-list__name">' +
          escapeHtml(o.waypoint.name) +
          "</span>" +
          '<span class="nav-list__note">' +
          escapeHtml(o.waypoint.notes) +
          "</span>" +
          "</div>" +
          '<span class="nav-list__meta data-inline">' +
          fmtNm(o.nm) +
          " @ " +
          fmtBearing(o.brg) +
          "</span>" +
          "</li>"
      )
      .join("");
  }

  // This re-runs the renderMap function along with the side panel renderers
  // This is effective at a small scale like this
  function selectAerodrome(icao) {
    if (!aerodromes.some((a) => a.icao === icao)) {
      return;
    }
    selectedIcao = icao;
    selectEl.value = icao;
    renderMap();
    renderDetail();
    renderNearby();
    renderWaypoints();
  }

  selectEl.addEventListener("change", () => selectAerodrome(selectEl.value));

  /* 
    This is the initialization sequence which runs once on page load. 
    It renders the map, legend, and side panel for the first time.
  */

  renderSelectOptions();
  renderMap();
  renderLegend();
  renderDetail();
  renderNearby();
  renderWaypoints();
})();
