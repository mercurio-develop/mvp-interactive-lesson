import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const LOCAL_STORAGE_KEY = 'forest_lab_local_results';

/**
 * Helper to get local storage results.
 */
function getLocalResults() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read from localStorage:', e);
    return [];
  }
}

/**
 * Helper to save local storage results.
 */
function saveLocalResults(results) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(results));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
}

export const resultsService = {
  /**
   * Check if Supabase connection details are provided.
   */
  isCloudConnected() {
    return !!supabase;
  },

  /**
   * Saves a new student game result.
   * Runs local storage write and attempts database upload if cloud is configured.
   */
  async saveResult(sessionData) {
    // 1. Always save to LocalStorage first (for offline resilience/fallback)
    const local = getLocalResults();
    const newRecord = {
      ...sessionData,
      id: sessionData.id || `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: sessionData.timestamp || new Date().toISOString()
    };
    local.unshift(newRecord);
    saveLocalResults(local);

    // 2. If Supabase is connected, attempt to insert into table
    if (supabase) {
      try {
        const { error } = await supabase
          .from('forest_lab_results')
          .insert([
            {
              student_name: newRecord.studentName,
              lab_rank: newRecord.labRank,
              score: newRecord.score,
              attempts: newRecord.attempts,
              successes: newRecord.successes,
              time_seconds: newRecord.timeSeconds,
              created_at: newRecord.timestamp
            }
          ]);
        if (error) {
          console.warn('Failed to upload to Supabase, fallback to local cache:', error);
          return { success: false, mode: 'local', error };
        }
        return { success: true, mode: 'cloud' };
      } catch (err) {
        console.error('Database connection error in saveResult:', err);
        return { success: false, mode: 'local', error: err };
      }
    }

    return { success: true, mode: 'local' };
  },

  /**
   * Retrieves all results sorted by date descending.
   */
  async getResults() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('forest_lab_results')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('Error reading from Supabase, loading local copy:', error);
          return getLocalResults();
        }

        // Map Supabase snake_case back to camelCase
        const mapped = data.map((row) => ({
          id: row.id,
          studentName: row.student_name,
          labRank: row.lab_rank,
          score: row.score,
          attempts: row.attempts,
          successes: row.successes,
          timeSeconds: row.time_seconds,
          timestamp: row.created_at
        }));

        // Keep local storage in sync as a cache
        saveLocalResults(mapped);
        return mapped;
      } catch (err) {
        console.error('Database connection error in getResults, using local data:', err);
        return getLocalResults();
      }
    }

    // Default local behavior
    return getLocalResults();
  },

  /**
   * Clears all results.
   */
  async clearResults() {
    saveLocalResults([]);

    if (supabase) {
      try {
        // Delete all rows where created_at is not null (allows bypassing default RLS/safety limits)
        const { error } = await supabase
          .from('forest_lab_results')
          .delete()
          .neq('student_name', ''); // Basic filter to bypass "delete without where" protection

        if (error) {
          console.error('Error clearing data in Supabase:', error);
          return { success: false, error };
        }
        return { success: true };
      } catch (err) {
        console.error('Database connection error in clearResults:', err);
        return { success: false, error: err };
      }
    }

    return { success: true };
  }
};
