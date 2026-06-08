import { courses } from "/course-data.js";

const elements = {
  title: document.querySelector("#dashboardTitle"),
  summary: document.querySelector("#dashboardSummary"),
  signOut: document.querySelector("#dashboardSignOut"),
  enrollmentCount: document.querySelector("#dashboardEnrollmentCount"),
  submissionCount: document.querySelector("#dashboardSubmissionCount"),
  track: document.querySelector("#dashboardTrack"),
  rep: document.querySelector("#dashboardRep"),
  nextActionTitle: document.querySelector("#nextActionTitle"),
  nextActionCopy: document.querySelector("#nextActionCopy"),
  learningList: document.querySelector("#dashboardLearningList"),
  submissionForm: document.querySelector("#submissionForm"),
  submissionCourse: document.querySelector("#submissionCourse"),
  submissionTitle: document.querySelector("#submissionTitle"),
  submissionBody: document.querySelector("#submissionBody"),
  submissionStatus: document.querySelector("#submissionStatus"),
  submissionButton: document.querySelector("#submissionButton"),
  submissionList: document.querySelector("#submissionList")
};

let currentEnrollments = [];
let currentSubmissions = [];

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getJson(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
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

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(dateString));
}

function renderLearning(enrollments) {
  if (!enrollments.length) {
    elements.learningList.innerHTML = `
      <article>
        <span>Start here</span>
        <strong>No enrolled courses yet</strong>
        <p>Pick a free drill or premium track. The dashboard starts tracking once you enroll.</p>
        <a href="/courses">Browse courses</a>
      </article>
    `;
    return;
  }

  elements.learningList.innerHTML = enrollments
    .map((enrollment) => {
      const course = courses.find((item) => item.slug === enrollment.slug);
      if (!course) return "";
      return `
        <article>
          <span>${escapeHtml(course.lane)} · ${escapeHtml(enrollment.status)}</span>
          <strong>${escapeHtml(course.title)}</strong>
          <p>${escapeHtml(course.drill)}</p>
          <a href="/courses/${escapeHtml(course.slug)}">Open course</a>
        </article>
      `;
    })
    .join("");
}

function renderSubmissionOptions(enrollments) {
  if (!enrollments.length) {
    elements.submissionCourse.innerHTML = `<option value="">Enroll in a course first</option>`;
    elements.submissionCourse.disabled = true;
    elements.submissionButton.disabled = true;
    return;
  }

  elements.submissionCourse.disabled = false;
  elements.submissionButton.disabled = false;
  elements.submissionCourse.innerHTML = enrollments
    .map((enrollment) => {
      const course = courses.find((item) => item.slug === enrollment.slug);
      if (!course) return "";
      return `<option value="${escapeHtml(course.slug)}">${escapeHtml(course.title)} · ${escapeHtml(course.lane)}</option>`;
    })
    .join("");
}

