// Combines the NAVLOG table, PDF export, and callouts into one module for the NAVLOG page.

import {
  solveLeg, validateTas, validateWindDir, validateWindSpeed, validateMagVar,
  loadRouteLegsWithGs, validateDepartureTime, eteMinutesForLeg, formatEte,
  addMinutesClock, formatClock,
  loadAircraftList, fuelRequired, checkFuelSufficiency
} from "./route-planner-bundle.js";
import { supabase } from "./supabase-client.js";
import { escapeHtml, applyFieldCheck, renderSelfTestList } from "./shared-utils.js";

// The NAVLOG module builds the final table, PDF export, and save-to-logbook flow.

// A flown-on date must not be in the future, while a missing date is allowed.
export function validateFlownOn(val) {
  if (!val) {
    return { state: "missing" };
  }
  const date = new Date(val + "T00:00:00");
  if (isNaN(date.getTime())) {
    return { state: "invalid", message: "Enter a valid date." };
  }
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  if (date.getTime() > endOfToday.getTime()) {
    return { state: "invalid", message: "Flown-on date can't be in the future." };
  }
  return { state: "valid", value: val };
}

// Most recent successful computeNavlogData() result — exported via
// getLastComputedNavlog() so the callouts panel below can reuse it instead
// of recomputing.
let lastComputedData = null;

// Returns the most recently computed NAVLOG result, or null if none is ready.
export function getLastComputedNavlog() {
  return lastComputedData;
}

// The PDF helpers live at module scope so the logbook can rebuild the same document later.

const JSPDF_CDN_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
let jsPdfLoadPromise = null;

// Injects the jsPDF <script> tag once and caches the resulting Promise
// so a second click while it's still loading doesn't inject it twice.
export function loadJsPdfConstructor() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("No window. jsPDF needs a browser."));
  }
  if (window.jspdf && window.jspdf.jsPDF) {
    return Promise.resolve(window.jspdf.jsPDF);
  }
  if (jsPdfLoadPromise) {
    return jsPdfLoadPromise;
  }
  jsPdfLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JSPDF_CDN_URL;
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error("jsPDF loaded but window.jspdf.jsPDF is missing."));
      }
    };
    script.onerror = () => {
      jsPdfLoadPromise = null; // allow a retry on the next click
      reject(new Error("Couldn't load the jsPDF library."));
    };
    document.head.appendChild(script);
  });
  return jsPdfLoadPromise;
}

// Pads to a fixed column width so a plain monospaced text table lines up
// in the PDF, without an extra table-layout plugin/CDN dependency.
function padCol(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s.padEnd(width);
}

const PDF_COLS = [
  { key: "i", label: "#", width: 4 },
  { key: "leg", label: "Leg", width: 30 },
  { key: "dist", label: "Dist", width: 8 },
  { key: "tc", label: "TC", width: 6 },
  { key: "wca", label: "WCA", width: 6 },
  { key: "th", label: "TH", width: 7 },
  { key: "mh", label: "MH", width: 7 },
  { key: "gs", label: "GS", width: 7 },
  { key: "ete", label: "ETE", width: 8 },
  { key: "eta", label: "ETA", width: 7 },
  { key: "fuelUsed", label: "Fuel used", width: 10 },
  { key: "fuelRem", label: "Fuel rem.", width: 10 }
];

function pdfRowLine(values) {
  return PDF_COLS.map((col) => padCol(values[col.key] !== undefined ? values[col.key] : "", col.width)).join("");
}

