// Combines the route planner, preview panels, and route save/load tools into one bundle.

import {
  distanceNm, bearingTrue, roundNm, roundDeg, toRad, toDeg,
  escapeHtml, applyFieldCheck, numericFieldCheck,
  approxEqual, renderSelfTestList,
  DRAFT_KEY, loadRouteDraft
} from "./shared-utils.js";

// The route planner builds the leg list and keeps a draft in session storage.

(async function () {
  "use strict";

  const departureSelect = document.getElementById("route-departure");
  const arrivalSelect = document.getElementById("route-arrival");
  const resetBtn = document.getElementById("route-reset-btn");
  const endpointNote = document.getElementById("route-endpoint-note");
  const summaryEl = document.getElementById("route-summary");
  const tableBody = document.getElementById("route-table-body");
  const addSelect = document.getElementById("route-add-select");
  const addBtn = document.getElementById("route-add-btn");
  const addConfirmBar = document.getElementById("route-add-confirm");
  const addConfirmText = document.getElementById("route-add-confirm-text");
  const addConfirmBtn = document.getElementById("route-add-confirm-btn");
  const addCancelBtn = document.getElementById("route-add-cancel-btn");

  const CUSTOM_VALUE = "__custom__";

  if (!departureSelect || !tableBody) {
    return; // Route Planner markup not present.
  }

  let aerodromes = [];
  let waypointDataset = [];
  let route = null;
  let uidCounter = 1;

  try {
    const [aeroRes, wptRes] = await Promise.all([
      fetch("./data/aerodromes.json"),
      fetch("./data/waypoints.json")
    ]);
    if (!aeroRes.ok || !wptRes.ok) {
      throw new Error("Data fetch failed: " + aeroRes.status + " / " + wptRes.status);
    }
    aerodromes = (await aeroRes.json()).aerodromes || [];
    waypointDataset = (await wptRes.json()).waypoints || [];
  } catch (err) {
    console.error("Route Planner: failed to load static data", err);
    summaryEl.textContent = "Couldn’t load aerodrome/waypoint data. Try reloading the app.";
    return;
  }

  if (aerodromes.length === 0) {
    return;
  }

  // The route starts from a loaded draft when one exists, otherwise a fresh default.

  function makeUid() {
    return "wpt-" + uidCounter++;
  }

  function defaultRoute() {
    const dep = aerodromes[0].icao;
    const arr = (aerodromes[1] || aerodromes[0]).icao;
    return {
      departureIcao: dep,
      arrivalIcao: arr,
      waypoints: [],
      arrivalLeg: { legDistanceNm: null, legTrueCourseDeg: null }
    };
  }

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.departureIcao || !Array.isArray(parsed.waypoints)) {
        return null;
      }
      // Only trust ICAO codes that still exist in the current dataset.
      if (!aerodromes.some((a) => a.icao === parsed.departureIcao)) {
        return null;
      }
      if (!aerodromes.some((a) => a.icao === parsed.arrivalIcao)) {
        return null;
      }
      parsed.waypoints.forEach((w) => {
        const n = parseInt(String(w.uid).replace("wpt-", ""), 10);
        if (!isNaN(n) && n >= uidCounter) {
          uidCounter = n + 1;
        }
      });
      return parsed;
    } catch (err) {
      console.warn("Route Planner: couldn't read saved draft, starting fresh.", err);
      return null;
    }
  }

  function saveDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(route));
    } catch (err) {
      console.warn("Route Planner: couldn't save draft to sessionStorage.", err);
    }
  }

  const loadedDraft = loadDraft();
  route = loadedDraft || defaultRoute();
  // Only auto-calculate legs for a brand-new route. recalculating a loaded
  // draft would silently overwrite the student's manual edits on reopen.
  const isNewRoute = !loadedDraft;

  // The lookup helpers turn ICAOs into the point data needed by the table and previews.

  function findAerodrome(icao) {
    return aerodromes.find((a) => a.icao === icao) || null;
  }

  function aerodromePoint(icao) {
    const a = findAerodrome(icao);
    if (!a) {
      return null;
    }
    return { name: a.icao + " - " + a.name, position: a.position };
  }

  function allPoints() {
    const dep = aerodromePoint(route.departureIcao);
    const arr = aerodromePoint(route.arrivalIcao);
    return [
      { kind: "endpoint", role: "departure", uid: "departure", name: dep ? dep.name : "?", position: dep ? dep.position : null },
      ...route.waypoints.map((w) => ({ kind: w.kind, role: "waypoint", uid: w.uid, name: w.name, position: w.position, ref: w })),
      { kind: "endpoint", role: "arrival", uid: "arrival", name: arr ? arr.name : "?", position: arr ? arr.position : null, ref: route.arrivalLeg }
    ];
  }

  // Suggested leg values are recalculated whenever the route structure changes.

  function recalcAllLegs() {
    const points = allPoints();
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1];
      const to = points[i];
      const legHolder = to.role === "arrival" ? route.arrivalLeg : to.ref;
      if (from.position && to.position) {
        legHolder.legDistanceNm = roundNm(distanceNm(from.position, to.position));
        legHolder.legTrueCourseDeg = roundDeg(bearingTrue(from.position, to.position));
      } else {
        // At least one end is a custom point with no known coordinates thus
        // can't suggest a value, leave whatever's already there (usually
        // null until the student types something in).
      }
    }
  }

  // The endpoint selects are rendered from the current route state.

  function renderEndpointSelects() {
    const options = aerodromes
      .map((a) => '<option value="' + escapeHtml(a.icao) + '">' + escapeHtml(a.icao) + " - " + escapeHtml(a.name) + "</option>")
      .join("");
    departureSelect.innerHTML = options;
    arrivalSelect.innerHTML = options;
    departureSelect.value = route.departureIcao;
    arrivalSelect.value = route.arrivalIcao;

    if (route.departureIcao === route.arrivalIcao) {
      endpointNote.hidden = false;
      endpointNote.textContent =
        "Departure and arrival are the same aerodrome - fine for a local training route, otherwise double-check your selection.";
    } else {
      endpointNote.hidden = true;
    }
  }

  // The add-waypoint select offers suggested points first and falls back to all waypoints.

  function renderAddSelect() {
    const suggested = waypointDataset.filter(
      (w) =>
        w.nearAerodromes.includes(route.departureIcao) ||
        w.nearAerodromes.includes(route.arrivalIcao)
    );
    const suggestedIds = new Set(suggested.map((w) => w.id));
    const others = waypointDataset.filter((w) => !suggestedIds.has(w.id));

    function optionsFor(list) {
      return list
        .map((w) => '<option value="' + escapeHtml(w.id) + '">' + escapeHtml(w.name) + "</option>")
        .join("");
    }

    addSelect.innerHTML =
      (suggested.length
        ? '<optgroup label="Suggested for this route">' + optionsFor(suggested) + "</optgroup>"
        : "") +
      '<optgroup label="All waypoints">' + optionsFor(others) + "</optgroup>" +
      '<option value="' + CUSTOM_VALUE + '">Custom point (enter manually)…</option>';
  }

  // The route table marks fields as missing, invalid, or complete so the student gets clear feedback.

  const DIST_MIN_NM = 0.1;
  const DIST_MAX_NM = 500; // sanity bound and generous for a Sydney Basin training leg
  const COURSE_MIN_DEG = 0;
  const COURSE_MAX_DEG = 359;

  // "missing" (not yet touched) is kept distinct from "invalid" (typed but
  // out of range/NaN) so each can be worded differently for the student.
  function validateDistance(val) {
    if (val === null || val === undefined) {
      return { state: "missing" };
    }
    if (typeof val !== "number" || isNaN(val) || !isFinite(val)) {
      return { state: "invalid", message: "Enter a number." };
    }
    if (val < DIST_MIN_NM) {
      return { state: "invalid", message: "Distance must be greater than 0 NM." };
    }
    if (val > DIST_MAX_NM) {
      return { state: "invalid", message: "Distance must be " + DIST_MAX_NM + " NM or less." };
    }
    return { state: "valid" };
  }

  function validateCourse(val) {
    if (val === null || val === undefined) {
      return { state: "missing" };
    }
    if (typeof val !== "number" || isNaN(val) || !isFinite(val)) {
      return { state: "invalid", message: "Enter a number." };
    }
    if (val < COURSE_MIN_DEG || val > COURSE_MAX_DEG) {
      return { state: "invalid", message: "True course must be between 000° and 359°." };
    }
    return { state: "valid" };
  }

  // Shared by the full table render and the summary-only update so the two
  // can't drift; an invalid or missing leg is excluded from the total.
  function summarizeLegs(points) {
    let totalNm = 0;
    let missingCount = 0;
    let invalidCount = 0;
    for (let i = 1; i < points.length; i++) {
      const to = points[i];
      const legHolder = to.role === "arrival" ? route.arrivalLeg : to.ref;
      const distCheck = validateDistance(legHolder.legDistanceNm);
      const courseCheck = validateCourse(legHolder.legTrueCourseDeg);
      if (distCheck.state === "invalid" || courseCheck.state === "invalid") {
        invalidCount++;
      } else if (distCheck.state === "missing" || courseCheck.state === "missing") {
        missingCount++;
      } else {
        totalNm += legHolder.legDistanceNm;
      }
    }
    return { legCount: points.length - 1, totalNm, missingCount, invalidCount };
  }

  function summaryHtml(summary) {
    let attention = "";
    if (summary.invalidCount > 0) {
      attention +=
        '<span><span class="route-summary__label">Needs attention</span><strong class="route-summary__alert">' +
        summary.invalidCount +
        (summary.invalidCount === 1 ? " leg has" : " legs have") +
        " an invalid value</strong></span>";
    }
    if (summary.missingCount > 0) {
      attention +=
        '<span><span class="route-summary__label">Needs attention</span><strong>' +
        summary.missingCount +
        (summary.missingCount === 1 ? " leg" : " legs") +
        " missing a distance/course</strong></span>";
    }
    return (
      '<span><span class="route-summary__label">Legs</span><strong>' + summary.legCount + "</strong></span>" +
      '<span><span class="route-summary__label">Total distance</span><strong>' +
      summary.totalNm.toFixed(1) +
      " NM</strong></span>" +
      attention
    );
  }

  function renderTable() {
    const points = allPoints();
    let rowsHtml = "";

    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1];
      const to = points[i];
      const legHolder = to.role === "arrival" ? route.arrivalLeg : to.ref;
      const dist = legHolder.legDistanceNm;
      const course = legHolder.legTrueCourseDeg;
      const isAuto = from.position && to.position;
      const distCheck = validateDistance(dist);
      const courseCheck = validateCourse(course);
      const isInvalid = distCheck.state === "invalid" || courseCheck.state === "invalid";
      const isIncomplete = !isInvalid && (distCheck.state === "missing" || courseCheck.state === "missing");

      const rowClasses =
        "route-row" +
        (to.role !== "waypoint" ? " route-row--endpoint" : "") +
        (isInvalid ? " route-row--invalid" : isIncomplete ? " route-row--incomplete" : "");

      const canMoveUp = to.role === "waypoint" && route.waypoints.findIndex((w) => w.uid === to.uid) > 0;
      const canMoveDown =
        to.role === "waypoint" &&
        route.waypoints.findIndex((w) => w.uid === to.uid) < route.waypoints.length - 1;

      const distErrorId = "dist-error-" + to.uid;
      const courseErrorId = "course-error-" + to.uid;

      rowsHtml +=
        '<tr class="' + rowClasses + '" data-uid="' + to.uid + '">' +
        '<td class="route-row__index">' + i + "</td>" +
        "<td>" + escapeHtml(from.name) + "</td>" +
        "<td>" +
        '<span class="route-row__point-name">' + escapeHtml(to.name) + "</span>" +
        (to.role === "waypoint"
          ? '<span class="route-row__point-type">' +
            (to.kind === "custom" ? "Custom point (no coordinates)" : "Waypoint") +
            "</span>"
          : "") +
        "</td>" +
        "<td>" +
        '<input type="number" step="0.1" min="' + DIST_MIN_NM + '" max="' + DIST_MAX_NM + '" inputmode="decimal" ' +
        'aria-label="Distance for leg ' + i + ', in nautical miles" ' +
        'aria-invalid="' + (distCheck.state === "invalid") + '" ' +
        'aria-describedby="' + distErrorId + '" ' +
        'class="route-row__dist' + (isAuto ? " route-row__input--auto" : "") + '" ' +
        'value="' + (dist === null || dist === undefined || (typeof dist === "number" && isNaN(dist)) ? "" : dist) + '">' +
        '<span class="field-error" id="' + distErrorId + '" role="alert">' +
        (distCheck.state === "invalid" ? escapeHtml(distCheck.message) : "") +
        "</span>" +
        "</td>" +
        "<td>" +
        '<input type="number" step="1" min="' + COURSE_MIN_DEG + '" max="' + COURSE_MAX_DEG + '" inputmode="numeric" ' +
        'aria-label="True course for leg ' + i + ', in degrees" ' +
        'aria-invalid="' + (courseCheck.state === "invalid") + '" ' +
        'aria-describedby="' + courseErrorId + '" ' +
        'class="route-row__course' + (isAuto ? " route-row__input--auto" : "") + '" ' +
        'value="' + (course === null || course === undefined || (typeof course === "number" && isNaN(course)) ? "" : course) + '">' +
        '<span class="field-error" id="' + courseErrorId + '" role="alert">' +
        (courseCheck.state === "invalid" ? escapeHtml(courseCheck.message) : "") +
        "</span>" +
        "</td>" +
        "<td>" +
        (to.role === "waypoint"
          ? '<div class="route-row__actions">' +
            '<button type="button" class="btn btn--ghost route-row__icon-btn" data-action="up" aria-label="Move ' +
            escapeHtml(to.name) +
            ' earlier in the route"' + (canMoveUp ? "" : " disabled") + ">↑</button>" +
            '<button type="button" class="btn btn--ghost route-row__icon-btn" data-action="down" aria-label="Move ' +
            escapeHtml(to.name) +
            ' later in the route"' + (canMoveDown ? "" : " disabled") + ">↓</button>" +
            '<button type="button" class="btn btn--ghost route-row__icon-btn route-row__icon-btn--danger" data-action="remove" aria-label="Remove ' +
            escapeHtml(to.name) +
            ' from the route">✕</button>' +
            "</div>"
          : "") +
        "</td>" +
        "</tr>";
    }

    tableBody.innerHTML = rowsHtml;
    summaryEl.innerHTML = summaryHtml(summarizeLegs(points));
    wireRowEvents();
  }

  function wireRowEvents() {
    tableBody.querySelectorAll("tr").forEach((row) => {
      const uid = row.dataset.uid;
      const distInput = row.querySelector(".route-row__dist");
      const courseInput = row.querySelector(".route-row__course");
      const distError = document.getElementById("dist-error-" + uid);
      const courseError = document.getElementById("course-error-" + uid);
      const legHolder = uid === "arrival" ? route.arrivalLeg : route.waypoints.find((w) => w.uid === uid);

      function refreshRowState() {
        const distCheck = validateDistance(legHolder.legDistanceNm);
        const courseCheck = validateCourse(legHolder.legTrueCourseDeg);
        const isInvalid = distCheck.state === "invalid" || courseCheck.state === "invalid";
        const isIncomplete = !isInvalid && (distCheck.state === "missing" || courseCheck.state === "missing");
        row.classList.toggle("route-row--invalid", isInvalid);
        row.classList.toggle("route-row--incomplete", isIncomplete);
        if (distInput) {
          distInput.setAttribute("aria-invalid", String(distCheck.state === "invalid"));
        }
        if (distError) {
          distError.textContent = distCheck.state === "invalid" ? distCheck.message : "";
        }
        if (courseInput) {
          courseInput.setAttribute("aria-invalid", String(courseCheck.state === "invalid"));
        }
        if (courseError) {
          courseError.textContent = courseCheck.state === "invalid" ? courseCheck.message : "";
        }
      }

      if (distInput && legHolder) {
        distInput.addEventListener("input", () => {
          const raw = distInput.value.trim();
          // parseFloat("") is NaN, not "not yet typed". keep that case as
          // null (missing) so validateDistance doesn't merge it with "invalid".
          legHolder.legDistanceNm = raw === "" ? null : parseFloat(raw);
          distInput.classList.remove("route-row__input--auto");
          refreshRowState();
          saveDraft();
          renderSummaryOnly();
        });
      }
      if (courseInput && legHolder) {
        courseInput.addEventListener("input", () => {
          const raw = courseInput.value.trim();
          legHolder.legTrueCourseDeg = raw === "" ? null : parseFloat(raw);
          courseInput.classList.remove("route-row__input--auto");
          refreshRowState();
          saveDraft();
          renderSummaryOnly();
        });
      }

      row.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => handleRowAction(uid, btn.dataset.action));
      });
    });
  }

  // Recomputes only the totals strip, without re-rendering (and thus not
  // stealing focus from) the input the student is actively typing in.
  function renderSummaryOnly() {
    summaryEl.innerHTML = summaryHtml(summarizeLegs(allPoints()));
  }

  function handleRowAction(uid, action) {
    const idx = route.waypoints.findIndex((w) => w.uid === uid);
    if (idx === -1) {
      return;
    }
    hideAddConfirm();
    if (action === "remove") {
      route.waypoints.splice(idx, 1);
    } else if (action === "up" && idx > 0) {
      [route.waypoints[idx - 1], route.waypoints[idx]] = [route.waypoints[idx], route.waypoints[idx - 1]];
    } else if (action === "down" && idx < route.waypoints.length - 1) {
      [route.waypoints[idx + 1], route.waypoints[idx]] = [route.waypoints[idx], route.waypoints[idx + 1]];
    } else {
      return;
    }
    recalcAllLegs();
    renderTable();
    saveDraft();
    if (window.showToast) {
      window.showToast("Route updated. Distances/courses recalculated.");
    }
  }

  // The add-waypoint flow pauses at confirmation so a mistaken pick does not mutate the route.

  let pendingWaypoint = null;

  function showAddConfirm(waypoint) {
    pendingWaypoint = waypoint;
    addConfirmText.textContent = "Add “" + waypoint.name + "” as the next waypoint before arrival?";
    addConfirmBar.hidden = false;
    addSelect.disabled = true;
    addBtn.disabled = true;
    addConfirmBtn.focus();
  }

  function hideAddConfirm() {
    pendingWaypoint = null;
    addConfirmBar.hidden = true;
    addSelect.disabled = false;
    addBtn.disabled = false;
  }

  addBtn.addEventListener("click", () => {
    const value = addSelect.value;
    if (!value) {
      return;
    }
    if (value === CUSTOM_VALUE) {
      const CUSTOM_NAME_MAX_LEN = 40;
      const name = window.prompt("Name this point (e.g. a landmark or turning point):");
      if (!name || !name.trim()) {
        return;
      }
      const trimmedName = name.trim();
      if (trimmedName.length > CUSTOM_NAME_MAX_LEN) {
        if (window.showToast) {
          window.showToast(
            "That name is too long (" + trimmedName.length + " characters) - keep it to " +
            CUSTOM_NAME_MAX_LEN + " or fewer and try again."
          );
        }
        return;
      }
      showAddConfirm({
        uid: makeUid(),
        kind: "custom",
        name: trimmedName,
        position: null,
        legDistanceNm: null,
        legTrueCourseDeg: null
      });
    } else {
      const dataWpt = waypointDataset.find((w) => w.id === value);
      if (!dataWpt) {
        return;
      }
      showAddConfirm({
        uid: makeUid(),
        kind: "named",
        name: dataWpt.name,
        position: dataWpt.position,
        legDistanceNm: null,
        legTrueCourseDeg: null
      });
    }
  });

  addConfirmBtn.addEventListener("click", () => {
    if (!pendingWaypoint) {
      return;
    }
    route.waypoints.push(pendingWaypoint);
    hideAddConfirm();
    recalcAllLegs();
    renderTable();
    saveDraft();
    if (window.showToast) {
      window.showToast("Waypoint added.");
    }
  });

  addCancelBtn.addEventListener("click", () => {
    hideAddConfirm();
  });

  // Endpoint changes and the reset action rebuild the route state immediately.

  departureSelect.addEventListener("change", () => {
    hideAddConfirm();
    route.departureIcao = departureSelect.value;
    renderEndpointSelects();
    renderAddSelect();
    recalcAllLegs();
    renderTable();
    saveDraft();
  });

  arrivalSelect.addEventListener("change", () => {
    hideAddConfirm();
    route.arrivalIcao = arrivalSelect.value;
    renderEndpointSelects();
    renderAddSelect();
    recalcAllLegs();
    renderTable();
    saveDraft();
  });

  resetBtn.addEventListener("click", () => {
    const ok = window.confirm("Clear the current route draft and start over?");
    if (!ok) {
      return;
    }
    hideAddConfirm();
    route = defaultRoute();
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      /* ignore */
    }
    renderEndpointSelects();
    renderAddSelect();
    recalcAllLegs();
    renderTable();
    if (window.showToast) {
      window.showToast("Route reset.");
    }
  });

  // The initial render seeds the table, summary, and draft storage.

  if (isNewRoute) {
    recalcAllLegs();
  }
  renderEndpointSelects();
  renderAddSelect();
  renderTable();
  saveDraft();
})();

