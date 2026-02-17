'use server';

import { ROSTER } from '@/src/config/roster';

const API_BASE_URL = 'https://prod.api-fortnite.com/api';

export interface TournamentRank {
    player: string;
    rank: number;
    points: number;
    matches: number;
    wins: number;
    kd: number;
    kills?: number;
    damage?: number;
    tournamentName?: string;
    isLive: boolean;
    accountId: string;
    sessionHistory?: any[];
}

export interface MatchDetail {
    matchId: string;
    points: number;
    kills: number;
    placement: number;
    time: string;
}

export interface TournamentInfo {
    eventId: string;
    eventWindowId: string;
    eventName: string;
    date?: string;
    displayDate?: string;
}

function isRelevantTournament(eventId: string): boolean {
    const e = eventId.toLowerCase();
    if (!e.includes('_eu')) return false;

    const isMajor = /fncs|victorycup|cashcup|soloseries|elite|champion|cup/i.test(e);
    if (!isMajor) return false;

    const isExcluded = /mobile|ranked|stranger|android|ios|blitz|playstation/i.test(e);
    return !isExcluded;
}

export async function getParticipatedTournaments(): Promise<TournamentInfo[]> {
    const apiKey = process.env.FORTNITE_API_KEY;
    if (!apiKey) return getMockTournaments();

    try {
        const [pastRes, currRes] = await Promise.all([
            fetch(`${API_BASE_URL}/v1/events/data/past`, { headers: { 'x-api-key': apiKey }, next: { revalidate: 3600 } }),
            fetch(`${API_BASE_URL}/v1/events/data/current`, { headers: { 'x-api-key': apiKey }, next: { revalidate: 300 } })
        ]);

        const pastData = pastRes.ok ? await pastRes.json() : { events: [] };
        const currData = currRes.ok ? await currRes.json() : { events: [] };

        const allRawEvents = [...(pastData.events || []), ...(currData.events || [])];
        const uniqueWindows = new Map<string, TournamentInfo>();
        const now = new Date();

        allRawEvents.forEach((event: any) => {
            if (!isRelevantTournament(event.eventId)) return;

            const windows = event.eventWindows || [];
            const windowMap = new Map(windows.map((w: any) => [w.eventWindowId, w]));

            windows.forEach((window: any) => {
                const beginTime = new Date(window.beginTime);
                if (beginTime > now) return;

                // Add standard window
                const key = `${event.eventId}:${window.eventWindowId}`;
                if (!uniqueWindows.has(key)) {
                    uniqueWindows.set(key, {
                        eventId: event.eventId,
                        eventWindowId: window.eventWindowId,
                        eventName: formatEventName(event.eventId, window),
                        date: window.beginTime,
                        displayDate: beginTime.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    });
                }
            });

            // Synthetic Cumulative Windows
            // FNCS Div 1: WeekXDay1 + WeekXDay2 -> WeekX Cumulative
            const fncsWeekMatch = event.eventId.match(/FNCSDivisionalCup_Division1_EU/);
            if (fncsWeekMatch) {
                const weeks = new Set<string>();
                windows.forEach((w: any) => {
                    const weekMatch = w.eventWindowId.match(/Week(\d+)/);
                    if (weekMatch) weeks.add(weekMatch[1]);
                });

                weeks.forEach(week => {
                    const day1 = windows.find((w: any) => w.eventWindowId.includes(`Week${week}Day1`));
                    const day2 = windows.find((w: any) => w.eventWindowId.includes(`Week${week}Day2`));

                    if (day1 && day2 && new Date(day2.beginTime) <= now) {
                        const cumKey = `${event.eventId}:${event.eventId}_Week${week}_Cumulative`;
                        if (!uniqueWindows.has(cumKey)) {
                            uniqueWindows.set(cumKey, {
                                eventId: event.eventId,
                                eventWindowId: `${event.eventId}_Week${week}_Cumulative`,
                                eventName: `FNCS Div 1 - Semaine ${week} (Cumulé)`,
                                date: day2.beginTime, // Use latest date
                                displayDate: new Date(day2.beginTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            });
                        }
                    }
                });
            }

            // Elite Series: PlayInDay1 + PlayInDay2 -> Cumulative
            if (event.eventId.includes('EliteSeries')) {
                // Play-Ins Cumulative
                if (event.eventId.includes('PlayIn')) {
                    const day1 = windows.find((w: any) => w.eventWindowId.includes('PlayInDay1'));
                    const day2 = windows.find((w: any) => w.eventWindowId.includes('PlayInDay2'));

                    if (day1 && day2 && new Date(day2.beginTime) <= now) {
                        const cumKey = `${event.eventId}:${event.eventId}_PlayIn_Cumulative`;
                        if (!uniqueWindows.has(cumKey)) {
                            uniqueWindows.set(cumKey, {
                                eventId: event.eventId,
                                eventWindowId: `${event.eventId}_PlayIn_Cumulative`,
                                eventName: `Elite Series - Qualification Intermédiaire (Cumulé)`,
                                date: day2.beginTime,
                                displayDate: new Date(day2.beginTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            });
                        }
                    }
                }

                // Opens Cumulative (Open1 + Open2)
                const open1 = windows.find((w: any) => w.eventWindowId.includes('Open1'));
                const open2 = windows.find((w: any) => w.eventWindowId.includes('Open2'));

                if (open1 && open2 && new Date(open2.beginTime) <= now) {
                    const cumKey = `${event.eventId}:${event.eventId}_Opens_Cumulative`;
                    if (!uniqueWindows.has(cumKey)) {
                        uniqueWindows.set(cumKey, {
                            eventId: event.eventId,
                            eventWindowId: `${event.eventId}_Opens_Cumulative`,
                            eventName: `Elite Series - Tournoi Ouvert (Cumulé)`,
                            date: open2.beginTime,
                            displayDate: new Date(open2.beginTime).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        });
                    }
                }
            }
        });

        return Array.from(uniqueWindows.values()).sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        }).slice(0, 50);

    } catch (error) {
        return getMockTournaments();
    }
}

