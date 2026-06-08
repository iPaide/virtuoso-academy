import { getCourse } from "/course-data.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const slug = window.location.pathname.split("/").filter(Boolean).at(-1);
const course = getCourse(slug);
const root = document.querySelector("#courseDetail");

if (!course) {
  document.title = "Course Not Found | Virtuoso Academy";
  root.innerHTML = `
    <section class="course-detail-hero">
      <p class="eyebrow">Course not found</p>
      <h1>This room is not built yet.</h1>
      <p>Return to the course catalog and choose an available rep.</p>
      <a class="primary-button" href="/courses">Back to courses</a>
    </section>
  `;
} else {
  document.title = `${course.title} | Virtuoso Academy`;
  root.innerHTML = `
    <section class="course-detail-hero">
      <p class="eyebrow">${escapeHtml(course.lane)} · ${escapeHtml(course.access)}</p>
      <h1>${escapeHtml(course.title)}</h1>
      <p>${escapeHtml(course.summary)}</p>
      <div class="detail-price">
        <strong>${escapeHtml(course.price)}</strong>
        <span>${escapeHtml(course.priceNote)}</span>
      </div>
      <div class="hero-actions">
        <button class="primary-button" id="enrollButton" type="button">${course.price === "Free" ? "Start free drill" : "Enroll in course"}</button>
        <a class="secondary-button" href="/#studio">Take this to Studio</a>
        <a class="secondary-button" href="/courses">All courses</a>
      </div>
      <p class="enrollment-status" id="enrollmentStatus">${course.price === "Free" ? "Free drill enrolls immediately with a student account." : "Premium enrollment requires paid access or a qualifying VIP tier."}</p>
    </section>

    <section class="course-detail-grid">
      <article class="course-detail-panel">
        <p class="eyebrow">Outcome</p>
        <h2>What this rep builds</h2>
        <p>${escapeHtml(course.outcome)}</p>
      </article>
      <article class="course-detail-panel">
        <p class="eyebrow">Assignment</p>
        <h2>The drill</h2>
        <p>${escapeHtml(course.drill)}</p>
      </article>
    </section>

    <section class="lesson-section">
      <div class="section-heading">
        <p class="eyebrow">Course contents</p>
        <h2>Lessons inside the room.</h2>
      </div>
      <div class="lesson-list">
        ${course.lessons
          .map(
            (lesson, index) => `
              <article>
                <span>Lesson ${String(index + 1).padStart(2, "0")}</span>
                <h3>${escapeHtml(lesson)}</h3>
                <p>Study the principle, run the drill, then bring the result back into The Studio for critique.</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;

  document.querySelector("#enrollButton").addEventListener("click", async () => {
    const status = document.querySelector("#enrollmentStatus");
    status.textContent = "Checking student access...";

    try {
      const response = await fetch("/api/enrollments/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: course.slug })
      });
      const data = await response.json();

      if (response.status === 401) {
        status.textContent = "Create or log into your student account first.";
        window.location.href = "/#join";
        return;
      }

      if (response.status === 402) {
        status.textContent = "Opening secure checkout...";
        const checkoutResponse = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: course.slug })
        });
        const checkoutData = await checkoutResponse.json();
        if (!checkoutResponse.ok) throw new Error(checkoutData.error || data.error || "Checkout is not ready.");
        window.location.href = checkoutData.url;
        return;
      }

      if (!response.ok) throw new Error(data.error || "Enrollment failed.");

      status.textContent = "Enrolled. Opening your learning dashboard.";
      window.location.href = "/dashboard";
    } catch (error) {
      status.textContent = error.message;
    }
  });
}
