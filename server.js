const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DATA_DIR =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'presentations.db');
const IS_EPHEMERAL =
  !process.env.DATA_DIR &&
  !process.env.RAILWAY_VOLUME_MOUNT_PATH &&
  DATA_DIR.startsWith(__dirname);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const STUDENTS_BY_CLASS = {
  '6-1': [
    '권재우', '김예빈', '김윤슬', '김윤중', '신승운',
    '신재윤', '신주환', '오하라', '이초연', '임아현',
    '정민찬', '정태준', '정하윤', '최예준', '한소율'
  ],
  '6-2': [
    '고민준', '김민지', '김예준', '김지안', '박시은',
    '설초은', '양지유', '유하진', '이승호', '이준영',
    '이충환', '임준희', '정태규', '한설아', '한지오'
  ],
  '6-3': [
    '김도영', '김동안', '김성진', '김소은', '김태윤',
    '박하민', '변서준', '오민지', '우진원', '이다민',
    '전태희', '정은', '조민준', '조이수', '황태상'
  ]
};

const CLASS_ID = process.env.CLASS_ID || '6-1';
const STUDENTS = STUDENTS_BY_CLASS[CLASS_ID];
if (!STUDENTS) {
  console.error(`Unknown CLASS_ID="${CLASS_ID}". Valid values: ${Object.keys(STUDENTS_BY_CLASS).join(', ')}`);
  process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS presentations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student TEXT NOT NULL,
    year INTEGER NOT NULL,
    week INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student, year, week)
  );
  CREATE INDEX IF NOT EXISTS idx_year_week ON presentations(year, week);
`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/students', (_req, res) => {
  res.json({ students: STUDENTS });
});

app.get('/api/class', (_req, res) => {
  res.json({ classId: CLASS_ID });
});

app.get('/api/week', (req, res) => {
  const year = parseInt(req.query.year, 10);
  const week = parseInt(req.query.week, 10);
  if (!Number.isInteger(year) || !Number.isInteger(week)) {
    return res.status(400).json({ error: 'year and week are required integers' });
  }
  const rows = db.prepare(
    'SELECT student, count FROM presentations WHERE year = ? AND week = ?'
  ).all(year, week);
  const byStudent = Object.fromEntries(STUDENTS.map(s => [s, 0]));
  for (const r of rows) byStudent[r.student] = r.count;
  res.json({ year, week, counts: byStudent });
});

app.post('/api/week/set', (req, res) => {
  const { year, week, student, count } = req.body || {};
  if (!Number.isInteger(year) || !Number.isInteger(week)) {
    return res.status(400).json({ error: 'year/week must be integers' });
  }
  if (!STUDENTS.includes(student)) {
    return res.status(400).json({ error: 'unknown student' });
  }
  const safeCount = Math.max(0, Math.min(999, parseInt(count, 10) || 0));
  db.prepare(`
    INSERT INTO presentations (student, year, week, count, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(student, year, week)
    DO UPDATE SET count = excluded.count, updated_at = datetime('now')
  `).run(student, year, week, safeCount);
  res.json({ ok: true, count: safeCount });
});

app.post('/api/week/increment', (req, res) => {
  const { year, week, student, delta } = req.body || {};
  if (!Number.isInteger(year) || !Number.isInteger(week)) {
    return res.status(400).json({ error: 'year/week must be integers' });
  }
  if (!STUDENTS.includes(student)) {
    return res.status(400).json({ error: 'unknown student' });
  }
  const d = parseInt(delta, 10) || 1;
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO presentations (student, year, week, count)
      VALUES (?, ?, ?, 0)
    `).run(student, year, week);
    db.prepare(`
      UPDATE presentations
      SET count = MAX(0, MIN(999, count + ?)), updated_at = datetime('now')
      WHERE student = ? AND year = ? AND week = ?
    `).run(d, student, year, week);
    return db.prepare(
      'SELECT count FROM presentations WHERE student = ? AND year = ? AND week = ?'
    ).get(student, year, week);
  });
  const row = tx();
  res.json({ ok: true, count: row.count });
});

app.get('/api/summary', (req, res) => {
  const year = parseInt(req.query.year, 10);
  if (!Number.isInteger(year)) {
    return res.status(400).json({ error: 'year is required' });
  }
  const rows = db.prepare(
    'SELECT student, week, count FROM presentations WHERE year = ? AND count > 0 ORDER BY week ASC'
  ).all(year);
  const weeks = [...new Set(rows.map(r => r.week))].sort((a, b) => a - b);
  const totals = Object.fromEntries(STUDENTS.map(s => [s, 0]));
  const perWeek = {};
  for (const w of weeks) {
    perWeek[w] = Object.fromEntries(STUDENTS.map(s => [s, 0]));
  }
  for (const r of rows) {
    perWeek[r.week][r.student] = r.count;
    totals[r.student] += r.count;
  }
  res.json({ year, weeks, perWeek, totals });
});

app.get('/api/health', (_req, res) => {
  let rowCount = 0;
  try {
    rowCount = db.prepare('SELECT COUNT(*) AS n FROM presentations').get().n;
  } catch (_) {}
  res.json({
    classId: CLASS_ID,
    dbPath: DB_PATH,
    ephemeral: IS_EPHEMERAL,
    rowCount
  });
});

app.listen(PORT, () => {
  console.log(`Student presentation tracker listening on :${PORT} (class ${CLASS_ID})`);
  console.log(`Database at ${DB_PATH}`);
  if (IS_EPHEMERAL) {
    console.warn('');
    console.warn('=======================================================================');
    console.warn('⚠️  WARNING: DATA IS ON EPHEMERAL STORAGE — IT WILL BE LOST ON REDEPLOY');
    console.warn('    Set DATA_DIR to a Railway volume mount path (e.g. /data) and');
    console.warn('    attach a Volume to this service mounted at that path.');
    console.warn('=======================================================================');
    console.warn('');
  }
});
