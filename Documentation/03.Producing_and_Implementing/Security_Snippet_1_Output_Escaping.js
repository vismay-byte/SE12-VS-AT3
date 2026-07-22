// Source: js/shared-utils.js
// Purpose: central helper used before ANY user-supplied or database-supplied
// string is written into the DOM via innerHTML, so a value like
// <script>alert(1)</script> typed into a waypoint name, aircraft type, or
// route label is displayed as harmless text instead of being executed.

// Escapes HTML-sensitive characters before injecting text into the DOM.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Example call site: js/logbook.js. Every field pulled back from Supabase
// (dates, ICAO codes, aircraft type) is escaped before being concatenated
// into the row's innerHTML string:
//
// return (
//   '<li class="logbook-row" data-id="' + flight.id + '">' +
//   '<div class="logbook-row__main">' +
//   '<span class="logbook-row__date">' + escapeHtml(flight.flown_on) + "</span>" +
//   '<span class="logbook-row__route">' + escapeHtml(depLabel) + " -> " + escapeHtml(arrLabel) + "</span>" +
//   '<span class="logbook-row__aircraft">' + escapeHtml(flight.aircraft_type) + "</span>" +
//   ...
// );
//
// The same pattern is repeated in js/checklists.js, js/nav-page.js,
// js/navlog-bundle.js and js/route-planner-bundle.js for every place a
// string value (rather than a number the app generated itself) is rendered.