// Builds the PDF document for a computed NAVLOG result or a saved logbook snapshot.
export function buildNavlogPdfDoc(jsPDF, data) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const depLabel = data.dep ? data.dep.icao : data.route.departureIcao;
  const arrLabel = data.arr ? data.arr.icao : data.route.arrivalIcao;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("VFR NAVLOG Trainer — Navigation Log", 40, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    [
      "Route: " + depLabel + " → " + arrLabel,
      "Aircraft: " + data.aircraft.name + " (" + data.aircraft.cruiseBurnLph + " L/h, " + data.aircraft.usableFuelL + " L usable)",
      "Departure: " + formatClock(data.departureClock) + " . Conditions: " + (data.condition === "night" ? "Night / marginal" : "Day VFR"),
      "TAS " + data.tasKt + " kt, wind " + data.windDirDeg + "°/" + data.windSpeedKt + " kt, magnetic variation " + data.magVarDeg + "°"
    ],
    40,
    62
  );

  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  let y = 120;
  doc.text(pdfRowLine({
    i: "#", leg: "Leg", dist: "Dist", tc: "TC", wca: "WCA", th: "TH", mh: "MH", gs: "GS", ete: "ETE", eta: "ETA", fuelUsed: "Fuel U", fuelRem: "Fuel R"
  }), 40, y);
  y += 6;
  doc.line(40, y, 555, y);
  y += 12;

  doc.setFont("courier", "normal");
  data.rows.forEach((row, i) => {
    const leg = row.leg;
    const legLabel = (leg.fromName + " -> " + leg.toName).replace(/[—→]/g, "-");
    let line;
    if (row.status !== "ok") {
      line = pdfRowLine({ i: i + 1, leg: legLabel, dist: row.status === "unflyable" ? "wind > TAS" : "incomplete" });
    } else {
      line = pdfRowLine({
        i: i + 1,
        leg: legLabel,
        dist: leg.distanceNm.toFixed(1),
        tc: leg.trueCourseDeg.toFixed(0),
        wca: (leg.wcaDeg >= 0 ? "R" : "L") + Math.abs(leg.wcaDeg).toFixed(0),
        th: leg.trueHeadingDeg.toFixed(0) + "T",
        mh: leg.magHeadingDeg.toFixed(0) + "M",
        gs: leg.groundSpeedKt.toFixed(0),
        ete: formatEte(row.ete),
        eta: row.eta,
        fuelUsed: row.fuelUsedL.toFixed(1),
        fuelRem: row.fuelRemainingL.toFixed(1)
      });
    }
    if (y > 780) {
      doc.addPage();
      y = 40;
    }
    doc.text(line, 40, y);
    y += 13;
  });

  y += 10;
  doc.line(40, y, 555, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    "Total: " + data.totalDistanceNm.toFixed(1) + " NM, " + formatEte(data.totalMinutes) +
    ". Fuel required " + data.fuel.totalFuelL.toFixed(1) + " L (" +
    (data.sufficiency.state === "ok" ? "within" : "EXCEEDS") + " " + data.aircraft.usableFuelL + " L usable)",
    40,
    y
  );

  y += 24;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text(
    "Cross-check against current ERSA/AIP/NOTAMs, certified aviation weather and the aircraft's actual POH before any real flight.",
    40,
    y,
    { maxWidth: 515 }
  );

  return { doc, filename: "navlog-" + depLabel + "-" + arrLabel + ".pdf" };
}

// The saved flight snapshot keeps only the data needed to rebuild a PDF later.

export function buildFlightSnapshot(data) {
  return {
    dep: data.dep ? { icao: data.dep.icao, name: data.dep.name } : null,
    arr: data.arr ? { icao: data.arr.icao, name: data.arr.name } : null,
    route: { departureIcao: data.route.departureIcao, arrivalIcao: data.route.arrivalIcao },
    aircraft: { name: data.aircraft.name, cruiseBurnLph: data.aircraft.cruiseBurnLph, usableFuelL: data.aircraft.usableFuelL },
    departureClock: data.departureClock,
    condition: data.condition,
    tasKt: data.tasKt,
    windDirDeg: data.windDirDeg,
    windSpeedKt: data.windSpeedKt,
    magVarDeg: data.magVarDeg,
    totalDistanceNm: data.totalDistanceNm,
    totalMinutes: data.totalMinutes,
    fuel: data.fuel,
    sufficiency: data.sufficiency,
    rows: data.rows.map((row) => ({
      status: row.status,
      fromName: row.leg.fromName,
      toName: row.leg.toName,
      distanceNm: row.leg.distanceNm,
      trueCourseDeg: row.leg.trueCourseDeg,
      wcaDeg: row.leg.wcaDeg,
      trueHeadingDeg: row.leg.trueHeadingDeg,
      magHeadingDeg: row.leg.magHeadingDeg,
      groundSpeedKt: row.leg.groundSpeedKt,
      ete: row.ete,
      eta: row.eta,
      fuelUsedL: row.fuelUsedL,
      fuelRemainingL: row.fuelRemainingL
    }))
  };
}

// Rebuilds the live NAVLOG data shape from a saved flight snapshot.
export function reconstructNavlogData(snapshot) {
  return {
    valid: true,
    dep: snapshot.dep,
    arr: snapshot.arr,
    route: snapshot.route,
    aircraft: snapshot.aircraft,
    departureClock: snapshot.departureClock,
    condition: snapshot.condition,
    tasKt: snapshot.tasKt,
    windDirDeg: snapshot.windDirDeg,
    windSpeedKt: snapshot.windSpeedKt,
    magVarDeg: snapshot.magVarDeg,
    totalDistanceNm: snapshot.totalDistanceNm,
    totalMinutes: snapshot.totalMinutes,
    fuel: snapshot.fuel,
    sufficiency: snapshot.sufficiency,
    rows: snapshot.rows.map((r) => ({
      status: r.status,
      leg: {
        fromName: r.fromName,
        toName: r.toName,
        distanceNm: r.distanceNm,
        trueCourseDeg: r.trueCourseDeg,
        wcaDeg: r.wcaDeg,
        trueHeadingDeg: r.trueHeadingDeg,
        magHeadingDeg: r.magHeadingDeg,
        groundSpeedKt: r.groundSpeedKt
      },
      ete: r.ete,
      eta: r.eta,
      fuelUsedL: r.fuelUsedL,
      fuelRemainingL: r.fuelRemainingL
    }))
  };
}