// The wind-triangle logic is pure and is reused by the preview panels and NAVLOG calculations.

export function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

// These limits keep the preview inputs within sensible training values.

const TAS_MIN_KT = 20; // below this isn't a realistic training-aircraft TAS
const TAS_MAX_KT = 300;
const WIND_DIR_MIN_DEG = 0;
const WIND_DIR_MAX_DEG = 359;
const WIND_SPEED_MIN_KT = 0;
const WIND_SPEED_MAX_KT = 150; // generous sanity bound, far above any VFR training limit
const MAGVAR_MIN_DEG = -30;
const MAGVAR_MAX_DEG = 30;

export function validateTas(val) {
  return numericFieldCheck(val, {
    min: TAS_MIN_KT,
    max: TAS_MAX_KT,
    rangeMessage: "TAS must be between " + TAS_MIN_KT + " and " + TAS_MAX_KT + " kt."
  });
}

export function validateWindDir(val) {
  return numericFieldCheck(val, {
    min: WIND_DIR_MIN_DEG,
    max: WIND_DIR_MAX_DEG,
    rangeMessage: "Wind direction must be between 000° and 359°."
  });
}

export function validateWindSpeed(val) {
  return numericFieldCheck(val, {
    min: WIND_SPEED_MIN_KT,
    max: WIND_SPEED_MAX_KT,
    rangeMessage: "Wind speed must be between 0 and " + WIND_SPEED_MAX_KT + " kt."
  });
}