export async function getTournamentRankings(eventId: string, eventWindowId: string): Promise<TournamentRank[]> {
    const apiKey = process.env.FORTNITE_API_KEY;
    if (!apiKey) return [];

    try {
        // Check for Cumulative Request
        if (eventWindowId.endsWith('_Cumulative')) {
            return getCumulativeRankings(eventId, eventWindowId, apiKey);
        }

        // Standard Fetch
        return fetchRankingsForWindow(eventId, eventWindowId, apiKey);
    } catch (error) {
        return [];
    }
}

async function fetchRankingsForWindow(eventId: string, eventWindowId: string, apiKey: string): Promise<TournamentRank[]> {
    const rankingsMap = new Map<string, TournamentRank>();
    // Top 5000 requires 50 pages (0-49)
    const totalPages = 50;
    const batchSize = 10;
    const pages = Array.from({ length: totalPages }, (_, i) => i);

    // Process in batches to avoid rate limits but speed up fetching
    for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const promises = batch.map(page =>
            fetch(
                `${API_BASE_URL}/v1/events/leaderboard?eventId=${eventId}&eventWindowId=${eventWindowId}&page=${page}`,
                {
                    headers: { 'x-api-key': apiKey },
                    next: { revalidate: 300, tags: ['rankings'] } // Cache for 5 minutes but allow tagging
                }
            ).then(res => res.ok ? res.json() : { entries: [] })
                .catch(() => ({ entries: [] }))
        );

        const results = await Promise.all(promises);

        results.forEach(lbData => {
            const entries = Array.isArray(lbData) ? lbData : (lbData.entries || []);
            entries.forEach((entry: any) => {
                const teamAccountIds = entry.teamAccountIds || [];
                const teamDisplayNames = entry.teamAccountDisplayNames || [];

                const rosterPlayer = ROSTER.find(p =>
                    teamAccountIds.includes(p.id) ||
                    teamDisplayNames.some((dn: string) => dn.toLowerCase().includes(p.username.toLowerCase()))
                );

                if (rosterPlayer && !rankingsMap.has(rosterPlayer.id)) {
                    const breakdown = entry.pointBreakdown || {};
                    let killsCount = 0;
                    Object.keys(breakdown).forEach(key => {
                        if (key.includes('ELIMS') || key.includes('KILLS') || key.includes('TEAM_ELIMS')) {
                            killsCount += (breakdown[key].timesAchieved || 0);
                        }
                    });

                    rankingsMap.set(rosterPlayer.id, {
                        player: rosterPlayer.name,
                        accountId: rosterPlayer.id,
                        rank: entry.rank || 0,
                        points: entry.pointsEarned || 0,
                        matches: entry.sessionHistory?.length || 0,
                        wins: (entry.sessionHistory || []).filter((s: any) =>
                            s.trackedStats?.VICTORY_ROYALE_STAT > 0 || s.trackedStats?.PLACEMENT_STAT_INDEX === 1
                        ).length || 0,
                        kd: entry.kd || 0,
                        kills: killsCount,
                        damage: entry.damageDealt || 0,
                        isLive: true,
                        sessionHistory: entry.sessionHistory || []
                    });
                    if (entry.sessionHistory && entry.sessionHistory.length > 0) {
                        console.log('DEBUG_SESSION_HISTORY_ITEM:', JSON.stringify(entry.sessionHistory[0], null, 2));
                    }
                }
            });
        });

        // Optional: Break early if all roster players found? 
        // We removed this to ensure we get the latest data if they are playing simultaneously, 
        // but if speed is critical we could re-enable:
        if (rankingsMap.size === ROSTER.length) break;
    }

    return Array.from(rankingsMap.values()).sort((a, b) => a.rank - b.rank);
}