function renderSubmissions(submissions) {
  elements.submissionCount.textContent = String(submissions.length);

  if (!submissions.length) {
    elements.submissionList.innerHTML = `
      <article>
        <span>No work submitted</span>
        <strong>The archive is empty.</strong>
        <p>Enroll in a course, complete the drill, and submit the work. Talent without receipts is just talk.</p>
      </article>
    `;
    return;
  }

  elements.submissionList.innerHTML = submissions
    .map((submission) => {
      const course = courses.find((item) => item.slug === submission.slug);
      const latestRevision = submission.revisions?.at(-1);
      const critiquePanel = submission.critique
        ? `
          <div class="critique-panel">
            <span>Saved critique · ${formatDate(submission.critique.createdAt)}</span>
            <p>${escapeHtml(submission.critique.body)}</p>
          </div>
        `
        : "";
      const revisionPanel = latestRevision
        ? `
          <div class="revision-panel">
            <span>Latest revision · ${formatDate(latestRevision.createdAt)}</span>
            <p>${escapeHtml(latestRevision.body).slice(0, 260)}${latestRevision.body.length > 260 ? "..." : ""}</p>
          </div>
        `
        : "";
      return `
        <article data-submission-id="${escapeHtml(submission.id)}">
          <div class="submission-meta">
            <span>${escapeHtml(submission.status)} · ${escapeHtml(course?.lane || "Academy")}</span>
            <strong>${escapeHtml(submission.title)}</strong>
            <small>${escapeHtml(course?.title || submission.slug)} · ${formatDate(submission.createdAt)}</small>
          </div>
          <div class="submission-work">
            <p>${escapeHtml(submission.body).slice(0, 260)}${submission.body.length > 260 ? "..." : ""}</p>
            ${critiquePanel}
            ${revisionPanel}
            <div class="revision-box">
              <textarea data-revision-input="${escapeHtml(submission.id)}" rows="4" placeholder="Paste the sharper revision here. Version two needs to prove the critique was heard."></textarea>
            </div>
          </div>
          <div class="submission-controls">
            <button class="secondary-button" data-action="critique" data-id="${escapeHtml(submission.id)}" type="button">
              ${submission.critique ? "Refresh critique" : "Request critique"}
            </button>
            <button class="primary-button" data-action="revise" data-id="${escapeHtml(submission.id)}" type="button">Submit revision</button>
            <a href="/?submission=${encodeURIComponent(submission.id)}#studio">Take it to Studio</a>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadDashboard() {
  try {
    const [{ student }, { enrollments }, { submissions }] = await Promise.all([
      getJson("/api/auth/me"),
      getJson("/api/enrollments/me"),
      getJson("/api/submissions/me")
    ]);
    currentEnrollments = enrollments;
    currentSubmissions = submissions;
    const firstCourse = courses.find((course) => course.slug === enrollments[0]?.slug);
    const latestSubmission = submissions[0];
    const track = firstCourse?.lane || "Underdog";

    elements.title.textContent = `${student.name}, your next rep is waiting.`;
    elements.summary.textContent = `${student.email} is signed in. This room is for work, not window shopping.`;
    elements.enrollmentCount.textContent = String(enrollments.length);
    elements.track.textContent = track;
    elements.rep.textContent = latestSubmission ? latestSubmission.status : firstCourse ? firstCourse.title : "Free drill";
    elements.nextActionTitle.textContent = latestSubmission?.status === "Revision due"
      ? "Revision due"
      : latestSubmission?.status === "Revised"
        ? "Version two is on record"
        : latestSubmission
          ? "Bring the latest submission into Studio"
          : firstCourse ? firstCourse.title : "Choose a first drill";
    elements.nextActionCopy.textContent = latestSubmission
      ? latestSubmission.status === "Revision due"
        ? `"${latestSubmission.title}" has critique waiting. Rewrite with discipline and submit the sharper version.`
        : latestSubmission.status === "Revised"
          ? `"${latestSubmission.title}" has a revision saved. Next move: compare the versions and keep raising the standard.`
          : `"${latestSubmission.title}" is on record. Now get critique, revise, and make the second version sharper.`
      : firstCourse
        ? firstCourse.drill
      : "Start with a free drill, then bring the work into Studio for critique.";
    renderLearning(enrollments);
    renderSubmissionOptions(enrollments);
    renderSubmissions(submissions);
  } catch {
    elements.title.textContent = "Student login required.";
    elements.summary.textContent = "Create or log into your account from the main site to unlock the dashboard.";
    elements.learningList.innerHTML = `<article><strong>Locked</strong><p>Your dashboard opens after student login.</p><a href="/#join">Go to login</a></article>`;
    elements.submissionForm.classList.add("locked");
    elements.submissionButton.disabled = true;
    elements.submissionList.innerHTML = `<article><strong>Locked</strong><p>Submissions unlock after student login.</p></article>`;
  }
}

elements.submissionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.submissionButton.disabled = true;
  elements.submissionStatus.textContent = "Putting the work on record...";

  try {
    await postJson("/api/submissions/create", {
      slug: elements.submissionCourse.value,
      title: elements.submissionTitle.value.trim(),
      body: elements.submissionBody.value.trim()
    });
    elements.submissionForm.reset();
    elements.submissionStatus.textContent = "Submitted. Now take it to Studio and demand the critique.";
    await loadDashboard();
  } catch (error) {
    elements.submissionStatus.textContent = error.message;
  } finally {
    elements.submissionButton.disabled = currentEnrollments.length === 0;
  }
});

elements.submissionList.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const id = actionButton.dataset.id;
  const action = actionButton.dataset.action;
  actionButton.disabled = true;

  try {
    if (action === "critique") {
      actionButton.textContent = "Critiquing...";
      await postJson("/api/submissions/critique", { id });
    }

    if (action === "revise") {
      const revisionInput = elements.submissionList.querySelector(`[data-revision-input="${CSS.escape(id)}"]`);
      await postJson("/api/submissions/revise", { id, body: revisionInput.value.trim() });
      revisionInput.value = "";
    }

    await loadDashboard();
  } catch (error) {
    elements.submissionStatus.textContent = error.message;
  } finally {
    actionButton.disabled = false;
  }
});

elements.signOut.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
});

loadDashboard();
