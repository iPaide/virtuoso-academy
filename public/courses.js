import { courses } from "/course-data.js";

const lists = document.querySelectorAll("[data-course-lane]");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

for (const list of lists) {
  const lane = list.dataset.courseLane;
  const laneCourses = courses.filter((course) => course.lane === lane);
  list.innerHTML = laneCourses
    .map(
      (course) => `
        <a class="course-card-link" href="/courses/${course.slug}">
          <article>
            <span>${escapeHtml(course.access)}</span>
            <h3>${escapeHtml(course.title)}</h3>
            <p>${escapeHtml(course.summary)}</p>
            <div class="course-price">
              <strong>${escapeHtml(course.price)}</strong>
              <small>${escapeHtml(course.priceNote)}</small>
            </div>
            <strong>Open course</strong>
          </article>
        </a>
      `
    )
    .join("");
}
