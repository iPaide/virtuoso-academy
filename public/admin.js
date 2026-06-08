const adminElements = {
  dialog: document.querySelector("#adminDialog"),
  form: document.querySelector("#adminForm"),
  loginButton: document.querySelector("#adminLoginButton"),
  logoutButton: document.querySelector("#adminLogoutButton"),
  closeButton: document.querySelector("#closeAdmin"),
  password: document.querySelector("#adminPassword"),
  note: document.querySelector("#adminNote"),
  dashboard: document.querySelector("#adminDashboard"),
  refreshButton: document.querySelector("#refreshAdmin"),
  studentCount: document.querySelector("#adminStudentCount"),
  activeSessionCount: document.querySelector("#adminActiveSessionCount"),
  noteCount: document.querySelector("#adminNoteCount"),
  enrollmentCount: document.querySelector("#adminEnrollmentCount"),
  paidAccessCount: document.querySelector("#adminPaidAccessCount"),
  needsCritiqueCount: document.querySelector("#adminNeedsCritiqueCount"),
  revisionDueCount: document.querySelector("#adminRevisionDueCount"),
  interventionCount: document.querySelector("#adminInterventionCount"),
  attentionList: document.querySelector("#adminAttentionList"),
  submissionList: document.querySelector("#adminSubmissionList"),
  studentList: document.querySelector("#adminStudentList"),
  selectedStudentName: document.querySelector("#selectedStudentName"),
  selectedStudentMeta: document.querySelector("#selectedStudentMeta"),
  selectedStudentSignals: document.querySelector("#selectedStudentSignals"),
  selectedStudentAccess: document.querySelector("#selectedStudentAccess"),
  selectedStudentSubmissions: document.querySelector("#selectedStudentSubmissions"),
  studentStatus: document.querySelector("#studentStatus"),
  studentNote: document.querySelector("#studentNote"),
  saveStudentNote: document.querySelector("#saveStudentNote"),
  statusText: document.querySelector("#adminStatusText")
};

let adminStudents = [];
let adminSubmissions = [];
let attentionQueue = [];
let selectedAdminStudentId = null;

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(dateString));
}

function getStudentName(studentId) {
  return adminStudents.find((student) => student.id === studentId)?.name || "Unknown student";
}

function statusClass(value) {
  return String(value || "active")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function renderPill(label, value, tone = "") {
  return `<span class="admin-pill ${tone}"><strong>${escapeHtml(value)}</strong>${escapeHtml(label)}</span>`;
}

async function adminRequest(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Admin request failed.");
  return data;
}

function setAdminUnlocked(unlocked) {
  adminElements.dashboard.classList.toggle("hidden", !unlocked);
  adminElements.logoutButton.classList.toggle("hidden", !unlocked);
  adminElements.loginButton.textContent = unlocked ? "Refresh admin portal" : "Unlock admin portal";
  adminElements.statusText.textContent = unlocked ? "Admin portal unlocked." : "Admin portal locked.";
}

function renderAdminStudents() {
  adminElements.studentList.innerHTML = "";

  if (!adminStudents.length) {
    adminElements.studentList.innerHTML = `<div class="session-item"><strong>No students yet</strong><span>The academy is waiting for its first signup.</span></div>`;
    return;
  }

  adminStudents.forEach((student) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `student-row${student.id === selectedAdminStudentId ? " active" : ""}`;
    button.innerHTML = `
      <span>
        <strong>${escapeHtml(student.name)}</strong>
        <span>${escapeHtml(student.email)} · ${escapeHtml(student.signals?.accessLabel || "First Rep")}</span>
      </span>
      <span class="student-status ${statusClass(student.status)}">${escapeHtml(student.status || "Active")}</span>
    `;
    button.addEventListener("click", () => selectAdminStudent(student.id));
    adminElements.studentList.append(button);
  });
}

