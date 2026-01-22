/**
 * Chess.com Public API Service
 * 
 * Read-only REST API integration for:
 * - Player profiles and stats
 * - Game archives and live games
 * - Daily puzzles
 * - Leaderboards
 * - Tournaments
 * 
 * API Docs: https://www.chess.com/news/view/published-data-api
 */

import axios, { AxiosInstance } from 'axios';

const CHESS_COM_API_BASE = 'https://api.chess.com/pub';

export interface ChessComPlayer {
    '@id': string;
    url: string;
    username: string;
    player_id: number;
    title?: string;
    status: string;
    name?: string;
    avatar?: string;
    location?: string;
    country: string;
    joined: number;
    last_online: number;
    followers: number;
    is_streamer: boolean;
    twitch_url?: string;
    fide?: number;
}

export interface PlayerStats {
    chess_daily?: GameTypeStats;
    chess_rapid?: GameTypeStats;
    chess_blitz?: GameTypeStats;
    chess_bullet?: GameTypeStats;
    tactics?: TacticsStats;
    lessons?: LessonsStats;
    puzzle_rush?: PuzzleRushStats;
}

export interface GameTypeStats {
    last: {
        date: number;
        rating: number;
        rd: number;
    };
    best?: {
        date: number;
        rating: number;
        game: string;
    };
    record: {
        win: number;
        loss: number;
        draw: number;
        time_per_move?: number;
        timeout_percent?: number;
    };
    tournament?: {
        count: number;
        withdraw: number;
        points: number;
        highest_finish: number;
    };
}

export interface TacticsStats {
    highest: { rating: number; date: number };
    lowest: { rating: number; date: number };
}

export interface LessonsStats {
    highest: { rating: number; date: number };
    lowest: { rating: number; date: number };
}

export interface PuzzleRushStats {
    daily: { total_attempts: number; score: number };
    best: { total_attempts: number; score: number };
}

export interface DailyPuzzle {
    title: string;
    url: string;
    publish_time: number;
    fen: string;
    pgn: string;
    image: string;
}

export interface LeaderboardEntry {
    player_id: number;
    '@id': string;
    url: string;
    username: string;
    score: number;
    rank: number;
}

export interface Leaderboards {
    daily: LeaderboardEntry[];
    daily960: LeaderboardEntry[];
    live_rapid: LeaderboardEntry[];
    live_blitz: LeaderboardEntry[];
    live_bullet: LeaderboardEntry[];
    tactics: LeaderboardEntry[];
    lessons: LeaderboardEntry[];
}

export interface Game {
    url: string;
    pgn: string;
    time_control: string;
    end_time: number;
    rated: boolean;
    fen: string;
    time_class: string;
    rules: string;
    white: {
        rating: number;
        result: string;
        '@id': string;
        username: string;
    };
    black: {
        rating: number;
        result: string;
        '@id': string;
        username: string;
    };
    accuracies?: {
        white: number;
        black: number;
    };
    eco?: string;
}

