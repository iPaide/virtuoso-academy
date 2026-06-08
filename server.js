import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getCourse } from "./public/course-data.js";

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "founder";
const DATABASE_URL = process.env.DATABASE_URL || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || "";
const PUBLIC_DIR = join(process.cwd(), "public");
const DATA_DIR = join(process.cwd(), "data");
const ACCOUNTS_FILE = join(DATA_DIR, "students.json");
const ADMIN_NOTES_FILE = join(DATA_DIR, "admin-notes.json");
const ENROLLMENTS_FILE = join(DATA_DIR, "enrollments.json");
const SUBMISSIONS_FILE = join(DATA_DIR, "submissions.json");
const ACCESS_GRANTS_FILE = join(DATA_DIR, "access-grants.json");
const scrypt = promisify(nodeScrypt);
const activeSessions = new Map();
const activeAdminSessions = new Set();
const freeCourseSlugs = new Set(["image-over-explanation", "metronome-read-through", "no-excuse-weekly-plan", "ownership-checklist"]);
const activeAccessStatuses = new Set(["active", "paid", "trialing"]);
const vipTiers = {
  "academy-elite": {
    name: "Academy Elite",
    amount: 14900,
    interval: "month",
    description: "Full course access, saved critique cycles, and priority development path."
  },
  "inner-circle": {
    name: "Inner Circle",
    amount: 49900,
    interval: "month",
    description: "High-touch founder mentorship lane with deeper strategy and accountability."
  }
};
let dbPoolPromise = null;
let stripeClientPromise = null;

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

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toAccount(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: toIso(row.created_at)
  };
}

