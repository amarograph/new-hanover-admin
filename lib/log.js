export async function logActivity(db, userId, action, targetType, targetId, oldValue, newValue) {
  await db.prepare(
    `INSERT INTO activity_log (user_id, action, target_type, target_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    userId ?? null,
    action,
    targetType ?? null,
    targetId != null ? String(targetId) : null,
    oldValue != null ? JSON.stringify(oldValue) : null,
    newValue != null ? JSON.stringify(newValue) : null
  ).run();
}
