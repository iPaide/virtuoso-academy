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

const checkoutStatus = document.querySelector("#checkoutStatus");
const tierButtons = document.querySelectorAll("[data-tier-checkout]");

for (const button of tierButtons) {
  button.addEventListener("click", async () => {
    const tier = button.dataset.tierCheckout;
    if (checkoutStatus) checkoutStatus.textContent = "Checking student account...";

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier })
      });
      const data = await response.json();

      if (response.status === 401) {
        if (checkoutStatus) checkoutStatus.textContent = "Create or log into your student account first.";
        window.location.href = "/#join";
        return;
      }

      if (!response.ok) throw new Error(data.error || "Checkout is not ready.");

      if (checkoutStatus) checkoutStatus.textContent = "Opening secure checkout...";
      window.location.href = data.url;
    } catch (error) {
      if (checkoutStatus) checkoutStatus.textContent = error.message;
    }
  });
}
