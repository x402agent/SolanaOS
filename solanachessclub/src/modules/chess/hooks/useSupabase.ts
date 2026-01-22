/**
 * React Native hook for Supabase integration
 * 
 * Provides easy access to Supabase client for storage and database operations
 * in the mobile app.
 */

import { useState, useEffect, useMemo } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ Supabase credentials not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env.local');
}

/**
 * Create a singleton Supabase client instance
 */
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseInstance && SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                // Disable auth persistence since we use wallet-based auth
                persistSession: false,
                autoRefreshToken: false,
            },
        });
    }

    if (!supabaseInstance) {
        throw new Error('Supabase client not initialized. Check your environment variables.');
    }

    return supabaseInstance;
}

/**
 * Hook to access Supabase client
 */
export function useSupabase() {
    const client = useMemo(() => {
        try {
            return getSupabaseClient();
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            return null;
        }
    }, []);

    return { supabase: client };
}

/**
 * Hook to upload files to Supabase Storage
 */
export function useSupabaseUpload() {
    const { supabase } = useSupabase();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadFile = async (
        bucket: string,
        path: string,
        file: Blob | File,
        options?: { contentType?: string; upsert?: boolean }
    ) => {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        setUploading(true);
        setError(null);

        try {
            const { data, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(path, file, {
                    contentType: options?.contentType,
                    upsert: options?.upsert ?? true,
                });

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(path);

            return {
                path: data.path,
                url: urlData.publicUrl,
            };
        } catch (err: any) {
            const errorMessage = err.message || 'Upload failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    return { uploadFile, uploading, error };
}

/**
 * Hook to query Supabase database
 */
export function useSupabaseQuery<T = any>(
    table: string,
    options?: {
        select?: string;
        filters?: Record<string, any>;
        orderBy?: { column: string; ascending?: boolean };
        limit?: number;
    }
) {
    const { supabase } = useSupabase();
    const [data, setData] = useState<T[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        if (!supabase) {
            setError('Supabase not initialized');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let query = supabase.from(table).select(options?.select || '*');

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

            // Apply limit
            if (options?.limit) {
                query = query.limit(options.limit);
            }

            const { data: queryData, error: queryError } = await query;

            if (queryError) {
                throw queryError;
            }

            setData(queryData as T[]);
        } catch (err: any) {
            setError(err.message || 'Query failed');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [table, JSON.stringify(options)]);

    return { data, loading, error, refetch: fetchData };
}

/**
 * Hook to subscribe to real-time updates
 */
export function useSupabaseSubscription<T = any>(
    table: string,
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: T) => void,
    filter?: string
) {
    const { supabase } = useSupabase();

    useEffect(() => {
        if (!supabase) {
            console.warn('Supabase not initialized, subscription not created');
            return;
        }

        const channel = supabase
            .channel(`${table}-changes`)
            .on(
                'postgres_changes',
                {
                    event,
                    schema: 'public',
                    table,
                    filter,
                },
                (payload) => {
                    callback(payload.new as T);
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [table, event, filter]);
}

/**
 * Hook to insert/update data
 */
export function useSupabaseMutation<T = any>(table: string) {
    const { supabase } = useSupabase();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const insert = async (data: Partial<T>) => {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        setLoading(true);
        setError(null);

        try {
            const { data: result, error: insertError } = await supabase
                .from(table)
                .insert(data)
                .select()
                .single();

            if (insertError) {
                throw insertError;
            }

            return result as T;
        } catch (err: any) {
            const errorMessage = err.message || 'Insert failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const update = async (id: string | number, data: Partial<T>) => {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        setLoading(true);
        setError(null);

        try {
            const { data: result, error: updateError } = await supabase
                .from(table)
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            return result as T;
        } catch (err: any) {
            const errorMessage = err.message || 'Update failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const remove = async (id: string | number) => {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        setLoading(true);
        setError(null);

        try {
            const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .eq('id', id);

            if (deleteError) {
                throw deleteError;
            }
        } catch (err: any) {
            const errorMessage = err.message || 'Delete failed';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return { insert, update, remove, loading, error };
}

/**
 * Example usage in a component:
 * 
 * ```typescript
 * // Upload a file
 * const { uploadFile, uploading } = useSupabaseUpload();
 * const handleUpload = async (file: File) => {
 *   const { url } = await uploadFile('profiles', `avatar-${userId}.jpg`, file);
 *   console.log('Uploaded:', url);
 * };
 * 
 * // Query data
 * const { data: games, loading } = useSupabaseQuery('chess_games', {
 *   filters: { status: 'active' },
 *   orderBy: { column: 'created_at', ascending: false },
 *   limit: 10
 * });
 * 
 * // Real-time subscription
 * useSupabaseSubscription('chess_games', 'UPDATE', (game) => {
 *   console.log('Game updated:', game);
 * }, `id=eq.${gameId}`);
 * 
 * // Insert/Update data
 * const { insert, update } = useSupabaseMutation('users');
 * await insert({ wallet_address: address, username: name });
 * await update(userId, { avatar_url: newUrl });
 * ```
 */