export function validateMagVar(val) {
  return numericFieldCheck(val, {
    min: MAGVAR_MIN_DEG,
    max: MAGVAR_MAX_DEG,
    rangeMessage: "Magnetic variation must be between " + MAGVAR_MIN_DEG + "° and " + MAGVAR_MAX_DEG + "°."
  });
}

// Solves one leg of the wind triangle and returns the heading and groundspeed results.
export function solveLeg(p) {
  const tasKt = p.tasKt;
  if (!(tasKt > 0)) {
    throw new Error("solveLeg: tasKt must be a positive number");
  }
  const A = toRad(p.windDirDeg - p.trueCourseDeg);
  const ratio = (p.windSpeedKt * Math.sin(A)) / tasKt;
  // Ratio outside [-1, 1] means wind exceeds TAS on the crosswind component
  // (leg unflyable) - clamp so asin() returns a number, not NaN.
  const clamped = Math.max(-1, Math.min(1, ratio));
  const wcaRad = Math.asin(clamped);
  const wcaDeg = toDeg(wcaRad);
  const trueHeadingDeg = normalizeDeg(p.trueCourseDeg + wcaDeg);
  // === 0 also catches -0 (from float subtraction on a pure crosswind leg)
  // so the UI never renders "-0 kt" for what is physically a stationary leg.
  const rawGroundSpeedKt = tasKt * Math.cos(wcaRad) - p.windSpeedKt * Math.cos(A);
  const groundSpeedKt = rawGroundSpeedKt === 0 ? 0 : rawGroundSpeedKt;
  const magHeadingDeg = normalizeDeg(trueHeadingDeg - (p.magVarDeg || 0));
  return {
    wcaDeg,
    trueHeadingDeg,
    magHeadingDeg,
    groundSpeedKt,
    unflyable: Math.abs(ratio) > 1
  };
}

// The wind preview self-tests use hand-checkable values rather than copied table data.

const WIND_SELF_TEST_CASES = [
  {
    label: "No wind - heading should equal course, GS should equal TAS",
    input: { trueCourseDeg: 90, distanceNm: 30, tasKt: 100, windDirDeg: 90, windSpeedKt: 0, magVarDeg: 0 },
    expected: { wcaDeg: 0, trueHeadingDeg: 90, groundSpeedKt: 100, magHeadingDeg: 90 }
  },
  {
    label: "Direct headwind (wind FROM straight ahead) - GS = TAS - wind",
    input: { trueCourseDeg: 360, distanceNm: 30, tasKt: 100, windDirDeg: 360, windSpeedKt: 20, magVarDeg: 0 },
    expected: { wcaDeg: 0, trueHeadingDeg: 0, groundSpeedKt: 80, magHeadingDeg: 0 }
  },
  {
    label: "Direct tailwind (wind FROM straight behind) - GS = TAS + wind",
    input: { trueCourseDeg: 180, distanceNm: 30, tasKt: 100, windDirDeg: 0, windSpeedKt: 20, magVarDeg: 0 },
    expected: { wcaDeg: 0, trueHeadingDeg: 180, groundSpeedKt: 120, magHeadingDeg: 180 }
  },
  {
    label: "90° crosswind, wind speed = TAS × 0.5 → WCA = asin(0.5) = exactly 30°",
    input: { trueCourseDeg: 0, distanceNm: 30, tasKt: 100, windDirDeg: 90, windSpeedKt: 50, magVarDeg: 0 },
    expected: { wcaDeg: 30, trueHeadingDeg: 30, groundSpeedKt: 86.60254, magHeadingDeg: 30 }
  },
  {
    label: "Same 90° crosswind, wind from the other side → WCA flips sign",
    input: { trueCourseDeg: 0, distanceNm: 30, tasKt: 100, windDirDeg: 270, windSpeedKt: 50, magVarDeg: 0 },
    expected: { wcaDeg: -30, trueHeadingDeg: 330, groundSpeedKt: 86.60254, magHeadingDeg: 330 }
  },
  {
    label: "Magnetic variation applied - 13°E means MH = TH - 13 (Bankstown's magVarDeg)",
    input: { trueCourseDeg: 90, distanceNm: 30, tasKt: 100, windDirDeg: 90, windSpeedKt: 0, magVarDeg: 13 },
    expected: { wcaDeg: 0, trueHeadingDeg: 90, groundSpeedKt: 100, magHeadingDeg: 77 }
  }
];