// Flights are queued locally if the browser is offline so they can be retried later.

const PENDING_SAVES_KEY = "navlog-pending-flight-saves-v1";

function loadPendingSaves() {
  try {
    const raw = localStorage.getItem(PENDING_SAVES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Logbook: couldn't read queued offline saves.", err);
    return [];
  }
}

function savePendingSaves(list) {
  try {
    localStorage.setItem(PENDING_SAVES_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Logbook: couldn't persist queued offline saves.", err);
  }
}

function queuePendingSave(row) {
  const pending = loadPendingSaves();
  pending.push(row);
  savePendingSaves(pending);
}

// Returns how many flight saves are currently queued while offline.
export function pendingFlightSaveCount() {
  return loadPendingSaves().length;
}

// Flushes queued flight saves in order when connectivity returns.
export async function flushPendingFlightSaves() {
  const pending = loadPendingSaves();
  let savedCount = 0;
  while (pending.length > 0) {
    const row = pending[0];
    const { error } = await supabase.from("flights").insert(row);
    if (error) {
      break; // still offline (or some other error) — leave the rest queued
    }
    pending.shift();
    savedCount++;
  }
  savePendingSaves(pending);
  return { savedCount, remainingCount: pending.length };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushPendingFlightSaves().then(({ savedCount }) => {
      if (savedCount > 0 && window.showToast) {
        window.showToast("Back online. " + savedCount + " queued flight" + (savedCount === 1 ? "" : "s") + " saved to your logbook.");
      }
    });
  });
}

