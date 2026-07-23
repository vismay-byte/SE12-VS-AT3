// Renders the saved flights and keeps the running hours total in sync.

import { supabase } from "./supabase-client.js";
import {
  reconstructNavlogData,
  buildNavlogPdfDoc,
  loadJsPdfConstructor,
  pendingFlightSaveCount,
  flushPendingFlightSaves
} from "./navlog-bundle.js";
import { formatEte } from "./route-planner-bundle.js";
import { escapeHtml, renderSelfTestList } from "./shared-utils.js";

// Formats the running total in decimal hours and keeps a small self-test around it.

export function formatHoursDecimal(totalMinutes) {
  return (totalMinutes / 60).toFixed(1) + " h";
}

export const SELF_TEST_CASES = [
  { label: "90 min → 1.5 h", fn: () => formatHoursDecimal(90), expected: "1.5 h" },
  { label: "12 min → 0.2 h", fn: () => formatHoursDecimal(12), expected: "0.2 h" },
  { label: "0 min → 0.0 h", fn: () => formatHoursDecimal(0), expected: "0.0 h" }
];

// Runs the self-test cases and reports pass/fail for each one.
export function runSelfTests() {
  return SELF_TEST_CASES.map((testCase) => {
    const actual = testCase.fn();
    return { label: testCase.label, pass: actual === testCase.expected, expected: testCase.expected, actual };
  });
}

// Wires the logbook UI, loading state, and replay actions.

