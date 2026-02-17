import { getParticipatedTournaments, getTournamentRankings, TournamentRank } from '@/src/lib/fortnite-api';
import Dashboard from './components/Dashboard';

export default async function Home() {
  // Fetch only tournaments where M8 players participated
  const participatedEvents = await getParticipatedTournaments();

  // Pick the most recent tournament
  const defaultEvent = participatedEvents[0] || null;

  let initialRankings: TournamentRank[] = [];
  if (defaultEvent) {
    initialRankings = await getTournamentRankings(defaultEvent.eventId, defaultEvent.eventWindowId);
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)] relative overflow-hidden flex flex-col items-center py-12 px-6 font-sans">
      {/* Background Gradient Decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--m8-pink)]/20 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[var(--m8-purple)]/20 blur-[150px] rounded-full" />

      <header className="relative z-10 mb-12 text-center animate-in fade-in slide-in-from-top duration-1000 flex flex-col items-center">
        <div className="inline-block px-4 py-1.5 mb-8 border border-[var(--m8-pink)]/30 rounded-full bg-[var(--m8-pink)]/5 backdrop-blur-sm shadow-[0_0_15px_rgba(255,105,180,0.3)]">
          <span className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] uppercase text-[var(--m8-pink)] drop-shadow-[0_0_5px_rgba(255,105,180,0.8)]">
            <span className="w-2 h-2 rounded-full bg-[var(--m8-pink)] animate-pulse shadow-[0_0_10px_var(--m8-pink)]" />
            M8 Competitive History
          </span>
        </div>

        <div className="relative w-48 h-48 md:w-64 md:h-64 mb-6 hover:scale-105 transition-transform duration-500 ease-in-out">
          <div className="absolute inset-0 bg-[var(--m8-pink)]/30 blur-3xl rounded-full animate-pulse"></div>
          <img src="/m16-logo.png" alt="M16 Logo" className="relative w-full h-full object-contain drop-shadow-[0_0_25px_rgba(255,105,180,0.5)]" />
        </div>

        <h2 className="text-2xl md:text-3xl font-black tracking-[0.5em] mb-4 italic text-transparent bg-clip-text bg-gradient-to-r from-[var(--m8-white)] to-[var(--m8-pink)] opacity-80">
          TRACKER
        </h2>

        <p className="text-[var(--m8-white)] opacity-60 text-sm md:text-base max-w-lg mx-auto font-light tracking-wide">
          Suivi exclusif des performances de <span className="text-[var(--m8-pink)] font-bold drop-shadow-[0_0_8px_rgba(255,105,180,0.6)]">Gentle Mates</span>.
        </p>
      </header>

      <Dashboard
        initialRankings={initialRankings}
        availableTournaments={participatedEvents}
        initialEvent={defaultEvent}
      />

      <footer className="relative z-10 mt-16 text-center text-[10px] uppercase tracking-[0.3em] font-bold opacity-30">
        <p>M8 Esport Analytics System</p>
        <p className="mt-2 text-[8px] opacity-50">Data verified from Epic Games via api-fortnite.com</p>
      </footer>
    </main>
  );
}
