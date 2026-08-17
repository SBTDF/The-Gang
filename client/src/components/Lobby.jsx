import { useState } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store/gameStore';
import RulesModal from './RulesModal';
import { GAME_MODES, IMPOSTER_CHALLENGES } from '../imposterMode';

const CHALLENGES = [
  {
    id: 'quickAccess',
    name: 'Quick Access',
    desc: 'Skip the White Chip (Pre-Flop) round — the game starts at the Flop with Yellow Chips active.',
  },
  {
    id: 'noiseSensor',
    name: 'Noise Sensor',
    desc: 'Once a player picks the 1-star chip, it auto-confirms and locks in place: it cannot be returned or taken back by any means.',
  },
  {
    id: 'motionDetector',
    name: 'Motion Detector',
    desc: 'If any Flop card is a Face Card (J, Q, K) the player holding the "1-star" White Chip must discard their hand and draw 2 new cards.',
  },
  {
    id: 'retinaScan',
    name: 'Retina Scan',
    desc: 'Before the highest Red Chip player reveals, the other players must guess a specific card value in that player\'s hand. A wrong guess fails the Heist.',
  },
  {
    id: 'hastyGetaway',
    name: 'Hasty Getaway',
    desc: 'Skip the Orange Chip (Turn) round — go straight to revealing the River and Red Chips.',
  },
  {
    id: 'silentAlarm',
    name: 'Signal Interference',
    desc: 'One card in the Flop is hidden from the center table for everyone, but it still counts toward the best hand and only reveals during the final hand reveal.',
  },
  {
    id: 'laserTripwires',
    name: 'Laser Tripwires',
    desc: 'If NO Flop card is a Face Card: the player holding the highest White Chip must discard their hand and draw 2 new cards (Flop evaluation).',
  },
  {
    id: 'blackout',
    name: 'Blackout',
    desc: 'At the beginning of the next round (e.g., moving from Flop to Turn), clear all chips from the previous round so history is hidden.',
  },
  {
    id: 'fingerprintScan',
    name: 'Fingerprint Scan',
    desc: 'Before the highest Red Chip player reveals, the other players must guess the exact hand ranking (e.g., "Flush"). A wrong guess fails the Heist.',
  },
  {
    id: 'securityCamera',
    name: 'Security Camera',
    desc: 'All players receive 3 pocket cards instead of 2 — hand evaluation uses the best 5 of the available cards.',
  },
];

// Incompatibility map: when adding a challenge, it cannot be active together with any listed ids.
const INCOMPAT = {
  quickAccess: ['laserTripwires'], // Quick Access skips the White Chip round; Laser Tripwires depends on White Chip logic
  laserTripwires: ['quickAccess'],
};

