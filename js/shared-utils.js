// Shared helpers for geometry, field validation, route-draft access, and self-test rendering.

// Great-circle helpers for distance and bearing calculations.

const EARTH_RADIUS_NM = 3440.065;

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

// Returns the great-circle distance between two points in nautical miles.
export function distanceNm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(h));
}

// Returns the initial true bearing from one point to another, normalized to 0-360.
export function bearingTrue(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Rounds distance values to the app's standard one-decimal precision.
export function roundNm(nm) {
  return Math.round(nm * 10) / 10;
}

// Rounds a course or bearing to the nearest whole degree and wraps it to 0-359.
export function roundDeg(deg) {
  return Math.round(deg) % 360;
}

// Small DOM helpers for safe rendering and field error feedback.

// Escapes HTML-sensitive characters before injecting text into the DOM.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Mirrors a validation result onto the input state and the visible error message.
export function applyFieldCheck(input, errorEl, check) {
  if (!input) {
    return;
  }
  const isInvalid = check.state === "invalid";
  input.setAttribute("aria-invalid", String(isInvalid));
  if (errorEl) {
    errorEl.textContent = isInvalid ? check.message : "";
  }
}

// Returns a missing, invalid, or valid result for a numeric field based on its range.
export function numericFieldCheck(val, { min, max, rangeMessage }) {
  if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
    return { state: "missing" };
  }
  const num = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(num) || !isFinite(num)) {
    return { state: "invalid", message: "Enter a number." };
  }
  if (num < min || num > max) {
    return { state: "invalid", message: rangeMessage };
  }
  return { state: "valid", value: num };
}

// The route draft is shared across the planner and its preview panels.

// js/route-planner-bundle.js owns writing this key (its own richer
// loadDraft() additionally validates against the live aerodrome dataset);
// every other module that only needs to read the in-progress draft shares
// this key and reader rather than each re-declaring/re-implementing it.
export const DRAFT_KEY = "navlog-route-draft-v1";

// Reads the current route draft and returns null if it is missing or malformed.
export function loadRouteDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.departureIcao || !Array.isArray(parsed.waypoints)) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("route-draft: couldn't read the route draft.", err);
    return null;
  }
}

// Shared helpers render the self-test results consistently across pages.

// Compares numbers within a tolerance and falls back to strict equality for other values.
export function approxEqual(a, b, tolerance) {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= tolerance;
  }
  return a === b;
}

// Renders self-test results as a pass/fail list with a summary chip.
export function renderSelfTestList(listEl, summaryEl, results, options) {
  if (!listEl) {
    return;
  }
  const opts = options || {};
  const summarySuffix = opts.summarySuffix || "self-test cases pass.";
  const passCount = results.filter((r) => r.pass).length;

  listEl.innerHTML = results
    .map((r) => {
      const detail = !r.pass && opts.renderDetail
        ? '<br><span class="' + (opts.detailClass || "") + '">' + escapeHtml(opts.renderDetail(r)) + "</span>"
        : "";
      return (
        '<li class="' + (opts.itemClass || "") + '">' +
        '<span class="chip ' + (r.pass ? "chip--go" : "chip--nogo") + '">' +
        (r.pass ? "Pass" : "Fail") +
        "</span> " +
        escapeHtml(r.label) +
        detail +
        "</li>"
      );
    })
    .join("");

  if (summaryEl) {
    summaryEl.textContent = passCount + " / " + results.length + " " + summarySuffix;
    summaryEl.className =
      (opts.summaryClass || "") + " " + (passCount === results.length ? "chip chip--go" : "chip chip--nogo");
  }
}