// Runs the wind self-tests and reports per-field diffs for any mismatch.
function runWindTriangleSelfTests(tolerance = 0.01) {
  return WIND_SELF_TEST_CASES.map((testCase) => {
    const result = solveLeg(testCase.input);
    const fields = ["wcaDeg", "trueHeadingDeg", "groundSpeedKt", "magHeadingDeg"];
    const diffs = fields.map((field) => ({
      field,
      expected: testCase.expected[field],
      actual: result[field],
      pass: approxEqual(result[field], testCase.expected[field], tolerance)
    }));
    return {
      label: testCase.label,
      pass: diffs.every((d) => d.pass),
      diffs
    };
  });
}

// Wires the wind preview panel and its table rendering.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM (e.g. imported headlessly in Node to run self-tests) — nothing to wire up.
  }

  const toggleBtn = document.getElementById("wind-preview-toggle");
  const body = document.getElementById("wind-preview-body");
  const tasInput = document.getElementById("wind-preview-tas");
  const windDirInput = document.getElementById("wind-preview-wind-dir");
  const windSpeedInput = document.getElementById("wind-preview-wind-speed");
  const magVarInput = document.getElementById("wind-preview-magvar");
  const tasError = document.getElementById("wind-preview-tas-error");
  const windDirError = document.getElementById("wind-preview-wind-dir-error");
  const windSpeedError = document.getElementById("wind-preview-wind-speed-error");
  const magVarError = document.getElementById("wind-preview-magvar-error");
  const magVarSourceNote = document.getElementById("wind-preview-magvar-note");
  const fetchBtn = document.getElementById("wind-preview-fetch-btn");
  const fetchNote = document.getElementById("wind-preview-fetch-note");
  const resultsBody = document.getElementById("wind-preview-table-body");
  const emptyNote = document.getElementById("wind-preview-empty");
  const selfTestList = document.getElementById("wind-preview-selftest-list");
  const selfTestSummary = document.getElementById("wind-preview-selftest-summary");

  if (!toggleBtn || !body) {
    return; // Preview panel markup not present — defensive no-op.
  }

  toggleBtn.addEventListener("click", () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    if (!expanded) {
      renderPreview();
      renderSelfTests();
    }
  });

  [tasInput, windDirInput, windSpeedInput, magVarInput].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderPreview);
    }
  });

  let aerodromesById = new Map();
  let defaultMagVarApplied = false;

  async function loadAerodromesOnce() {
    if (aerodromesById.size > 0) {
      return;
    }
    try {
      const res = await fetch("./data/aerodromes.json");
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      const data = await res.json();
      (data.aerodromes || []).forEach((a) => aerodromesById.set(a.icao, a));
    } catch (err) {
      console.warn("Wind preview: couldn't load aerodromes.json for magnetic variation.", err);
    }
  }

  function routeLegs(route) {
    const dep = aerodromesById.get(route.departureIcao);
    const arr = aerodromesById.get(route.arrivalIcao);
    const points = [
      { name: dep ? dep.icao + " - " + dep.name : route.departureIcao, isEndpoint: true },
      ...route.waypoints.map((w) => ({
        name: w.name,
        legDistanceNm: w.legDistanceNm,
        legTrueCourseDeg: w.legTrueCourseDeg,
        isEndpoint: false
      })),
      {
        name: arr ? arr.icao + " - " + arr.name : route.arrivalIcao,
        legDistanceNm: route.arrivalLeg ? route.arrivalLeg.legDistanceNm : null,
        legTrueCourseDeg: route.arrivalLeg ? route.arrivalLeg.legTrueCourseDeg : null,
        isEndpoint: true,
        isArrival: true
      }
    ];
    const legs = [];
    for (let i = 1; i < points.length; i++) {
      legs.push({
        fromName: points[i - 1].name,
        toName: points[i].name,
        distanceNm: points[i].legDistanceNm,
        trueCourseDeg: points[i].legTrueCourseDeg
      });
    }
    return { legs, dep };
  }

  // Fetches indicative current wind from Open-Meteo (free, no key) for the
  // route's departure aerodrome - same API/pattern as gonogo.js's own
  // fetchWeather(), requesting wind speed directly in knots so no unit
  // conversion is needed here (BUG-01: this panel previously had no live-
  // weather option at all, unlike Go/No-Go).
  async function fetchWindWeather() {
    await loadAerodromesOnce();
    const route = loadRouteDraft();
    const dep = route ? aerodromesById.get(route.departureIcao) : null;
    if (!dep || !dep.position) {
      fetchNote.textContent = "No route/departure aerodrome found yet. Build a route above first.";
      return;
    }
    fetchBtn.disabled = true;
    fetchNote.textContent = "Fetching indicative weather for " + dep.icao + "…";
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=" + dep.position.lat +
        "&longitude=" + dep.position.lon +
        "&current=wind_speed_10m,wind_direction_10m" +
        "&wind_speed_unit=kn&timezone=auto";
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("HTTP " + res.status);
      }
      const data = await res.json();
      const current = data.current || {};
      if (typeof current.wind_speed_10m === "number") {
        windSpeedInput.value = Math.round(current.wind_speed_10m);
      }
      if (typeof current.wind_direction_10m === "number") {
        windDirInput.value = Math.round(current.wind_direction_10m);
      }
      fetchNote.textContent =
        "Fetched indicative wind for " + dep.icao + " at " + (current.time || "now") +
        ". Not certified aviation weather. Edit either field by hand if you have a better source.";
      renderPreview();
    } catch (err) {
      console.warn("Wind preview: couldn't fetch Open-Meteo weather.", err);
      fetchNote.textContent =
        "Couldn't fetch indicative weather (needs an internet connection).";
    } finally {
      fetchBtn.disabled = false;
    }
  }

  if (fetchBtn) {
    fetchBtn.addEventListener("click", fetchWindWeather);
  }

  async function renderPreview() {
    await loadAerodromesOnce();
    const route = loadRouteDraft();

    if (!defaultMagVarApplied && route) {
      const dep = aerodromesById.get(route.departureIcao);
      if (dep && typeof dep.magVarDeg === "number" && magVarInput && magVarInput.value === "") {
        magVarInput.value = dep.magVarDeg;
        defaultMagVarApplied = true;
        if (magVarSourceNote) {
          magVarSourceNote.textContent =
            "Pre-filled from " + dep.icao + "'s magVarDeg (" + dep.magVarDeg +
            "°E). Edit if a leg's actual variation differs. The whole " +
            "route uses one figure for now; Sydney Basin variation doesn't change " +
            "enough over these distances to need a per-leg value.";
        }
      }
    }

    if (!route || route.waypoints === undefined) {
      resultsBody.innerHTML = "";
      emptyNote.hidden = false;
      emptyNote.textContent = "No route found yet. Build a route above first, then come back to this panel.";
      return;
    }

    // "missing" wind/magvar is fine (defaults to calm/0); "invalid" blocks.
    const tasCheck = validateTas(tasInput.value);
    const windDirCheck = validateWindDir(windDirInput.value);
    const windSpeedCheck = validateWindSpeed(windSpeedInput.value);
    const magVarCheck = validateMagVar(magVarInput.value);

    applyFieldCheck(tasInput, tasError, tasCheck);
    applyFieldCheck(windDirInput, windDirError, windDirCheck);
    applyFieldCheck(windSpeedInput, windSpeedError, windSpeedCheck);
    applyFieldCheck(magVarInput, magVarError, magVarCheck);

    const anyInvalid =
      tasCheck.state === "invalid" ||
      windDirCheck.state === "invalid" ||
      windSpeedCheck.state === "invalid" ||
      magVarCheck.state === "invalid";

    if (anyInvalid) {
      resultsBody.innerHTML = "";
      emptyNote.hidden = false;
      emptyNote.textContent = "Fix the highlighted field(s) above to calculate headings.";
      return;
    }

    if (tasCheck.state === "missing") {
      resultsBody.innerHTML = "";
      emptyNote.hidden = false;
      emptyNote.textContent = "Enter a true airspeed (TAS) above to calculate headings.";
      return;
    }

    emptyNote.hidden = true;

    const { legs } = routeLegs(route);
    const tasKt = tasCheck.value;
    const windDirDeg = windDirCheck.state === "valid" ? windDirCheck.value : 0;
    const windSpeedKt = windSpeedCheck.state === "valid" ? windSpeedCheck.value : 0;
    const magVarDeg = magVarCheck.state === "valid" ? magVarCheck.value : 0;

    let rowsHtml = "";
    legs.forEach((leg, i) => {
      if (typeof leg.distanceNm !== "number" || typeof leg.trueCourseDeg !== "number") {
        rowsHtml +=
          '<tr class="wind-preview-row wind-preview-row--incomplete">' +
          '<td class="wind-preview-row__index">' + (i + 1) + "</td>" +
          "<td>" + escapeHtml(leg.fromName) + " → " + escapeHtml(leg.toName) + "</td>" +
          '<td colspan="5">Leg is missing a distance/true course. Fill it in above on the route table first.</td>' +
          "</tr>";
        return;
      }
      const result = solveLeg({
        trueCourseDeg: leg.trueCourseDeg,
        distanceNm: leg.distanceNm,
        tasKt,
        windDirDeg,
        windSpeedKt,
        magVarDeg
      });
      const wcaLabel =
        (result.wcaDeg >= 0 ? "R " : "L ") + Math.abs(result.wcaDeg).toFixed(0) + "°";
      rowsHtml +=
        '<tr class="wind-preview-row' + (result.unflyable ? " wind-preview-row--unflyable" : "") + '">' +
        '<td class="wind-preview-row__index">' + (i + 1) + "</td>" +
        "<td>" + escapeHtml(leg.fromName) + " → " + escapeHtml(leg.toName) + "</td>" +
        "<td>" + leg.trueCourseDeg.toFixed(0) + "°T</td>" +
        "<td>" +
        (result.unflyable
          ? '<span class="chip chip--nogo">Wind exceeds TAS</span>'
          : wcaLabel) +
        "</td>" +
        "<td>" + result.trueHeadingDeg.toFixed(0) + "°T</td>" +
        "<td>" + result.magHeadingDeg.toFixed(0) + "°M</td>" +
        "<td>" + result.groundSpeedKt.toFixed(0) + " kt</td>" +
        "</tr>";
    });
    resultsBody.innerHTML = rowsHtml;
  }

  function renderSelfTests() {
    renderSelfTestList(selfTestList, selfTestSummary, runWindTriangleSelfTests(), {
      itemClass: "wind-preview-selftest__item",
      detailClass: "wind-preview-selftest__detail",
      summaryClass: "wind-preview-selftest__summary",
      renderDetail: (r) =>
        r.diffs
          .filter((d) => !d.pass)
          .map((d) => d.field + ": expected " + d.expected + ", got " + d.actual.toFixed(3))
          .join("; ")
    });
  }
})();