(function () {
  "use strict";

  if (typeof document === "undefined") {
    return; // No DOM — nothing to wire up.
  }

  const navCard = document.querySelector('[data-page="view-logbook"]');
  const loggedOutNote = document.getElementById("logbook-logged-out");
  const loggedOutBtn = document.getElementById("logbook-login-btn");
  const contentEl = document.getElementById("logbook-content");
  const totalHoursEl = document.getElementById("logbook-total-hours");
  const flightCountEl = document.getElementById("logbook-flight-count");
  const listEl = document.getElementById("logbook-list");
  const emptyNote = document.getElementById("logbook-empty");
  const pendingNote = document.getElementById("logbook-pending-note");
  const pendingRetryBtn = document.getElementById("logbook-pending-retry-btn");
  const selfTestList = document.getElementById("logbook-selftest-list");
  const selfTestSummary = document.getElementById("logbook-selftest-summary");

  if (!navCard || !listEl) {
    return; // Logbook page markup not present — defensive no-op.
  }

  let currentUser = null;

  function updatePendingNote() {
    const count = pendingFlightSaveCount();
    pendingNote.hidden = count === 0;
    pendingNote.textContent = count + " flight" + (count === 1 ? "" : "s") + " queued, waiting to save (you were offline when you saved).";
  }

  async function loadFlights() {
    const { data, error } = await supabase
      .from("flights")
      .select("id, flown_on, aircraft_type, route, flight_time_minutes")
      .eq("pilot_id", currentUser.id)
      .order("flown_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("Logbook: couldn't load flights.", error);
      return { flights: null, error };
    }
    return { flights: data, error: null };
  }

  function renderFlightRow(flight) {
    const snapshot = flight.route || {};
    const depLabel = snapshot.dep ? snapshot.dep.icao : snapshot.route ? snapshot.route.departureIcao : "?";
    const arrLabel = snapshot.arr ? snapshot.arr.icao : snapshot.route ? snapshot.route.arrivalIcao : "?";
    return (
      '<li class="logbook-row" data-id="' + flight.id + '">' +
      '<div class="logbook-row__main">' +
      '<span class="logbook-row__date">' + escapeHtml(flight.flown_on) + "</span>" +
      '<span class="logbook-row__route">' + escapeHtml(depLabel) + " → " + escapeHtml(arrLabel) + "</span>" +
      '<span class="logbook-row__aircraft">' + escapeHtml(flight.aircraft_type) + "</span>" +
      '<span class="logbook-row__duration">' + formatEte(flight.flight_time_minutes) + "</span>" +
      "</div>" +
      '<div class="logbook-row__actions">' +
      '<button type="button" class="btn btn--ghost" data-action="pdf">Re-export PDF</button>' +
      '<button type="button" class="btn btn--ghost logbook-row__delete" data-action="delete">Delete</button>' +
      "</div>" +
      "</li>"
    );
  }

  async function reExportPdf(flight) {
    if (!flight.route) {
      if (window.showToast) {
        window.showToast("This flight has no stored route detail to rebuild a PDF from.");
      }
      return;
    }
    if (window.showToast) {
      window.showToast("Loading PDF library…");
    }
    let jsPDF;
    try {
      jsPDF = await loadJsPdfConstructor();
    } catch (err) {
      console.warn("Logbook: couldn't load jsPDF.", err);
      if (window.showToast) {
        window.showToast("Couldn't load the PDF library. Check your internet connection and try again.");
      }
      return;
    }
    const data = reconstructNavlogData(flight.route);
    const { doc, filename } = buildNavlogPdfDoc(jsPDF, data);
    doc.save(filename);
    if (window.showToast) {
      window.showToast("Downloaded " + filename + ".");
    }
  }

  async function deleteFlight(flight, rowEl) {
    const ok = window.confirm("Delete this logbook entry (" + flight.flown_on + ", " + flight.aircraft_type + ")? This can't be undone.");
    if (!ok) {
      return;
    }
    const { error } = await supabase.from("flights").delete().eq("id", flight.id);
    if (error) {
      if (window.showToast) {
        window.showToast("Couldn't delete: " + error.message);
      }
      return;
    }
    rowEl.remove();
    if (window.showToast) {
      window.showToast("Deleted.");
    }
    renderAll(); // re-fetch so the running total updates
  }

  async function renderAll() {
    updatePendingNote();

    // Reads auth.js's own already-tracked login state instead of running a
    // second, independent supabase.auth.getUser() check here — that second
    // check could race with (or run before) auth.js's own initial session
    // lookup and incorrectly report "logged out" for a split second, which
    // showed the "Log in" button/prompt even while a session was still
    // valid — a real security-relevant bug (a logged-in student could open
    // the login form and sign in as a different account without ever being
    // told they were already signed in). window.getCurrentUser() is the one
    // place this is now decided.
    currentUser = window.getCurrentUser ? window.getCurrentUser() : null;

    if (!currentUser) {
      loggedOutNote.hidden = false;
      contentEl.hidden = true;
      return;
    }
    loggedOutNote.hidden = true;
    contentEl.hidden = false;

    const { flights, error } = await loadFlights();
    if (error) {
      listEl.innerHTML = "";
      emptyNote.hidden = false;
      emptyNote.textContent = "Couldn't load your logbook. Check your internet connection and try again.";
      totalHoursEl.textContent = "-";
      flightCountEl.textContent = "-";
      return;
    }

    if (flights.length === 0) {
      listEl.innerHTML = "";
      emptyNote.hidden = false;
      emptyNote.textContent = "No flights saved yet. Generate a NAVLOG and use “Save to logbook” there.";
      totalHoursEl.textContent = formatHoursDecimal(0);
      flightCountEl.textContent = "0";
      return;
    }

    emptyNote.hidden = true;
    const totalMinutes = flights.reduce((sum, f) => sum + f.flight_time_minutes, 0);
    totalHoursEl.textContent = formatHoursDecimal(totalMinutes);
    flightCountEl.textContent = String(flights.length);

    listEl.innerHTML = flights.map(renderFlightRow).join("");
    listEl.querySelectorAll(".logbook-row").forEach((rowEl) => {
      const flight = flights.find((f) => String(f.id) === rowEl.dataset.id);
      rowEl.querySelector('[data-action="pdf"]').addEventListener("click", () => reExportPdf(flight));
      rowEl.querySelector('[data-action="delete"]').addEventListener("click", () => deleteFlight(flight, rowEl));
    });
  }

  if (loggedOutBtn) {
    loggedOutBtn.addEventListener("click", () => {
      // Opens the login dialog directly — not accountBtn.click(), which
      // toggles sign-in/sign-out based on auth.js's own login state and
      // would sign a genuinely logged-in user out if this page's logged-out
      // prompt were ever showing while a session actually exists (BUG-03).
      if (window.openAuthDialog) {
        window.openAuthDialog("login");
      }
    });
  }

  if (pendingRetryBtn) {
    pendingRetryBtn.addEventListener("click", async () => {
      pendingRetryBtn.disabled = true;
      const { savedCount, remainingCount } = await flushPendingFlightSaves();
      pendingRetryBtn.disabled = false;
      if (window.showToast) {
        window.showToast(
          savedCount > 0
            ? savedCount + " flight" + (savedCount === 1 ? "" : "s") + " saved. " + (remainingCount > 0 ? remainingCount + " still queued." : "")
            : "Still couldn't save. Check your internet connection."
        );
      }
      updatePendingNote();
      if (savedCount > 0) {
        renderAll();
      }
    });
  }

  navCard.addEventListener("click", renderAll);
  // Listens for auth.js's own broadcast (see window.getCurrentUser() above)
  // instead of a second, independent supabase.auth.onAuthStateChange
  // subscription here — one source of truth, so this page's login-state
  // view can never diverge from the header's. Also renders immediately on
  // module load (not just on a future click/event) so a student who logged
  // in on a *different* page and then opens Logbook for the first time in
  // this session sees the correct state straight away, not the stale
  // "not logged in" default the page starts hidden behind.
  window.addEventListener("navlog-auth-changed", renderAll);
  renderAll();

  function renderSelfTests() {
    renderSelfTestList(selfTestList, selfTestSummary, runSelfTests(), {
      itemClass: "logbook-selftest__item",
      summaryClass: "logbook-selftest__summary"
    });
  }
  renderSelfTests();
})();
