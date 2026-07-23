// Wires the auth dialog to Supabase and keeps the form flow in sync. const used because these values will not change
// during the page lifetime, and we want to avoid accidental reassignment.
// Retrieves the different elements of the supabase authentication and dialog forms

import { supabase } from "./supabase-client.js";

const dialog = document.getElementById("auth-dialog");
const accountBtn = document.getElementById("account-btn");
const closeBtn = document.getElementById("auth-dialog-close");
const tabsWrapper = document.getElementById("auth-tabs");
const tabLogin = document.getElementById("auth-tab-login");
const tabSignup = document.getElementById("auth-tab-signup");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const forgotForm = document.getElementById("forgot-form");
const resetForm = document.getElementById("reset-form");
const ALL_FORMS = [loginForm, signupForm, forgotForm, resetForm];

const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");
const forgotError = document.getElementById("forgot-error");
const resetError = document.getElementById("reset-error");

const forgotPasswordLink = document.getElementById("forgot-password-link");
const forgotBackBtn = document.getElementById("forgot-back");

const signupPasswordInput = document.getElementById("signup-password");
const passwordChecklist = document.getElementById("password-checklist");
const resetPasswordInput = document.getElementById("reset-password");
const resetPasswordChecklist = document.getElementById("reset-password-checklist");

let currentUser = null;

// The password checklist mirrors the server policy for quicker feedback.
// This light email check catches malformed values before the request is sent.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return EMAIL_PATTERN.test(email);
}

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

function updatePasswordChecklist(inputEl, checklistEl) {
  const value = inputEl.value;
  PASSWORD_RULES.forEach(({ rule, test }) => {
    const item = checklistEl.querySelector('[data-rule="' + rule + '"]');
    item.classList.toggle("password-checklist__item--met", test(value));
  });
}

signupPasswordInput.addEventListener("input", () =>
  updatePasswordChecklist(signupPasswordInput, passwordChecklist)
);
resetPasswordInput.addEventListener("input", () =>
  updatePasswordChecklist(resetPasswordInput, resetPasswordChecklist)
);

function showToast(message) {
  if (window.showToast) window.showToast(message);
}

function clearErrors() {
  loginError.textContent = "";
  signupError.textContent = "";
  forgotError.textContent = "";
  resetError.textContent = "";
}

function setView(view) {
  clearErrors();
  tabsWrapper.hidden = view !== "login" && view !== "signup";
  tabLogin.setAttribute("aria-selected", String(view === "login"));
  tabSignup.setAttribute("aria-selected", String(view === "signup"));

  ALL_FORMS.forEach((form) => (form.hidden = true));
  const shown = { login: loginForm, signup: signupForm, forgot: forgotForm, reset: resetForm }[view];
  shown.hidden = false;

  if (view === "signup") updatePasswordChecklist(signupPasswordInput, passwordChecklist);
  if (view === "reset") updatePasswordChecklist(resetPasswordInput, resetPasswordChecklist);

  shown.querySelector("input").focus();
}

function openDialog(view) {
  setView(view || "login");
  dialog.showModal();
}

function closeDialog() {
  dialog.close();
}

function setBusy(form, busy) {
  form.querySelectorAll("button, input").forEach((el) => (el.disabled = busy));
}

async function refreshPilotProfile(user) {
  if (!user) {
    accountBtn.textContent = "Log in / Sign up";
    accountBtn.dataset.authed = "false";
    return;
  }
  const { data, error } = await supabase
    .from("pilots")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const name = !error && data ? data.display_name : user.email;
  accountBtn.textContent = "Log out (" + name + ")";
  accountBtn.dataset.authed = "true";
}

accountBtn.addEventListener("click", () => {
  if (currentUser) {
    supabase.auth.signOut();
  } else {
    openDialog("login");
  }
});

// Unconditional entry point for other modules that need to prompt for login
// (e.g. logbook.js/navlog-bundle.js's "log in to save" prompts) — deliberately
// NOT accountBtn.click(), which toggles sign-in/sign-out based on currentUser
// and would sign a genuinely logged-in user out if their own page's view of
// login state was stale (this was BUG-03: an actual sign-out-on-click bug).
window.openAuthDialog = function openAuthDialog(view) {
  openDialog(view || "login");
};

// The single source of truth for "is anyone logged in right now" — other
// modules (logbook.js) read this instead of running their own separate
// supabase.auth.getUser()/onAuthStateChange, which could race or (before
// the initial getSession() below resolves) miss a session that already
// exists, showing a "Log in" button/prompt while a session is actually
// still valid. Returns the Supabase user object, or null if logged out.
window.getCurrentUser = function getCurrentUser() {
  return currentUser;
};

// Fired every time currentUser changes (including the very first time it's
// determined, on page load) — see js/logbook.js's own listener for why this
// exists instead of each page tracking auth state independently.
function broadcastAuthState() {
  window.dispatchEvent(new CustomEvent("navlog-auth-changed", { detail: { loggedIn: !!currentUser } }));
}