// The time and ETA helpers are pure calculations reused by the preview panels and NAVLOG.

const DEPARTURE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Validates a departure time in HH:MM form and returns a missing/invalid/valid result.
export function validateDepartureTime(val) {
  if (val === null || val === undefined || String(val).trim() === "") {
    return { state: "missing" };
  }
  const match = DEPARTURE_TIME_PATTERN.exec(String(val).trim());
  if (!match) {
    return { state: "invalid", message: "Enter a time as HH:MM, 24-hour (e.g. 09:15 or 21:05)." };
  }
  // The regex groups are strings ("09"); Number() (rather than parseInt,
  // which could read "09" as octal-looking text in some older engines)
  // converts them to plain numbers.
  return { state: "valid", value: { h: Number(match[1]), m: Number(match[2]) } };
}

// Returns the ETE for one leg in minutes, or null when the leg cannot be flown.
export function eteMinutesForLeg(distanceNm, groundSpeedKt) {
  if (!(groundSpeedKt > 0) || !(distanceNm >= 0)) {
    return null;
  }
  return (distanceNm / groundSpeedKt) * 60;
}

// Formats a minutes value as a human-readable ETE string.
export function formatEte(minutes) {
  if (minutes === null || minutes === undefined || !isFinite(minutes)) {
    return "-"; // em dash - "not available", not zero
  }
  const totalWholeMin = Math.round(minutes);
  const hrs = Math.floor(totalWholeMin / 60);
  const mins = totalWholeMin % 60;
  const minsStr = String(mins).padStart(2, "0");
  return hrs > 0 ? hrs + "h " + minsStr + "m" : totalWholeMin + " min";
}

// Adds minutes to a 24-hour clock and returns a wrapped clock value with a day offset.
export function addMinutesClock(h, m, minutesToAdd) {
  const totalStartMin = h * 60 + m;
  const totalMin = totalStartMin + minutesToAdd;
  const dayOffset = Math.floor(totalMin / 1440); // 1440 = minutes in a day
  const wrapped = ((totalMin % 1440) + 1440) % 1440; // guards against a negative totalMin too
  return {
    h: Math.floor(wrapped / 60),
    m: Math.round(wrapped % 60),
    dayOffset
  };
}

// Formats a clock value as HH:MM and adds a day-offset suffix when needed.
export function formatClock(clock) {
  const hh = String(clock.h).padStart(2, "0");
  const mm = String(clock.m).padStart(2, "0");
  const suffix = clock.dayOffset > 0 ? " (+" + clock.dayOffset + "d)" : "";
  return hh + ":" + mm + suffix;
}

// The shared route-reading helper caches aerodrome lookups so the later panels do not re-fetch them.

let aerodromesByIdCache = null;

async function loadAerodromesOnce() {
  if (aerodromesByIdCache) {
    return aerodromesByIdCache;
  }
  const map = new Map();
  try {
    const res = await fetch("./data/aerodromes.json");
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    const data = await res.json();
    (data.aerodromes || []).forEach((a) => map.set(a.icao, a));
  } catch (err) {
    console.warn("Time & ETA preview: couldn't load aerodromes.json.", err);
  }
  aerodromesByIdCache = map;
  return map;
}

// Rebuilds the route into per-leg objects with distance, course, and optional groundspeed data.
export async function loadRouteLegsWithGs(windParams) {
  const aerodromesById = await loadAerodromesOnce();
  const route = loadRouteDraft();
  if (!route) {
    return { route: null, legs: [], dep: null, arr: null };
  }

  const dep = aerodromesById.get(route.departureIcao);
  const arr = aerodromesById.get(route.arrivalIcao);
  const points = [
    { name: dep ? dep.icao + " - " + dep.name : route.departureIcao },
    ...route.waypoints.map((w) => ({
      name: w.name,
      legDistanceNm: w.legDistanceNm,
      legTrueCourseDeg: w.legTrueCourseDeg
    })),
    {
      name: arr ? arr.icao + " - " + arr.name : route.arrivalIcao,
      legDistanceNm: route.arrivalLeg ? route.arrivalLeg.legDistanceNm : null,
      legTrueCourseDeg: route.arrivalLeg ? route.arrivalLeg.legTrueCourseDeg : null
    }
  ];

  const legs = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const distanceNm = to.legDistanceNm;
    const trueCourseDeg = to.legTrueCourseDeg;
    const complete = typeof distanceNm === "number" && typeof trueCourseDeg === "number";
    let groundSpeedKt = null;
    let wcaDeg = null;
    let trueHeadingDeg = null;
    let magHeadingDeg = null;
    let unflyable = false;
    if (complete && windParams) {
      const result = solveLeg({
        trueCourseDeg,
        distanceNm,
        tasKt: windParams.tasKt,
        windDirDeg: windParams.windDirDeg,
        windSpeedKt: windParams.windSpeedKt,
        magVarDeg: windParams.magVarDeg
      });
      groundSpeedKt = result.groundSpeedKt;
      wcaDeg = result.wcaDeg;
      trueHeadingDeg = result.trueHeadingDeg;
      magHeadingDeg = result.magHeadingDeg;
      unflyable = result.unflyable || result.groundSpeedKt <= 0;
    }
    legs.push({
      fromName: from.name,
      toName: to.name,
      distanceNm,
      trueCourseDeg,
      complete,
      groundSpeedKt,
      wcaDeg,
      trueHeadingDeg,
      magHeadingDeg,
      unflyable
    });
  }
  return { route, legs, dep: dep || null, arr: arr || null };
}

// The time and ETA self-tests cover simple arithmetic and clock wraparound cases.

