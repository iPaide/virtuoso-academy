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
  studentList: document.querySelector("#adminStudentList"),
  selectedStudentName: document.querySelector("#selectedStudentName"),
  selectedStudentMeta: document.querySelector("#selectedStudentMeta"),
  studentStatus: document.querySelector("#studentStatus"),
  studentNote: document.querySelector("#studentNote"),
  saveStudentNote: document.querySelector("#saveStudentNote"),
  statusText: document.querySelector("#adminStatusText")
};

let adminStudents = [];
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
        <span>${escapeHtml(student.email)} · Joined ${formatDate(student.createdAt)}</span>
      </span>
      <span class="student-status">${escapeHtml(student.status || "Active")}</span>
    `;
    button.addEventListener("click", () => selectAdminStudent(student.id));
    adminElements.studentList.append(button);
  });
}

function selectAdminStudent(studentId) {
  selectedAdminStudentId = studentId;
  const student = adminStudents.find((item) => item.id === studentId);
  if (!student) return;

  adminElements.selectedStudentName.textContent = student.name;
  adminElements.selectedStudentMeta.textContent = `${student.email} · Joined ${formatDate(student.createdAt)}`;
  adminElements.studentStatus.value = student.status || "Active";
  adminElements.studentNote.value = student.note || "";
  adminElements.statusText.textContent = "Founder note ready.";
  renderAdminStudents();
}

function renderAdminSummary(summary) {
  adminElements.studentCount.textContent = String(summary.metrics.students);
  adminElements.activeSessionCount.textContent = String(summary.metrics.activeSessions);
  adminElements.noteCount.textContent = String(summary.metrics.notes);
  adminElements.enrollmentCount.textContent = String(summary.metrics.enrollments || 0);
  adminStudents = summary.students;
  if (!selectedAdminStudentId && adminStudents.length) selectedAdminStudentId = adminStudents[0].id;
  renderAdminStudents();
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
  setAdminUnlocked(false);
  renderAdminStudents();
  adminElements.selectedStudentName.textContent = "No student selected";
  adminElements.selectedStudentMeta.textContent = "Choose a student from the directory.";
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
