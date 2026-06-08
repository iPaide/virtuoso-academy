const storageKeys = {
  profile: "va.profile",
  sessions: "va.sessions",
  activeSessionId: "va.activeSessionId"
};

if (location.hash === "#blueprint") {
  history.replaceState(null, "", "#method");
}

const mentorGreeting = {
  role: "assistant",
  content:
    "Welcome to The Studio. Bring me lyrics, a hook, a concept, or the business pressure you are facing. I will give you the truth with the gloves on. The pen gets sharper in the ring."
};

const sampleVersePrompt = `Critique this verse like a mentor, focusing on imagery, rhyme pattern, cadence, and emotional truth:

I been running from the city where the lights don't sleep
Dreams in my pocket but the rent too steep
Everybody says they love me when the song goes live
But nobody calls when I am barely alive`;

const elements = {
  authButton: document.querySelector("#authButton"),
  authDialog: document.querySelector("#authDialog"),
  authForm: document.querySelector("#authForm"),
  authTitle: document.querySelector("#authTitle"),
  authSubmit: document.querySelector("#authSubmit"),
  authNote: document.querySelector("#authNote"),
  signupTab: document.querySelector("#signupTab"),
  loginTab: document.querySelector("#loginTab"),
  resetTab: document.querySelector("#resetTab"),
  closeAuth: document.querySelector("#closeAuth"),
  resetToken: document.querySelector("#resetToken"),
  artistName: document.querySelector("#artistName"),
  artistEmail: document.querySelector("#artistEmail"),
  artistPassword: document.querySelector("#artistPassword"),
  profilePill: document.querySelector("#profilePill"),
  mentorMode: document.querySelector("#mentorMode"),
  submissionTarget: document.querySelector("#submissionTarget"),
  joinButton: document.querySelector("#joinButton"),
  startAccountButton: document.querySelector("#startAccountButton"),
  samplePrompt: document.querySelector("#samplePrompt"),
  sessionList: document.querySelector("#sessionList"),
  newSession: document.querySelector("#newSession"),
  messages: document.querySelector("#messages"),
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  sendButton: document.querySelector("#sendButton"),
  statusText: document.querySelector("#statusText")
};

let authMode = "signup";
let profile = loadJson(storageKeys.profile, null);
let sessions = loadJson(storageKeys.sessions, []);
let activeSessionId = localStorage.getItem(storageKeys.activeSessionId);
let studioSubmissions = [];
const requestedSubmissionId = new URLSearchParams(window.location.search).get("submission");

function loadJson(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(storageKeys.sessions, JSON.stringify(sessions));
  if (activeSessionId) localStorage.setItem(storageKeys.activeSessionId, activeSessionId);
}

function createSession() {
  const session = {
    id: crypto.randomUUID(),
    title: "New critique session",
    createdAt: new Date().toISOString(),
    messages: [mentorGreeting]
  };
  sessions.unshift(session);
  activeSessionId = session.id;
  saveState();
  render();
}

function getActiveSession() {
  if (!sessions.length) createSession();
  let session = sessions.find((item) => item.id === activeSessionId);
  if (!session) {
    activeSessionId = sessions[0].id;
    session = sessions[0];
  }
  return session;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(dateString));
}

function renderProfile() {
  if (profile?.name) {
    elements.profilePill.textContent = profile.name;
    elements.authButton.textContent = "Dashboard";
    elements.joinButton.textContent = "Open dashboard";
    elements.startAccountButton.textContent = "Open dashboard";
    elements.artistName.value = profile.name;
    elements.artistEmail.value = profile.email || "";
  } else {
    elements.profilePill.textContent = "Guest artist";
    elements.authButton.textContent = "Sign in";
    elements.joinButton.textContent = "Create student account";
    elements.startAccountButton.textContent = "Create student account";
  }
}

