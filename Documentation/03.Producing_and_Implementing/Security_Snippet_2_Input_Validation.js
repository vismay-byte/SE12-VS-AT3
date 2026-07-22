// Source: js/shared-utils.js and js/route-planner-bundle.js
// Purpose: reject bad or malicious input BEFORE it ever reaches a
// calculation, the DOM, or a Supabase query, rather than trying to clean
// it up afterwards.

// --- shared-utils.js: generic numeric-range gate used across every ---
// --- calculator (true course, wind speed, TAS, magnetic variation...) ---
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

// --- route-planner-bundle.js: strict pattern match for the departure-time ---
// --- field, so only a well-formed 24-hour "HH:MM" string is ever accepted ---
const DEPARTURE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateDepartureTime(val) {
  if (val === null || val === undefined || String(val).trim() === "") {
    return { state: "missing" };
  }
  const match = DEPARTURE_TIME_PATTERN.exec(String(val).trim());
  if (!match) {
    return { state: "invalid", message: "Enter a time as HH:MM, 24-hour (e.g. 09:15 or 21:05)." };
  }
  return { state: "valid", value: { h: Number(match[1]), m: Number(match[2]) } };
}

// Every numeric input in Route Planner, NAVLOG, Go/No-Go and the wind/time
// preview panels is run through numericFieldCheck (or a purpose-built regex
// like DEPARTURE_TIME_PATTERN above) before its value is used, and
// applyFieldCheck() (also in shared-utils.js) mirrors any failure onto the
// input's aria-invalid attribute and a visible <span class="field-error">
// message, so invalid or out-of-range values never reach the math layer.