// Saves one flight to the current user's logbook and reports the result clearly.
export async function saveFlightToLogbook(data, flownOnDate) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData ? userData.user : null;
  if (!user) {
    return { status: "not-logged-in" };
  }

  const row = {
    pilot_id: user.id,
    flown_on: flownOnDate,
    aircraft_type: data.aircraft.name,
    route: buildFlightSnapshot(data),
    flight_time_minutes: Math.max(1, Math.round(data.totalMinutes))
  };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    queuePendingSave(row);
    return { status: "queued" };
  }

  const { error } = await supabase.from("flights").insert(row);
  if (error) {
    // No error.code means a network failure (dropped connection), not a
    // schema/permission error — worth queuing rather than losing.
    if (!error.code) {
      queuePendingSave(row);
      return { status: "queued" };
    }
    return { status: "error", message: error.message };
  }
  return { status: "saved" };
}

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM — nothing to wire up.
  }

  const navCard = document.querySelector('[data-page="view-navlog"]');
  const tasInput = document.getElementById("navlog-tas");
  const windDirInput = document.getElementById("navlog-wind-dir");
  const windSpeedInput = document.getElementById("navlog-wind-speed");
  const magVarInput = document.getElementById("navlog-magvar");
  const magVarNote = document.getElementById("navlog-magvar-note");
  const departureInput = document.getElementById("navlog-departure");
  const aircraftSelect = document.getElementById("navlog-aircraft");
  const conditionSelect = document.getElementById("navlog-condition");
  const emptyNote = document.getElementById("navlog-empty");
  const tableBody = document.getElementById("navlog-table-body");
  const summaryEl = document.getElementById("navlog-summary");
  const pdfBtn = document.getElementById("navlog-pdf-btn");
  const pdfNote = document.getElementById("navlog-pdf-note");
  const flownOnInput = document.getElementById("navlog-flown-on");
  const saveLogbookBtn = document.getElementById("navlog-save-logbook-btn");
  const saveLogbookNote = document.getElementById("navlog-save-logbook-note");

  const errorEls = {
    tas: document.getElementById("navlog-tas-error"),
    windDir: document.getElementById("navlog-wind-dir-error"),
    windSpeed: document.getElementById("navlog-wind-speed-error"),
    magVar: document.getElementById("navlog-magvar-error"),
    departure: document.getElementById("navlog-departure-error"),
    flownOn: document.getElementById("navlog-flown-on-error")
  };

  if (!tableBody || !tasInput) {
    return; // NAVLOG page markup not present — defensive no-op.
  }

  let aircraftList = [];
  let defaultMagVarApplied = false;

  async function populateAircraftSelect() {
    if (aircraftList.length > 0) {
      return;
    }
    aircraftList = await loadAircraftList();
    aircraftSelect.innerHTML = aircraftList
      .map((a) => '<option value="' + escapeHtml(a.id) + '">' + escapeHtml(a.name) + "</option>")
      .join("");
  }

  function selectedAircraft() {
    return aircraftList.find((a) => a.id === aircraftSelect.value) || null;
  }

  // computeNavlogData() builds the full table data and totals before the DOM renderer formats it.

  async function computeNavlogData() {
    const tasCheck = validateTas(tasInput.value);
    const windDirCheck = validateWindDir(windDirInput.value);
    const windSpeedCheck = validateWindSpeed(windSpeedInput.value);
    const magVarCheck = validateMagVar(magVarInput.value);
    const departureCheck = validateDepartureTime(departureInput.value);

    applyFieldCheck(tasInput, errorEls.tas, tasCheck);
    applyFieldCheck(windDirInput, errorEls.windDir, windDirCheck);
    applyFieldCheck(windSpeedInput, errorEls.windSpeed, windSpeedCheck);
    applyFieldCheck(magVarInput, errorEls.magVar, magVarCheck);
    applyFieldCheck(departureInput, errorEls.departure, departureCheck);

    const anyInvalid =
      tasCheck.state === "invalid" ||
      windDirCheck.state === "invalid" ||
      windSpeedCheck.state === "invalid" ||
      magVarCheck.state === "invalid" ||
      departureCheck.state === "invalid";

    if (anyInvalid) {
      return { valid: false, reason: "Fix the highlighted field(s) above to generate the log." };
    }
    if (tasCheck.state === "missing") {
      return { valid: false, reason: "Enter a true airspeed (TAS) above to generate the log." };
    }
    if (departureCheck.state === "missing") {
      return { valid: false, reason: "Enter a departure time above to generate the log." };
    }

    const aircraft = selectedAircraft();
    if (!aircraft) {
      return { valid: false, reason: "No aircraft profile is selected." };
    }

    const tasKt = tasCheck.value;
    const windDirDeg = windDirCheck.state === "valid" ? windDirCheck.value : 0;
    const windSpeedKt = windSpeedCheck.state === "valid" ? windSpeedCheck.value : 0;
    const magVarDeg = magVarCheck.state === "valid" ? magVarCheck.value : 0;

    const { route, legs, dep, arr } = await loadRouteLegsWithGs({ tasKt, windDirDeg, windSpeedKt, magVarDeg });

    if (!defaultMagVarApplied && dep && typeof dep.magVarDeg === "number" && magVarInput.value === "") {
      magVarInput.value = dep.magVarDeg;
      defaultMagVarApplied = true;
      magVarNote.textContent =
        "Pre-filled from " + dep.icao + "'s magVarDeg (" + dep.magVarDeg + "°E) — edit if needed.";
      // Recurse once now magVarInput.value is filled, so the first render
      // uses the real figure instead of silently defaulting to 0 for a pass.
      return computeNavlogData();
    }

    if (!route) {
      return { valid: false, reason: "No route found yet. Build a route on the Route Planner page first." };
    }

    const condition = conditionSelect.value === "night" ? "night" : "day";

    let cumulativeMinutes = 0;
    let totalMinutes = 0;
    let totalDistanceNm = 0;
    let anyIncomplete = false;
    let anyUnflyable = false;
    const rows = [];

    legs.forEach((leg) => {
      if (!leg.complete) {
        anyIncomplete = true;
        rows.push({ leg, status: "incomplete" });
        return;
      }
      const ete = eteMinutesForLeg(leg.distanceNm, leg.groundSpeedKt);
      if (leg.unflyable || ete === null) {
        anyUnflyable = true;
        rows.push({ leg, status: "unflyable" });
        return;
      }
      cumulativeMinutes += ete;
      totalMinutes += ete;
      totalDistanceNm += leg.distanceNm;
      const eta = formatClock(addMinutesClock(departureCheck.value.h, departureCheck.value.m, cumulativeMinutes));
      rows.push({ leg, status: "ok", ete, cumulativeMinutes, eta });
    });

    const fuel = fuelRequired(totalMinutes, aircraft.cruiseBurnLph, condition);
    const sufficiency = checkFuelSufficiency(fuel.totalFuelL, aircraft.usableFuelL);

    // Fuel-remaining countdown: departs with the full planned load
    // (trip + reserve) and counts down leg by leg, so it reads exactly
    // the reserve figure at the final leg — see header comment.
    let cumulativeFuelUsedL = 0;
    rows.forEach((row) => {
      if (row.status !== "ok") {
        return;
      }
      const fuelUsedThisLegL = (row.ete / 60) * aircraft.cruiseBurnLph;
      cumulativeFuelUsedL += fuelUsedThisLegL;
      row.fuelUsedL = fuelUsedThisLegL;
      row.fuelRemainingL = fuel.totalFuelL - cumulativeFuelUsedL;
    });

    return {
      valid: true,
      route,
      dep,
      arr,
      rows,
      totalMinutes,
      totalDistanceNm,
      anyIncomplete,
      anyUnflyable,
      departureClock: departureCheck.value,
      aircraft,
      condition,
      fuel,
      sufficiency,
      // Kept alongside the computed figures so buildNavlogPdfDoc() is a pure
      // function of `data`. logbook re-export rebuilds the PDF from a
      // stored record, long after these inputs are gone.
      tasKt,
      windDirDeg,
      windSpeedKt,
      magVarDeg
    };
  }

  // The DOM renderer turns the computed rows into the visible table and summary.

  function renderNavlogToDom(data) {
    if (!data.valid) {
      tableBody.innerHTML = "";
      summaryEl.innerHTML = "";
      emptyNote.hidden = false;
      emptyNote.textContent = data.reason;
      return;
    }
    emptyNote.hidden = true;

    let rowsHtml = "";
    data.rows.forEach((row, i) => {
      const leg = row.leg;
      const legLabel = escapeHtml(leg.fromName) + " → " + escapeHtml(leg.toName);
      if (row.status === "incomplete") {
        rowsHtml +=
          '<tr class="navlog-row navlog-row--incomplete"><td>' + (i + 1) + "</td><td>" + legLabel +
          '</td><td colspan="10">Leg is missing a distance/true course.</td></tr>';
        return;
      }
      if (row.status === "unflyable") {
        rowsHtml +=
          '<tr class="navlog-row navlog-row--unflyable"><td>' + (i + 1) + "</td><td>" + legLabel + "</td><td>" +
          leg.distanceNm.toFixed(1) + ' NM</td><td colspan="9"><span class="chip chip--nogo">Wind exceeds TAS</span></td></tr>';
        return;
      }
      rowsHtml +=
        '<tr class="navlog-row">' +
        "<td>" + (i + 1) + "</td>" +
        "<td>" + legLabel + "</td>" +
        "<td>" + leg.distanceNm.toFixed(1) + " NM</td>" +
        "<td>" + leg.trueCourseDeg.toFixed(0) + "°</td>" +
        "<td>" + (leg.wcaDeg >= 0 ? "R" : "L") + Math.abs(leg.wcaDeg).toFixed(0) + "°</td>" +
        "<td>" + leg.trueHeadingDeg.toFixed(0) + "°T</td>" +
        "<td>" + leg.magHeadingDeg.toFixed(0) + "°M</td>" +
        "<td>" + leg.groundSpeedKt.toFixed(0) + " kt</td>" +
        "<td>" + formatEte(row.ete) + "</td>" +
        "<td>" + row.eta + "</td>" +
        "<td>" + row.fuelUsedL.toFixed(1) + " L</td>" +
        "<td>" + row.fuelRemainingL.toFixed(1) + " L</td>" +
        "</tr>";
    });
    tableBody.innerHTML = rowsHtml;

    let notes = "";
    if (data.anyIncomplete) {
      notes += " Some legs are missing a distance/course and are excluded from the totals.";
    }
    if (data.anyUnflyable) {
      notes += " Some legs can’t be flown as entered (wind exceeds TAS) and are excluded from the totals.";
    }

    summaryEl.innerHTML =
      '<div><span class="navlog-page__summary-label">Total distance</span><strong>' + data.totalDistanceNm.toFixed(1) + " NM</strong></div>" +
      '<div><span class="navlog-page__summary-label">Total en-route time</span><strong>' + formatEte(data.totalMinutes) + "</strong></div>" +
      '<div><span class="navlog-page__summary-label">Fuel required (trip + reserve)</span><strong>' + data.fuel.totalFuelL.toFixed(1) + " L</strong></div>" +
      '<div><span class="navlog-page__summary-label">' + escapeHtml(data.aircraft.name) + " usable fuel</span><strong>" + data.aircraft.usableFuelL + " L</strong></div>" +
      '<div><span class="navlog-page__summary-label">Fuel verdict</span><strong>' +
      (data.sufficiency.state === "ok"
        ? '<span class="chip chip--go">Within usable fuel</span>'
        : '<span class="chip chip--nogo">Exceeds usable fuel</span>') +
      "</strong></div>" +
      (notes ? '<p class="navlog-page__note">' + notes + "</p>" : "");
  }

  // computeNavlogData() reads-then-mutates magVarInput.value overlapping calls could paint a stale heading out of order.
  // Chaining every compute-and-render pass onto one Promise guarantees they
  // run in order. PDF export reuses this same queue so it can't race a
  // render still in flight.
  let renderChain = Promise.resolve();

  async function computeAndRenderOnce() {
    await populateAircraftSelect();
    const data = await computeNavlogData();
    renderNavlogToDom(data);
    lastComputedData = data;
    return data;
  }

  function runSerialized(task) {
    const result = renderChain.then(task, task);
    renderChain = result.then(() => {}, () => {}); // keep the chain alive even after a rejection
    return result;
  }

  function renderAll() {
    runSerialized(computeAndRenderOnce);
  }

  [tasInput, windDirInput, windSpeedInput, magVarInput, departureInput].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderAll);
    }
  });
  [aircraftSelect, conditionSelect].forEach((el) => {
    if (el) {
      el.addEventListener("change", renderAll);
    }
  });
  if (navCard) {
    navCard.addEventListener("click", renderAll);
  }

  // The export button just loads the library, builds the PDF, and saves it.

  async function exportPdf() {
    const data = await runSerialized(computeAndRenderOnce);
    if (!data.valid) {
      if (window.showToast) {
        window.showToast(data.reason);
      }
      return;
    }

    pdfBtn.disabled = true;
    pdfNote.hidden = false;
    pdfNote.textContent = "Loading PDF library…";

    let jsPDF;
    try {
      jsPDF = await loadJsPdfConstructor();
    } catch (err) {
      console.warn("NAVLOG PDF export: couldn't load jsPDF.", err);
      pdfNote.textContent = "Couldn’t load the PDF library. Check your internet connection and try again.";
      pdfBtn.disabled = false;
      return;
    }

    pdfNote.textContent = "Building PDF…";
    const { doc, filename } = buildNavlogPdfDoc(jsPDF, data);
    doc.save(filename);

    pdfNote.textContent = "Downloaded " + filename + ".";
    pdfBtn.disabled = false;
  }

  if (pdfBtn) {
    pdfBtn.addEventListener("click", exportPdf);
  }

  // The save button reuses the same computed data as the PDF export path.

  if (flownOnInput && !flownOnInput.value) {
    // toISOString() is UTC-based and can read as yesterday/tomorrow
    // depending on timezone, so build a local YYYY-MM-DD string instead.
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    flownOnInput.value = yyyy + "-" + mm + "-" + dd;
  }

  async function saveToLogbook() {
    const data = await runSerialized(computeAndRenderOnce);
    if (!data.valid) {
      if (window.showToast) {
        window.showToast(data.reason);
      }
      return;
    }
    const flownOnCheck = validateFlownOn(flownOnInput.value);
    applyFieldCheck(flownOnInput, errorEls.flownOn, flownOnCheck);
    if (flownOnCheck.state === "missing") {
      saveLogbookNote.hidden = false;
      saveLogbookNote.textContent = "Enter the date this flight was flown.";
      return;
    }
    if (flownOnCheck.state === "invalid") {
      saveLogbookNote.hidden = false;
      saveLogbookNote.textContent = "Fix the flown-on date above: " + flownOnCheck.message;
      return;
    }

    saveLogbookBtn.disabled = true;
    saveLogbookNote.hidden = false;
    saveLogbookNote.textContent = "Saving…";

    const result = await saveFlightToLogbook(data, flownOnInput.value);
    saveLogbookBtn.disabled = false;

    if (result.status === "saved") {
      saveLogbookNote.textContent = "Saved to your logbook.";
    } else if (result.status === "queued") {
      saveLogbookNote.textContent = "You're offline. This flight is queued and will save automatically once you're back online.";
    } else if (result.status === "not-logged-in") {
      saveLogbookNote.textContent = "Log in to save this flight to your logbook.";
      if (window.showToast) {
        window.showToast("Log in to save this flight to your logbook.");
      }
      // Opens the login dialog directly (see auth.js's window.openAuthDialog
      // comment) — not accountBtn.click(), which would sign a genuinely
      // logged-in user out if this "not-logged-in" result were ever stale
      // by the time the click handler ran (BUG-03).
      if (window.openAuthDialog) {
        window.openAuthDialog("login");
      }
    } else {
      saveLogbookNote.textContent = "Couldn't save this flight: " + (result.message || "unknown error") + ".";
    }
  }

  if (saveLogbookBtn) {
    saveLogbookBtn.addEventListener("click", saveToLogbook);
  }

  // Populate the aircraft dropdown as soon as the module loads, so it's
  // ready the first time the student opens this page 
  // same as how the other panels populate on first open.
  populateAircraftSelect();
})();