const TIME_SELF_TEST_CASES = [
  {
    label: "30 NM at 90 kt GS → ETE = 20 min exactly",
    fn: () => eteMinutesForLeg(30, 90),
    expected: 20
  },
  {
    label: "100 NM at 100 kt GS → ETE = 60 min (formats as “1h 00m”)",
    fn: () => eteMinutesForLeg(100, 100),
    expected: 60
  },
  {
    label: "45 NM at 60 kt GS → ETE = 45 min",
    fn: () => eteMinutesForLeg(45, 60),
    expected: 45
  },
  {
    label: "Zero/negative groundspeed (wind exceeds TAS) → ETE is null, not Infinity/NaN",
    fn: () => eteMinutesForLeg(30, 0),
    expected: null
  }
];

const CLOCK_SELF_TEST_CASES = [
  {
    label: "09:15 + 45 min → 10:00, same day",
    fn: () => addMinutesClock(9, 15, 45),
    expected: { h: 10, m: 0, dayOffset: 0 }
  },
  {
    label: "23:50 + 20 min → 00:10, rolls to next day (+1d)",
    fn: () => addMinutesClock(23, 50, 20),
    expected: { h: 0, m: 10, dayOffset: 1 }
  },
  {
    label: "00:00 + 90 min → 01:30, same day",
    fn: () => addMinutesClock(0, 0, 90),
    expected: { h: 1, m: 30, dayOffset: 0 }
  }
];

// Runs the time and clock self-tests and reports pass/fail for each case.
function runTimeEteSelfTests(tolerance = 0.01) {
  const eteResults = TIME_SELF_TEST_CASES.map((testCase) => {
    const actual = testCase.fn();
    return { label: testCase.label, pass: approxEqual(actual, testCase.expected, tolerance), expected: testCase.expected, actual };
  });
  const clockResults = CLOCK_SELF_TEST_CASES.map((testCase) => {
    const actual = testCase.fn();
    const pass =
      actual.h === testCase.expected.h && actual.m === testCase.expected.m && actual.dayOffset === testCase.expected.dayOffset;
    return { label: testCase.label, pass, expected: testCase.expected, actual };
  });
  return [...eteResults, ...clockResults];
}

// Wires the time and ETA preview panel and its table rendering.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM (e.g. imported headlessly to run self-tests) — nothing to wire up.
  }

  const toggleBtn = document.getElementById("time-eta-toggle");
  const body = document.getElementById("time-eta-body");
  const departureInput = document.getElementById("time-eta-departure");
  const departureError = document.getElementById("time-eta-departure-error");
  const resultsBody = document.getElementById("time-eta-table-body");
  const emptyNote = document.getElementById("time-eta-empty");
  const totalNote = document.getElementById("time-eta-total-note");
  const selfTestList = document.getElementById("time-eta-selftest-list");
  const selfTestSummary = document.getElementById("time-eta-selftest-summary");

  // These belong to the wind-preview panel's own markup — read only,
  // never written to, same rule this whole section follows for the
  // route draft.
  const tasInput = document.getElementById("wind-preview-tas");
  const windDirInput = document.getElementById("wind-preview-wind-dir");
  const windSpeedInput = document.getElementById("wind-preview-wind-speed");
  const magVarInput = document.getElementById("wind-preview-magvar");

  if (!toggleBtn || !body) {
    return; // Preview panel markup not present — defensive no-op.
  }

  toggleBtn.addEventListener("click", () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    if (!expanded) {
      renderPreview();
      renderSelfTests();
    }
  });

  // Re-render on any of the four wind-panel fields too, since this
  // panel's groundspeed (and therefore every ETE) depends on them.
  [departureInput, tasInput, windDirInput, windSpeedInput, magVarInput].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderPreview);
    }
  });

  async function renderPreview() {
    const departureCheck = validateDepartureTime(departureInput.value);
    const isInvalidTime = departureCheck.state === "invalid";
    departureInput.setAttribute("aria-invalid", String(isInvalidTime));
    departureError.textContent = isInvalidTime ? departureCheck.message : "";

    // Read the wind-panel's own inputs the same way that panel reads
    // itself (missing = default sensibly, invalid = block).
    const tasVal = parseFloat(tasInput.value);
    const windDirVal = windDirInput.value.trim() === "" ? 0 : parseFloat(windDirInput.value);
    const windSpeedVal = windSpeedInput.value.trim() === "" ? 0 : parseFloat(windSpeedInput.value);
    const magVarVal = magVarInput.value.trim() === "" ? 0 : parseFloat(magVarInput.value);

    if (tasInput.value.trim() === "" || isNaN(tasVal) || tasVal <= 0) {
      resultsBody.innerHTML = "";
      totalNote.textContent = "";
      emptyNote.hidden = false;
      emptyNote.textContent =
        "Enter a true airspeed in the “Wind and heading preview” panel above first. Groundspeed comes from there.";
      return;
    }

    const { route, legs } = await loadRouteLegsWithGs({
      tasKt: tasVal,
      windDirDeg: windDirVal,
      windSpeedKt: windSpeedVal,
      magVarDeg: magVarVal
    });

    if (!route) {
      resultsBody.innerHTML = "";
      totalNote.textContent = "";
      emptyNote.hidden = false;
      emptyNote.textContent = "No route found yet. Build a route above first, then come back to this panel.";
      return;
    }

    emptyNote.hidden = true;

    const hasDeparture = departureCheck.state === "valid";
    let clock = hasDeparture ? { h: departureCheck.value.h, m: departureCheck.value.m, dayOffset: 0 } : null;
    let cumulativeMinutes = 0;
    let totalMinutes = 0;
    let anyIncomplete = false;
    let anyUnflyable = false;

    let rowsHtml = "";
    legs.forEach((leg, i) => {
      if (!leg.complete) {
        anyIncomplete = true;
        rowsHtml +=
          '<tr class="time-eta-row time-eta-row--incomplete">' +
          '<td class="time-eta-row__index">' + (i + 1) + "</td>" +
          "<td>" + escapeHtml(leg.fromName) + " → " + escapeHtml(leg.toName) + "</td>" +
          '<td colspan="4">Leg is missing a distance/true course. Fill it in on the route table above.</td>' +
          "</tr>";
        return;
      }

      const ete = eteMinutesForLeg(leg.distanceNm, leg.groundSpeedKt);
      if (leg.unflyable || ete === null) {
        anyUnflyable = true;
        rowsHtml +=
          '<tr class="time-eta-row time-eta-row--unflyable">' +
          '<td class="time-eta-row__index">' + (i + 1) + "</td>" +
          "<td>" + escapeHtml(leg.fromName) + " → " + escapeHtml(leg.toName) + "</td>" +
          "<td>" + leg.distanceNm.toFixed(1) + " NM</td>" +
          '<td colspan="3"><span class="chip chip--nogo">Wind exceeds TAS. ETE unavailable</span></td>' +
          "</tr>";
        return;
      }

      totalMinutes += ete;
      let etaCell = "-";
      if (hasDeparture) {
        cumulativeMinutes += ete;
        clock = addMinutesClock(departureCheck.value.h, departureCheck.value.m, cumulativeMinutes);
        etaCell = formatClock(clock);
      }

      rowsHtml +=
        '<tr class="time-eta-row">' +
        '<td class="time-eta-row__index">' + (i + 1) + "</td>" +
        "<td>" + escapeHtml(leg.fromName) + " → " + escapeHtml(leg.toName) + "</td>" +
        "<td>" + leg.distanceNm.toFixed(1) + " NM</td>" +
        "<td>" + leg.groundSpeedKt.toFixed(0) + " kt</td>" +
        "<td>" + formatEte(ete) + "</td>" +
        "<td>" + etaCell + "</td>" +
        "</tr>";
    });

    resultsBody.innerHTML = rowsHtml;

    let note = "Total en-route time: " + formatEte(totalMinutes) + ".";
    if (!hasDeparture) {
      note += " Enter a departure time above to also see each leg's ETA.";
    }
    if (anyIncomplete) {
      note += " Some legs are missing distance/course and are excluded from the total.";
    }
    if (anyUnflyable) {
      note += " Some legs can't be flown as entered (wind exceeds TAS) and are excluded from the total.";
    }
    totalNote.textContent = note;
  }

  function renderSelfTests() {
    renderSelfTestList(selfTestList, selfTestSummary, runTimeEteSelfTests(), {
      itemClass: "time-eta-selftest__item",
      detailClass: "time-eta-selftest__detail",
      summaryClass: "time-eta-selftest__summary",
      renderDetail: (r) => "expected " + JSON.stringify(r.expected) + ", got " + JSON.stringify(r.actual)
    });
  }
})();

// The fuel helpers are pure calculations reused by the fuel preview and NAVLOG totals.

