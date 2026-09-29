# College Credit Bank — SQL backend

## Run
1. Install Node.js LTS.
2. Open this folder in Visual Studio / VS Code.
3. In the terminal run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

The server creates `database/college_credit_bank.sqlite` automatically from `database/schema.sql` and `database/seed.sql`.

The Excel source used for this build has:
- 3 admin accounts
- 111 teacher rows across the department sheets
- 60 student rows
- student mentor-in-charge data is stored
- event/registration/attendance/credit data are stored in SQL tables

The current demo keeps the supplied passwords in the seed database because the existing website uses them directly. For production, replace them with salted password hashes.


## Persistence / deployment notes

The application stores all application data in `database/college_credit_bank.sqlite`.
The server writes the SQLite database to disk after successful changes. Events,
registrations, attendance, credit transactions, inter-college submissions, and
student profile fields are therefore preserved across browser refreshes and
server restarts.

The API save flow is merge-based and no longer deletes/recreates the whole
database on every browser save. Background polling is prevented from racing a
save, and student credit balances are recalculated from durable attendance/
credit records.

For production deployment, the hosting provider must give the application a
**persistent writable disk/volume** for the `database/` directory. Do not use
an ephemeral filesystem if you need data to survive a server/container
replacement. Keep regular database backups before major deployments.

The supplied project includes the College Credit logo as
`college-credit-logo.jpeg`; the previous SVG logo is no longer referenced.

### Final QA status

- Frontend JavaScript syntax checked.
- Backend JavaScript syntax checked.
- SQL schema parsed successfully in SQLite.
- Registration schema includes Semester and existing databases are migrated.
- Student dashboard event/attendance counts use persisted event/attendance data.
- Attendance chart is a green/red donut chart.
- Event and credit charts use the requested purple/dark-blue gradients.
- Chart gridlines are disabled.
- Save/polling race that could cause slow refreshes or stale overwrites has been addressed.


## New Admin Student Reports
- Admin -> Students now has a **Report** button for every student.
- The report shows college events where the student was marked Present.
- It also shows teacher-approved inter-college event participation.
- The report can be exported directly to PDF.
- The Teacher dashboard's Registrations count is based on unique students, so one student registering for multiple events is counted once.