// The callouts panel uses the most recent NAVLOG result and speaks each event when enabled.

// Builds the timed callout events for one simulated flight.
export function computeCalloutSchedule(p) {
  const events = [];

  events.push({ atMinute: 0, type: "checklist", text: "Before takeoff: run your pre-start and pre-takeoff checklist." });

  if (p.totalMinutes > 0) {
    for (let m = p.fuelIntervalMin; m < p.totalMinutes; m += p.fuelIntervalMin) {
      events.push({ atMinute: m, type: "fuel", text: "Fuel check." });
    }
    for (let m = p.diIntervalMin; m < p.totalMinutes; m += p.diIntervalMin) {
      events.push({ atMinute: m, type: "di", text: "Directional indicator check. Align with the compass." });
    }
  }

  (p.legBoundaries || []).forEach((boundary) => {
    events.push({ atMinute: boundary.atMinute, type: "leg", text: "Leg complete. " + boundary.text });
  });

  if (p.totalMinutes > 0) {
    events.push({ atMinute: p.totalMinutes * 0.8, type: "checklist", text: "Prepare for arrival. Review your pre-landing checklist." });
    events.push({ atMinute: p.totalMinutes, type: "arrival", text: "Estimated time of arrival. Complete your shutdown checklist after landing." });
  }

  // Stable sort: events landing on the exact same minute keep
  // the relative order they were pushed in above.
  events.sort((a, b) => a.atMinute - b.atMinute);
  return events;
}