const DAY_RESERVE_MIN = 30;
const NIGHT_RESERVE_MIN = 45;

// Returns the standard training reserve for the selected flight condition.
export function reserveMinutesFor(condition) {
  return condition === "night" ? NIGHT_RESERVE_MIN : DAY_RESERVE_MIN;
}

// Returns the fuel requirement for a trip, including the reserve margin.
export function fuelRequired(totalTripMinutes, cruiseBurnLph, condition) {
  const reserveMinutes = reserveMinutesFor(condition);
  const tripFuelL = (totalTripMinutes / 60) * cruiseBurnLph;
  const reserveFuelL = (reserveMinutes / 60) * cruiseBurnLph;
  return {
    tripFuelL,
    reserveFuelL,
    totalFuelL: tripFuelL + reserveFuelL,
    reserveMinutes
  };
}

// Compares the required fuel against the aircraft's usable fuel capacity.
export function checkFuelSufficiency(totalFuelL, usableFuelL) {
  const spareL = usableFuelL - totalFuelL;
  return { state: spareL >= 0 ? "ok" : "insufficient", spareL };
}

// The fuel self-tests cover reserve logic and sufficiency checks.

const FUEL_SELF_TEST_CASES = [
  {
    label: "60 min trip, 30 L/h burn, day (30 min reserve) → trip 30 L + reserve 15 L = 45 L total",
    fn: () => fuelRequired(60, 30, "day"),
    expected: { tripFuelL: 30, reserveFuelL: 15, totalFuelL: 45, reserveMinutes: 30 }
  },
  {
    label: "60 min trip, 30 L/h burn, night (45 min reserve) → trip 30 L + reserve 22.5 L = 52.5 L total",
    fn: () => fuelRequired(60, 30, "night"),
    expected: { tripFuelL: 30, reserveFuelL: 22.5, totalFuelL: 52.5, reserveMinutes: 45 }
  },
  {
    label: "45 L required against 98 L usable (C152) → sufficient, 53 L spare",
    fn: () => checkFuelSufficiency(45, 98),
    expected: { state: "ok", spareL: 53 }
  },
  {
    label: "120 L required against 98 L usable (C152) → insufficient, 22 L short",
    fn: () => checkFuelSufficiency(120, 98),
    expected: { state: "insufficient", spareL: -22 }
  }
];

function fuelValuesApproxEqual(a, b, tolerance) {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= tolerance;
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    return Object.keys(b).every((key) => fuelValuesApproxEqual(a[key], b[key], tolerance));
  }
  return a === b;
}

// Runs the fuel self-tests and reports pass/fail for each case.
function runFuelCalcSelfTests(tolerance = 0.01) {
  return FUEL_SELF_TEST_CASES.map((testCase) => {
    const actual = testCase.fn();
    return { label: testCase.label, pass: fuelValuesApproxEqual(actual, testCase.expected, tolerance), expected: testCase.expected, actual };
  });
}

// The shared aircraft loader caches the aircraft data for the later panels.

let aircraftListCache = null;

// Fetches and caches the aircraft list so later panels reuse it.
export async function loadAircraftList() {
  if (aircraftListCache) {
    return aircraftListCache;
  }
  try {
    const res = await fetch("./data/aircraft.json");
    if (!res.ok) {
      throw new Error("HTTP " + res.status);
    }
    const data = await res.json();
    aircraftListCache = data.aircraft || [];
  } catch (err) {
    console.warn("Couldn't load aircraft.json.", err);
    aircraftListCache = [];
  }
  return aircraftListCache;
}

// Wires the fuel preview panel and its computed verdict.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM (e.g. imported headlessly to run self-tests) — nothing to wire up.
  }

  const toggleBtn = document.getElementById("fuel-preview-toggle");
  const body = document.getElementById("fuel-preview-body");
  const aircraftSelect = document.getElementById("fuel-preview-aircraft");
  const conditionSelect = document.getElementById("fuel-preview-condition");
  const emptyNote = document.getElementById("fuel-preview-empty");
  const resultEl = document.getElementById("fuel-preview-result");
  const selfTestList = document.getElementById("fuel-preview-selftest-list");
  const selfTestSummary = document.getElementById("fuel-preview-selftest-summary");

  // Read-only references into the wind-preview panel's inputs — this
  // panel needs TAS/wind (via loadRouteLegsWithGs) purely to work out
  // each leg's groundspeed and, from that, total trip time.
  const tasInput = document.getElementById("wind-preview-tas");
  const windDirInput = document.getElementById("wind-preview-wind-dir");
  const windSpeedInput = document.getElementById("wind-preview-wind-speed");
  const magVarInput = document.getElementById("wind-preview-magvar");

  if (!toggleBtn || !body) {
    return; // Preview panel markup not present — defensive no-op.
  }

  let aircraftList = [];

  function selectedAircraft() {
    return aircraftList.find((a) => a.id === aircraftSelect.value) || null;
  }

  async function loadAircraftOnce() {
    if (aircraftList.length > 0) {
      return;
    }
    aircraftList = await loadAircraftList();
    aircraftSelect.innerHTML = aircraftList
      .map((a) => '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + " (" + a.cruiseBurnLph + " L/h, " + a.usableFuelL + " L usable)</option>")
      .join("");
  }

  toggleBtn.addEventListener("click", async () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    if (!expanded) {
      await loadAircraftOnce();
      renderPreview();
      renderSelfTests();
    }
  });

  [aircraftSelect, conditionSelect, tasInput, windDirInput, windSpeedInput, magVarInput].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderPreview);
      el.addEventListener("change", renderPreview);
    }
  });

  async function renderPreview() {
    const aircraft = selectedAircraft();
    if (!aircraft) {
      emptyNote.hidden = false;
      emptyNote.textContent = "No aircraft profiles loaded yet.";
      resultEl.innerHTML = "";
      return;
    }

    const tasVal = parseFloat(tasInput.value);
    if (tasInput.value.trim() === "" || isNaN(tasVal) || tasVal <= 0) {
      emptyNote.hidden = false;
      emptyNote.textContent =
        "Enter a true airspeed in the “Wind and heading preview” panel above first. This figure comes from there. " +
        aircraft.name + "'s typical cruise TAS is about " + aircraft.typicalCruiseTasKt + " kt.";
      resultEl.innerHTML = "";
      return;
    }

    const windDirVal = windDirInput.value.trim() === "" ? 0 : parseFloat(windDirInput.value);
    const windSpeedVal = windSpeedInput.value.trim() === "" ? 0 : parseFloat(windSpeedInput.value);
    const magVarVal = magVarInput.value.trim() === "" ? 0 : parseFloat(magVarInput.value);

    const { route, legs } = await loadRouteLegsWithGs({
      tasKt: tasVal,
      windDirDeg: windDirVal,
      windSpeedKt: windSpeedVal,
      magVarDeg: magVarVal
    });

    if (!route) {
      emptyNote.hidden = false;
      emptyNote.textContent = "No route found yet. Build a route above first, then come back to this panel.";
      resultEl.innerHTML = "";
      return;
    }

    let totalMinutes = 0;
    let anyIncomplete = false;
    let anyUnflyable = false;
    legs.forEach((leg) => {
      if (!leg.complete) {
        anyIncomplete = true;
        return;
      }
      const ete = eteMinutesForLeg(leg.distanceNm, leg.groundSpeedKt);
      if (leg.unflyable || ete === null) {
        anyUnflyable = true;
        return;
      }
      totalMinutes += ete;
    });

    emptyNote.hidden = true;

    const condition = conditionSelect.value === "night" ? "night" : "day";
    const fuel = fuelRequired(totalMinutes, aircraft.cruiseBurnLph, condition);
    const sufficiency = checkFuelSufficiency(fuel.totalFuelL, aircraft.usableFuelL);

    let warningsHtml = "";
    if (anyIncomplete) {
      warningsHtml += '<p class="fuel-preview__note">Some legs are missing a distance/course and are excluded from trip time.</p>';
    }
    if (anyUnflyable) {
      warningsHtml += '<p class="fuel-preview__note">Some legs can’t be flown as entered (wind exceeds TAS) and are excluded from trip time.</p>';
    }

    resultEl.innerHTML =
      '<div class="fuel-preview__figures">' +
      '<div><span class="fuel-preview__label">Total en-route time</span><strong>' + formatEte(totalMinutes) + "</strong></div>" +
      '<div><span class="fuel-preview__label">Trip fuel</span><strong>' + fuel.tripFuelL.toFixed(1) + " L</strong></div>" +
      '<div><span class="fuel-preview__label">Reserve (' + fuel.reserveMinutes + " min, " + condition + ')</span><strong>' +
      fuel.reserveFuelL.toFixed(1) + " L</strong></div>" +
      '<div><span class="fuel-preview__label">Total fuel required</span><strong>' + fuel.totalFuelL.toFixed(1) + " L</strong></div>" +
      '<div><span class="fuel-preview__label">' + escapeHtml(aircraft.name) + " usable fuel</span><strong>" + aircraft.usableFuelL + " L</strong></div>" +
      "</div>" +
      '<p class="fuel-preview__verdict">' +
      (sufficiency.state === "ok"
        ? '<span class="chip chip--go">Within usable fuel</span> ' + sufficiency.spareL.toFixed(1) + " L to spare."
        : '<span class="chip chip--nogo">Exceeds usable fuel</span> by ' + Math.abs(sufficiency.spareL).toFixed(1) +
          " L. Shorten the route, refuel en route, or pick a different aircraft.") +
      "</p>" +
      warningsHtml;
  }

  function renderSelfTests() {
    renderSelfTestList(selfTestList, selfTestSummary, runFuelCalcSelfTests(), {
      itemClass: "fuel-preview-selftest__item",
      detailClass: "fuel-preview-selftest__detail",
      summaryClass: "fuel-preview-selftest__summary",
      renderDetail: (r) => "expected " + JSON.stringify(r.expected) + ", got " + JSON.stringify(r.actual)
    });
  }
})();