closeBtn.addEventListener("click", closeDialog);
dialog.addEventListener("cancel", () => setView("login")); // Esc key resets the dialog for next open
tabLogin.addEventListener("click", () => setView("login"));
tabSignup.addEventListener("click", () => setView("signup"));
forgotPasswordLink.addEventListener("click", () => setView("forgot"));
forgotBackBtn.addEventListener("click", () => setView("login"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  // Defence in depth alongside the button-visibility fix elsewhere (e.g.
  // logbook.js): even if this dialog were ever reachable while a session
  // already exists, submitting new credentials must never silently swap
  // the signed-in account. Log out explicitly first.
  if (currentUser) {
    loginError.textContent = "You're already logged in. Log out first if you want to switch accounts.";
    return;
  }

  const email = loginForm.elements["email"].value.trim();
  const password = loginForm.elements["password"].value;

  if (!email || !isValidEmail(email)) {
    loginError.textContent = "Enter a valid email address.";
    loginForm.elements["email"].focus();
    return;
  }
  if (!password) {
    loginError.textContent = "Enter your password.";
    loginForm.elements["password"].focus();
    return;
  }

  setBusy(loginForm, true);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  setBusy(loginForm, false);
  if (error) {
    loginError.textContent = error.message;
    return;
  }
  loginForm.reset();
  closeDialog();
  showToast("Logged in.");
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signupError.textContent = "";

  const email = signupForm.elements["email"].value.trim();
  const password = signupForm.elements["password"].value;
  const displayName = signupForm.elements["displayName"].value.trim();
  const homeBase = signupForm.elements["homeBase"].value.trim();

  if (!email || !isValidEmail(email)) {
    signupError.textContent = "Enter a valid email address.";
    signupForm.elements["email"].focus();
    return;
  }
  if (!displayName) {
    signupError.textContent = "Enter a display name.";
    signupForm.elements["displayName"].focus();
    return;
  }
  if (!passwordMeetsPolicy(password)) {
    signupError.textContent = "Please meet all the password requirements above before continuing.";
    signupPasswordInput.focus();
    return;
  }

  setBusy(signupForm, true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, home_base: homeBase || null }
    }
  });

  setBusy(signupForm, false);
  if (error) {
    // Supabase's own server-side check is the real source of truth — it can
    // still reject a password that passed the client-side rules above (e.g.
    // it's on a known leaked-password list, if that project setting is on).
    if (error.name === "AuthWeakPasswordError" && error.reasons) {
      signupError.textContent = "Password rejected by the server: " + error.reasons.join(", ") + ".";
    } else {
      signupError.textContent = error.message;
    }
    return;
  }
  signupForm.reset();
  updatePasswordChecklist(signupPasswordInput, passwordChecklist);

  if (data.session) {
    // Email confirmation is off — the account is immediately usable.
    closeDialog();
    showToast("Account created. You're logged in.");
  } else {
    // Email confirmation is on — no session yet until the link is clicked.
    closeDialog();
    showToast("Account created. Check your email to confirm before logging in.");
  }
});

forgotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  forgotError.textContent = "";

  const email = forgotForm.elements["email"].value.trim();

  if (!email || !isValidEmail(email)) {
    forgotError.textContent = "Enter a valid email address.";
    forgotForm.elements["email"].focus();
    return;
  }

  setBusy(forgotForm, true);

  // Link back to this page; Supabase parses the recovery token from the
  // URL and fires PASSWORD_RECOVERY (handled below), opening "reset". This
  // URL must be in Supabase's Authentication > URL Configuration allow-list.
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  setBusy(forgotForm, false);
  if (error) {
    forgotError.textContent = error.message;
    return;
  }
  forgotForm.reset();
  closeDialog();
  showToast("If that email has an account, a reset link is on its way.");
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetError.textContent = "";

  const password = resetForm.elements["password"].value;

  if (!passwordMeetsPolicy(password)) {
    resetError.textContent = "Please meet all the password requirements above before continuing.";
    resetPasswordInput.focus();
    return;
  }

  setBusy(resetForm, true);
  const { error } = await supabase.auth.updateUser({ password });
  setBusy(resetForm, false);

  if (error) {
    if (error.name === "AuthWeakPasswordError" && error.reasons) {
      resetError.textContent = "Password rejected by the server: " + error.reasons.join(", ") + ".";
    } else {
      resetError.textContent = error.message;
    }
    return;
  }
  resetForm.reset();
  updatePasswordChecklist(resetPasswordInput, resetPasswordChecklist);
  closeDialog();
  showToast("Password updated.");
});

supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;
  refreshPilotProfile(currentUser);
  broadcastAuthState();

  if (event === "SIGNED_OUT") {
    showToast("Logged out.");
  }
  if (event === "PASSWORD_RECOVERY") {
    // Arrived here via the reset-password email link — prompt for a new
    // password regardless of whether the dialog was already open.
    openDialog("reset");
  }
});

// Pick up an existing session on page load (e.g. returning visitor).
supabase.auth.getSession().then(({ data }) => {
  currentUser = data.session ? data.session.user : null;
  refreshPilotProfile(currentUser);
  broadcastAuthState();
});
