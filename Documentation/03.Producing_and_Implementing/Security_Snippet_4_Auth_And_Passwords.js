// Source: js/auth.js
// Purpose: client-side password policy gate. The actual hashing and storage
// of the password is never handled by this project's own code at all. It
// is delegated entirely to Supabase Auth, which hashes passwords (bcrypt)
// server-side before they are ever written to a table. This file only
// stops an obviously-weak password from being submitted, and mirrors
// Supabase's own server-side policy so the pilot gets instant feedback.

const PASSWORD_RULES = [
  { rule: "length", label: "At least 10 characters", test: (pw) => pw.length >= 10 },
  { rule: "lower", label: "A lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { rule: "upper", label: "An uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { rule: "digit", label: "A number", test: (pw) => /\d/.test(pw) },
  { rule: "symbol", label: "A symbol (e.g. ! @ # $)", test: (pw) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pw) }
];

function passwordMeetsPolicy(password) {
  return PASSWORD_RULES.every((r) => r.test(password));
}

// The server is still treated as the source of truth: if Supabase rejects a
// password that passed every rule above (e.g. it appears on a known
// leaked-password list), that server-side reason is shown to the pilot
// instead of a generic error:
//
// if (error.name === "AuthWeakPasswordError" && error.reasons) {
//   signupError.textContent = "Password rejected by the server: " + error.reasons.join(", ") + ".";
// }
//
// Session handling (auth.js, on load):
// supabase.auth.getSession().then(({ data }) => {
//   currentUser = data.session ? data.session.user : null;
//   refreshPilotProfile(currentUser);
// });
//
// The session token itself (a signed JWT) is issued and verified by
// Supabase, never generated or checked by this project's own code, which
// removes an entire class of home-grown auth bugs (weak session IDs,
// missing expiry, etc.) from the app's attack surface.
