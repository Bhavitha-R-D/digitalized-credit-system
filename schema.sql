PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  admin_id INTEGER PRIMARY KEY, admin_name TEXT NOT NULL, admin_email TEXT NOT NULL UNIQUE, admin_password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teachers (
  teacher_id TEXT PRIMARY KEY, teacher_name TEXT NOT NULL, teacher_email TEXT NOT NULL, teacher_password TEXT NOT NULL, department_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
  student_id TEXT PRIMARY KEY, student_name TEXT NOT NULL, student_email TEXT NOT NULL UNIQUE, student_password TEXT NOT NULL,
  department_name TEXT NOT NULL, mentor_incharge TEXT, course TEXT DEFAULT 'BCA Data Science', year TEXT DEFAULT '',
  semester TEXT DEFAULT '5th Semester', contact TEXT DEFAULT '', credits REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY, event_name TEXT NOT NULL, description TEXT, incharge_teacher TEXT NOT NULL, incharge_email TEXT NOT NULL,
  created_by_role TEXT NOT NULL, created_by_email TEXT, contact TEXT NOT NULL, event_date TEXT NOT NULL, start_time TEXT NOT NULL,
  end_time TEXT NOT NULL, venue TEXT NOT NULL, credits REAL NOT NULL, capacity INTEGER NOT NULL, registration_deadline TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registrations (
  registration_id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE, registration_date TEXT NOT NULL, name TEXT NOT NULL,
  register_no TEXT, course TEXT, semester TEXT, email TEXT, contact TEXT, year TEXT, UNIQUE(event_id, student_id)
);
CREATE TABLE IF NOT EXISTS attendance (
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE, student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('Present','Absent')), marked_at TEXT NOT NULL, PRIMARY KEY(event_id, student_id)
);
CREATE TABLE IF NOT EXISTS credit_transactions (
  transaction_id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE, date TEXT NOT NULL, activity TEXT NOT NULL, credits REAL NOT NULL, UNIQUE(student_id,event_id)
);

CREATE TABLE IF NOT EXISTS inter_college_submissions (
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
  status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
  awarded_credits REAL NOT NULL DEFAULT 0,
  teacher_comment TEXT DEFAULT '',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT DEFAULT '',
  reviewed_by TEXT DEFAULT ''
);