function renderSubmissionTargets() {
  if (!profile?.name) {
    elements.submissionTarget.innerHTML = `<option value="">Log in to save critique</option>`;
    elements.submissionTarget.disabled = true;
    return;
  }

  if (!studioSubmissions.length) {
    elements.submissionTarget.innerHTML = `<option value="">No submissions yet</option>`;
    elements.submissionTarget.disabled = true;
    return;
  }

  elements.submissionTarget.disabled = false;
  elements.submissionTarget.innerHTML = `
    <option value="">Do not save</option>
    ${studioSubmissions
      .map((submission) => `<option value="${escapeHtml(submission.id)}">${escapeHtml(submission.title)} · ${escapeHtml(submission.status)}</option>`)
      .join("")}
  `;
  if (requestedSubmissionId && studioSubmissions.some((submission) => submission.id === requestedSubmissionId)) {
    elements.submissionTarget.value = requestedSubmissionId;
  }
}

function renderSessions() {
  elements.sessionList.innerHTML = "";
  sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `session-item${session.id === activeSessionId ? " active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(session.title)}</strong><span>${formatDate(session.createdAt)}</span>`;
    button.addEventListener("click", () => {
      activeSessionId = session.id;
      saveState();
      render();
    });
    elements.sessionList.append(button);
  });
}

function renderMessages() {
  const session = getActiveSession();
  elements.messages.innerHTML = "";
  session.messages.forEach((message) => {
    const article = document.createElement("article");
    article.className = `message ${message.role}`;
    article.innerHTML = `<span class="message-label">${message.role === "user" ? "Artist" : "Mentor"}</span>${escapeHtml(message.content)}`;
    elements.messages.append(article);
  });
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function render() {
  renderProfile();
  renderSubmissionTargets();
  renderSessions();
  renderMessages();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function summarizeTitle(content) {
  return content.replace(/\s+/g, " ").trim().slice(0, 54) || "Critique session";
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === "signup";
  const isLogin = mode === "login";
  const isResetRequest = mode === "reset-request";
  const isResetConfirm = mode === "reset-confirm";

  elements.authTitle.textContent = isSignup
    ? "Create your student account"
    : isLogin
      ? "Log in to your profile"
      : isResetConfirm
        ? "Set a new password"
        : "Reset your password";
  elements.authSubmit.textContent = isSignup
    ? "Create account"
    : isLogin
      ? "Log in"
      : isResetConfirm
        ? "Set new password"
        : "Send reset link";
  elements.artistName.closest("label").classList.toggle("hidden", !isSignup);
  elements.artistEmail.closest("label").classList.toggle("hidden", isResetConfirm);
  elements.artistPassword.closest("label").classList.toggle("hidden", isResetRequest);
  elements.artistName.required = isSignup;
  elements.artistEmail.required = !isResetConfirm;
  elements.artistPassword.required = !isResetRequest;
  elements.artistPassword.minLength = isSignup || isResetConfirm ? 8 : 6;
  elements.artistPassword.autocomplete = isSignup || isResetConfirm ? "new-password" : "current-password";
  elements.authNote.textContent = isSignup
    ? "Create a student account to unlock your academy profile and return to your work."
    : isLogin
      ? "Use the email and password you created for Virtuoso Academy."
      : isResetConfirm
        ? "Choose a stronger password: at least 8 characters with a letter and a number."
        : "Enter your account email. If it exists, a reset link will be prepared.";
  elements.signupTab.classList.toggle("active", isSignup);
  elements.loginTab.classList.toggle("active", isLogin);
  elements.resetTab.classList.toggle("active", isResetRequest || isResetConfirm);
}

function openAuth(mode = profile?.name ? "login" : "signup") {
  setAuthMode(mode);
  elements.artistPassword.value = "";
  elements.authDialog.showModal();
  queueMicrotask(() => (authMode === "signup" ? elements.artistName : elements.artistEmail).focus());
}

async function authRequest(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Student access failed.");
  return data.student;
}

async function resetRequest(payload) {
  const response = await fetch("/api/auth/password-reset/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Password reset failed.");
  return data;
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

async function loadStudioSubmissions() {
  if (!profile?.name) {
    studioSubmissions = [];
    renderSubmissionTargets();
    return;
  }

  try {
    const response = await fetch("/api/submissions/me");
    const data = await response.json();
    studioSubmissions = response.ok ? data.submissions : [];
  } catch {
    studioSubmissions = [];
  }
  renderSubmissionTargets();
}

async function loadCurrentStudent() {
  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    profile = response.ok ? data.student : null;
    if (profile) {
      localStorage.setItem(storageKeys.profile, JSON.stringify(profile));
    } else {
      localStorage.removeItem(storageKeys.profile);
    }
  } catch {
    profile = loadJson(storageKeys.profile, null);
  }
  renderProfile();
  await loadStudioSubmissions();
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  profile = null;
  studioSubmissions = [];
  localStorage.removeItem(storageKeys.profile);
  render();
  location.hash = "join";
}

async function sendMessage(content) {
  const session = getActiveSession();
  const mode = elements.mentorMode.value;
  const submissionId = elements.submissionTarget.value;
  session.messages.push({ role: "user", content });
  if (session.title === "New critique session") session.title = summarizeTitle(content);

  const assistantMessage = { role: "assistant", content: "" };
  session.messages.push(assistantMessage);
  saveState();
  render();

  elements.sendButton.disabled = true;
  elements.messageInput.disabled = true;
  elements.statusText.textContent = "Mentor is listening to the tape...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: session.messages.slice(0, -1), mode })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantMessage.content += decoder.decode(value, { stream: true });
      saveState();
      renderMessages();
    }

    if (submissionId) {
      await postJson("/api/submissions/save-mentor-critique", {
        id: submissionId,
        body: assistantMessage.content,
        mode
      });
      await loadStudioSubmissions();
      elements.statusText.textContent = "Critique saved to the selected submission. Revision is due.";
    } else {
      elements.statusText.textContent = "Critique complete. Select a submission to save it into the archive.";
    }
  } catch (error) {
    assistantMessage.content += `\n\nThe room hit a technical snag: ${error.message}. Check the backend and send it again.`;
    elements.statusText.textContent = "Connection failed.";
    saveState();
    renderMessages();
  } finally {
    elements.sendButton.disabled = false;
    elements.messageInput.disabled = false;
    elements.messageInput.focus();
  }
}