class ChessComAPIService {
    private api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: CHESS_COM_API_BASE,
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'SolanaChessApp/1.0 (Contact: your@email.com)', // Replace with your contact
            },
        });
    }

    /**
     * Get player profile
     * @param username Chess.com username
     */
    async getPlayerProfile(username: string): Promise<ChessComPlayer> {
        const response = await this.api.get(`/player/${username}`);
        return response.data;
    }

    /**
     * Get player statistics
     * @param username Chess.com username
     */
    async getPlayerStats(username: string): Promise<PlayerStats> {
        const response = await this.api.get(`/player/${username}/stats`);
        return response.data;
    }

    /**
     * Check if player is online
     * @param username Chess.com username
     */
    async isPlayerOnline(username: string): Promise<boolean> {
        const response = await this.api.get(`/player/${username}/is-online`);
        return response.data.online;
    }

    /**
     * Get player's current daily games
     * @param username Chess.com username
     */
    async getCurrentGames(username: string): Promise<{ games: Game[] }> {
        const response = await this.api.get(`/player/${username}/games`);
        return response.data;
    }

    /**
     * Get player's games to move (daily games where it's their turn)
     * @param username Chess.com username
     */
    async getToMoveGames(username: string): Promise<{ games: any[] }> {
        const response = await this.api.get(`/player/${username}/games/to-move`);
        return response.data;
    }

    /**
     * Get list of monthly archives for a player
     * @param username Chess.com username
     */
    async getGameArchives(username: string): Promise<{ archives: string[] }> {
        const response = await this.api.get(`/player/${username}/games/archives`);
        return response.data;
    }

    /**
     * Get games from a specific month
     * @param username Chess.com username
     * @param year 4-digit year
     * @param month 2-digit month (01-12)
     */
    async getMonthlyGames(username: string, year: number, month: number): Promise<{ games: Game[] }> {
        const monthStr = month.toString().padStart(2, '0');
        const response = await this.api.get(`/player/${username}/games/${year}/${monthStr}`);
        return response.data;
    }

    /**
     * Get today's daily puzzle
     */
    async getDailyPuzzle(): Promise<DailyPuzzle> {
        const response = await this.api.get('/puzzle');
        return response.data;
    }

    /**
     * Get a random daily puzzle
     */
    async getRandomPuzzle(): Promise<DailyPuzzle> {
        const response = await this.api.get('/puzzle/random');
        return response.data;
    }

    /**
     * Get leaderboards (top 50 players in various categories)
     */
    async getLeaderboards(): Promise<Leaderboards> {
        const response = await this.api.get('/leaderboards');
        return response.data;
    }

    /**
     * Get titled players (GM, IM, FM, etc.)
     * @param title Title abbreviation: GM, WGM, IM, WIM, FM, WFM, NM, WNM, CM, WCM
     */
    async getTitledPlayers(title: string): Promise<{ players: string[] }> {
        const response = await this.api.get(`/titled/${title}`);
        return response.data;
    }

    /**
     * Get streamers
     */
    async getStreamers(): Promise<{ streamers: any[] }> {
        const response = await this.api.get('/streamers');
        return response.data;
    }

    /**
     * Get country profile
     * @param iso ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB')
     */
    async getCountry(iso: string): Promise<any> {
        const response = await this.api.get(`/country/${iso}`);
        return response.data;
    }

    /**
     * Get players from a country
     * @param iso ISO 3166-1 alpha-2 country code
     */
    async getCountryPlayers(iso: string): Promise<{ players: string[] }> {
        const response = await this.api.get(`/country/${iso}/players`);
        return response.data;
    }

    /**
     * Helper: Get recent games for a player
     * Fetches games from the most recent archive
     */
    async getRecentGames(username: string, limit: number = 10): Promise<Game[]> {
        try {
            const archives = await this.getGameArchives(username);
            if (archives.archives.length === 0) return [];

            // Get the most recent archive
            const latestArchive = archives.archives[archives.archives.length - 1];
            const parts = latestArchive.split('/');
            const year = parseInt(parts[parts.length - 2]);
            const month = parseInt(parts[parts.length - 1]);

            const monthlyGames = await this.getMonthlyGames(username, year, month);
            return monthlyGames.games.slice(-limit).reverse(); // Get last N games, most recent first
        } catch (error) {
            console.error('[ChessComAPI] Error fetching recent games:', error);
            return [];
        }
    }

    /**
     * Helper: Calculate win rate from stats
     */
    calculateWinRate(stats: GameTypeStats | undefined): number {
        if (!stats?.record) return 0;
        const { win, loss, draw } = stats.record;
        const total = win + loss + draw;
        if (total === 0) return 0;
        return Math.round((win / total) * 100);
    }
}

// Export singleton instance
export const chessComAPI = new ChessComAPIService();

// Export class for custom instances
export default ChessComAPIService;
