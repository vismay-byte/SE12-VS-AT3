// Renders the aircraft checklist and stores each flight's progress in session storage.

import { loadAircraftList } from "./route-planner-bundle.js";
import { renderSelfTestList, escapeHtml } from "./shared-utils.js";

const STATE_KEY = "navlog-checklist-state-v1";
const EXPECTED_PHASE_IDS = ["pre-start", "pre-takeoff", "cruise", "pre-landing", "shutdown"];
const MIN_ITEMS_PER_PHASE = 3;

// The checklist self-test checks that each aircraft record has the expected phases and items.

export function checkAircraftChecklistShape(aircraft) {
  const problems = [];
  const phases = aircraft.checklists || [];
  const phaseIds = phases.map((p) => p.id);
  EXPECTED_PHASE_IDS.forEach((expectedId) => {
    if (!phaseIds.includes(expectedId)) {
      problems.push('missing phase "' + expectedId + '"');
    }
  });
  phases.forEach((phase) => {
    if (!Array.isArray(phase.items) || phase.items.length < MIN_ITEMS_PER_PHASE) {
      problems.push('phase "' + phase.id + '" has fewer than ' + MIN_ITEMS_PER_PHASE + " items");
    }
  });
  return { pass: problems.length === 0, problems };
}

// Runs the checklist shape check across the aircraft list.
export function runSelfTests(aircraftList) {
  return aircraftList.map((aircraft) => {
    const result = checkAircraftChecklistShape(aircraft);
    return { label: aircraft.name + " has all 5 phases, each with ≥" + MIN_ITEMS_PER_PHASE + " items", pass: result.pass, problems: result.problems };
  });
}