async function getCumulativeRankings(eventId: string, syntheticWindowId: string, apiKey: string): Promise<TournamentRank[]> {
    // Determine constituent windows
    let windowIds: string[] = [];

    // FNCS Week Cumulative
    if (syntheticWindowId.includes('Week')) {
        const weekMatch = syntheticWindowId.match(/Week(\d+)/);
        if (weekMatch) {
            const week = weekMatch[1];
            // We need to find the specific eventWindowIds for Day 1 and Day 2
            // Since we don't store them in the synthetic ID, we reconstruct by pattern matching known conventions
            // OR simpler: we assume standard naming pattern if consistent
            // Fetch event data to get exact window IDs
            const eventRes = await fetch(`${API_BASE_URL}/v1/events/data/past`, { headers: { 'x-api-key': apiKey }, next: { revalidate: 3600 } });
            const eventData = await eventRes.json();
            const event = eventData.events.find((e: any) => e.eventId === eventId);
            if (event) {
                const day1 = event.eventWindows.find((w: any) => w.eventWindowId.includes(`Week${week}Day1`));
                const day2 = event.eventWindows.find((w: any) => w.eventWindowId.includes(`Week${week}Day2`));
                if (day1) windowIds.push(day1.eventWindowId);
                if (day2) windowIds.push(day2.eventWindowId);
            }
        }
    }
    // Elite Series PlayIn Cumulative
    else if (syntheticWindowId.includes('PlayIn')) {
        const eventRes = await fetch(`${API_BASE_URL}/v1/events/data/past`, { headers: { 'x-api-key': apiKey }, next: { revalidate: 3600 } });
        const eventData = await eventRes.json();
        const event = eventData.events.find((e: any) => e.eventId === eventId);
        if (event) {
            const day1 = event.eventWindows.find((w: any) => w.eventWindowId.includes('PlayInDay1'));
            const day2 = event.eventWindows.find((w: any) => w.eventWindowId.includes('PlayInDay2'));
            if (day1) windowIds.push(day1.eventWindowId);
            if (day2) windowIds.push(day2.eventWindowId);
        }
    }
    // Elite Series Opens Cumulative (Open1 + Open2)
    else if (syntheticWindowId.includes('Opens')) {
        const eventRes = await fetch(`${API_BASE_URL}/v1/events/data/past`, { headers: { 'x-api-key': apiKey }, next: { revalidate: 3600 } });
        const eventData = await eventRes.json();
        const event = eventData.events.find((e: any) => e.eventId === eventId);
        if (event) {
            const open1 = event.eventWindows.find((w: any) => w.eventWindowId.includes('Open1'));
            const open2 = event.eventWindows.find((w: any) => w.eventWindowId.includes('Open2'));
            if (open1) windowIds.push(open1.eventWindowId);
            if (open2) windowIds.push(open2.eventWindowId);
        }
    }

    if (windowIds.length === 0) return [];

    // Fetch both leaderboards
    const [stats1, stats2] = await Promise.all(
        windowIds.map(wid => fetchRankingsForWindow(eventId, wid, apiKey))
    );

    // Merge Logic
    const mergedMap = new Map<string, TournamentRank>();

    // Process first results
    stats1.forEach(stat => mergedMap.set(stat.accountId, stat));

    // Merge second results
    stats2.forEach(stat => {
        const existing = mergedMap.get(stat.accountId);
        if (existing) {
            existing.points += stat.points;
            existing.kills = (existing.kills || 0) + (stat.kills || 0);
            existing.wins += stat.wins;
            existing.matches += stat.matches;
            existing.sessionHistory = [...(existing.sessionHistory || []), ...(stat.sessionHistory || [])];
        } else {
            mergedMap.set(stat.accountId, stat);
        }
    });

    return Array.from(mergedMap.values()).sort((a, b) => b.points - a.points).map((r, index) => ({
        ...r,
        rank: index + 1 // Recalculate rank based on total points
    }));
}


