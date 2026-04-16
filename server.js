const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'presentations.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const STUDENTS = [
  '권재우', '김예빈', '김윤슬', '김윤중', '신승운',
  '신재윤', '신주환', '오하라', '이초연', '임아현',
  '정민찬', '정태준', '정하윤', '최예준', '한소율'
];

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

app.listen(PORT, () => {
  console.log(`Student presentation tracker listening on :${PORT}`);
  console.log(`Database at ${DB_PATH}`);
});
