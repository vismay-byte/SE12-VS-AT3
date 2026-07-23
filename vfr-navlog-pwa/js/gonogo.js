// Evaluates the student's personal minima against route conditions and returns a simple verdict.

import { toRad, escapeHtml, applyFieldCheck, numericFieldCheck, approxEqual, renderSelfTestList } from "./shared-utils.js";
import { loadRouteLegsWithGs, validateWindDir } from "./route-planner-bundle.js";

const MINIMUMS_KEY = "navlog-personal-minimums-v1";
const CAUTION_MARGIN = 0.85; // a factor at/above 85% of its hard limit counts as "caution"
const VISIBILITY_CAUTION_MARGIN = 1.15; // visibility within 15% above the minimum counts as "caution"

// Validates the numeric inputs using the same shape as the preview panels.

export function validateWindSpeedKt(val) {
  return numericFieldCheck(val, { min: 0, max: 150, rangeMessage: "Wind speed must be between 0 and 150 kt." });
}
export function validateCrosswindKt(val) {
  return numericFieldCheck(val, { min: 0, max: 150, rangeMessage: "Crosswind component must be between 0 and 150 kt." });
}
export function validateVisibilityKm(val) {
  return numericFieldCheck(val, { min: 0, max: 200, rangeMessage: "Visibility must be between 0 and 200 km." });
}
export function validateCloudCoverPct(val) {
  return numericFieldCheck(val, { min: 0, max: 100, rangeMessage: "Cloud cover must be between 0 and 100%." });
}

// The core logic is pure so it can be tested without the DOM.

// Returns the crosswind component for one leg in knots.
export function crosswindComponentKt(windDirDeg, windSpeedKt, trueCourseDeg) {
  const angle = toRad(windDirDeg - trueCourseDeg);
  return Math.abs(windSpeedKt * Math.sin(angle));
}

// Returns the worst complete-leg crosswind component, or 0 when none are complete.
export function worstCrosswindKt(legs, windDirDeg, windSpeedKt) {
  let worst = 0;
  legs.forEach((leg) => {
    if (!leg.complete) {
      return;
    }
    const crosswind = crosswindComponentKt(windDirDeg, windSpeedKt, leg.trueCourseDeg);
    if (crosswind > worst) {
      worst = crosswind;
    }
  });
  return worst;
}

// Compares the current conditions against the student's minimums and returns a verdict.
export function evaluateGoNoGo(minimums, conditions) {
  const failReasons = [];
  const cautionReasons = [];

  if (conditions.windSpeedKt > minimums.maxWindKt) {
    failReasons.push("Wind speed " + conditions.windSpeedKt + " kt exceeds your limit of " + minimums.maxWindKt + " kt.");
  } else if (conditions.windSpeedKt >= minimums.maxWindKt * CAUTION_MARGIN) {
    cautionReasons.push("Wind speed " + conditions.windSpeedKt + " kt is close to your limit of " + minimums.maxWindKt + " kt.");
  }

  if (conditions.crosswindKt > minimums.maxCrosswindKt) {
    failReasons.push("Worst-leg crosswind " + conditions.crosswindKt.toFixed(0) + " kt exceeds your limit of " + minimums.maxCrosswindKt + " kt.");
  } else if (conditions.crosswindKt >= minimums.maxCrosswindKt * CAUTION_MARGIN) {
    cautionReasons.push("Worst-leg crosswind " + conditions.crosswindKt.toFixed(0) + " kt is close to your limit of " + minimums.maxCrosswindKt + " kt.");
  }

  if (conditions.visibilityKm < minimums.minVisibilityKm) {
    failReasons.push("Visibility " + conditions.visibilityKm + " km is below your minimum of " + minimums.minVisibilityKm + " km.");
  } else if (conditions.visibilityKm <= minimums.minVisibilityKm * VISIBILITY_CAUTION_MARGIN) {
    cautionReasons.push("Visibility " + conditions.visibilityKm + " km is close to your minimum of " + minimums.minVisibilityKm + " km.");
  }

  if (conditions.cloudCoverPct > minimums.maxCloudCoverPct) {
    failReasons.push("Cloud cover " + conditions.cloudCoverPct + "% exceeds your limit of " + minimums.maxCloudCoverPct + "%.");
  } else if (conditions.cloudCoverPct >= minimums.maxCloudCoverPct * CAUTION_MARGIN) {
    cautionReasons.push("Cloud cover " + conditions.cloudCoverPct + "% is close to your limit of " + minimums.maxCloudCoverPct + "%.");
  }

  if (conditions.flightCondition === "night" && !minimums.nightCurrent) {
    failReasons.push("Flight conditions are set to night, but you haven't marked yourself current for night flying.");
  }

  if (failReasons.length > 0) {
    return { status: "nogo", reasons: failReasons };
  }
  if (cautionReasons.length > 0) {
    return { status: "caution", reasons: cautionReasons };
  }
  return { status: "go", reasons: [] };
}