function formatEventName(eventId: string, window: any): string {
    let name = eventId.replace('epicgames_', '').replace('Fortnite:', '');
    const parts = name.split('_');

    let baseName = "";
    if (name.includes('FNCS')) {
        const divMatch = name.match(/Division(\d+)/);
        const div = divMatch ? `Div ${divMatch[1]}` : "";
        baseName = `FNCS ${div}`.trim();
    } else if (name.includes('SoloVictoryCup')) {
        baseName = "Solo Victory Cup";
    } else if (name.includes('DuosVictoryCup')) {
        baseName = "Duos Victory Cup";
    } else if (name.includes('CashCup')) {
        baseName = "Cash Cup";
    } else if (name.includes('SoloSeries')) {
        baseName = "Solo Victory Cup";
    } else if (name.includes('EliteSeries')) {
        baseName = "Elite Series";
    } else {
        baseName = name.split('_').filter(p => !['EU', 'S39', 'S38', 'S37', 'Day1', 'Day2'].includes(p)).join(' ');
    }

    // Elite Series Logic
    if (name.includes('EliteSeries')) {
        if (window.eventWindowId.includes('Open')) {
            if (window.eventWindowId.includes('Open1')) return `Elite Series - Tournoi Ouvert (Session 1)`;
            if (window.eventWindowId.includes('Open2')) return `Elite Series - Tournoi Ouvert (Session 2)`;
            return `Elite Series - Tournoi Ouvert`;
        }
        if (window.eventWindowId.includes('PlayIn')) {
            if (window.eventWindowId.includes('Day1')) return `Elite Series - Qualification Intermédiaire (Session 1)`;
            if (window.eventWindowId.includes('Day2')) return `Elite Series - Qualification Intermédiaire (Session 2)`;
            return `Elite Series - Qualification Intermédiaire`;
        }
        if (window.eventWindowId.includes('Heat')) {
            const hMatch = window.eventWindowId.match(/Heat(\d+)/);
            return `Elite Series - Série ${hMatch ? hMatch[1] : ''}`;
        }
        if (window.eventWindowId.includes('Final')) return `Elite Series - Finale`;
    }

    // FNCS Logic
    if (name.includes('FNCS')) {
        if (window.eventWindowId.includes('Week')) {
            const wMatch = window.eventWindowId.match(/Week(\d+)/);
            const week = wMatch ? wMatch[1] : '?';

            if (window.eventWindowId.includes('Day1')) return `FNCS Div 1 - Semaine ${week} (Session 1)`;
            if (window.eventWindowId.includes('Day2')) return `FNCS Div 1 - Semaine ${week} (Session 2)`;
            if (window.eventWindowId.includes('Final')) return `FNCS Div 1 - Finale Hebdomadaire ${week}`;
        }
    }

    // Fallback for others
    if (window.eventWindowId.includes('Week')) {
        const wMatch = window.eventWindowId.match(/Week(\d+)/);
        if (wMatch) baseName += ` W${wMatch[1]}`;
    } else if (window.eventWindowId.includes('Qualifier')) {
        const qMatch = window.eventWindowId.match(/Qualifier(\d+)/);
        if (qMatch) baseName += ` Q${qMatch[1]}`;
    }

    if (window.eventWindowId.includes('Final')) {
        baseName += " Finals";
    } else if (window.eventWindowId.includes('Day1')) {
        baseName += " Day 1";
    } else if (window.eventWindowId.includes('Day2')) {
        baseName += " Day 2";
    } else if (window.round && window.round > 1) {
        baseName += ` Round ${window.round}`;
    } else {
        const rMatch = window.eventWindowId.match(/Round(\d+)/);
        if (rMatch) baseName += ` Rd ${rMatch[1]}`;
    }

    return baseName.trim();
}

export async function getPlayerMatchDetails(playerData: TournamentRank): Promise<MatchDetail[]> {
    if (!playerData.sessionHistory) return [];

    return playerData.sessionHistory.map((m: any, i: number) => {
        const stats = m.trackedStats || {};
        return {
            matchId: m.sessionId || `match-${i}`,
            points: 0,
            kills: stats.TEAM_ELIMS_STAT_INDEX || stats.ELIMS || stats.KILLS || 0,
            placement: stats.PLACEMENT_STAT_INDEX || 0,
            time: m.endTime ? new Date(m.endTime).toLocaleTimeString('fr-FR') : 'N/A'
        };
    }).reverse();
}

function getMockTournaments(): TournamentInfo[] {
    return [
        { eventId: '1', eventWindowId: '1', eventName: 'FNCS Finals', displayDate: '25/02/2026', date: '2026-02-25' }
    ];
}