elements.authButton.addEventListener("click", () => {
  if (profile?.name) {
    window.location.href = "/dashboard";
  } else {
    openAuth("signup");
  }
});
elements.joinButton.addEventListener("click", () => {
  if (profile?.name) {
    window.location.href = "/dashboard";
  } else {
    openAuth("signup");
  }
});
elements.startAccountButton.addEventListener("click", () => {
  if (profile?.name) {
    window.location.href = "/dashboard";
  } else {
    openAuth("signup");
  }
});
elements.signupTab.addEventListener("click", () => setAuthMode("signup"));
elements.loginTab.addEventListener("click", () => setAuthMode("login"));
elements.resetTab.addEventListener("click", () => setAuthMode("reset-request"));
elements.closeAuth.addEventListener("click", () => elements.authDialog.close());
elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.artistName.value.trim();
  const email = elements.artistEmail.value.trim();
  const password = elements.artistPassword.value;
  const token = elements.resetToken.value;

  try {
    if (authMode === "reset-request") {
      const data = await resetRequest({ email });
      elements.authNote.textContent = data.resetUrl ? "Reset link ready for testing: " : data.message;
      if (data.resetUrl) {
        const link = document.createElement("a");
        link.href = data.resetUrl;
        link.textContent = "open reset link";
        elements.authNote.append(link);
      }
      return;
    }

    profile = await authRequest(
      authMode === "signup"
        ? "/api/auth/signup"
        : authMode === "reset-confirm"
          ? "/api/auth/password-reset/confirm"
          : "/api/auth/login",
      authMode === "reset-confirm" ? { token, password } : { name, email, password }
    );
    localStorage.setItem(storageKeys.profile, JSON.stringify(profile));
    elements.authDialog.close();
    elements.authForm.reset();
    render();
    window.location.href = "/dashboard";
  } catch (error) {
    elements.authNote.textContent = error.message;
  }
});

elements.newSession.addEventListener("click", createSession);
elements.samplePrompt.addEventListener("click", () => {
  elements.messageInput.value = sampleVersePrompt;
  location.hash = "studio";
  elements.messageInput.focus();
});

elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = elements.messageInput.value.trim();
  if (!content) return;
  elements.messageInput.value = "";
  await sendMessage(content);
});

if (!sessions.length) createSession();
render();
loadCurrentStudent();

const resetToken = new URLSearchParams(window.location.search).get("reset");
if (resetToken) {
  elements.resetToken.value = resetToken;
  openAuth("reset-confirm");
}