// The self-test cases are hand-checkable and kept deliberately small.

const SAMPLE_MINIMUMS = { maxWindKt: 20, maxCrosswindKt: 12, minVisibilityKm: 8, maxCloudCoverPct: 70, nightCurrent: false };

export const SELF_TEST_CASES = [
  {
    label: "Wind 90° off a 000° course at 15 kt → full 15 kt crosswind component",
    fn: () => crosswindComponentKt(90, 15, 0),
    expected: 15
  },
  {
    label: "Wind straight down a 090° course (wind from 090°) → 0 kt crosswind component",
    fn: () => crosswindComponentKt(90, 15, 90),
    expected: 0
  },
  {
    label: "Everything comfortably inside minimums → GO",
    fn: () => evaluateGoNoGo(SAMPLE_MINIMUMS, { windSpeedKt: 8, crosswindKt: 4, visibilityKm: 15, cloudCoverPct: 20, flightCondition: "day" }).status,
    expected: "go"
  },
  {
    label: "Wind at 90% of the limit (18 of 20 kt) → CAUTION",
    fn: () => evaluateGoNoGo(SAMPLE_MINIMUMS, { windSpeedKt: 18, crosswindKt: 4, visibilityKm: 15, cloudCoverPct: 20, flightCondition: "day" }).status,
    expected: "caution"
  },
  {
    label: "Wind over the limit (25 of 20 kt) → NO-GO",
    fn: () => evaluateGoNoGo(SAMPLE_MINIMUMS, { windSpeedKt: 25, crosswindKt: 4, visibilityKm: 15, cloudCoverPct: 20, flightCondition: "day" }).status,
    expected: "nogo"
  },
  {
    label: "Visibility below minimum (5 km of 8 km) → NO-GO",
    fn: () => evaluateGoNoGo(SAMPLE_MINIMUMS, { windSpeedKt: 8, crosswindKt: 4, visibilityKm: 5, cloudCoverPct: 20, flightCondition: "day" }).status,
    expected: "nogo"
  },
  {
    label: "Night flight without night currency → NO-GO even with perfect weather",
    fn: () => evaluateGoNoGo(SAMPLE_MINIMUMS, { windSpeedKt: 5, crosswindKt: 2, visibilityKm: 20, cloudCoverPct: 5, flightCondition: "night" }).status,
    expected: "nogo"
  },
  {
    label: "Night flight WITH night currency and good weather → GO",
    fn: () => evaluateGoNoGo({ ...SAMPLE_MINIMUMS, nightCurrent: true }, { windSpeedKt: 5, crosswindKt: 2, visibilityKm: 20, cloudCoverPct: 5, flightCondition: "night" }).status,
    expected: "go"
  }
];

// Runs the self-test cases and reports pass/fail for each one.
export function runSelfTests(tolerance = 0.01) {
  return SELF_TEST_CASES.map((testCase) => {
    const actual = testCase.fn();
    return { label: testCase.label, pass: approxEqual(actual, testCase.expected, tolerance), expected: testCase.expected, actual };
  });
}

