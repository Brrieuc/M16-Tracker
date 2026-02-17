'use client';

import { useState, useEffect } from 'react';
import {
    TournamentRank,
    TournamentInfo,
    MatchDetail,
    getTournamentRankings,
    getPlayerMatchDetails
} from '@/src/lib/fortnite-api';
import { refreshTournamentData } from '@/app/actions';

interface DashboardProps {
    initialRankings: TournamentRank[];
    availableTournaments: TournamentInfo[];
    initialEvent: TournamentInfo | null;
}

type SortField = 'rank' | 'points' | 'kills' | 'wins' | 'matches' | 'player';
type SortOrder = 'asc' | 'desc';

export default function Dashboard({ initialRankings, availableTournaments, initialEvent }: DashboardProps) {
    const [selectedEvent, setSelectedEvent] = useState<TournamentInfo | null>(initialEvent);
    const [rankings, setRankings] = useState<TournamentRank[]>(initialRankings);
    const [selectedPlayer, setSelectedPlayer] = useState<TournamentRank | null>(null);
    const [matchDetails, setMatchDetails] = useState<MatchDetail[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ field: SortField, order: SortOrder }>({ field: 'rank', order: 'asc' });

    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [spoilerDelay, setSpoilerDelay] = useState(0); // Minutes


    // Fetch new rankings when tournament changes
    useEffect(() => {
        if (selectedEvent && selectedEvent !== initialEvent) {
            setLoading(true);
            getTournamentRankings(selectedEvent.eventId, selectedEvent.eventWindowId)
                .then(newRankings => {
                    setRankings(newRankings);
                    setLastUpdated(new Date());
                    setLoading(false);
                });
        }
    }, [selectedEvent, initialEvent]);

    const handleRefresh = async () => {
        if (!selectedEvent) return;
        setIsRefreshing(true);
        try {
            await refreshTournamentData();
            const newRankings = await getTournamentRankings(selectedEvent.eventId, selectedEvent.eventWindowId);
            setRankings(newRankings);
            setLastUpdated(new Date());
        } catch (error) {
            console.error("Refresh failed", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handlePlayerClick = async (player: TournamentRank) => {
        if (!selectedEvent) return;
        setSelectedPlayer(player);
        setLoadingDetails(true);
        // Always fetch fresh details
        const details = await getPlayerMatchDetails(player);
        setMatchDetails(details);
        setLoadingDetails(false);
    };

    // Refresh inside modal
    const handlePlayerRefresh = async () => {
        if (!selectedPlayer) return;
        setLoadingDetails(true);
        const details = await getPlayerMatchDetails(selectedPlayer);
        setMatchDetails(details);
        setLoadingDetails(false);
    };

    // Sorting logic
    const handleSort = (field: SortField) => {
        setSortConfig(prev => ({
            field,
            order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
        }));
    };

    const sortedRankings = [...rankings].sort((a, b) => {
        const { field, order } = sortConfig;
        let valA = a[field as keyof TournamentRank] ?? 0;
        let valB = b[field as keyof TournamentRank] ?? 0;

        if (field === 'rank' && valA === 0) valA = 999999;
        if (field === 'rank' && valB === 0) valB = 999999;

        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredTournaments = availableTournaments.filter(t =>
        t.eventName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortConfig.field !== field) return <span className="opacity-20 ml-1">⇅</span>;
        return <span className="ml-1 text-[var(--m8-pink)]">{sortConfig.order === 'asc' ? '↑' : '↓'}</span>;
    };

    // Spoiler Logic
    const isSpoilerStats = (player: TournamentRank) => {
        if (spoilerDelay === 0) return false;
        // Check if latest match ended within delay window
        if (!player.sessionHistory || player.sessionHistory.length === 0) return false;

        // Find latest match time
        const latestMatch = player.sessionHistory.reduce((latest, current) => {
            const time = new Date(current.endTime).getTime();
            return time > latest ? time : latest;
        }, 0);

        const now = Date.now();
        const delayMs = spoilerDelay * 60 * 1000;

        return (now - latestMatch) < delayMs;
    };

    return (
        <div className="w-full max-w-6xl mx-auto z-10">
            {/* Tournament Selector & Search */}
            <div className="mb-12 flex flex-col items-center gap-6">
                <div className="flex flex-wrap gap-4 justify-center items-center backdrop-blur-md bg-white/5 p-4 rounded-2xl border border-white/5 shadow-xl">
                    <div className="flex items-center gap-3 px-4 py-2 bg-black/20 rounded-xl border border-white/5">
                        <span className="text-[var(--m8-pink)]">🔍</span>
                        <input
                            type="text"
                            placeholder="Chercher un tournoi..."
                            className="bg-transparent border-none outline-none text-xs font-bold uppercase tracking-wider w-40 md:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <select
                        className="bg-[var(--m8-grey)] text-[var(--m8-white)] px-4 py-2 rounded-xl border border-[var(--m8-white)]/10 focus:border-[var(--m8-pink)] outline-none transition-all uppercase text-xs font-bold min-w-[250px]"
                        value={selectedEvent?.eventId + ':' + selectedEvent?.eventWindowId || ''}
                        onChange={(e) => {
                            const [id, win] = e.target.value.split(':');
                            const found = availableTournaments.find(t => t.eventId === id && t.eventWindowId === win);
                            if (found) setSelectedEvent(found);
                        }}
                    >
                        {filteredTournaments.length > 0 ? filteredTournaments.map(t => (
                            <option key={t.eventId + t.eventWindowId} value={t.eventId + ':' + t.eventWindowId}>
                                [{t.displayDate || 'N/A'}] {t.eventName}
                            </option>
                        )) : <option disabled>Aucun tournoi trouvé</option>}
                    </select>

                    {/* Refresh Button */}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        className="bg-[var(--m8-grey)] hover:bg-[var(--m8-pink)] disabled:opacity-50 text-white p-2 rounded-xl border border-white/10 transition-colors group relative"
                        title="Actualiser le classement"
                    >
                        <span className={`block text-lg ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}>↻</span>
                    </button>

                    {/* Spoiler Delay Dropdown */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-black/20 rounded-xl border border-white/5 relative group">
                        <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Délai:</span>
                        <select
                            value={spoilerDelay}
                            onChange={(e) => setSpoilerDelay(Number(e.target.value))}
                            className="bg-transparent border-none outline-none text-xs font-bold text-[var(--m8-pink)] appearance-none cursor-pointer"
                        >
                            <option value={0}>Aucun</option>
                            <option value={1}>1 min</option>
                            <option value={2}>2 min</option>
                            <option value={3}>3 min</option>
                            <option value={5}>5 min</option>
                            <option value={10}>10 min</option>
                        </select>
                        <span className="text-[var(--m8-pink)] text-xs pointer-events-none">▼</span>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 text-white text-[9px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center">
                            Cache les scores si une game s'est terminée récemment pour éviter le spoil du stream.
                        </div>
                    </div>

                    {loading && <div className="w-5 h-5 border-2 border-[var(--m8-pink)] border-t-transparent rounded-full animate-spin"></div>}
                </div>

                {/* Last Update Info */}
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    <p className="text-[9px] uppercase tracking-[0.2em] font-bold opacity-30">
                        Dernière mise à jour: {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
            </div>

            {/* Main Leaderboard */}
            <div className="bg-[var(--m8-grey)]/40 backdrop-blur-xl border border-[var(--m8-white)]/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-500">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[var(--m8-white)]/5 text-[var(--m8-pink)] text-[10px] uppercase tracking-[0.2em] font-black">
                                <th className="py-6 px-8 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('rank')}>
                                    Rank <SortIcon field="rank" />
                                </th>
                                <th className="py-6 px-8 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('player')}>
                                    Gentle Mate <SortIcon field="player" />
                                </th>
                                <th className="py-6 px-8 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('points')}>
                                    Points <SortIcon field="points" />
                                </th>
                                <th className="py-6 px-8 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('kills')}>
                                    Kills <SortIcon field="kills" />
                                </th>
                                <th className="py-6 px-8 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('wins')}>
                                    Top 1 <SortIcon field="wins" />
                                </th>
                                <th className="py-6 px-8 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('matches')}>
                                    Matches <SortIcon field="matches" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--m8-white)]/5">
                            {sortedRankings.length > 0 ? sortedRankings.map((data) => {
                                const isHidden = isSpoilerStats(data);
                                return (
                                    <tr
                                        key={data.accountId}
                                        className="group hover:bg-[var(--m8-white)]/5 cursor-pointer transition-all duration-300"
                                        onClick={() => handlePlayerClick(data)}
                                    >
                                        <td className="py-8 px-8">
                                            <span className={`text-4xl font-black italic transition-all ${data.rank > 0 ? 'opacity-10 group-hover:opacity-100 group-hover:text-[var(--m8-pink)]' : 'opacity-5'}`}>
                                                {isHidden ? '??' : `#${data.rank || '--'}`}
                                            </span>
                                        </td>
                                        <td className="py-8 px-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--m8-pink)] to-purple-800 flex items-center justify-center font-black text-white shadow-lg border border-white/10 group-hover:scale-110 transition-transform">
                                                    {data.player[0]}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-xl group-hover:text-[var(--m8-pink)] transition-colors uppercase italic">{data.player}</p>
                                                        {isHidden && <span className="text-[8px] bg-red-500/20 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded uppercase font-black tracking-wider">Spoiler Prot.</span>}
                                                    </div>
                                                    <p className="text-[8px] opacity-40 uppercase tracking-widest font-black">Pro Player</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-8 px-8 text-right font-mono text-3xl font-black text-[var(--m8-white)] group-hover:text-[var(--m8-pink)] transition-colors">
                                            {isHidden ? <span className="blur-sm opacity-50">Locked</span> : data.points.toLocaleString()}
                                        </td>
                                        <td className={`py-8 px-8 text-right font-black text-lg ${(data.kills || 0) > 0 ? 'text-indigo-400' : 'opacity-20'}`}>
                                            {isHidden ? <span className="blur-sm">--</span> : (data.kills || 0)}
                                        </td>
                                        <td className={`py-8 px-8 text-right font-black text-lg ${data.wins > 0 ? 'text-green-400' : 'opacity-20'}`}>
                                            {isHidden ? <span className="blur-sm">--</span> : data.wins}
                                        </td>
                                        <td className="py-8 px-8 text-right opacity-40 font-bold">
                                            {isHidden ? <span className="blur-sm">--</span> : data.matches}
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr>
                                    <td colSpan={6} className="py-20 text-center">
                                        <p className="text-[var(--m8-pink)] font-black uppercase tracking-[0.3em] text-sm animate-pulse">
                                            Aucun joueur M8 trouvé dans le Top 300 de cette session
                                        </p>
                                        <p className="text-[var(--m8-white)] opacity-30 text-[10px] mt-2 uppercase font-bold">
                                            Les joueurs ne sont peut-être pas encore entrés dans le classement ou sont plus loin.
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Player Detail Modal */}
            {selectedPlayer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-[var(--m8-black)] border border-[var(--m8-pink)]/30 w-full max-w-5xl max-h-[90vh] rounded-[2rem] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(255,0,127,0.2)] border-b-8">
                        <div className="p-10 flex justify-between items-center bg-gradient-to-r from-[var(--m8-pink)]/20 via-transparent to-transparent relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--m8-pink)]/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                            <div>
                                <h2 className="text-5xl font-black italic text-[var(--m8-white)] mb-1 uppercase">
                                    {selectedPlayer.player} <span className="text-[var(--m8-pink)]">Stats</span>
                                </h2>
                                <p className="text-[10px] uppercase tracking-[0.4em] font-black opacity-40">
                                    {selectedEvent?.eventName} — {selectedEvent?.displayDate}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedPlayer(null)}
                                className="w-12 h-12 rounded-full bg-white/5 hover:bg-[var(--m8-pink)] flex items-center justify-center transition-all group z-10"
                            >
                                <span className="text-2xl group-hover:rotate-90 transition-transform">✕</span>
                            </button>
                        </div>

                        <div className="p-10 overflow-y-auto flex-1">
                            {isSpoilerStats(selectedPlayer) && (
                                <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-4">
                                    <span className="text-2xl">🙈</span>
                                    <div>
                                        <h4 className="text-red-400 font-bold uppercase tracking-wider text-sm">Mode Anti-Spoil Actif</h4>
                                        <p className="text-[10px] opacity-70">Les scores totaux sont cachés car une game vient de se terminer récemment (délai de {spoilerDelay} min). Les détails de cette game sont masqués ci-dessous.</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                                <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col items-center hover:bg-white/[0.08] transition-colors">
                                    <span className="text-[var(--m8-pink)] font-black text-5xl mb-2">
                                        {isSpoilerStats(selectedPlayer) ? '??' : `#${selectedPlayer.rank || '--'}`}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest font-black opacity-40 text-center">Rang Global</span>
                                </div>
                                <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col items-center hover:bg-white/[0.08] transition-colors">
                                    <span className="text-indigo-400 font-black text-5xl mb-2">
                                        {isSpoilerStats(selectedPlayer) ? '??' : (selectedPlayer.kills || 0)}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest font-black opacity-40">Total Kills</span>
                                </div>
                                <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col items-center hover:bg-white/[0.08] transition-colors">
                                    <span className="text-green-400 font-black text-5xl mb-2">
                                        {isSpoilerStats(selectedPlayer) ? '??' : selectedPlayer.wins}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest font-black opacity-40">Top 1</span>
                                </div>
                                <div className="bg-white/5 p-8 rounded-3xl border border-white/5 flex flex-col items-center hover:bg-white/[0.08] transition-colors">
                                    <span className="text-[var(--m8-white)] font-black text-5xl mb-2">
                                        {isSpoilerStats(selectedPlayer) ? '??' : selectedPlayer.points}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest font-black opacity-40">Points</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mb-8 justify-between">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-[var(--m8-pink)] font-black uppercase tracking-[0.3em] text-xs">Détails des parties</h3>
                                    <div className="h-[1px] w-20 bg-white/10"></div>
                                </div>
                                <button
                                    onClick={handlePlayerRefresh}
                                    disabled={loadingDetails}
                                    className="text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 hover:text-[var(--m8-pink)] transition-colors disabled:opacity-50"
                                >
                                    <span className={loadingDetails ? 'animate-spin' : ''}>↻</span> Actualiser
                                </button>
                            </div>

                            {loadingDetails ? (
                                <div className="py-20 flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-[var(--m8-pink)] border-t-transparent rounded-full animate-spin"></div>
                                    <span className="uppercase font-black tracking-widest text-[10px] opacity-40 text-center">Récupération des données serveurs...</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {matchDetails.length > 0 ? matchDetails
                                        .filter(match => {
                                            if (spoilerDelay === 0) return true;
                                            // If "match.time" is "N/A", we can't filter, show it? Or hide? 
                                            // Assume valid time format HH:MM:SS, wait match.time is only time string... 
                                            // Limitation: matchDetail only has time string, not full date. 
                                            // BUT we have `selectedPlayer.sessionHistory` which has full ISO dates.
                                            // We need to use `matchId` to link back to sessionHistory or pass raw sessionHistory to filter.
                                            // `matchDetails` is derived from `sessionHistory` in `fortnite-api.ts`.

                                            // HOTFIX: Filter based on sessionHistory directly in `getPlayerMatchDetails` OR
                                            // Since we are inside the component, we can check if this match corresponds to a hidden session.
                                            // But `match.time` format "19:35:42" is hard to compare with `Date.now()` precisely if day crosses.
                                            // Fortunately most tournaments are same day.

                                            // ACTUALLY: `matchDetails` is just a view model. 
                                            // We should just use the index if possible or trust the server or...
                                            // Let's rely on the fact that `matchDetails` are reversed (latest first).
                                            // If `isSpoilerStats(selectedPlayer)` is true, it means the *latest* match is spoiling.
                                            // So we should hide the FIRST element of `matchDetails` if it matches the spoiler condition.

                                            // Better approach: Re-implement filtering inside the map or before map.
                                            // We'll trust `isSpoilerStats` which uses `sessionHistory`.
                                            // If `isSpoilerStats` is True, we hide the top match? 
                                            // Not necessarily, maybe 2 matches ended in last 5 mins.

                                            // Let's look at `sessionHistory` on `selectedPlayer`.
                                            const matchingSession = selectedPlayer.sessionHistory?.find(s => (s.sessionId === match.matchId) || (`match-${selectedPlayer.sessionHistory?.indexOf(s)}` === match.matchId));
                                            if (!matchingSession) return true;

                                            const endTime = new Date(matchingSession.endTime).getTime();
                                            const now = Date.now();
                                            const delayMs = spoilerDelay * 60 * 1000;
                                            return (now - endTime) > delayMs;
                                        })
                                        .map((match, i) => (
                                            <div key={i} className="bg-white/5 p-6 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all border border-transparent hover:border-white/10">
                                                <div className="flex items-center gap-10">
                                                    <span className="text-2xl font-black italic opacity-20 group-hover:opacity-100 group-hover:text-[var(--m8-pink)] transition-all">G{matchDetails.length - i}</span>
                                                    <div className="w-20">
                                                        <p className="font-black text-3xl italic">#{match.placement}</p>
                                                        <p className="text-[8px] opacity-40 font-black uppercase tracking-widest">Position</p>
                                                    </div>
                                                    <div className="h-10 w-[1px] bg-white/10 hidden md:block"></div>
                                                    <div>
                                                        <p className="font-black text-xl text-indigo-400">{match.kills} KILLS</p>
                                                        <p className="text-[8px] opacity-40 font-black uppercase tracking-widest">Eliminations</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] opacity-40 font-black uppercase tracking-widest">{match.time}</p>
                                                    <div className={`mt-2 h-1 w-12 ml-auto rounded-full ${match.placement === 1 ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : match.placement <= 10 ? 'bg-[var(--m8-pink)]' : 'bg-white/20'}`}></div>
                                                </div>
                                            </div>
                                        )) : (
                                        <div className="py-20 text-center opacity-30 uppercase font-black tracking-[0.5em] text-xs">Aucune donnée de game trouvée pour cette session.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