// The save/load panel stores named routes separately from the temporary draft.

const SAVED_ROUTES_KEY = "navlog-saved-routes-v1";
const POST_RELOAD_VIEW_KEY = "navlog-post-reload-view";
const NAME_MAX_LEN = 40;

// The storage helpers keep the route library and the live draft separate.

export function loadSavedRoutes() {
  try {
    const raw = localStorage.getItem(SAVED_ROUTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Save/Load: couldn't read saved routes.", err);
    return {};
  }
}

function persistSavedRoutes(routes) {
  try {
    localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(routes));
  } catch (err) {
    console.warn("Save/Load: couldn't persist saved routes.", err);
  }
}

// Saves a route under the given name and returns the updated library.
export function saveNamedRoute(routes, name, route) {
  const updated = { ...routes, [name]: route };
  persistSavedRoutes(updated);
  return updated;
}

// Removes a saved route by name and returns the updated library.
export function deleteNamedRoute(routes, name) {
  const updated = { ...routes };
  delete updated[name];
  persistSavedRoutes(updated);
  return updated;
}

// The save/load self-tests check a simple round-trip through the route map.

const SAVE_LOAD_SELF_TEST_CASES = [
  {
    label: "Saving a route under a name, then reading it back, returns the exact same route object",
    fn: () => {
      const sample = { departureIcao: "YSBK", arrivalIcao: "YSCN", waypoints: [], arrivalLeg: { legDistanceNm: 16.5, legTrueCourseDeg: 245 } };
      const afterSave = saveNamedRouteInMemory({}, "Test route", sample);
      return JSON.stringify(afterSave["Test route"]) === JSON.stringify(sample);
    },
    expected: true
  },
  {
    label: "Deleting a saved route removes exactly that one entry, leaving others untouched",
    fn: () => {
      const twoRoutes = { A: { departureIcao: "YSBK" }, B: { departureIcao: "YSCN" } };
      const afterDelete = deleteNamedRouteInMemory(twoRoutes, "A");
      return Object.keys(afterDelete).length === 1 && "B" in afterDelete && !("A" in afterDelete);
    },
    expected: true
  }
];

// In-memory equivalents of saveNamedRoute()/deleteNamedRoute() that skip the
// localStorage write, so the self-test checks pure map logic headlessly.
function saveNamedRouteInMemory(routes, name, route) {
  return { ...routes, [name]: route };
}
function deleteNamedRouteInMemory(routes, name) {
  const updated = { ...routes };
  delete updated[name];
  return updated;
}

// Runs the save/load self-tests and reports pass/fail for each case.
function runSaveLoadSelfTests() {
  return SAVE_LOAD_SELF_TEST_CASES.map((testCase) => {
    const actual = testCase.fn();
    return { label: testCase.label, pass: actual === testCase.expected, expected: testCase.expected, actual };
  });
}

// Wires the save/load panel and its route actions.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM — nothing to wire up.
  }

  const toggleBtn = document.getElementById("save-load-toggle");
  const body = document.getElementById("save-load-body");
  const nameInput = document.getElementById("save-load-name");
  const saveBtn = document.getElementById("save-load-save-btn");
  const saveNote = document.getElementById("save-load-save-note");
  const listEl = document.getElementById("save-load-list");
  const emptyNote = document.getElementById("save-load-empty");
  const selfTestList = document.getElementById("save-load-selftest-list");
  const selfTestSummary = document.getElementById("save-load-selftest-summary");

  if (!toggleBtn || !body) {
    return; // Panel markup not present — defensive no-op.
  }

  function routeSummary(route) {
    const legCount = (route.waypoints || []).length + 1;
    return route.departureIcao + " → " + route.arrivalIcao + " (" + legCount + " leg" + (legCount === 1 ? "" : "s") + ")";
  }

  function renderList() {
    const routes = loadSavedRoutes();
    const names = Object.keys(routes).sort((a, b) => a.localeCompare(b));
    if (names.length === 0) {
      listEl.innerHTML = "";
      emptyNote.hidden = false;
      return;
    }
    emptyNote.hidden = true;
    listEl.innerHTML = names
      .map(
        (name) =>
          '<li class="save-load-row" data-name="' + escapeHtml(name) + '">' +
          '<div class="save-load-row__main">' +
          '<span class="save-load-row__name">' + escapeHtml(name) + "</span>" +
          '<span class="save-load-row__summary">' + escapeHtml(routeSummary(routes[name])) + "</span>" +
          "</div>" +
          '<div class="save-load-row__actions">' +
          '<button type="button" class="btn btn--ghost" data-action="load">Load</button>' +
          '<button type="button" class="btn btn--ghost save-load-row__delete" data-action="delete">Delete</button>' +
          "</div>" +
          "</li>"
      )
      .join("");

    listEl.querySelectorAll(".save-load-row").forEach((rowEl) => {
      const name = rowEl.dataset.name;
      rowEl.querySelector('[data-action="load"]').addEventListener("click", () => loadNamedRoute(name));
      rowEl.querySelector('[data-action="delete"]').addEventListener("click", () => handleDelete(name));
    });
  }

  toggleBtn.addEventListener("click", () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    if (!expanded) {
      renderList();
      renderSelfTests();
    }
  });

  saveBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    saveNote.hidden = false;
    if (!name) {
      saveNote.textContent = "Enter a name for this route.";
      return;
    }
    if (name.length > NAME_MAX_LEN) {
      saveNote.textContent = "Keep the name to " + NAME_MAX_LEN + " characters or fewer.";
      return;
    }
    const draft = loadRouteDraft();
    if (!draft) {
      saveNote.textContent = "No route found yet — build a route above first.";
      return;
    }
    const existing = loadSavedRoutes();
    if (existing[name] && !window.confirm('A saved route named "' + name + '" already exists. Overwrite it?')) {
      saveNote.textContent = "";
      return;
    }
    saveNamedRoute(existing, name, draft);
    saveNote.textContent = 'Saved as "' + name + '".';
    nameInput.value = "";
    renderList();
    if (window.showToast) {
      window.showToast("Route saved.");
    }
  });

  function loadNamedRoute(name) {
    const routes = loadSavedRoutes();
    const route = routes[name];
    if (!route) {
      return;
    }
    const ok = window.confirm('Load "' + name + '"? This replaces the route you\'re currently working on.');
    if (!ok) {
      return;
    }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(route));
      sessionStorage.setItem(POST_RELOAD_VIEW_KEY, "view-route");
    } catch (err) {
      console.warn("Save/Load: couldn't write the loaded route into the working draft.", err);
      if (window.showToast) {
        window.showToast("Couldn't load that route - see the console for details.");
      }
      return;
    }
    // route-planner section above reads the draft once, at module load —
    // nothing short of a fresh page load would pick up this newly-written draft.
    window.location.reload();
  }

  function handleDelete(name) {
    const ok = window.confirm('Delete the saved route "' + name + '"? This can\'t be undone.');
    if (!ok) {
      return;
    }
    deleteNamedRoute(loadSavedRoutes(), name);
    renderList();
    if (window.showToast) {
      window.showToast("Deleted.");
    }
  }

  function renderSelfTests() {
    renderSelfTestList(selfTestList, selfTestSummary, runSaveLoadSelfTests(), {
      itemClass: "save-load-selftest__item",
      summaryClass: "save-load-selftest__summary"
    });
  }

  // The post-reload redirect back to view-route (POST_RELOAD_VIEW_KEY) is
  // handled by shell.js at boot, not here — this module is now lazy-loaded
  // only once view-route is already open, so it would never see the flag
  // on the reload that's supposed to bring the student back to this view.
})();
