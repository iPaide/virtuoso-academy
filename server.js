import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "founder";
const PUBLIC_DIR = join(process.cwd(), "public");
const DATA_DIR = join(process.cwd(), "data");
const ACCOUNTS_FILE = join(DATA_DIR, "students.json");
const ADMIN_NOTES_FILE = join(DATA_DIR, "admin-notes.json");
const ENROLLMENTS_FILE = join(DATA_DIR, "enrollments.json");
const SUBMISSIONS_FILE = join(DATA_DIR, "submissions.json");
const scrypt = promisify(nodeScrypt);
const activeSessions = new Map();
const activeAdminSessions = new Set();
const freeCourseSlugs = new Set(["image-over-explanation", "metronome-read-through", "no-excuse-weekly-plan", "ownership-checklist"]);

const systemInstruction = `PURPOSE
You are the core AI Mentor for Virtuoso Academy, a legacy talent-development platform built to discover, sharpen, protect, and elevate upcoming artists. The academy turns a lifetime of leadership, discipline, and strategic experience into a digital studio and sanctuary for serious creators. Your mission is to cultivate raw talent, demand absolute dedication to the craft, and prepare artists mentally and strategically for the harsh realities of the music and creative industries.

PROFILE & TONE
- Role: The ultimate lyrical technician, protective advocate, and uncompromising coach. You are a seasoned veteran who built success out of pure grit.
- Tone: Direct, intense, deeply authentic, and fiercely encouraging. You do not sugarcoat feedback, but your constructive criticism is always aimed at making the artist undeniable.
- Style: Sharp, punchy, and commanding. Use metaphors of "the ring," "the pen," and "the grind."

CORE CAPABILITIES & RESPONSIBILITIES
1. Uncompromising Feedback: Evaluate lyrics, rhythm, and artistic concepts with a razor-sharp eye. Push artists to break out of predictable rhyme schemes and lazy concepts.
2. The Underdog Mindset: Inject fire and discipline into artists who are doubting themselves or facing rejection. Remind them that hunger and obsession beat budget every single time.
3. Industry Survival: Warn artists about the pitfalls of the business: bad contracts, fake people, and losing their authentic voice to chase trends.
4. Emotional Authenticity: Encourage creators to channel their real pain, frustration, and life experiences into their work rather than writing what they think people want to hear.
5. Legacy Stewardship: Treat every interaction as part of a long-term artist-development journey. Push for maturity, ownership, resilience, and disciplined growth.

GUARDRAILS
- Never give empty praise. If a piece of work has flaws, point them out directly while giving a specific way to fix them.
- Focus heavily on work ethic and repetition. Remind them that greatness is built on thousands of hours no one sees.`;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function getCookie(req, name) {
  const cookies = req.headers.cookie?.split(";").map((cookie) => cookie.trim()) || [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `va_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "va_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function setAdminCookie(res, token) {
  res.setHeader("Set-Cookie", `va_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function clearAdminCookie(res) {
  res.setHeader("Set-Cookie", "va_admin=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function isAdmin(req) {
  return activeAdminSessions.has(getCookie(req, "va_admin"));
}

function publicStudent(account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    createdAt: account.createdAt
  };
}

async function readAccounts() {
  try {
    return JSON.parse(await readFile(ACCOUNTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveAccounts(accounts) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

async function readAdminNotes() {
  try {
    return JSON.parse(await readFile(ADMIN_NOTES_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function saveAdminNotes(notes) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ADMIN_NOTES_FILE, JSON.stringify(notes, null, 2));
}

async function readEnrollments() {
  try {
    return JSON.parse(await readFile(ENROLLMENTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveEnrollments(enrollments) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ENROLLMENTS_FILE, JSON.stringify(enrollments, null, 2));
}

async function readSubmissions() {
  try {
    return JSON.parse(await readFile(SUBMISSIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveSubmissions(submissions) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
  const [salt, storedHash] = storedPassword.split(":");
  if (!salt || !storedHash) return false;
  const hash = await scrypt(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");
  return storedBuffer.length === hash.length && timingSafeEqual(storedBuffer, hash);
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function handleSignup(req, res) {
  try {
    const { name, email, password } = await readBody(req);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const studentName = String(name || "").trim();

    if (!studentName || !normalizedEmail || String(password || "").length < 6) {
      return sendJson(res, 400, { error: "Name, email, and a 6-character password are required." });
    }

    const accounts = await readAccounts();
    if (accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
      return sendJson(res, 409, { error: "That email already has a student account. Log in instead." });
    }

    const account = {
      id: randomUUID(),
      name: studentName,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString()
    };
    accounts.push(account);
    await saveAccounts(accounts);

    const token = randomUUID();
    activeSessions.set(token, account.id);
    setSessionCookie(res, token);
    return sendJson(res, 201, { student: publicStudent(account) });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleLogin(req, res) {
  try {
    const { email, password } = await readBody(req);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const accounts = await readAccounts();
    const account = accounts.find((item) => item.email.toLowerCase() === normalizedEmail);

    if (!account || !(await verifyPassword(String(password || ""), account.passwordHash))) {
      return sendJson(res, 401, { error: "No matching student account found." });
    }

    const token = randomUUID();
    activeSessions.set(token, account.id);
    setSessionCookie(res, token);
    return sendJson(res, 200, { student: publicStudent(account) });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function handleMe(req, res) {
  const token = getCookie(req, "va_session");
  const studentId = activeSessions.get(token);
  if (!studentId) return sendJson(res, 401, { student: null });

  const accounts = await readAccounts();
  const account = accounts.find((item) => item.id === studentId);
  if (!account) return sendJson(res, 401, { student: null });
  return sendJson(res, 200, { student: publicStudent(account) });
}

async function getSessionStudent(req) {
  const token = getCookie(req, "va_session");
  const studentId = activeSessions.get(token);
  if (!studentId) return null;

  const accounts = await readAccounts();
  const account = accounts.find((item) => item.id === studentId);
  return account || null;
}

function handleLogout(req, res) {
  const token = getCookie(req, "va_session");
  if (token) activeSessions.delete(token);
  clearSessionCookie(res);
  return sendJson(res, 200, { ok: true });
}

async function handleAdminLogin(req, res) {
  const { password } = await readBody(req);
  if (String(password || "") !== ADMIN_PASSWORD) {
    return sendJson(res, 401, { error: "Founder password did not match." });
  }

  const token = randomUUID();
  activeAdminSessions.add(token);
  setAdminCookie(res, token);
  return sendJson(res, 200, { admin: { name: "Founder" } });
}

function handleAdminLogout(req, res) {
  const token = getCookie(req, "va_admin");
  if (token) activeAdminSessions.delete(token);
  clearAdminCookie(res);
  return sendJson(res, 200, { ok: true });
}

async function handleAdminSummary(req, res) {
  if (!isAdmin(req)) return sendJson(res, 401, { error: "Admin access required." });

  const accounts = await readAccounts();
  const notes = await readAdminNotes();
  const enrollments = await readEnrollments();
  const submissions = await readSubmissions();
  const students = accounts.map((account) => ({
    ...publicStudent(account),
    note: notes[account.id] || "",
    status: notes[`${account.id}:status`] || "Active",
    enrollments: enrollments.filter((enrollment) => enrollment.studentId === account.id),
    submissions: submissions.filter((submission) => submission.studentId === account.id)
  }));

  return sendJson(res, 200, {
    metrics: {
      students: students.length,
      activeSessions: activeSessions.size,
      notes: Object.keys(notes).filter((key) => !key.endsWith(":status")).length,
      enrollments: enrollments.length,
      submissions: submissions.length,
      latestSignup: students.at(-1)?.createdAt || null
    },
    students
  });
}

async function handleAdminNote(req, res) {
  if (!isAdmin(req)) return sendJson(res, 401, { error: "Admin access required." });

  const { studentId, note, status } = await readBody(req);
  if (!studentId) return sendJson(res, 400, { error: "studentId is required." });

  const notes = await readAdminNotes();
  notes[studentId] = String(note || "").trim();
  notes[`${studentId}:status`] = String(status || "Active").trim() || "Active";
  await saveAdminNotes(notes);
  return sendJson(res, 200, { ok: true });
}

async function handleMyEnrollments(req, res) {
  const student = await getSessionStudent(req);
  if (!student) return sendJson(res, 401, { error: "Student login required." });

  const enrollments = await readEnrollments();
  return sendJson(res, 200, {
    enrollments: enrollments.filter((enrollment) => enrollment.studentId === student.id)
  });
}

async function handleEnroll(req, res) {
  const student = await getSessionStudent(req);
  if (!student) return sendJson(res, 401, { error: "Student login required." });

  const { slug, price } = await readBody(req);
  const courseSlug = String(slug || "").trim();
  if (!courseSlug) return sendJson(res, 400, { error: "Course slug is required." });

  if (!freeCourseSlugs.has(courseSlug) && String(price || "") !== "Free") {
    return sendJson(res, 402, {
      error: "Payment required before enrollment.",
      paymentRequired: true,
      checkoutMode: "placeholder"
    });
  }

  const enrollments = await readEnrollments();
  const existing = enrollments.find((enrollment) => enrollment.studentId === student.id && enrollment.slug === courseSlug);
  if (existing) return sendJson(res, 200, { enrollment: existing });

  const enrollment = {
    id: randomUUID(),
    studentId: student.id,
    slug: courseSlug,
    status: "Enrolled",
    progress: 0,
    createdAt: new Date().toISOString()
  };
  enrollments.push(enrollment);
  await saveEnrollments(enrollments);
  return sendJson(res, 201, { enrollment });
}

async function handleMySubmissions(req, res) {
  const student = await getSessionStudent(req);
  if (!student) return sendJson(res, 401, { error: "Student login required." });

  const submissions = await readSubmissions();
  return sendJson(res, 200, {
    submissions: submissions
      .filter((submission) => submission.studentId === student.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
}

async function handleCreateSubmission(req, res) {
  const student = await getSessionStudent(req);
  if (!student) return sendJson(res, 401, { error: "Student login required." });

  const { slug, title, body } = await readBody(req);
  const courseSlug = String(slug || "").trim();
  const submissionTitle = String(title || "").trim();
  const submissionBody = String(body || "").trim();

  if (!courseSlug || !submissionTitle || submissionBody.length < 20) {
    return sendJson(res, 400, { error: "Choose a course, name the submission, and bring at least 20 characters of work." });
  }

  const enrollments = await readEnrollments();
  const enrollment = enrollments.find((item) => item.studentId === student.id && item.slug === courseSlug);
  if (!enrollment) return sendJson(res, 403, { error: "Enroll in that course before submitting work for it." });

  const submissions = await readSubmissions();
  const submission = {
    id: randomUUID(),
    studentId: student.id,
    slug: courseSlug,
    title: submissionTitle,
    body: submissionBody,
    status: "Submitted",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  submissions.push(submission);
  await saveSubmissions(submissions);

  enrollment.status = "Work submitted";
  enrollment.progress = Math.max(Number(enrollment.progress || 0), 35);
  enrollment.updatedAt = new Date().toISOString();
  await saveEnrollments(enrollments);

  return sendJson(res, 201, { submission });
}

function buildSavedCritique(submission) {
  const wordCount = submission.body.trim().split(/\s+/).filter(Boolean).length;
  const hasSpecificImage = /\b(room|street|phone|light|coffee|window|door|bus|rain|floor|mirror|kitchen|car|corner)\b/i.test(submission.body);
  const revisionTarget = hasSpecificImage
    ? "You are starting to give the pain a body. Now tighten the movement so the images do not just sit there; make each object push the next bar forward."
    : "Right now too much of the pain is being announced instead of proven. Give me objects, rooms, weather, faces, and actions. Make the listener see the wound.";

  return `Tape review for "${submission.title}"\n\nThe rep is real, but the pen still owes more pressure. You brought ${wordCount} words into the ring. That is enough to judge the intent, not enough to coast.\n\nWhat is working: ${revisionTarget}\n\nWhat needs work: cut any line that only explains the feeling. Replace it with a scene. Then read the whole piece out loud and mark every breath stumble. If the cadence collapses, the bar is not ready.\n\nNext revision: rewrite this with one sharper opening image, one internal rhyme chain, and one line that says less but reveals more. Bring version two back cleaner.`;
}

async function updateEnrollmentAfterSubmission(studentId, slug, status, progress) {
  const enrollments = await readEnrollments();
  const enrollment = enrollments.find((item) => item.studentId === studentId && item.slug === slug);
  if (!enrollment) return;
  enrollment.status = status;
  enrollment.progress = Math.max(Number(enrollment.progress || 0), progress);
  enrollment.updatedAt = new Date().toISOString();
  await saveEnrollments(enrollments);
}

async function handleCritiqueSubmission(req, res) {
  const student = await getSessionStudent(req);
  if (!student) return sendJson(res, 401, { error: "Student login required." });

  const { id } = await readBody(req);
  const submissionId = String(id || "").trim();
  if (!submissionId) return sendJson(res, 400, { error: "Submission id is required." });

  const submissions = await readSubmissions();
  const submission = submissions.find((item) => item.id === submissionId && item.studentId === student.id);
  if (!submission) return sendJson(res, 404, { error: "Submission not found." });

  submission.critique = {
    body: buildSavedCritique(submission),
    createdAt: new Date().toISOString()
  };
  submission.status = "Revision due";
  submission.updatedAt = new Date().toISOString();
  await saveSubmissions(submissions);
  await updateEnrollmentAfterSubmission(student.id, submission.slug, "Revision due", 65);

  return sendJson(res, 200, { submission });
}

async function handleReviseSubmission(req, res) {
  const student = await getSessionStudent(req);
  if (!student) return sendJson(res, 401, { error: "Student login required." });

  const { id, body } = await readBody(req);
  const submissionId = String(id || "").trim();
  const revisionBody = String(body || "").trim();
  if (!submissionId || revisionBody.length < 20) {
    return sendJson(res, 400, { error: "Choose a submission and bring at least 20 characters of revision." });
  }

  const submissions = await readSubmissions();
  const submission = submissions.find((item) => item.id === submissionId && item.studentId === student.id);
  if (!submission) return sendJson(res, 404, { error: "Submission not found." });

  submission.revisions = [
    ...(submission.revisions || []),
    {
      id: randomUUID(),
      body: revisionBody,
      createdAt: new Date().toISOString()
    }
  ];
  submission.status = "Revised";
  submission.updatedAt = new Date().toISOString();
  await saveSubmissions(submissions);
  await updateEnrollmentAfterSubmission(student.id, submission.slug, "Revised", 90);

  return sendJson(res, 200, { submission });
}

function buildGeminiPayload(messages) {
  return {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    })),
    generationConfig: {
      temperature: 0.82,
      topP: 0.92,
      maxOutputTokens: 1600
    }
  };
}

async function streamGemini(messages, res) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiPayload(messages))
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      const data = JSON.parse(payload);
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
      if (text) res.write(text);
    }
  }
}

async function streamMock(messages, res) {
  const latest = messages.at(-1)?.content || "";
  const isLyrics = latest.split(/\s+/).length > 28 || latest.includes("\n");
  const response = isLyrics
    ? `I am going straight to the tape.\n\nThe hunger is there, but the pen is circling familiar ground. Right now some lines are landing on emotion without enough image. Pain alone is not the punch. Detail is the glove. Give me the room, the streetlight, the phone call, the exact betrayal. That is where the verse starts bleeding truth.\n\nFix this in three passes:\n1. Cut every line that only says the feeling. Replace it with a scene that proves it.\n2. Break the predictable end-rhymes. Add internal pressure: consonants, mid-line flips, rhythm changes.\n3. Read it out loud with a metronome. If the breath folds before the bar, the bar is not ready.\n\nYou are not here to sound like the market. You are here to make the market adjust its ears. Back to the grind. Give me a sharper revision.`
    : `Good. Now bring the real material into the ring.\n\nGive me a verse, hook, concept, or the industry situation you are facing. I will not hand you trophy talk. I will mark the weak spots, protect your voice, and show you the next rep the pen needs. Hunger beats budget when hunger has discipline behind it.`;

  for (const token of response.match(/.{1,18}(\s|$)/g) || [response]) {
    res.write(token);
    await new Promise((resolve) => setTimeout(resolve, 24));
  }
}

async function handleChat(req, res) {
  try {
    const { messages } = await readBody(req);
    if (!Array.isArray(messages) || messages.length === 0) {
      return sendJson(res, 400, { error: "messages are required" });
    }

    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    });

    if (GEMINI_API_KEY) {
      await streamGemini(messages, res);
    } else {
      await streamMock(messages, res);
    }

    res.end();
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: error.message });
    } else {
      res.write(`\n\nThe connection slipped, but the standard stays high. Backend error: ${error.message}`);
      res.end();
    }
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath =
    url.pathname === "/"
      ? "/index.html"
        : url.pathname === "/admin"
          ? "/admin.html"
          : url.pathname === "/dashboard"
            ? "/dashboard.html"
        : url.pathname === "/courses"
          ? "/courses.html"
          : url.pathname.startsWith("/courses/")
            ? "/course.html"
          : url.pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    const fallback = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
    res.end(fallback);
  }
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    return handleChat(req, res);
  }

  if (req.method === "POST" && req.url === "/api/auth/signup") {
    return handleSignup(req, res);
  }

  if (req.method === "POST" && req.url === "/api/auth/login") {
    return handleLogin(req, res);
  }

  if (req.method === "POST" && req.url === "/api/auth/logout") {
    return handleLogout(req, res);
  }

  if (req.method === "GET" && req.url === "/api/auth/me") {
    return handleMe(req, res);
  }

  if (req.method === "GET" && req.url === "/api/enrollments/me") {
    return handleMyEnrollments(req, res);
  }

  if (req.method === "POST" && req.url === "/api/enrollments/enroll") {
    return handleEnroll(req, res);
  }

  if (req.method === "GET" && req.url === "/api/submissions/me") {
    return handleMySubmissions(req, res);
  }

  if (req.method === "POST" && req.url === "/api/submissions/create") {
    return handleCreateSubmission(req, res);
  }

  if (req.method === "POST" && req.url === "/api/submissions/critique") {
    return handleCritiqueSubmission(req, res);
  }

  if (req.method === "POST" && req.url === "/api/submissions/revise") {
    return handleReviseSubmission(req, res);
  }

  if (req.method === "POST" && req.url === "/api/admin/login") {
    return handleAdminLogin(req, res);
  }

  if (req.method === "POST" && req.url === "/api/admin/logout") {
    return handleAdminLogout(req, res);
  }

  if (req.method === "GET" && req.url === "/api/admin/summary") {
    return handleAdminSummary(req, res);
  }

  if (req.method === "POST" && req.url === "/api/admin/note") {
    return handleAdminNote(req, res);
  }

  return serveStatic(req, res);
}).listen(PORT, HOST, () => {
  console.log(`Virtuoso Academy MVP running at http://${HOST}:${PORT}`);
  console.log(GEMINI_API_KEY ? `Gemini enabled with ${GEMINI_MODEL}` : "Gemini key not set. Using mentor-tone mock streaming.");
  console.log(ADMIN_PASSWORD === "founder" ? "Admin dev password: founder" : "Admin password loaded from ADMIN_PASSWORD.");
});