// The callout self-tests check the basic schedule shape rather than a full speech run.

const CALLOUTS_SELF_TEST_CASES = [
  {
    label: "40 min flight, 20 min fuel interval, 15 min DI interval → fuel checks at 20 only (< 40), DI checks at 15 and 30",
    fn: () => {
      const events = computeCalloutSchedule({ totalMinutes: 40, legBoundaries: [], fuelIntervalMin: 20, diIntervalMin: 15 });
      return {
        fuelMinutes: events.filter((e) => e.type === "fuel").map((e) => e.atMinute),
        diMinutes: events.filter((e) => e.type === "di").map((e) => e.atMinute)
      };
    },
    expected: { fuelMinutes: [20], diMinutes: [15, 30] }
  },
  {
    label: "Every schedule starts with a t=0 checklist callout and ends with the arrival callout at totalMinutes",
    fn: () => {
      const events = computeCalloutSchedule({ totalMinutes: 25, legBoundaries: [], fuelIntervalMin: 20, diIntervalMin: 15 });
      return { first: events[0].type, firstAt: events[0].atMinute, last: events[events.length - 1].type, lastAt: events[events.length - 1].atMinute };
    },
    expected: { first: "checklist", firstAt: 0, last: "arrival", lastAt: 25 }
  },
  {
    label: "A leg boundary at 10 min produces a leg-change callout at exactly 10 min, sorted correctly among the others",
    fn: () => {
      const events = computeCalloutSchedule({
        totalMinutes: 30,
        legBoundaries: [{ atMinute: 10, text: "Turn to heading 090° for YSCN." }],
        fuelIntervalMin: 20,
        diIntervalMin: 15
      });
      const legEvent = events.find((e) => e.type === "leg");
      const isSorted = events.every((e, i) => i === 0 || events[i - 1].atMinute <= e.atMinute);
      return { legAtMinute: legEvent.atMinute, isSorted };
    },
    expected: { legAtMinute: 10, isSorted: true }
  }
];

function calloutsDeepEqualJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Runs the callout self-tests and reports pass/fail for each one.
function runCalloutsSelfTests() {
  return CALLOUTS_SELF_TEST_CASES.map((testCase) => {
    const actual = testCase.fn();
    return { label: testCase.label, pass: calloutsDeepEqualJson(actual, testCase.expected), expected: testCase.expected, actual };
  });
}

// Wires the callouts panel, timing controls, and speech playback.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM required
  }

  const toggleBtn = document.getElementById("callouts-toggle");
  const body = document.getElementById("callouts-body");
  const enabledInput = document.getElementById("callouts-enabled");
  const rateInput = document.getElementById("callouts-rate");
  const volumeInput = document.getElementById("callouts-volume");
  const speedSelect = document.getElementById("callouts-speed");
  const fuelIntervalInput = document.getElementById("callouts-fuel-interval");
  const diIntervalInput = document.getElementById("callouts-di-interval");
  const startBtn = document.getElementById("callouts-start-btn");
  const pauseBtn = document.getElementById("callouts-pause-btn");
  const stopBtn = document.getElementById("callouts-stop-btn");
  const statusEl = document.getElementById("callouts-status");
  const logEl = document.getElementById("callouts-log");
  const speechWarning = document.getElementById("callouts-speech-warning");
  const selfTestList = document.getElementById("callouts-selftest-list");
  const selfTestSummary = document.getElementById("callouts-selftest-summary");

  if (!toggleBtn || !body) {
    return; // Panel markup not present
  }

  const speechAvailable = typeof window !== "undefined" && "speechSynthesis" in window;
  if (speechWarning) {
    speechWarning.hidden = speechAvailable;
  }

  toggleBtn.addEventListener("click", () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!expanded));
    body.hidden = expanded;
    if (!expanded) {
      renderSelfTests();
    }
  });

  // The simulation state tracks the active schedule and how far the run has progressed.

  let schedule = [];
  let nextEventIndex = 0;
  let simElapsedMin = 0;
  let totalMinutesForRun = 0;
  let tickTimerId = null;
  let lastTickAt = null; // performance.now() timestamp of the previous tick
  let runState = "stopped"; // "stopped" | "running" | "paused"

  function speak(text) {
    if (!enabledInput.checked || !speechAvailable) {
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = parseFloat(rateInput.value) || 1;
    utterance.volume = parseFloat(volumeInput.value);
    if (isNaN(utterance.volume)) {
      utterance.volume = 1;
    }
    window.speechSynthesis.speak(utterance);
  }

  function logCallout(event) {
    const li = document.createElement("li");
    li.className = "callouts-log__item callouts-log__item--" + event.type;
    li.textContent = "[" + event.atMinute.toFixed(1) + " min] " + event.text;
    logEl.appendChild(li);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function updateStatus() {
    statusEl.textContent =
      "Elapsed: " + simElapsedMin.toFixed(1) + " / " + totalMinutesForRun.toFixed(1) + " min (" + runState + ")";
  }

  // The button that can actually resume a paused run is Start 
  // Pause only ever pauses, so it stays disabled
  // whenever there's nothing running to pause.
  function updateButtons() {
    startBtn.disabled = runState === "running";
    startBtn.textContent = runState === "paused" ? "Resume" : "Start";
    pauseBtn.disabled = runState !== "running";
    stopBtn.disabled = runState === "stopped";
  }

  function fireDueEvents() {
    while (nextEventIndex < schedule.length && schedule[nextEventIndex].atMinute <= simElapsedMin) {
      const event = schedule[nextEventIndex];
      logCallout(event);
      speak(event.text);
      nextEventIndex++;
    }
  }

  function tick() {
    const now = performance.now();
    const deltaMs = now - lastTickAt;
    lastTickAt = now;
    const speedMultiplier = parseFloat(speedSelect.value) || 1;
    simElapsedMin += (deltaMs / 60000) * speedMultiplier;
    if (simElapsedMin > totalMinutesForRun) {
      simElapsedMin = totalMinutesForRun;
    }
    fireDueEvents();
    updateStatus();
    if (simElapsedMin >= totalMinutesForRun) {
      stopSimulation();
    }
  }

  function startSimulation() {
    const data = getLastComputedNavlog();
    if (!data || !data.valid) {
      if (window.showToast) {
        window.showToast("Generate a valid NAVLOG above first (true airspeed, wind, departure time and aircraft).");
      }
      return;
    }

    if (runState === "paused") {
      // Resume: keep the existing schedule/progress, just restart the clock.
      runState = "running";
      lastTickAt = performance.now();
      tickTimerId = setInterval(tick, 250);
      updateStatus();
      updateButtons();
      return;
    }

    totalMinutesForRun = data.totalMinutes;
    const okRows = data.rows.filter((r) => r.status === "ok");
    // Every row except the last becomes a "turn for the next leg" callout;
    // the last row's arrival is handled by computeCalloutSchedule()'s own
    // final "arrival" event instead, so it isn't described as a "leg".
    const legBoundaries = okRows.slice(0, -1).map((row) => ({
      atMinute: row.cumulativeMinutes,
      text: "Turn to heading " + row.leg.magHeadingDeg.toFixed(0) + "° for " + row.leg.toName + "."
    }));

    const fuelIntervalMin = parseFloat(fuelIntervalInput.value) || 20;
    const diIntervalMin = parseFloat(diIntervalInput.value) || 15;
    schedule = computeCalloutSchedule({ totalMinutes: totalMinutesForRun, legBoundaries, fuelIntervalMin, diIntervalMin });
    nextEventIndex = 0;
    simElapsedMin = 0;
    logEl.innerHTML = "";

    runState = "running";
    lastTickAt = performance.now();
    tickTimerId = setInterval(tick, 250);
    updateStatus();
    updateButtons();
  }

  function pauseSimulation() {
    if (runState !== "running") {
      return;
    }
    clearInterval(tickTimerId);
    tickTimerId = null;
    runState = "paused";
    updateStatus();
    updateButtons();
  }

  // Halts the timer without clearing anything which is used on natural completion
  // and as the first step of a reset.
  function stopSimulation() {
    clearInterval(tickTimerId);
    tickTimerId = null;
    runState = "stopped";
    if (speechAvailable) {
      window.speechSynthesis.cancel();
    }
    updateStatus();
    updateButtons();
  }

  // Unlike stopSimulation() alone, this also clears the elapsed time/log/
  // schedule, matching what the "Stop & reset" button's label promises.
  function resetSimulation() {
    stopSimulation();
    simElapsedMin = 0;
    totalMinutesForRun = 0;
    schedule = [];
    nextEventIndex = 0;
    logEl.innerHTML = "";
    updateStatus();
  }

  // startSimulation() itself branches on runState === "paused" to resume
  // in place rather than rebuilding the schedule, so the same handler
  // covers both a fresh start and a resume-from-pause click.
  startBtn.addEventListener("click", startSimulation);
  pauseBtn.addEventListener("click", pauseSimulation);
  stopBtn.addEventListener("click", resetSimulation);

  updateButtons();
  updateStatus();

  function renderSelfTests() {
    renderSelfTestList(selfTestList, selfTestSummary, runCalloutsSelfTests(), {
      itemClass: "callouts-selftest__item",
      summaryClass: "callouts-selftest__summary"
    });
  }
})();
