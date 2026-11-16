// Portable data layer: a small subset of the platform query builder backed by
// node:sqlite. It implements exactly the surface functions/router.mjs uses:
//   db.from(table).select(cols).eq(k,v).order(k,{ascending}).limit(n)
//   db.from(table).insert(row)[.select(cols)]
//   db.from(table).insertIfAbsent(row, { onConflict })[.select(cols)]
//   db.from(table).update(values).eq(...)[.select(cols)]
import { DatabaseSync } from 'node:sqlite';

// Columns the platform stored as real booleans; SQLite stores them as 0/1 and
// the router compares some of them with `!== false`, so they must round-trip.
const BOOLEAN_COLUMNS = {
  users: new Set(['email_consent']),
  notices: new Set(['pinned', 'deleted']),
  updates: new Set(['deleted']),
  events: new Set(['deleted']),
  chat_messages: new Set(['deleted']),
  posts: new Set(['deleted']),
  server_status: new Set(['online']),
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quote(name) {
  if (!IDENT.test(name)) throw new Error(`unsafe identifier: ${name}`);
  return `"${name}"`;
}

function bind(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function mapRow(table, row) {
  if (!row) return row;
  const columns = BOOLEAN_COLUMNS[table];
  if (!columns) return { ...row };
  const out = { ...row };
  for (const column of columns) {
    if (out[column] !== undefined && out[column] !== null) out[column] = Boolean(out[column]);
  }
  return out;
}

function project(columns) {
  if (columns.trim() === '*') return '*';
  return columns.split(',').map((part) => quote(part.trim())).join(', ');
}

export function createDatabase(path) {
  const database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA busy_timeout = 5000');

  function from(table) {
    quote(table);
    const state = {
      table, columns: null, filters: [], order: [], limit: null,
      mode: 'read', values: null, ignore: false,
    };

    const query = {
      select(columns) { state.columns = columns; return query; },
      eq(key, value) { state.filters.push([key, bind(value)]); return query; },
      order(key, options = {}) { state.order.push([key, options.ascending !== false]); return query; },
      limit(value) { state.limit = value; return query; },
      insert(values) { state.mode = 'insert'; state.values = values; return query; },
      insertIfAbsent(values) { state.mode = 'insert'; state.values = values; state.ignore = true; return query; },
      update(values) { state.mode = 'update'; state.values = values; return query; },
      then(resolve, reject) {
        return Promise.resolve().then(() => run()).then(resolve, reject);
      },
    };

    function run() {
      if (state.mode === 'insert') return runInsert();
      if (state.mode === 'update') return runUpdate();
      return runSelect();
    }

    function whereClause(params) {
      if (state.filters.length === 0) return '';
      const parts = state.filters.map(([key, value]) => {
        params.push(value);
        return `${quote(key)} = ?`;
      });
      return ` WHERE ${parts.join(' AND ')}`;
    }

    function returning() {
      return state.columns ? ` RETURNING ${project(state.columns)}` : '';
    }

    function runSelect() {
      const params = [];
      const where = whereClause(params);
      let sql = `SELECT ${state.columns ? project(state.columns) : '*'} FROM ${quote(state.table)}${where}`;
      if (state.order.length > 0) {
        sql += ` ORDER BY ${state.order.map(([key, asc]) => `${quote(key)} ${asc ? 'ASC' : 'DESC'}`).join(', ')}`;
      }
      if (state.limit !== null) {
        params.push(state.limit);
        sql += ' LIMIT ?';
      }
      const data = database.prepare(sql).all(...params).map((row) => mapRow(state.table, row));
      return { data, error: null };
    }

    function runInsert() {
      const keys = Object.keys(state.values);
      const params = keys.map((key) => bind(state.values[key]));
      const sql = `INSERT ${state.ignore ? 'OR IGNORE ' : ''}INTO ${quote(state.table)} `
        + `(${keys.map(quote).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
        + returning();
      const data = database.prepare(sql).all(...params).map((row) => mapRow(state.table, row));
      return { data, error: null };
    }

    function runUpdate() {
      const params = [];
      const sets = Object.keys(state.values).map((key) => {
        params.push(bind(state.values[key]));
        return `${quote(key)} = ?`;
      });
      const where = whereClause(params);
      const sql = `UPDATE ${quote(state.table)} SET ${sets.join(', ')}${where}`
        + (state.columns ? returning() : '');
      const data = state.columns
        ? database.prepare(sql).all(...params).map((row) => mapRow(state.table, row))
        : (database.prepare(sql).run(...params), []);
      return { data, error: null };
    }

    return query;
  }

  return {
    from,
    exec: (sql) => database.exec(sql),
    close: () => database.close(),
  };
}
