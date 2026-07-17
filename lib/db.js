import { Pool } from 'pg';

// Réutilise un pool unique entre invocations "à chaud" de la fonction
// serverless (pattern standard pour Vercel + Postgres). max:1 car le pool
// applicatif s'ajoute au pooler PgBouncer déjà en place côté Vercel Postgres.
let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
    if (!connectionString) {
      throw new Error('POSTGRES_URL manquant : liez une base Vercel Postgres au projet.');
    }
    pool = new Pool({ connectionString, max: 1 });
  }
  return pool;
}

// Fragment SQL réutilisable pour produire un horodatage TEXT au même
// format que SQLite ("YYYY-MM-DD HH:MM:SS"), afin que le frontend
// (formatDate/formatDateTime) n'ait rien à changer.
export const NOW_EXPR = "to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";
export const TODAY_EXPR = "CURRENT_DATE::text";

function toPgQuery(query) {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

async function exec(query, args) {
  const result = await getPool().query(toPgQuery(query), args);
  return result;
}

// Adaptateur imitant l'API `env.DB.prepare(sql).bind(...args).first()/.all()/.run()`
// de Cloudflare D1, pour réutiliser telles quelles les requêtes existantes.
export const db = {
  prepare(query) {
    return {
      bind(...args) {
        return {
          async first() {
            const { rows } = await exec(query, args);
            return rows[0] ?? null;
          },
          async all() {
            const { rows } = await exec(query, args);
            return { results: rows };
          },
          async run() {
            const { rows } = await exec(query, args);
            return { meta: { last_row_id: rows[0]?.id ?? null } };
          },
        };
      },
      async first() {
        const { rows } = await exec(query, []);
        return rows[0] ?? null;
      },
      async all() {
        const { rows } = await exec(query, []);
        return { results: rows };
      },
      async run() {
        const { rows } = await exec(query, []);
        return { meta: { last_row_id: rows[0]?.id ?? null } };
      },
    };
  },
};