// Wires the checklist page UI and its saved state.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM — nothing to wire up.
  }

  const navCard = document.querySelector('[data-page="view-checklists"]');
  const aircraftSelect = document.getElementById("checklists-aircraft");
  const listEl = document.getElementById("checklists-list");
  const overallProgressEl = document.getElementById("checklists-overall-progress");
  const resetBtn = document.getElementById("checklists-reset-btn");
  const selfTestList = document.getElementById("checklists-selftest-list");
  const selfTestSummary = document.getElementById("checklists-selftest-summary");

  if (!navCard || !listEl) {
    return; // Checklists page markup not present — defensive no-op.
  }

  let aircraftList = [];

  function loadState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.warn("Checklists: couldn't read saved progress.", err);
      return {};
    }
  }

  function saveState(state) {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Checklists: couldn't save progress.", err);
    }
  }

  let state = loadState();

  function ticksFor(aircraftId, phaseId, itemCount) {
    const aircraftState = state[aircraftId] || {};
    const existing = aircraftState[phaseId];
    if (Array.isArray(existing) && existing.length === itemCount) {
      return existing;
    }
    return new Array(itemCount).fill(false);
  }

  function setTick(aircraftId, phaseId, itemIndex, checked, itemCount) {
    if (!state[aircraftId]) {
      state[aircraftId] = {};
    }
    const ticks = ticksFor(aircraftId, phaseId, itemCount).slice();
    ticks[itemIndex] = checked;
    state[aircraftId][phaseId] = ticks;
    saveState(state);
  }

  function selectedAircraft() {
    return aircraftList.find((a) => a.id === aircraftSelect.value) || null;
  }

  async function populateAircraftSelect() {
    if (aircraftList.length > 0) {
      return;
    }
    aircraftList = await loadAircraftList();
    aircraftSelect.innerHTML = aircraftList.map((a) => '<option value="' + a.id + '">' + escapeHtml(a.name) + "</option>").join("");
  }

  function renderChecklist() {
    const aircraft = selectedAircraft();
    if (!aircraft || !Array.isArray(aircraft.checklists)) {
      listEl.innerHTML = "";
      overallProgressEl.textContent = "";
      return;
    }

    let totalItems = 0;
    let totalChecked = 0;

    const phasesHtml = aircraft.checklists
      .map((phase, phaseIdx) => {
        const ticks = ticksFor(aircraft.id, phase.id, phase.items.length);
        const checkedCount = ticks.filter(Boolean).length;
        totalItems += phase.items.length;
        totalChecked += checkedCount;
        const complete = checkedCount === phase.items.length;

        const itemsHtml = phase.items
          .map((item, itemIdx) => {
            const checkboxId = "checklist-item-" + aircraft.id + "-" + phase.id + "-" + itemIdx;
            return (
              '<li class="checklist-item">' +
              '<label class="checklist-item__label">' +
              '<input type="checkbox" id="' + checkboxId + '" data-phase="' + phase.id + '" data-index="' + itemIdx + '"' +
              (ticks[itemIdx] ? " checked" : "") + ">" +
              '<span class="checklist-item__text' + (ticks[itemIdx] ? " checklist-item__text--done" : "") + '">' +
              escapeHtml(item) +
              "</span>" +
              "</label>" +
              "</li>"
            );
          })
          .join("");

        return (
          "<details class=\"checklist-phase\" data-phase-id=\"" + phase.id + "\"" + (phaseIdx === 0 ? " open" : "") + ">" +
          "<summary>" +
          '<span class="checklist-phase__label">' + escapeHtml(phase.label) + "</span>" +
          '<span class="chip ' + (complete ? "chip--go" : "chip--caution") + '">' + checkedCount + " / " + phase.items.length + "</span>" +
          "</summary>" +
          '<ul class="checklist-phase__items">' + itemsHtml + "</ul>" +
          "</details>"
        );
      })
      .join("");

    listEl.innerHTML = phasesHtml;
    overallProgressEl.textContent = aircraft.name + ": " + totalChecked + " / " + totalItems + " items complete.";

    listEl.querySelectorAll('input[type="checkbox"]').forEach((box) => {
      box.addEventListener("change", () => {
        const phaseId = box.dataset.phase;
        const itemIndex = parseInt(box.dataset.index, 10);
        const phase = aircraft.checklists.find((p) => p.id === phaseId);
        setTick(aircraft.id, phaseId, itemIndex, box.checked, phase.items.length);
        updateChecklistProgress(aircraft); // patches chips/strike-through in place so open <details> stay open
      });
    });
  }

  // Updates the "N / M" chips and strike-through text in place, without touching
  // the <details> elements, so a ticked item doesn't collapse an open phase.
  function updateChecklistProgress(aircraft) {
    let totalItems = 0;
    let totalChecked = 0;

    aircraft.checklists.forEach((phase) => {
      const ticks = ticksFor(aircraft.id, phase.id, phase.items.length);
      const checkedCount = ticks.filter(Boolean).length;
      totalItems += phase.items.length;
      totalChecked += checkedCount;
      const complete = checkedCount === phase.items.length;

      const detailsEl = listEl.querySelector('details[data-phase-id="' + phase.id + '"]');
      if (!detailsEl) {
        return;
      }
      const chip = detailsEl.querySelector(".chip");
      if (chip) {
        chip.textContent = checkedCount + " / " + phase.items.length;
        chip.classList.toggle("chip--go", complete);
        chip.classList.toggle("chip--caution", !complete);
      }

      phase.items.forEach((item, itemIdx) => {
        const checkboxId = "checklist-item-" + aircraft.id + "-" + phase.id + "-" + itemIdx;
        const input = document.getElementById(checkboxId);
        if (!input) {
          return;
        }
        input.checked = !!ticks[itemIdx];
        const span = input.parentElement.querySelector(".checklist-item__text");
        if (span) {
          span.classList.toggle("checklist-item__text--done", !!ticks[itemIdx]);
        }
      });
    });

    overallProgressEl.textContent = aircraft.name + ": " + totalChecked + " / " + totalItems + " items complete.";
  }

  aircraftSelect.addEventListener("change", renderChecklist);
  navCard.addEventListener("click", async () => {
    await populateAircraftSelect();
    renderChecklist();
    renderSelfTests();
  });

  resetBtn.addEventListener("click", () => {
    const aircraft = selectedAircraft();
    if (!aircraft) {
      return;
    }
    const ok = window.confirm("Reset every ticked item on " + aircraft.name + "'s checklist?");
    if (!ok) {
      return;
    }
    delete state[aircraft.id];
    saveState(state);
    renderChecklist();
    if (window.showToast) {
      window.showToast("Checklist reset.");
    }
  });

  function renderSelfTests() {
    if (aircraftList.length === 0) {
      return;
    }
    renderSelfTestList(selfTestList, selfTestSummary, runSelfTests(aircraftList), {
      itemClass: "checklists-selftest__item",
      detailClass: "checklists-selftest__detail",
      summaryClass: "checklists-selftest__summary",
      summarySuffix: "aircraft pass the data-shape self-test.",
      renderDetail: (r) => r.problems.join("; ")
    });
  }

  // Populate on module load too, same as the other pages, so the
  // dropdown/checklist are ready the first time this page is opened.
  (async () => {
    await populateAircraftSelect();
    renderChecklist();
    renderSelfTests();
  })();
})();
