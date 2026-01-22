// File: server/src/utils/supabase-client.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
}

/**
 * Supabase client instance for server-side operations
 * Uses service role key for elevated permissions
 */
export const supabaseAdmin: SupabaseClient = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

/**
 * Create a Supabase client with anon key (for client-facing operations)
 */
export function createAnonClient(): SupabaseClient {
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!anonKey) {
        throw new Error('Missing SUPABASE_ANON_KEY in environment variables');
    }

    return createClient(supabaseUrl, anonKey);
}

/**
 * Database helper functions
 */

/**
 * Generic query builder with error handling
 */
export async function executeQuery<T>(
    queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<T> {
    const { data, error } = await queryFn(supabaseAdmin);

    if (error) {
        throw new Error(`Database query failed: ${error.message}`);
    }

    if (!data) {
        throw new Error('No data returned from query');
    }

    return data;
}

/**
 * Insert a single record
 */
export async function insertRecord<T>(
    table: string,
    record: Partial<T>
): Promise<T> {
    return executeQuery<T>(async (client) =>
        client.from(table).insert(record).select().single()
    );
}

/**
 * Update a record by ID
 */
export async function updateRecord<T>(
    table: string,
    id: string | number,
    updates: Partial<T>
): Promise<T> {
    return executeQuery<T>(async (client) =>
        client.from(table).update(updates).eq('id', id).select().single()
    );
}

/**
 * Delete a record by ID
 */
export async function deleteRecord(
    table: string,
    id: string | number
): Promise<void> {
    const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to delete record: ${error.message}`);
    }
}

/**
 * Get a single record by ID
 */
export async function getRecordById<T>(
    table: string,
    id: string | number
): Promise<T | null> {
    const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch record: ${error.message}`);
    }

    return data as T | null;
}

/**
 * Get multiple records with optional filters
 */
export async function getRecords<T>(
    table: string,
    options?: {
        filters?: Record<string, any>;
        orderBy?: { column: string; ascending?: boolean };
        limit?: number;
        offset?: number;
    }
): Promise<T[]> {
    let query = supabaseAdmin.from(table).select('*');

    // Apply filters
    if (options?.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }

    // Apply ordering
    if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
            ascending: options.orderBy.ascending ?? true,
        });
    }

    // Apply pagination
    if (options?.limit) {
        query = query.limit(options.limit);
    }

    if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch records: ${error.message}`);
    }

    return (data as T[]) || [];
}

export default supabaseAdmin;
