const express = require("express");
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "database");
const DB_FILE = path.join(DB_DIR, "college_credit_bank.sqlite");
const SCHEMA_FILE = path.join(DB_DIR, "schema.sql");
const SEED_FILE = path.join(DB_DIR, "seed.sql");

let db;
let SQL;

function rows(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}
function exec(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}
function saveDb() {
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}
function tableColumns(table) {
  return new Set(rows(`PRAGMA table_info(${table})`).map(r => r.name));
}

function addColumnIfMissing(table, column, definition) {
  const cols = tableColumns(table);
  if (!cols.has(column)) db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateDatabase() {
  // Existing databases from older versions must be upgraded instead of being reused with an incompatible schema.
  // In particular, older builds used events.date while the current schema uses events.event_date.
  addColumnIfMissing("events", "event_date", "TEXT");
  const eventCols = tableColumns("events");
  if (eventCols.has("date")) {
    db.run("UPDATE events SET event_date = COALESCE(NULLIF(event_date,''), date) WHERE event_date IS NULL OR event_date = ''");
  }
  addColumnIfMissing("events", "registration_deadline", "TEXT");
  addColumnIfMissing("events", "created_at", "TEXT");
  addColumnIfMissing("registrations", "semester", "TEXT DEFAULT ''");
  db.run("UPDATE registrations SET semester = COALESCE((SELECT semester FROM students WHERE students.student_id = registrations.student_id), '') WHERE semester IS NULL OR TRIM(semester) = ''");

  // Every student belongs to the same BCA Data Science, 5th Semester program.
  // Add the column for older databases that predate it, then backfill any
  // student row that doesn't already have a course/semester value set.
  addColumnIfMissing("students", "course", "TEXT DEFAULT ''");
  addColumnIfMissing("students", "semester", "TEXT DEFAULT ''");
  db.run("UPDATE students SET course = 'BCA Data Science' WHERE course IS NULL OR TRIM(course) = ''");
  db.run("UPDATE students SET semester = '5th Semester' WHERE semester IS NULL OR TRIM(semester) = ''");

  // Inter-college workflow storage. CREATE TABLE IF NOT EXISTS is safe for both new and existing databases.
  db.run(`CREATE TABLE IF NOT EXISTS inter_college_submissions (
    submission_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_email TEXT NOT NULL,
    college_name TEXT NOT NULL,
    fest_name TEXT NOT NULL,
    event_name TEXT NOT NULL,
    teacher_incharge TEXT NOT NULL,
    teacher_email TEXT NOT NULL,
    mentor_incharge TEXT NOT NULL,
    mentor_email TEXT NOT NULL,
    winning_certificate TEXT,
    participation_certificate TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    awarded_credits REAL NOT NULL DEFAULT 0,
    teacher_comment TEXT DEFAULT '',
    submitted_at TEXT NOT NULL,
    reviewed_at TEXT DEFAULT '',
    reviewed_by TEXT DEFAULT ''
  )`);
}

function resetAndSeedIfNeeded() {
  db.run(fs.readFileSync(SCHEMA_FILE, "utf8"));
  migrateDatabase();
  const count = rows("SELECT COUNT(*) AS c FROM admins")[0].c;
  if (Number(count) === 0) db.run(fs.readFileSync(SEED_FILE, "utf8"));
  saveDb();
}
function bootstrap() {
  return {
    admins: rows("SELECT admin_id AS id, admin_name AS name, admin_email AS email, admin_password AS password FROM admins"),
    teachers: rows("SELECT teacher_id AS id, teacher_name AS name, teacher_email AS email, teacher_password AS password, department_name AS department FROM teachers"),
    students: rows("SELECT student_id AS id, student_name AS name, student_email AS email, student_password AS password, department_name AS department, mentor_incharge AS mentor, course, year, semester, contact, credits FROM students"),
    events: rows(`SELECT event_id AS id,event_name AS name,description,incharge_teacher AS inchargeTeacher,incharge_email AS inchargeEmail,
      created_by_role AS createdByRole,created_by_email AS createdByEmail,contact,event_date AS date,event_date AS eventDate,start_time AS startTime,
      end_time AS endTime,venue,credits,capacity,registration_deadline AS deadline,registration_deadline AS registrationDeadline,created_at AS createdAt FROM events`),
    registrations: rows(`SELECT registration_id AS id,event_id AS eventId,student_id AS studentId,registration_date AS registrationDate,
      name,register_no AS registerNo,course,semester,email,contact,year FROM registrations`),
    attendance: rows(`SELECT event_id AS eventId,student_id AS studentId,status,marked_at AS markedAt FROM attendance`),
    creditTransactions: rows(`SELECT transaction_id AS id,student_id AS studentId,event_id AS eventId,date,activity,credits FROM credit_transactions`),
    interCollegeSubmissions: rows(`SELECT submission_id AS id,student_id AS studentId,student_name AS studentName,student_email AS studentEmail,
      college_name AS collegeName,fest_name AS festName,event_name AS eventName,teacher_incharge AS teacherIncharge,teacher_email AS teacherEmail,
      mentor_incharge AS mentorIncharge,mentor_email AS mentorEmail,winning_certificate AS winningCertificate,
      participation_certificate AS participationCertificate,status,awarded_credits AS awardedCredits,teacher_comment AS teacherComment,
      submitted_at AS submittedAt,reviewed_at AS reviewedAt,reviewed_by AS reviewedBy FROM inter_college_submissions`)
  };
}

const app = express();
// Allow the frontend to call the API even if the HTML is opened directly
// during local testing or served from a different local origin.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({limit:"5mb"}));
app.use(express.static(ROOT));

app.get("/api/health", (req,res)=>res.json({ok:true}));
app.get("/api/bootstrap", (req,res)=>{
  try {
    res.json(bootstrap());
  } catch (err) {
    console.error("Bootstrap database error:", err);
    res.status(500).json({error:"Database bootstrap failed", detail:err.message});
  }
});

app.post("/api/login", (req,res)=>{
  const {role,email,password} = req.body || {};
  const e = String(email || "").trim().toLowerCase();
  let account = null;
  if (role === "admin") account = rows("SELECT admin_id AS id,admin_name AS name,admin_email AS email,admin_password AS password FROM admins WHERE lower(admin_email)=?",[e])[0];
  if (role === "teacher") account = rows("SELECT teacher_id AS id,teacher_name AS name,teacher_email AS email,teacher_password AS password,department_name AS department FROM teachers WHERE lower(teacher_email)=? LIMIT 1",[e])[0];
  if (role === "student") account = rows("SELECT student_id AS id,student_name AS name,student_email AS email,student_password AS password,department_name AS department,mentor_incharge AS mentor,course,year,semester,contact,credits FROM students WHERE lower(student_email)=?",[e])[0];
  if (!account) return res.status(401).json({error:"Incorrect email ID"});
  if (account.password !== password) return res.status(401).json({error:"Incorrect password"});
  delete account.password;
  res.json({role,account});
});

app.put("/api/state", (req,res)=>{
  const s = req.body || {};
  try {
    db.run("BEGIN");

    // IMPORTANT: this endpoint is merge-based. Older versions deleted and
    // recreated every row on every save, so a stale browser tab/poll could
    // erase data created by another user. We now UPSERT incoming rows and
    // only delete records explicitly listed by the client.
    // Only explicitly changed student master records are updated. The old
    // implementation wrote the whole browser's users array on every save,
    // which allowed a stale tab to overwrite newer credits/profile data.
    for (const u of (s.studentUpdates || [])) {
      exec(`UPDATE students SET student_name=?,course=?,year=?,semester=?,contact=?,mentor_incharge=?,department_name=? WHERE student_id=?`,
        [u.name||"",u.course||"",u.year||"",u.semester||"",u.contact||"",u.mentor||"",u.department||"",u.id]);
    }

    for (const e of (s.events || [])) {
      exec(`INSERT INTO events(event_id,event_name,description,incharge_teacher,incharge_email,created_by_role,created_by_email,contact,event_date,start_time,end_time,venue,credits,capacity,registration_deadline,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(event_id) DO UPDATE SET
          event_name=excluded.event_name,description=excluded.description,incharge_teacher=excluded.incharge_teacher,
          incharge_email=excluded.incharge_email,created_by_role=excluded.created_by_role,created_by_email=excluded.created_by_email,
          contact=excluded.contact,event_date=excluded.event_date,start_time=excluded.start_time,end_time=excluded.end_time,
          venue=excluded.venue,credits=excluded.credits,capacity=excluded.capacity,
          registration_deadline=excluded.registration_deadline,created_at=excluded.created_at`,
        [e.id,e.name,e.description||"",e.inchargeTeacher,e.inchargeEmail,e.createdByRole||"admin",e.createdByEmail||"",e.contact,e.date,e.startTime,e.endTime,e.venue,Number(e.credits||0),Number(e.capacity||50),e.deadline || e.registrationDeadline || "",e.createdAt||new Date().toISOString()]);
    }

    for (const r of (s.registrations || [])) {
      exec(`INSERT INTO registrations(registration_id,event_id,student_id,registration_date,name,register_no,course,semester,email,contact,year)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(registration_id) DO UPDATE SET
          event_id=excluded.event_id,student_id=excluded.student_id,registration_date=excluded.registration_date,
          name=excluded.name,register_no=excluded.register_no,course=excluded.course,semester=excluded.semester,
          email=excluded.email,contact=excluded.contact,year=excluded.year`,
        [r.id,r.eventId,r.studentId,r.registrationDate,r.name||"",r.registerNo||"",r.course||"",r.semester||"",r.email||"",r.contact||"",r.year||""]);
    }

    for (const a of (s.attendance || [])) {
      exec(`INSERT INTO attendance(event_id,student_id,status,marked_at) VALUES(?,?,?,?)
        ON CONFLICT(event_id,student_id) DO UPDATE SET status=excluded.status,marked_at=excluded.marked_at`,
        [a.eventId,a.studentId,a.status,a.markedAt||new Date().toISOString()]);
    }

    for (const t of (s.creditTransactions || [])) {
      exec(`INSERT INTO credit_transactions(transaction_id,student_id,event_id,date,activity,credits)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(student_id,event_id) DO UPDATE SET date=excluded.date,activity=excluded.activity,credits=excluded.credits`,
        [t.id || null,t.studentId,t.eventId,t.date,t.activity,Number(t.credits||0)]);
    }

    for (const x of (s.interCollegeSubmissions || [])) {
      exec(`INSERT INTO inter_college_submissions(
        submission_id,student_id,student_name,student_email,college_name,fest_name,event_name,teacher_incharge,teacher_email,
        mentor_incharge,mentor_email,winning_certificate,participation_certificate,status,awarded_credits,teacher_comment,submitted_at,reviewed_at,reviewed_by
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(submission_id) DO UPDATE SET
        student_id=excluded.student_id,student_name=excluded.student_name,student_email=excluded.student_email,
        college_name=excluded.college_name,fest_name=excluded.fest_name,event_name=excluded.event_name,
        teacher_incharge=excluded.teacher_incharge,teacher_email=excluded.teacher_email,mentor_incharge=excluded.mentor_incharge,
        mentor_email=excluded.mentor_email,winning_certificate=excluded.winning_certificate,
        participation_certificate=excluded.participation_certificate,status=excluded.status,
        awarded_credits=excluded.awarded_credits,teacher_comment=excluded.teacher_comment,
        submitted_at=excluded.submitted_at,reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by`,
      [x.id,x.studentId,x.studentName||"",x.studentEmail||"",x.collegeName||"",x.festName||"",x.eventName||"",
       x.teacherIncharge||"",x.teacherEmail||"",x.mentorIncharge||"",x.mentorEmail||"",x.winningCertificate||"",
       x.participationCertificate||"",x.status||"Pending",Number(x.awardedCredits||0),x.teacherComment||"",x.submittedAt||new Date().toISOString(),x.reviewedAt||"",x.reviewedBy||""]);
    }

    const del = (table, column, ids) => {
      for (const id of Array.isArray(ids) ? ids : []) {
        if (id !== undefined && id !== null && String(id) !== "") {
          exec(`DELETE FROM ${table} WHERE ${column}=?`, [id]);
        }
      }
    };
    // Event deletion cascades registrations, attendance and event credits.
    del("events","event_id",s.deletedEvents);
    del("registrations","registration_id",s.deletedRegistrations);
    del("credit_transactions","transaction_id",s.deletedCreditTransactions);
    del("inter_college_submissions","submission_id",s.deletedInterCollegeSubmissions);

    // Credits are derived from durable records so a stale browser can never
    // overwrite a student's balance. Present college attendance creates a
    // credit transaction; approved inter-college submissions add awarded
    // credits.
    db.run(`UPDATE students SET credits = COALESCE((
      SELECT SUM(ct.credits) FROM credit_transactions ct WHERE ct.student_id = students.student_id
    ),0) + COALESCE((
      SELECT SUM(ic.awarded_credits) FROM inter_college_submissions ic
      WHERE ic.student_id = students.student_id AND ic.status = 'Approved'
    ),0)`);

    db.run("COMMIT");
    saveDb();
    res.json({ok:true,state:bootstrap()});
  } catch(err) {
    try { db.run("ROLLBACK"); } catch {}
    console.error("State save error:", err);
    res.status(500).json({error:"Could not save application data",detail:err.message});
  }
});

app.get(/.*/, (req,res)=>{
  res.sendFile(path.join(ROOT,"final2(1).html"));
});

(async()=>{
  SQL = await initSqlJs({locateFile:file=>path.join(path.dirname(require.resolve("sql.js")),file)});
  fs.mkdirSync(DB_DIR,{recursive:true});
  if (fs.existsSync(DB_FILE)) db = new SQL.Database(new Uint8Array(fs.readFileSync(DB_FILE)));
  else db = new SQL.Database();
  resetAndSeedIfNeeded();
  app.listen(PORT,()=>console.log(`College Credit Bank running at http://localhost:${PORT}`));
})().catch(err=>{console.error(err);process.exit(1);});
