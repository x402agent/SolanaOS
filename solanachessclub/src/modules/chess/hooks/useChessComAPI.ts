/**
 * React hooks for Chess.com API integration
 */

import { useState, useEffect } from 'react';
import { chessComAPI, ChessComPlayer, PlayerStats, DailyPuzzle, Leaderboards, Game } from '../services/chessComAPI';

/**
 * Hook to fetch and cache a Chess.com player profile
 */
export function useChessComPlayer(username: string | null) {
    const [player, setPlayer] = useState<ChessComPlayer | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!username) {
            setPlayer(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        chessComAPI.getPlayerProfile(username)
            .then(data => {
                if (!cancelled) {
                    setPlayer(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message || 'Failed to fetch player');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [username]);

    return { player, loading, error };
}

/**
 * Hook to fetch player stats
 */
export function useChessComStats(username: string | null) {
    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!username) {
            setStats(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        chessComAPI.getPlayerStats(username)
            .then(data => {
                if (!cancelled) {
                    setStats(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message || 'Failed to fetch stats');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [username]);

    return { stats, loading, error };
}

/**
 * Hook to fetch daily puzzle
 */
export function useDailyPuzzle() {
    const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPuzzle = async (random: boolean = false) => {
        setLoading(true);
        setError(null);

        try {
            const data = random
                ? await chessComAPI.getRandomPuzzle()
                : await chessComAPI.getDailyPuzzle();
            setPuzzle(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch puzzle');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPuzzle();
    }, []);

    return { puzzle, loading, error, refresh: () => fetchPuzzle(false), getRandom: () => fetchPuzzle(true) };
}

/**
 * Hook to fetch leaderboards
 */
export function useLeaderboards() {
    const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboards = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await chessComAPI.getLeaderboards();
            setLeaderboards(data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch leaderboards');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboards();
    }, []);

    return { leaderboards, loading, error, refresh: fetchLeaderboards };
}

/**
 * Hook to fetch recent games
 */
export function useRecentGames(username: string | null, limit: number = 10) {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!username) {
            setGames([]);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        chessComAPI.getRecentGames(username, limit)
            .then(data => {
                if (!cancelled) {
                    setGames(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setError(err.message || 'Failed to fetch games');
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [username, limit]);

    return { games, loading, error };
}

/**
 * Hook to check if player is online
 */
export function usePlayerOnlineStatus(username: string | null, pollingInterval: number = 60000) {
    const [isOnline, setIsOnline] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!username) {
            setIsOnline(false);
            return;
        }

        const checkStatus = async () => {
            try {
                const online = await chessComAPI.isPlayerOnline(username);
                setIsOnline(online);
                setLoading(false);
            } catch (err) {
                setIsOnline(false);
                setLoading(false);
            }
        };

        setLoading(true);
        checkStatus();

        const interval = setInterval(checkStatus, pollingInterval);

        return () => clearInterval(interval);
    }, [username, pollingInterval]);

    return { isOnline, loading };
}
