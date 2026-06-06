export const courses = [
  {
    slug: "rhyme-architecture-lab",
    lane: "Write",
    access: "Premium Track",
    price: "$39",
    priceNote: "or included with Academy Plus",
    title: "Rhyme Architecture Lab",
    summary: "Internal rhyme, end-rhyme discipline, multisyllabic movement, and breaking predictable patterns.",
    outcome: "Build verses with sharper structure, cleaner movement, and less obvious rhyme pressure.",
    lessons: ["Rhyme placement and bar tension", "Internal chains without clutter", "Multisyllabic control", "Breaking the predictable couplet"],
    drill: "Rewrite eight bars three times: end-rhyme only, internal rhyme heavy, then balanced for performance."
  },
  {
    slug: "hook-pressure-workshop",
    lane: "Write",
    access: "Premium Track",
    price: "$29",
    priceNote: "or included with Academy Plus",
    title: "Hook Pressure Workshop",
    summary: "Write hooks with clarity, tension, repetition, and emotional gravity without chasing trends.",
    outcome: "Create hooks that carry the record instead of decorating it.",
    lessons: ["The promise of a hook", "Repetition without laziness", "Emotional center lines", "Hook-to-verse contrast"],
    drill: "Write five hook concepts from one pain point. Keep only the one a stranger can repeat after one listen."
  },
  {
    slug: "image-over-explanation",
    lane: "Write",
    access: "Free Drill",
    price: "Free",
    priceNote: "student account required",
    title: "Image Over Explanation",
    summary: "Replace abstract feelings with scenes, objects, rooms, weather, and specific memory.",
    outcome: "Make emotion visible instead of merely announcing it.",
    lessons: ["Concrete nouns", "Scene selection", "Sensory anchors", "Cutting abstract filler"],
    drill: "Circle every feeling word in a verse. Replace each one with an object, action, or setting."
  },
  {
    slug: "breath-and-bar-control",
    lane: "Perform",
    access: "Premium Track",
    price: "$39",
    priceNote: "or included with Academy Plus",
    title: "Breath and Bar Control",
    summary: "Learn where the breath breaks, where cadence drags, and where delivery needs more command.",
    outcome: "Deliver bars with stamina, intention, and cleaner timing.",
    lessons: ["Breath marks", "Pocket discipline", "Line length audit", "Pressure-testing fast passages"],
    drill: "Record one verse at three tempos and mark every breath collapse."
  },
  {
    slug: "performance-identity",
    lane: "Perform",
    access: "Premium Track",
    price: "$29",
    priceNote: "or included with Academy Plus",
    title: "Performance Identity",
    summary: "Build a voice that sounds lived-in, not borrowed from whoever is loudest this month.",
    outcome: "Find delivery choices that match your story and stop sounding rented.",
    lessons: ["Tone and origin", "Accent and honesty", "Energy levels", "Owning silence"],
    drill: "Perform the same four bars as confession, confrontation, and celebration. Keep what feels true."
  },
  {
    slug: "metronome-read-through",
    lane: "Perform",
    access: "Free Drill",
    price: "Free",
    priceNote: "student account required",
    title: "Metronome Read-Through",
    summary: "Test every bar against time, breath, and emphasis until the verse can take pressure.",
    outcome: "Expose weak rhythm before it reaches the booth.",
    lessons: ["Counting bars", "Stress points", "Pocket correction", "Clean read-through reps"],
    drill: "Read the verse over a metronome for ten clean takes without rushing the last word."
  },
  {
    slug: "artist-identity-system",
    lane: "Build",
    access: "Premium Track",
    price: "$49",
    priceNote: "or included with Academy Plus",
    title: "Artist Identity System",
    summary: "Clarify story, sound, visuals, audience, and the standard behind the public name.",
    outcome: "Define the artist identity before the algorithm tries to define it for you.",
    lessons: ["Origin story", "Sound boundaries", "Visual language", "Audience promise"],
    drill: "Write a one-page artist code: what you stand for, what you refuse, and what your work must prove."
  },
  {
    slug: "release-strategy-basics",
    lane: "Build",
    access: "Premium Track",
    price: "$39",
    priceNote: "or included with Academy Plus",
    title: "Release Strategy Basics",
    summary: "Plan a release with timing, assets, message, follow-up content, and a reason to return.",
    outcome: "Stop dropping songs into silence and start building momentum.",
    lessons: ["Release purpose", "Asset checklist", "Pre-save versus proof", "Post-release rhythm"],
    drill: "Map one release across 21 days: before, release week, and follow-up."
  },
  {
    slug: "no-excuse-weekly-plan",
    lane: "Build",
    access: "Free Drill",
    price: "Free",
    priceNote: "student account required",
    title: "No-Excuse Weekly Plan",
    summary: "Build a repeatable seven-day practice and release rhythm that does not depend on mood.",
    outcome: "Create discipline that survives low motivation.",
    lessons: ["Weekly rep design", "Low-energy tasks", "Revision windows", "Accountability checkpoints"],
    drill: "Schedule seven days of work with one writing rep, one revision rep, and one business rep per day."
  },
  {
    slug: "contract-red-flags",
    lane: "Protect",
    access: "Premium Track",
    price: "$59",
    priceNote: "or included with Academy Plus",
    title: "Contract Red Flags",
    summary: "Spot language that can trap ownership, publishing, masters, creative control, or future earnings.",
    outcome: "Know when to slow down, ask questions, and protect the work.",
    lessons: ["Masters and publishing", "Term and territory", "Recoupment basics", "Approval and control clauses"],
    drill: "Build a personal contract question list before taking any meeting."
  },
  {
    slug: "industry-room-discipline",
    lane: "Protect",
    access: "Premium Track",
    price: "$39",
    priceNote: "or included with Academy Plus",
    title: "Industry Room Discipline",
    summary: "Learn how to read motives, protect your voice, and move carefully around fake opportunity.",
    outcome: "Enter rooms with hunger and leave with your standards intact.",
    lessons: ["Reading incentives", "Pressure language", "Boundary scripts", "When to walk"],
    drill: "Write three polite ways to say no when the room is pushing you away from your voice."
  },
  {
    slug: "ownership-checklist",
    lane: "Protect",
    access: "Free Drill",
    price: "Free",
    priceNote: "student account required",
    title: "Ownership Checklist",
    summary: "Know what belongs to you before you upload, collaborate, sign, split, or release.",
    outcome: "Build a habit of ownership before business gets complicated.",
    lessons: ["Splits", "Collaborator notes", "File records", "Registration basics"],
    drill: "Create a release folder with credits, splits, stems, dates, and written collaborator agreements."
  }
];

export function getCourse(slug) {
  return courses.find((course) => course.slug === slug);
}
