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
  closeAuth: document.querySelector("#closeAuth"),
  artistName: document.querySelector("#artistName"),
  artistEmail: document.querySelector("#artistEmail"),
  artistPassword: document.querySelector("#artistPassword"),
  profilePill: document.querySelector("#profilePill"),
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
  elements.authTitle.textContent = isSignup ? "Create your student account" : "Log in to your profile";
  elements.authSubmit.textContent = isSignup ? "Create account" : "Log in";
  elements.artistName.closest("label").classList.toggle("hidden", !isSignup);
  elements.artistName.required = isSignup;
  elements.artistPassword.autocomplete = isSignup ? "new-password" : "current-password";
  elements.authNote.textContent = isSignup
    ? "Create a student account to unlock your academy profile and return to your work."
    : "Use the email and password you created for Virtuoso Academy.";
  elements.signupTab.classList.toggle("active", isSignup);
  elements.loginTab.classList.toggle("active", !isSignup);
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
}

async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  profile = null;
  localStorage.removeItem(storageKeys.profile);
  render();
  location.hash = "join";
}

async function sendMessage(content) {
  const session = getActiveSession();
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
      body: JSON.stringify({ messages: session.messages.slice(0, -1) })
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

    elements.statusText.textContent = "Critique saved. The next rep is waiting.";
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
elements.closeAuth.addEventListener("click", () => elements.authDialog.close());
elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.artistName.value.trim();
  const email = elements.artistEmail.value.trim();
  const password = elements.artistPassword.value;

  try {
    profile = await authRequest(authMode === "signup" ? "/api/auth/signup" : "/api/auth/login", { name, email, password });
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