function renderAttentionQueue() {
  if (!attentionQueue.length) {
    adminElements.attentionList.innerHTML = `<article><strong>No urgent flags</strong><p>No student currently needs critique, revision pressure, or intervention.</p></article>`;
    return;
  }

  adminElements.attentionList.innerHTML = attentionQueue
    .map(
      (student) => `
        <button class="attention-card" data-student-id="${escapeHtml(student.id)}" type="button">
          <span class="student-status ${student.signals.needsIntervention ? "intervention" : "active"}">
            ${student.signals.needsIntervention ? "Intervention" : "Review"}
          </span>
          <strong>${escapeHtml(student.name)}</strong>
          <p>${escapeHtml(student.signals.latestSubmissionTitle || student.email)}</p>
          <div>
            ${renderPill("Needs critique", student.signals.needsCritique, student.signals.needsCritique ? "warn" : "")}
            ${renderPill("Revision due", student.signals.revisionDue, student.signals.revisionDue ? "hot" : "")}
          </div>
        </button>
      `
    )
    .join("");

  adminElements.attentionList.querySelectorAll("[data-student-id]").forEach((button) => {
    button.addEventListener("click", () => selectAdminStudent(button.dataset.studentId));
  });
}

function renderSubmissionBoard() {
  if (!adminSubmissions.length) {
    adminElements.submissionList.innerHTML = `<article><strong>No submissions yet</strong><p>When students submit work, the founder board will show it here.</p></article>`;
    return;
  }

  adminElements.submissionList.innerHTML = adminSubmissions
    .slice(0, 20)
    .map((submission) => {
      const needsCritique = !submission.critique;
      const revisionCount = submission.revisions?.length || 0;
      return `
        <article class="${needsCritique ? "needs-critique" : ""}">
          <span class="student-status ${statusClass(submission.status)}">${escapeHtml(submission.status || "Submitted")}</span>
          <strong>${escapeHtml(submission.title)}</strong>
          <p>${escapeHtml(getStudentName(submission.studentId))} · ${escapeHtml(submission.slug)} · ${formatDate(submission.updatedAt || submission.createdAt)}</p>
          <div>
            ${renderPill("Critique", needsCritique ? "Due" : "Saved", needsCritique ? "warn" : "")}
            ${renderPill("Revisions", revisionCount, revisionCount ? "hot" : "")}
          </div>
        </article>
      `;
    })
    .join("");
}

function selectAdminStudent(studentId) {
  selectedAdminStudentId = studentId;
  const student = adminStudents.find((item) => item.id === studentId);
  if (!student) return;

  adminElements.selectedStudentName.textContent = student.name;
  adminElements.selectedStudentMeta.textContent = `${student.email} · Joined ${formatDate(student.createdAt)} · Latest activity ${formatDate(student.signals?.latestActivityAt || student.createdAt)}`;
  adminElements.studentStatus.value = student.status || "Active";
  adminElements.studentNote.value = student.note || "";
  adminElements.selectedStudentSignals.innerHTML = `
    ${renderPill("Enrollments", student.enrollments?.length || 0)}
    ${renderPill("Submissions", student.submissions?.length || 0)}
    ${renderPill("Needs critique", student.signals?.needsCritique || 0, student.signals?.needsCritique ? "warn" : "")}
    ${renderPill("Revision due", student.signals?.revisionDue || 0, student.signals?.revisionDue ? "hot" : "")}
  `;
  adminElements.selectedStudentAccess.innerHTML = (student.activeAccessGrants?.length ? student.activeAccessGrants : [{ type: "membership", tier: "first-rep", status: "active" }])
    .map(
      (grant) => `
        <article>
          <span>${escapeHtml(grant.type || "access")}</span>
          <strong>${escapeHtml(grant.tier || grant.slug || "First Rep")}</strong>
          <small>${escapeHtml(grant.status || "active")}</small>
        </article>
      `
    )
    .join("");
  adminElements.selectedStudentSubmissions.innerHTML = (student.submissions || [])
    .slice(0, 4)
    .map(
      (submission) => `
        <article>
          <strong>${escapeHtml(submission.title)}</strong>
          <span>${escapeHtml(submission.status)} · ${formatDate(submission.updatedAt || submission.createdAt)}</span>
        </article>
      `
    )
    .join("") || `<article><strong>No submissions yet</strong><span>Assign the first rep.</span></article>`;
  adminElements.statusText.textContent = "Founder note ready.";
  renderAdminStudents();
}