export default function Lobby() {
  const { room, roomCode, myId, playerName, reset, setError } = useGameStore();
  const [showRules, setShowRules] = useState(false);
  const challenges = room?.challenges || [];
  const gameMode = room?.gameMode || GAME_MODES.CLASSIC;
  const challengeCatalog = gameMode === GAME_MODES.IMPOSTER ? IMPOSTER_CHALLENGES : CHALLENGES;

  const isHost = room?.hostId === myId;
  const players = room?.players || [];
  const canStart = players.length >= 3 && isHost;

  const findName = (id) => challengeCatalog.find((c) => c.id === id)?.name || id;

  const handleModeChange = (nextMode) => {
    if (!isHost || nextMode === gameMode) return;
    socket.emit('SET_GAME_MODE', { gameMode: nextMode });
  };

  const toggleChallenge = (id) => {
    // remove
    if (challenges.includes(id)) {
      const next = challenges.filter((c) => c !== id);
      socket.emit('SET_CHALLENGES', { challenges: next });
      return;
    }

    // adding: check incompatibilities
    for (const sel of challenges) {
      if ((INCOMPAT[id] && INCOMPAT[id].includes(sel)) || (INCOMPAT[sel] && INCOMPAT[sel].includes(id))) {
        setError(`${findName(id)} conflicts with ${findName(sel)} and cannot be enabled together.`);
        return;
      }
    }

    const next = [...challenges, id];
    socket.emit('SET_CHALLENGES', { challenges: next });
  };

  const handleStart = () => {
    socket.emit('START_GAME');
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
      <div className="max-w-lg mx-auto w-full space-y-6">
        <header className="text-center">
          <p className="text-white/50 text-sm">Mã phòng</p>
          <h2 className="font-display text-4xl font-bold text-gold tracking-[0.3em]">{roomCode}</h2>
          <p className="text-white/40 text-xs mt-1">Chia sẻ mã này cho bạn bè</p>
        </header>

        <div className="bg-black/25 rounded-2xl p-4 border border-white/10">
          <h3 className="text-sm font-semibold text-white/70 mb-3">
            Người chơi ({players.length}/6)
          </h3>
          <ul className="space-y-2">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5"
              >
                <span className={p.id === myId ? 'text-gold font-medium' : ''}>
                  {p.name} {p.id === myId && '(bạn)'}
                </span>
                {p.isHost && <span className="text-xs text-gold/70">Host</span>}
              </li>
            ))}
          </ul>
          {players.length < 3 && (
            <p className="text-amber-400/80 text-xs mt-3 text-center">
              Cần ít nhất 3 người để bắt đầu
            </p>
          )}
        </div>

        <div className="bg-black/25 rounded-2xl p-4 border border-white/10">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Thử thách (tùy chọn)</h3>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Game mode</div>
                  <div className="mt-1 text-sm text-white/80">
                    {gameMode === GAME_MODES.IMPOSTER ? 'Imposter Mode' : 'Classic Mode'}
                  </div>
                </div>
                {isHost ? (
                  <select
                    value={gameMode}
                    onChange={(event) => handleModeChange(event.target.value)}
                    className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value={GAME_MODES.CLASSIC}>Classic</option>
                    <option value={GAME_MODES.IMPOSTER}>Imposter</option>
                  </select>
                ) : (
                  <span className="text-xs text-white/45">Host selects</span>
                )}
              </div>
              {gameMode === GAME_MODES.IMPOSTER && (
                <p className="mt-2 text-xs leading-snug text-amber-200/70">
                  One hidden Imposter tries to sabotage the Crew. These challenges progress independently during the heist.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {challengeCatalog.map((c) => {
                const selected = challenges.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => isHost && toggleChallenge(c.id)}
                    disabled={!isHost}
                    aria-pressed={selected}
                    className={`challenge-card w-full text-left p-3 hover:scale-[1.01] transition-transform ${selected ? 'border-gold/60 ring-1 ring-gold/20 bg-gold/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{c.name}</div>
                        <div className={`mt-1 text-[10px] font-bold tracking-wide ${selected ? 'text-emerald-300' : 'text-white/40'}`}>
                          {selected ? 'ACTIVE' : 'DISABLED'}
                        </div>
                        <p className="text-[13px] text-white/75 mt-2 leading-snug">{c.desc}</p>
                        {gameMode === GAME_MODES.IMPOSTER && (
                          <div className="mt-2 space-y-1 text-[11px] leading-snug">
                            <div className="text-red-200/75">Imposter buff: {c.imposterBuff}</div>
                            <div className="text-emerald-200/75">Crew buff: {c.crewBuff}</div>
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${selected ? 'bg-gold text-felt-dark' : 'bg-white/5 text-white/40'}`}>
                          {selected ? '✓' : '+'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
        </div>

        <div className="flex flex-col gap-3">
          {isHost && (
            <button type="button" onClick={handleStart} disabled={!canStart} className="btn-primary w-full">
              Bắt đầu Heist
            </button>
          )}
          {!isHost && (
            <p className="text-center text-white/50 text-sm animate-pulse">
              Đang chờ host bắt đầu...
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowRules(true)} className="btn-secondary flex-1 text-sm">
              Luật chơi
            </button>
            <button type="button" onClick={reset} className="btn-secondary flex-1 text-sm">
              Rời phòng
            </button>
          </div>
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
