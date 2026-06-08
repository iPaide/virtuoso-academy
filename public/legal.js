const pages = {
  "/privacy": {
    eyebrow: "Privacy Policy",
    title: "Privacy is part of the trust.",
    updated: "Last updated: June 8, 2026",
    intro:
      "Virtuoso Academy collects only what the platform needs to create accounts, run mentorship features, process payments, and protect the academy community.",
    sections: [
      {
        heading: "Information We Collect",
        body:
          "We may collect account details, contact information, course activity, submissions, critiques, revisions, payment status, and technical data such as cookies, device information, and service logs."
      },
      {
        heading: "How We Use Information",
        body:
          "We use information to provide student accounts, course access, AI mentor feedback, saved submissions, payment processing, support, security, analytics, and platform improvement."
      },
      {
        heading: "Payments",
        body:
          "Payments are processed through Stripe. Virtuoso Academy does not store full card numbers. Stripe may process payment and billing information under its own policies."
      },
      {
        heading: "Submissions and Creative Work",
        body:
          "Lyrics, poems, concepts, assignments, revisions, and related creative submissions are used to provide critique, mentorship, course functionality, and student recordkeeping. Artists keep ownership of their work."
      },
      {
        heading: "Sharing",
        body:
          "We do not sell artist submissions. We may share limited information with service providers that help operate the platform, such as hosting, database, AI, analytics, email, and payment providers."
      },
      {
        heading: "Security and Retention",
        body:
          "We use server-side sessions, hashed passwords, access controls, and database-backed records. No system is perfect, but the academy standard is to treat student trust like serious work."
      }
    ]
  },
  "/terms": {
    eyebrow: "Terms of Use",
    title: "The academy has standards.",
    updated: "Last updated: June 8, 2026",
    intro:
      "By using Virtuoso Academy, you agree to use the platform seriously, lawfully, and with respect for your own craft and the work of others.",
    sections: [
      {
        heading: "Student Accounts",
        body:
          "You are responsible for your account, password, submissions, and activity. Use accurate information and do not share access with people who should not be inside your profile."
      },
      {
        heading: "Mentorship and AI Feedback",
        body:
          "Mentor responses are educational and strategic feedback, not guarantees of commercial success, legal representation, financial advice, or mental health treatment."
      },
      {
        heading: "Payments and Access",
        body:
          "Paid courses and VIP tiers unlock access based on the selected offer. Pricing, availability, and features may change. Subscription access may end if payment fails, is canceled, or is refunded."
      },
      {
        heading: "Acceptable Use",
        body:
          "Do not upload unlawful content, impersonate others, attack the service, scrape private records, abuse payment flows, or submit work you do not have the right to use."
      },
      {
        heading: "Platform Changes",
        body:
          "Virtuoso Academy may update features, courses, pricing, policies, and platform structure as the academy grows from MVP into a full product."
      },
      {
        heading: "No Passive Promise",
        body:
          "The academy can provide structure, critique, and pressure. The artist still has to do the reps. Results depend on discipline, execution, market conditions, and choices outside the platform."
      }
    ]
  },
  "/ownership": {
    eyebrow: "Submission Ownership",
    title: "Your work stays yours.",
    updated: "Last updated: June 8, 2026",
    intro:
      "Clear statement: artists keep ownership of their lyrics, poems, musical concepts, assignments, revisions, and creative submissions.",
    sections: [
      {
        heading: "Artists Keep Ownership",
        body:
          "Virtuoso Academy does not claim ownership of your submitted lyrics, poems, hooks, concepts, recordings, release ideas, names, brands, or other original creative work."
      },
      {
        heading: "Limited Permission to Operate the Platform",
        body:
          "When you submit work, you give Virtuoso Academy limited permission to store, process, display to you, critique, and use that work only as needed to provide mentorship, course functionality, account history, support, safety, and platform improvement."
      },
      {
        heading: "No Sale of Submissions",
        body:
          "Virtuoso Academy will not sell your lyrics, poems, concepts, or assignments as creative works. The work you bring into the ring remains your material."
      },
      {
        heading: "AI Mentor Processing",
        body:
          "Submissions may be processed by AI systems to generate critique and mentorship responses. That processing is for feedback and platform operation, not a transfer of ownership."
      },
      {
        heading: "Your Responsibility",
        body:
          "Only submit work you own or have permission to use. Keep your own records, splits, collaborator agreements, drafts, and release documentation. Ownership discipline starts before the business gets complicated."
      },
      {
        heading: "Removal and Records",
        body:
          "You may request deletion of account records or submissions. Some records may remain where required for security, payment history, legal compliance, dispute handling, or backup integrity."
      }
    ]
  }
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const path = pages[window.location.pathname] ? window.location.pathname : "/ownership";
const page = pages[path];
document.title = `${page.eyebrow} | Virtuoso Academy`;

document.querySelector("#legalMain").innerHTML = `
  <section class="legal-hero">
    <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
    <h1>${escapeHtml(page.title)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <span>${escapeHtml(page.updated)}</span>
  </section>
  <section class="ownership-callout">
    <span class="roadmap-step">Core promise</span>
    <h2>Artists keep ownership of their work.</h2>
    <p>Virtuoso Academy is here to sharpen and protect the craft, not take the craft from the artist.</p>
  </section>
  <section class="legal-grid">
    ${page.sections
      .map(
        (section) => `
          <article>
            <h2>${escapeHtml(section.heading)}</h2>
            <p>${escapeHtml(section.body)}</p>
          </article>
        `
      )
      .join("")}
  </section>
  <section class="legal-note">
    <p>
      These pages are platform policy language for Virtuoso Academy. They are not a substitute for legal advice from
      an attorney who can review your exact situation.
    </p>
  </section>
`;