function renderAdminSummary(summary) {
  adminElements.studentCount.textContent = String(summary.metrics.students);
  adminElements.activeSessionCount.textContent = String(summary.metrics.activeSessions);
  adminElements.noteCount.textContent = String(summary.metrics.notes);
  adminElements.enrollmentCount.textContent = String(summary.metrics.enrollments || 0);
  adminElements.paidAccessCount.textContent = String(summary.metrics.paidAccess || 0);
  adminElements.needsCritiqueCount.textContent = String(summary.metrics.needsCritique || 0);
  adminElements.revisionDueCount.textContent = String(summary.metrics.revisionDue || 0);
  adminElements.interventionCount.textContent = String(summary.metrics.interventions || 0);
  adminStudents = summary.students;
  adminSubmissions = summary.submissions || [];
  attentionQueue = summary.attentionQueue || [];
  if (!selectedAdminStudentId && adminStudents.length) selectedAdminStudentId = adminStudents[0].id;
  renderAdminStudents();
  renderAttentionQueue();
  renderSubmissionBoard();
  if (selectedAdminStudentId) selectAdminStudent(selectedAdminStudentId);
}

async function loadAdminSummary() {
  try {
    const summary = await adminRequest("/api/admin/summary");
    setAdminUnlocked(true);
    renderAdminSummary(summary);
  } catch (error) {
    setAdminUnlocked(false);
    adminElements.note.textContent = error.message;
    adminElements.dialog.showModal();
  }
}

async function saveAdminNote() {
  if (!selectedAdminStudentId) {
    adminElements.statusText.textContent = "Select a student first.";
    return;
  }

  try {
    await adminRequest("/api/admin/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selectedAdminStudentId,
        note: adminElements.studentNote.value,
        status: adminElements.studentStatus.value
      })
    });
    adminElements.statusText.textContent = "Founder note saved.";
    await loadAdminSummary();
  } catch (error) {
    adminElements.statusText.textContent = error.message;
  }
}

async function adminLogout() {
  await fetch("/api/admin/logout", { method: "POST" });
  selectedAdminStudentId = null;
  adminStudents = [];
  adminSubmissions = [];
  attentionQueue = [];
  setAdminUnlocked(false);
  renderAdminStudents();
  renderAttentionQueue();
  renderSubmissionBoard();
  adminElements.selectedStudentName.textContent = "No student selected";
  adminElements.selectedStudentMeta.textContent = "Choose a student from the directory.";
  adminElements.selectedStudentSignals.innerHTML = "";
  adminElements.selectedStudentAccess.innerHTML = "";
  adminElements.selectedStudentSubmissions.innerHTML = "";
  adminElements.studentStatus.value = "";
  adminElements.studentNote.value = "";
}

adminElements.loginButton.addEventListener("click", () => {
  if (adminElements.dashboard.classList.contains("hidden")) {
    adminElements.dialog.showModal();
  } else {
    loadAdminSummary();
  }
});
adminElements.closeButton.addEventListener("click", () => adminElements.dialog.close());
adminElements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await adminRequest("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminElements.password.value })
    });
    adminElements.form.reset();
    adminElements.dialog.close();
    await loadAdminSummary();
  } catch (error) {
    adminElements.note.textContent = error.message;
  }
});
adminElements.refreshButton.addEventListener("click", loadAdminSummary);
adminElements.logoutButton.addEventListener("click", adminLogout);
adminElements.saveStudentNote.addEventListener("click", saveAdminNote);

loadAdminSummary();
