const NH = window.NH || {};

NH.api = async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const message = (data && data.error) || `Erreur (${res.status})`;
    throw new Error(message);
  }
  return data;
};

NH.get = (path) => NH.api(path);
NH.post = (path, body) => NH.api(path, { method: 'POST', body: JSON.stringify(body) });
NH.put = (path, body) => NH.api(path, { method: 'PUT', body: JSON.stringify(body) });
NH.patch = (path, body) => NH.api(path, { method: 'PATCH', body: JSON.stringify(body) });
NH.del = (path) => NH.api(path, { method: 'DELETE' });

window.NH = NH;
