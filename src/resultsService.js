import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = 'forest_lab_local_results';
const CLOUD_CHECK_TTL_MS = 30_000;
let cloudConnectionCache = { ok: false, checkedAt: 0 };

function invalidateCloudConnectionCache() {
  cloudConnectionCache = { ok: false, checkedAt: 0 };
}
const PAGE_SIZE = 500;

function getLocalResults() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
    return [];
  }
}

function saveLocalResults(results) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(results));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
}

function mapRow(row) {
  return {
    id: row.id,
    studentName: row.student_name,
    successes: row.successes ?? 0,
    totalExperiments: row.total_experiments ?? 3,
    allPassed: row.all_passed ?? (row.successes === 3),
    experimentStatus: row.experiment_status ?? null,
    labRank: row.lab_rank,
    score: row.score,
    attempts: row.attempts,
    timeSeconds: row.time_seconds,
    timestamp: row.created_at,
    source: 'cloud',
  };
}

function recordKey(record) {
  if (record.id && !String(record.id).startsWith('local-')) {
    return record.id;
  }
  return `${record.studentName}|${record.timestamp}`;
}

function mergeResults(cloudRows, localRows) {
  const merged = new Map();

  const add = (record) => {
    const key = recordKey(record);
    const existing = merged.get(key);
    const preferCloud =
      record.source === 'cloud' ||
      (record.id && !String(record.id).startsWith('local-'));
    const existingIsCloud =
      existing?.source === 'cloud' ||
      (existing?.id && !String(existing.id).startsWith('local-'));

    if (!existing || (preferCloud && !existingIsCloud)) {
      merged.set(key, record);
    } else if (!preferCloud && existingIsCloud) {
      return;
    } else if (
      new Date(record.timestamp).getTime() >= new Date(existing.timestamp).getTime()
    ) {
      merged.set(key, record);
    }
  };

  localRows.forEach(add);
  cloudRows.forEach(add);

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
}

async function fetchAllCloudResults() {
  const all = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('forest_lab_results')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    all.push(...data.map(mapRow));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

function buildInsertPayload(record) {
  return {
    student_name: record.studentName,
    successes: record.successes ?? 0,
    total_experiments: record.totalExperiments ?? 3,
    all_passed: record.allPassed ?? false,
    experiment_status: record.experimentStatus ?? null,
    lab_rank: record.labRank || null,
    score: record.score ?? record.successes ?? 0,
    attempts: record.attempts ?? record.totalExperiments ?? 3,
    time_seconds: record.timeSeconds ?? 0,
  };
}

export const resultsService = {
  isCloudConfigured() {
    return !!supabase;
  },

  async isCloudConnected({ force = false } = {}) {
    if (!supabase) {
      cloudConnectionCache = { ok: false, checkedAt: Date.now() };
      return false;
    }

    const cacheFresh =
      !force &&
      cloudConnectionCache.checkedAt &&
      Date.now() - cloudConnectionCache.checkedAt < CLOUD_CHECK_TTL_MS;
    if (cacheFresh) {
      return cloudConnectionCache.ok;
    }

    try {
      const { error } = await supabase
        .from('forest_lab_results')
        .select('id')
        .limit(1);

      const ok = !error;
      cloudConnectionCache = { ok, checkedAt: Date.now() };
      return ok;
    } catch {
      cloudConnectionCache = { ok: false, checkedAt: Date.now() };
      return false;
    }
  },

  async saveResult(sessionData) {
    const newRecord = {
      ...sessionData,
      id: sessionData.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: sessionData.timestamp || new Date().toISOString(),
      source: 'local',
    };

    const local = getLocalResults();
    local.unshift(newRecord);
    saveLocalResults(local);

    if (!supabase) {
      return { success: true, mode: 'local' };
    }

    try {
      const { data, error } = await supabase
        .from('forest_lab_results')
        .insert([buildInsertPayload(newRecord)])
        .select('id, created_at')
        .single();

      if (error) {
        console.error('Supabase insert failed:', error.message, error.details, error.hint);
        invalidateCloudConnectionCache();
        return { success: false, mode: 'local', error };
      }

      const synced = {
        ...newRecord,
        id: data.id,
        timestamp: data.created_at,
        source: 'cloud',
      };

      const updatedLocal = getLocalResults().map((r) =>
        r.id === newRecord.id ? synced : r
      );
      saveLocalResults(updatedLocal);

      cloudConnectionCache = { ok: true, checkedAt: Date.now() };
      return { success: true, mode: 'cloud', id: data.id };
    } catch (err) {
      console.error('Database connection error in saveResult:', err);
      invalidateCloudConnectionCache();
      return { success: false, mode: 'local', error: err };
    }
  },

  async getResults() {
    const localRows = getLocalResults().map((r) => ({ ...r, source: r.source || 'local' }));

    if (!supabase) {
      return localRows;
    }

    try {
      const cloudRows = await fetchAllCloudResults();
      cloudConnectionCache = { ok: true, checkedAt: Date.now() };
      const merged = mergeResults(cloudRows, localRows);
      saveLocalResults(merged);
      return merged;
    } catch (err) {
      console.error('Database connection error in getResults, using local data:', err);
      invalidateCloudConnectionCache();
      return localRows;
    }
  },

  async clearResults() {
    saveLocalResults([]);

    if (!supabase) {
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('forest_lab_results')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error('Error clearing data in Supabase:', error);
        invalidateCloudConnectionCache();
        return { success: false, error };
      }
      cloudConnectionCache = { ok: true, checkedAt: Date.now() };
      return { success: true };
    } catch (err) {
      console.error('Database connection error in clearResults:', err);
      invalidateCloudConnectionCache();
      return { success: false, error: err };
    }
  },
};