function toEnrollment(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    slug: row.slug,
    status: row.status,
    progress: Number(row.progress || 0),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toAccessGrant(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    type: row.type,
    slug: row.slug || "",
    tier: row.tier || "",
    status: row.status,
    stripeSessionId: row.stripe_session_id || "",
    stripeCustomerId: row.stripe_customer_id || "",
    stripeSubscriptionId: row.stripe_subscription_id || "",
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function toSubmission(row, revisions = []) {
  return {
    id: row.id,
    studentId: row.student_id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ...(row.critique_body
      ? {
          critique: {
            body: row.critique_body,
            createdAt: toIso(row.critique_created_at)
          }
        }
      : {}),
    ...(revisions.length ? { revisions } : {})
  };
}

async function ensureDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_notes (
      student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Active',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Enrolled',
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ,
      UNIQUE(student_id, slug)
    );

    CREATE TABLE IF NOT EXISTS access_grants (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      slug TEXT,
      tier TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      stripe_session_id TEXT UNIQUE,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted',
      critique_body TEXT,
      critique_created_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS submission_revisions (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getDbPool() {
  if (!DATABASE_URL) return null;
  if (!dbPoolPromise) {
    dbPoolPromise = (async () => {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined
      });
      await ensureDatabase(pool);
      return pool;
    })();
  }
  return dbPoolPromise;
}

async function readAccounts() {
  const pool = await getDbPool();
  if (pool) {
    const result = await pool.query("SELECT * FROM students ORDER BY created_at ASC");
    return result.rows.map(toAccount);
  }

  try {
    return JSON.parse(await readFile(ACCOUNTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveAccounts(accounts) {
  const pool = await getDbPool();
  if (pool) {
    for (const account of accounts) {
      await pool.query(
        `
          INSERT INTO students (id, name, email, password_hash, created_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash
        `,
        [account.id, account.name, account.email, account.passwordHash, account.createdAt]
      );
    }
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

async function readAdminNotes() {
  const pool = await getDbPool();
  if (pool) {
    const result = await pool.query("SELECT * FROM admin_notes");
    return result.rows.reduce((notes, row) => {
      notes[row.student_id] = row.note || "";
      notes[`${row.student_id}:status`] = row.status || "Active";
      return notes;
    }, {});
  }

  try {
    return JSON.parse(await readFile(ADMIN_NOTES_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function saveAdminNotes(notes) {
  const pool = await getDbPool();
  if (pool) {
    const studentIds = new Set(
      Object.keys(notes)
        .map((key) => key.replace(/:status$/, ""))
        .filter(Boolean)
    );

    for (const studentId of studentIds) {
      await pool.query(
        `
          INSERT INTO admin_notes (student_id, note, status, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (student_id) DO UPDATE SET
            note = EXCLUDED.note,
            status = EXCLUDED.status,
            updated_at = NOW()
        `,
        [studentId, notes[studentId] || "", notes[`${studentId}:status`] || "Active"]
      );
    }
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ADMIN_NOTES_FILE, JSON.stringify(notes, null, 2));
}

async function readEnrollments() {
  const pool = await getDbPool();
  if (pool) {
    const result = await pool.query("SELECT * FROM enrollments ORDER BY created_at ASC");
    return result.rows.map(toEnrollment);
  }

  try {
    return JSON.parse(await readFile(ENROLLMENTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveEnrollments(enrollments) {
  const pool = await getDbPool();
  if (pool) {
    for (const enrollment of enrollments) {
      await pool.query(
        `
          INSERT INTO enrollments (id, student_id, slug, status, progress, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            progress = EXCLUDED.progress,
            updated_at = EXCLUDED.updated_at
        `,
        [
          enrollment.id,
          enrollment.studentId,
          enrollment.slug,
          enrollment.status || "Enrolled",
          Number(enrollment.progress || 0),
          enrollment.createdAt,
          enrollment.updatedAt || null
        ]
      );
    }
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ENROLLMENTS_FILE, JSON.stringify(enrollments, null, 2));
}

async function readAccessGrants() {
  const pool = await getDbPool();
  if (pool) {
    const result = await pool.query("SELECT * FROM access_grants ORDER BY created_at ASC");
    return result.rows.map(toAccessGrant);
  }

  try {
    return JSON.parse(await readFile(ACCESS_GRANTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveAccessGrants(grants) {
  const pool = await getDbPool();
  if (pool) {
    for (const grant of grants) {
      await pool.query(
        `
          INSERT INTO access_grants (
            id, student_id, type, slug, tier, status, stripe_session_id, stripe_customer_id,
            stripe_subscription_id, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            type = EXCLUDED.type,
            slug = EXCLUDED.slug,
            tier = EXCLUDED.tier,
            status = EXCLUDED.status,
            stripe_session_id = EXCLUDED.stripe_session_id,
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            updated_at = EXCLUDED.updated_at
        `,
        [
          grant.id,
          grant.studentId,
          grant.type,
          grant.slug || null,
          grant.tier || null,
          grant.status || "active",
          grant.stripeSessionId || null,
          grant.stripeCustomerId || null,
          grant.stripeSubscriptionId || null,
          grant.createdAt,
          grant.updatedAt || null
        ]
      );
    }
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(ACCESS_GRANTS_FILE, JSON.stringify(grants, null, 2));
}

async function readSubmissions() {
  const pool = await getDbPool();
  if (pool) {
    const [submissionResult, revisionResult] = await Promise.all([
      pool.query("SELECT * FROM submissions ORDER BY created_at ASC"),
      pool.query("SELECT * FROM submission_revisions ORDER BY created_at ASC")
    ]);
    const revisionsBySubmission = revisionResult.rows.reduce((grouped, row) => {
      grouped[row.submission_id] ||= [];
      grouped[row.submission_id].push({
        id: row.id,
        body: row.body,
        createdAt: toIso(row.created_at)
      });
      return grouped;
    }, {});
    return submissionResult.rows.map((row) => toSubmission(row, revisionsBySubmission[row.id] || []));
  }

  try {
    return JSON.parse(await readFile(SUBMISSIONS_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveSubmissions(submissions) {
  const pool = await getDbPool();
  if (pool) {
    for (const submission of submissions) {
      await pool.query(
        `
          INSERT INTO submissions (
            id, student_id, slug, title, body, status, critique_body, critique_created_at, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            body = EXCLUDED.body,
            status = EXCLUDED.status,
            critique_body = EXCLUDED.critique_body,
            critique_created_at = EXCLUDED.critique_created_at,
            updated_at = EXCLUDED.updated_at
        `,
        [
          submission.id,
          submission.studentId,
          submission.slug,
          submission.title,
          submission.body,
          submission.status || "Submitted",
          submission.critique?.body || null,
          submission.critique?.createdAt || null,
          submission.createdAt,
          submission.updatedAt || null
        ]
      );

      for (const revision of submission.revisions || []) {
        await pool.query(
          `
            INSERT INTO submission_revisions (id, submission_id, body, created_at)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body
          `,
          [revision.id, submission.id, revision.body, revision.createdAt]
        );
      }
    }
    return;
  }

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

function getAppBaseUrl(req) {
  if (APP_URL) return APP_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  return `${proto}://${req.headers.host}`;
}

function parsePriceToCents(price) {
  const match = String(price || "").match(/\$([0-9]+(?:\.[0-9]{1,2})?)/);
  return match ? Math.round(Number(match[1]) * 100) : 0;
}

function courseIsFree(course) {
  return !course || course.price === "Free" || freeCourseSlugs.has(course.slug);
}

function tierAllowsCourse(tier, course) {
  if (tier === "inner-circle") return true;
  if (tier === "academy-elite") return course.access !== "Founder Shield";
  return false;
}

function hasCourseAccess(grants, course) {
  if (courseIsFree(course)) return true;
  return grants.some((grant) => {
    if (!activeAccessStatuses.has(grant.status)) return false;
    if (grant.type === "course" && grant.slug === course.slug) return true;
    if (grant.type === "membership" && tierAllowsCourse(grant.tier, course)) return true;
    return false;
  });
}

async function getStripeClient() {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) return null;
  if (!stripeClientPromise) {
    stripeClientPromise = import("stripe").then(({ default: Stripe }) => new Stripe(STRIPE_SECRET_KEY));
  }
  return stripeClientPromise;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
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
  const accessGrants = await readAccessGrants();
  const students = accounts.map((account) => ({
    ...publicStudent(account),
    note: notes[account.id] || "",
    status: notes[`${account.id}:status`] || "Active",
    accessGrants: accessGrants.filter((grant) => grant.studentId === account.id),
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
      paidAccess: accessGrants.filter((grant) => activeAccessStatuses.has(grant.status)).length,
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

  const { slug } = await readBody(req);
  const courseSlug = String(slug || "").trim();
  if (!courseSlug) return sendJson(res, 400, { error: "Course slug is required." });
  const course = getCourse(courseSlug);
  if (!course) return sendJson(res, 404, { error: "Course not found." });

  const accessGrants = await readAccessGrants();
  const studentGrants = accessGrants.filter((grant) => grant.studentId === student.id);
  if (!hasCourseAccess(studentGrants, course)) {
    return sendJson(res, 402, {
      error: "Payment required before enrollment.",
      paymentRequired: true,
      checkoutPath: "/api/payments/checkout",
      checkoutAvailable: Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET)
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

async function createEnrollmentIfMissing(studentId, courseSlug, status = "Enrolled") {
  const enrollments = await readEnrollments();
  const existing = enrollments.find((enrollment) => enrollment.studentId === studentId && enrollment.slug === courseSlug);
  if (existing) return existing;

  const enrollment = {
    id: randomUUID(),
    studentId,
    slug: courseSlug,
    status,
    progress: 0,
    createdAt: new Date().toISOString()
  };
  enrollments.push(enrollment);
  await saveEnrollments(enrollments);
  return enrollment;
}

async function upsertAccessGrant(grantData) {
  const grants = await readAccessGrants();
  const existing = grants.find(
    (grant) =>
      (grantData.stripeSessionId && grant.stripeSessionId === grantData.stripeSessionId) ||
      (grantData.stripeSubscriptionId && grant.stripeSubscriptionId === grantData.stripeSubscriptionId) ||
      (grant.studentId === grantData.studentId &&
        grant.type === grantData.type &&
        grant.slug === (grantData.slug || "") &&
        grant.tier === (grantData.tier || ""))
  );

  if (existing) {
    Object.assign(existing, {
      ...grantData,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    });
  } else {
    grants.push({
      id: randomUUID(),
      status: "active",
      slug: "",
      tier: "",
      createdAt: new Date().toISOString(),
      ...grantData
    });
  }

  await saveAccessGrants(grants);
}

async function handleCreateCheckout(req, res) {
  try {
    const student = await getSessionStudent(req);
    if (!student) return sendJson(res, 401, { error: "Student login required." });

    const stripe = await getStripeClient();
    if (!stripe) {
      return sendJson(res, 503, {
        error: "Stripe is not fully configured yet. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET before taking payment."
      });
    }

    const { slug, tier } = await readBody(req);
    const tierSlug = String(tier || "").trim();
    const courseSlug = String(slug || "").trim();
    const baseUrl = getAppBaseUrl(req);
    let sessionConfig;

    if (tierSlug) {
      const selectedTier = vipTiers[tierSlug];
      if (!selectedTier) return sendJson(res, 400, { error: "Unknown VIP tier." });

      sessionConfig = {
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              recurring: { interval: selectedTier.interval },
              product_data: {
                name: `Virtuoso Academy - ${selectedTier.name}`,
                description: selectedTier.description
              },
              unit_amount: selectedTier.amount
            },
            quantity: 1
          }
        ],
        success_url: `${baseUrl}/dashboard?checkout=success`,
        cancel_url: `${baseUrl}/courses?checkout=cancelled#pricing`,
        metadata: {
          studentId: student.id,
          type: "membership",
          tier: tierSlug
        }
      };
    } else if (courseSlug) {
      const course = getCourse(courseSlug);
      if (!course) return sendJson(res, 404, { error: "Course not found." });
      if (courseIsFree(course)) return sendJson(res, 400, { error: "That course is already free. Enroll directly." });

      sessionConfig = {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Virtuoso Academy - ${course.title}`,
                description: course.summary
              },
              unit_amount: parsePriceToCents(course.price)
            },
            quantity: 1
          }
        ],
        success_url: `${baseUrl}/dashboard?checkout=success`,
        cancel_url: `${baseUrl}/courses/${course.slug}?checkout=cancelled`,
        metadata: {
          studentId: student.id,
          type: "course",
          slug: course.slug
        }
      };
    } else {
      return sendJson(res, 400, { error: "Choose a course or VIP tier before checkout." });
    }

    const session = await stripe.checkout.sessions.create({
      ...sessionConfig,
      customer_email: student.email,
      client_reference_id: student.id,
      allow_promotion_codes: true
    });

    return sendJson(res, 200, { url: session.url });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function fulfillCheckoutSession(session) {
  const metadata = session.metadata || {};
  const studentId = metadata.studentId || session.client_reference_id;
  if (!studentId) return;

  if (metadata.type === "membership" && metadata.tier && vipTiers[metadata.tier]) {
    await upsertAccessGrant({
      studentId,
      type: "membership",
      tier: metadata.tier,
      status: "active",
      stripeSessionId: session.id,
      stripeCustomerId: String(session.customer || ""),
      stripeSubscriptionId: String(session.subscription || ""),
      updatedAt: new Date().toISOString()
    });
    return;
  }

  if (metadata.type === "course" && metadata.slug) {
    const course = getCourse(metadata.slug);
    if (!course) return;
    await upsertAccessGrant({
      studentId,
      type: "course",
      slug: course.slug,
      status: "active",
      stripeSessionId: session.id,
      stripeCustomerId: String(session.customer || ""),
      updatedAt: new Date().toISOString()
    });
    await createEnrollmentIfMissing(studentId, course.slug, "Paid access");
  }
}

async function markSubscriptionAccess(subscriptionId, status) {
  if (!subscriptionId) return;
  const grants = await readAccessGrants();
  let changed = false;

  for (const grant of grants) {
    if (grant.stripeSubscriptionId === subscriptionId) {
      grant.status = status;
      grant.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) await saveAccessGrants(grants);
}

async function handleStripeWebhook(req, res) {
  try {
    const stripe = await getStripeClient();
    if (!stripe) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Stripe is not fully configured.");
    }

    const signature = req.headers["stripe-signature"];
    const rawBody = await readRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      await fulfillCheckoutSession(event.data.object);
    }

    if (event.type === "customer.subscription.deleted") {
      await markSubscriptionAccess(event.data.object.id, "inactive");
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const status = activeAccessStatuses.has(subscription.status) ? "active" : "inactive";
      await markSubscriptionAccess(subscription.id, status);
    }

    return sendJson(res, 200, { received: true });
  } catch (error) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end(`Webhook error: ${error.message}`);
  }
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

  const course = getCourse(courseSlug);
  if (!course) return sendJson(res, 404, { error: "Course not found." });

  const accessGrants = await readAccessGrants();
  const studentGrants = accessGrants.filter((grant) => grant.studentId === student.id);
  if (!hasCourseAccess(studentGrants, course)) {
    return sendJson(res, 402, { error: "Paid access is required before submitting work for that course." });
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

async function handleHealth(req, res) {
  try {
    const pool = await getDbPool();
    if (pool) await pool.query("SELECT 1");
    return sendJson(res, 200, {
      ok: true,
      storage: pool ? "postgres" : "json",
      databaseReady: Boolean(pool),
      stripeReady: Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET)
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      storage: "postgres",
      databaseReady: false,
      stripeReady: Boolean(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET),
      error: error.message
    });
  }
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

  if (req.method === "POST" && req.url === "/api/stripe/webhook") {
    return handleStripeWebhook(req, res);
  }

  if (req.method === "GET" && req.url === "/api/health") {
    return handleHealth(req, res);
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

  if (req.method === "POST" && req.url === "/api/payments/checkout") {
    return handleCreateCheckout(req, res);
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
  console.log(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET ? "Stripe Checkout enabled." : "Stripe keys not set. Paid checkout is locked.");
});