// Wires the Go/No-Go page and its weather lookup flow.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM — nothing to wire up.
  }

  const navCard = document.querySelector('[data-page="view-gonogo"]');

  const maxWindInput = document.getElementById("gonogo-max-wind");
  const maxCrosswindInput = document.getElementById("gonogo-max-crosswind");
  const minVisInput = document.getElementById("gonogo-min-visibility");
  const maxCloudInput = document.getElementById("gonogo-max-cloud");
  const nightCurrentInput = document.getElementById("gonogo-night-current");

  const windSpeedInput = document.getElementById("gonogo-wind-speed");
  const windDirInput = document.getElementById("gonogo-wind-dir");
  const visibilityInput = document.getElementById("gonogo-visibility");
  const cloudInput = document.getElementById("gonogo-cloud");
  const conditionSelect = document.getElementById("gonogo-condition");
  const fetchBtn = document.getElementById("gonogo-fetch-btn");
  const fetchNote = document.getElementById("gonogo-fetch-note");

  const errorEls = {
    maxWind: document.getElementById("gonogo-max-wind-error"),
    maxCrosswind: document.getElementById("gonogo-max-crosswind-error"),
    minVisibility: document.getElementById("gonogo-min-visibility-error"),
    maxCloud: document.getElementById("gonogo-max-cloud-error"),
    windSpeed: document.getElementById("gonogo-wind-speed-error"),
    windDir: document.getElementById("gonogo-wind-dir-error"),
    visibility: document.getElementById("gonogo-visibility-error"),
    cloud: document.getElementById("gonogo-cloud-error")
  };

  const emptyNote = document.getElementById("gonogo-empty");
  const resultEl = document.getElementById("gonogo-result");
  const selfTestList = document.getElementById("gonogo-selftest-list");
  const selfTestSummary = document.getElementById("gonogo-selftest-summary");

  if (!navCard || !resultEl) {
    return; // Go/No-Go page markup not present — defensive no-op.
  }

  /* 
    This establishes the personal minimums which the Go/No-Go evaluation uses, 
    and persists them across visits. It is stored locally because it is a 
    personal preference, not a shared route or flight record.
  */

  function loadSavedMinimums() {
    try {
      const raw = localStorage.getItem(MINIMUMS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn("Go/No-Go: couldn't read saved personal minimums.", err);
      return null;
    }
  }

  function saveMinimums() {
    try {
      localStorage.setItem(
        MINIMUMS_KEY,
        JSON.stringify({
          maxWindKt: maxWindInput.value,
          maxCrosswindKt: maxCrosswindInput.value,
          minVisibilityKm: minVisInput.value,
          maxCloudCoverPct: maxCloudInput.value,
          nightCurrent: nightCurrentInput.checked
        })
      );
    } catch (err) {
      console.warn("Go/No-Go: couldn't save personal minimums.", err);
    }
  }

  const saved = loadSavedMinimums();
  if (saved) {
    maxWindInput.value = saved.maxWindKt || "";
    maxCrosswindInput.value = saved.maxCrosswindKt || "";
    minVisInput.value = saved.minVisibilityKm || "";
    maxCloudInput.value = saved.maxCloudCoverPct || "";
    nightCurrentInput.checked = !!saved.nightCurrent;
  }

  /*
   Open-Meteo reports wind speed in m/s, visibility in metres, and cloud cover in %.
   This is an API whihc is free use and does not require an API key. 
   The wind speed is converted to knots, and visibility is converted to 
   kilometers for the Go/No-Go evaluation.
  */

  async function fetchWeather() {
    const { dep } = await loadRouteLegsWithGs(null);
    if (!dep || !dep.position) {
      fetchNote.textContent = "No route/departure aerodrome found yet. Build a route on the Route Planner page first.";
      return;
    }
    fetchBtn.disabled = true;
    fetchNote.textContent = "Fetching indicative weather for " + dep.icao + "…";
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=" + dep.position.lat +
        "&longitude=" + dep.position.lon +
        "&current=wind_speed_10m,wind_direction_10m,cloud_cover,visibility" +
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
      if (typeof current.cloud_cover === "number") {
        cloudInput.value = Math.round(current.cloud_cover);
      }
      // Open-Meteo reports visibility in metres — convert to km, the
      // unit this page's fields and personal minimums use throughout.
      if (typeof current.visibility === "number") {
        visibilityInput.value = Math.round((current.visibility / 1000) * 10) / 10;
      }
      fetchNote.textContent =
        "Fetched indicative weather for " + dep.icao + " at " + (current.time || "now") +
        ". Not certified aviation weather. Edit any field by hand if you have a better source.";
      renderAll();
    } catch (err) {
      console.warn("Go/No-Go: couldn't fetch Open-Meteo weather.", err);
      fetchNote.textContent =
        "Couldn't fetch indicative weather (needs an internet connection). Enter current conditions manually below instead.";
    } finally {
      fetchBtn.disabled = false;
    }
  }

  if (fetchBtn) {
    fetchBtn.addEventListener("click", fetchWeather);
  }

  /* 
    This is the main render loop which reads the current field values, 
    validates them, and evaluates the Go/No-Go verdict. It also renders 
    the self-test results. 
  */

  async function renderAll() {
    saveMinimums();

    const maxWindCheck = validateWindSpeedKt(maxWindInput.value);
    const maxCrosswindCheck = validateCrosswindKt(maxCrosswindInput.value);
    const minVisibilityCheck = validateVisibilityKm(minVisInput.value);
    const maxCloudCheck = validateCloudCoverPct(maxCloudInput.value);
    const windSpeedCheck = validateWindSpeedKt(windSpeedInput.value);
    const windDirCheck = validateWindDir(windDirInput.value);
    const visibilityCheck = validateVisibilityKm(visibilityInput.value);
    const cloudCheck = validateCloudCoverPct(cloudInput.value);

    applyFieldCheck(maxWindInput, errorEls.maxWind, maxWindCheck);
    applyFieldCheck(maxCrosswindInput, errorEls.maxCrosswind, maxCrosswindCheck);
    applyFieldCheck(minVisInput, errorEls.minVisibility, minVisibilityCheck);
    applyFieldCheck(maxCloudInput, errorEls.maxCloud, maxCloudCheck);
    applyFieldCheck(windSpeedInput, errorEls.windSpeed, windSpeedCheck);
    applyFieldCheck(windDirInput, errorEls.windDir, windDirCheck);
    applyFieldCheck(visibilityInput, errorEls.visibility, visibilityCheck);
    applyFieldCheck(cloudInput, errorEls.cloud, cloudCheck);

    const allChecks = [
      maxWindCheck, maxCrosswindCheck, minVisibilityCheck, maxCloudCheck,
      windSpeedCheck, windDirCheck, visibilityCheck, cloudCheck
    ];
    if (allChecks.some((c) => c.state === "invalid")) {
      emptyNote.hidden = false;
      emptyNote.textContent = "Fix the highlighted field(s) above to see a Go/No-Go verdict.";
      resultEl.innerHTML = "";
      return;
    }

    const missing = [];
    if (maxWindCheck.state === "missing") missing.push("max wind speed");
    if (maxCrosswindCheck.state === "missing") missing.push("max crosswind");
    if (minVisibilityCheck.state === "missing") missing.push("min visibility");
    if (maxCloudCheck.state === "missing") missing.push("max cloud cover");
    if (windSpeedCheck.state === "missing") missing.push("current wind speed");
    if (visibilityCheck.state === "missing") missing.push("current visibility");
    if (cloudCheck.state === "missing") missing.push("current cloud cover");

    if (missing.length > 0) {
      emptyNote.hidden = false;
      emptyNote.textContent = "Fill in: " + missing.join(", ") + ".";
      resultEl.innerHTML = "";
      return;
    }
    emptyNote.hidden = true;

    const maxWindKt = maxWindCheck.value;
    const maxCrosswindKt = maxCrosswindCheck.value;
    const minVisibilityKm = minVisibilityCheck.value;
    const maxCloudCoverPct = maxCloudCheck.value;
    const windSpeedKt = windSpeedCheck.value;
    const windDirDeg = windDirCheck.state === "valid" ? windDirCheck.value : 0;
    const visibilityKm = visibilityCheck.value;
    const cloudCoverPct = cloudCheck.value;

    const { route, legs } = await loadRouteLegsWithGs(null);
    const crosswindKt = route ? worstCrosswindKt(legs, windDirDeg, windSpeedKt) : 0;

    const verdict = evaluateGoNoGo(
      { maxWindKt, maxCrosswindKt, minVisibilityKm, maxCloudCoverPct, nightCurrent: nightCurrentInput.checked },
      { windSpeedKt, crosswindKt, visibilityKm, cloudCoverPct, flightCondition: conditionSelect.value === "night" ? "night" : "day" }
    );

    const chipClass = verdict.status === "go" ? "chip--go" : verdict.status === "caution" ? "chip--caution" : "chip--nogo";
    const chipLabel = verdict.status === "go" ? "GO" : verdict.status === "caution" ? "CAUTION" : "NO-GO";

    let html =
      '<div class="gonogo-verdict"><span class="chip ' + chipClass + ' gonogo-verdict__chip">' + chipLabel + "</span>";
    if (route) {
      html += '<span class="gonogo-verdict__crosswind">Worst-leg crosswind component: ' + crosswindKt.toFixed(0) + " kt</span>";
    } else {
      html += '<span class="gonogo-verdict__crosswind">No route built yet. Crosswind check skipped, wind speed/visibility/cloud checks still apply.</span>';
    }
    html += "</div>";

    if (verdict.reasons.length > 0) {
      html += '<ul class="gonogo-reasons">' + verdict.reasons.map((r) => "<li>" + escapeHtml(r) + "</li>").join("") + "</ul>";
    } else {
      html += '<p class="gonogo-page__note">No concerns against your personal minimums.</p>';
    }
    resultEl.innerHTML = html;
  }

  [
    maxWindInput, maxCrosswindInput, minVisInput, maxCloudInput, nightCurrentInput,
    windSpeedInput, windDirInput, visibilityInput, cloudInput
  ].forEach((el) => {
    if (el) {
      el.addEventListener("input", renderAll);
    }
  });
  if (conditionSelect) {
    conditionSelect.addEventListener("change", renderAll);
  }
  navCard.addEventListener("click", renderAll);

  function renderSelfTests() {
    renderSelfTestList(selfTestList, selfTestSummary, runSelfTests(), {
      itemClass: "gonogo-selftest__item",
      summaryClass: "gonogo-selftest__summary"
    });
  }
  renderSelfTests();

  // Render once on load too (not just on the card click), so a saved
  // set of minimums + any values already sitting in the fields show a
  // verdict immediately, same as the other pages populate on load.
  renderAll();
})();
