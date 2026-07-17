export async function nextNumber(db, prefix, year) {
  const key = year ? `${prefix}-${year}` : prefix;
  await db.prepare(
    `INSERT INTO counters (key, value) VALUES (?, 1)
     ON CONFLICT(key) DO UPDATE SET value = counters.value + 1`
  ).bind(key).run();
  const row = await db.prepare('SELECT value FROM counters WHERE key = ?').bind(key).first();
  const seq = String(row.value).padStart(3, '0');
  return year ? `${prefix}-${year}-${seq}` : `${prefix}-${seq}`;
}
