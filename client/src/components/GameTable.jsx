import { useEffect, useMemo, useState } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store/gameStore';
import { evaluateBestHand, formatCardLabel } from '../utils/handUtils';
import Card from './Card';
import Chip from './Chip';
import VaultAlarm from './VaultAlarm';
import GameLog from './GameLog';
import EmoteMenu from './EmoteMenu';
import RulesModal from './RulesModal';
import HandRankingsModal from './HandRankingsModal';

const PHASE_HINTS = {
  PRE_FLOP: 'Chọn chip trắng — số càng cao = bài càng mạnh',
  FLOP: 'Chọn chip vàng',
  TURN: 'Chọn chip cam',
  RIVER: 'Chọn chip đỏ — quyết định thứ tự Showdown',
};

export default function GameTable() {
  const {
    room,
    myId,
    myCards,
    showdownStep,
    gameOver,
    heistResult,
    selectedChip,
    setSelectedChip,
    emotes,
    reset,
  } = useGameStore();

  const [showRules, setShowRules] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [emoteTarget, setEmoteTarget] = useState(null);
  const [showMobileLog, setShowMobileLog] = useState(false);
  const [challengeVote, setChallengeVote] = useState({ cardRank: null, handRank: null });
  const [challengeLocked, setChallengeLocked] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const myVote = guessPhase?.myVote;
    if (!myVote) {
      setChallengeVote({ cardRank: null, handRank: null });
      setChallengeLocked(false);
      return;
    }

    setChallengeVote({
      cardRank: myVote.cardRank ?? null,
      handRank: myVote.handRank ?? null,
    });
    setChallengeLocked(Boolean(myVote.confirmed));
  }, [guessPhase]);

  if (!room) return null;

  const { players, communityCards, gameState, currentChipColor, availableChips, lockedChips } =
    room;
  const opponents = players.filter((p) => p.id !== myId);
  const me = players.find((p) => p.id === myId);
  const myChipValue = me?.chips?.[currentChipColor];
  const isChipPhase = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState);
  const isHost = room.hostId === myId;

  const guessPhase = room?.guessPhase;

  const myBestHand = useMemo(() => {
    if (!myCards?.length || !communityCards) return null;
    return evaluateBestHand(myCards, communityCards);
  }, [myCards, communityCards]);

  const submitChallengeVote = (confirm = false) => {
    if (!guessPhase || myId === guessPhase.targetPlayerId || challengeLocked) return;
    socket.emit('SUBMIT_GUESS', {
      cardRank: guessPhase.needRetina ? challengeVote.cardRank : null,
      handRank: guessPhase.needFingerprint ? challengeVote.handRank : null,
      confirm,
    });
    if (confirm) {
      setChallengeLocked(true);
    }
  };

  const resetChallengeChoice = () => {
    if (!guessPhase || challengeLocked) return;
    setChallengeVote({ cardRank: null, handRank: null });
    socket.emit('SUBMIT_GUESS', {
      cardRank: null,
      handRank: null,
      confirm: false,
    });
  };

  const handleChipClick = (value, targetPlayerId = null) => {
    if (!isChipPhase) return;

    if (selectedChip === value && !targetPlayerId) {
      setSelectedChip(null);
      return;
    }

    if (targetPlayerId) {
      socket.emit('SELECT_CHIP', { chipValue: value, targetPlayerId });
      setSelectedChip(null);
      return;
    }

    if (myChipValue != null && myChipValue !== value) {
      socket.emit('SELECT_CHIP', { chipValue: value });
      setSelectedChip(null);
      return;
    }

    if (myChipValue === value) {
      setSelectedChip(value);
      return;
    }

    socket.emit('SELECT_CHIP', { chipValue: value });
  };

  const handlePlayerChipClick = (player) => {
    if (!isChipPhase || !currentChipColor) return;
    const theirChip = player.chips[currentChipColor];
    if (theirChip == null) return;
    if (lockedChips?.includes(theirChip)) return;
    handleChipClick(theirChip, player.id);
  };

  const handleAdvanceShowdown = () => {
    socket.emit('ADVANCE_SHOWDOWN');
  };

  const handleNextHeist = () => {
    useGameStore.setState({ heistResult: null, showdownStep: null });
    socket.emit('NEXT_HEIST');
  };

  if (gameOver) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
          {gameOver.result === 'WIN' ? (
            <span className="text-emerald-400">🎉 Chiến thắng!</span>
          ) : (
            <span className="text-red-400">🚨 Thất bại!</span>
          )}
        </h2>
        <p className="text-white/60 mb-2">
          Vault: {gameOver.vault}/3 — Alarm: {gameOver.alarms}/3
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-6">
          Về menu
        </button>
      </div>
    );
  }

  return (
    <div className="game-shell flex-1 flex flex-col min-h-0 overflow-hidden px-2 pt-2 sm:px-4">
      {/* Top bar */}
      <div className="flex-shrink-0 px-2 pt-1 pb-2 space-y-3">
        <div className="glass-panel rounded-2xl border border-gold/20 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          <VaultAlarm
            vault={room.vault}
            alarms={room.alarms}
            heistNumber={room.heistNumber}
            phase={gameState}
          />
        </div>
        <div className="flex gap-2 justify-center">
          <button type="button" onClick={() => setShowRules(true)} className="btn-secondary text-xs px-3 py-1.5">
            ?
          </button>
          <button type="button" onClick={() => setShowRankings(true)} className="btn-secondary text-xs px-3 py-1.5">
            🃏
          </button>
          <button
            type="button"
            onClick={() => setShowMobileLog(!showMobileLog)}
            className="btn-secondary text-xs px-3 py-1.5 lg:hidden"
          >
            📋
          </button>
        </div>
      </div>

      {/* Main game area */}
      <div className="flex-1 flex min-h-0 pb-2 gap-3">
        <GameLog logs={room.gameLog} />

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Opponents - top area */}
          <div className="flex-shrink-0 flex flex-wrap justify-center gap-2 sm:gap-4 py-2 px-1">
            {opponents.map((p) => {
              const vote = room?.guessPhase?.playerVotes?.find((entry) => entry.id === p.id)?.vote;
              const voteBadge = vote?.confirmed
                ? `${vote.cardRank || vote.handRank || 'Locked'}`
                : vote
                  ? `${vote.cardRank || vote.handRank || 'Selected'}`
                  : null;

              return (
                <PlayerSlot
                  key={p.id}
                  player={{ ...p, voteBadge }}
                  currentChipColor={currentChipColor}
                  isChipPhase={isChipPhase}
                  onChipClick={() => handlePlayerChipClick(p)}
                  onEmote={() => setEmoteTarget(p.id)}
                  emote={emotes.find((e) => e.targetPlayerId === p.id || e.fromId === p.id)}
                  showCards={gameState === 'SHOWDOWN' && p.cards}
                />
              );
            })}
          </div>

          {/* Table center */}
          <div className="flex-1 felt-table mx-auto w-full max-w-2xl flex flex-col items-center justify-center p-3 sm:p-6 min-h-0 shadow-[0_25px_50px_rgba(0,0,0,0.28)]">
            {/* Community cards */}
            <div className="mb-4 sm:mb-6 rounded-2xl border border-gold/20 bg-black/20 px-3 py-2 shadow-inner shadow-black/20">
              <div className="flex gap-1.5 sm:gap-2 justify-center">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Card
                    key={i}
                    card={communityCards[i]}
                    faceDown={!communityCards[i]}
                    size="md"
                  />
                ))}
              </div>
            </div>

            {/* Chip pool */}
            {isChipPhase && (
              <div className="glass-panel rounded-2xl px-4 py-3 text-center space-y-2 shadow-[0_8px_20px_rgba(0,0,0,0.15)] border border-gold/10">
                <p className="text-[10px] uppercase tracking-[0.22em] text-gold/80">{PHASE_HINTS[gameState]}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {availableChips?.map((v) => (
                    <Chip
                      key={v}
                      value={v}
                      color={currentChipColor}
                      locked={lockedChips?.includes(v)}
                      selected={selectedChip === v}
                      onClick={() => handleChipClick(v)}
                    />
                  ))}
                </div>
                {myChipValue != null && (
                  <p className="text-xs text-gold/80">
                    Chip của bạn: {myChipValue} — chạm chip đối thủ để cướp
                  </p>
                )}
              </div>
            )}

            {/* Showdown */}
            {gameState === 'SHOWDOWN' && showdownStep && !showdownStep.done && (
              <div className="glass-panel rounded-2xl px-5 py-4 text-center space-y-3 animate-fade-in border border-gold/15">
                <p className="text-gold font-display text-xl tracking-wide">
                  {showdownStep.playerName} lật bài
                </p>
                <div className="flex justify-center gap-2">
                  {showdownStep.cards?.map((c, i) => (
                    <Card key={i} card={c} size="md" />
                  ))}
                </div>
                <p className="text-sm text-white/75">{showdownStep.hand?.name}</p>
                <button type="button" onClick={handleAdvanceShowdown} className="btn-primary text-sm">
                  Tiếp ({showdownStep.index + 1}/{showdownStep.total})
                </button>
              </div>
            )}

            {/* Heist result */}
            {gameState === 'HEIST_RESULT' && heistResult && (
              <div className="text-center space-y-4">
                <p className={`font-display text-2xl ${heistResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {heistResult.success ? '✓ Heist thành công!' : '✗ Heist thất bại!'}
                </p>

                {room.leaderboard?.length > 0 && (
                  <div className="glass-panel mx-auto max-w-xl rounded-2xl border border-gold/20 p-4 text-left">
                    <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-gold/80">Final leaderboard</p>
                    <div className="space-y-2">
                      {room.leaderboard.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                          <span className="text-white/80">#{entry.placement} {entry.name}</span>
                          <span className="text-gold">{entry.hand?.name || 'Unknown'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isHost && (
                  <button type="button" onClick={handleNextHeist} className="btn-primary">
                    Heist tiếp theo
                  </button>
                )}
                {!isHost && (
                  <p className="text-white/50 text-sm animate-pulse">Chờ host...</p>
                )}
              </div>
            )}

            {gameState === 'SHOWDOWN_GUESS' && guessPhase && myId !== guessPhase.targetPlayerId && (
              <div className="glass-panel mt-4 w-full max-w-xl rounded-2xl border border-gold/20 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
                <div className="mb-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gold/80">Challenge vote</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    Vote for {guessPhase.targetName}
                  </h3>
                  <p className="mt-2 text-xs text-white/60">
                    {Math.max(0, Math.ceil((guessPhase.expiresAt - now) / 1000))}s left
                  </p>
                </div>

                {guessPhase.needRetina && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Card rank</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {guessPhase.options.retina.map((rank) => {
                        const count = guessPhase.voteCounts?.retina?.[rank] || 0;
                        return (
                          <button
                            key={rank}
                            type="button"
                            onClick={() => {
                              if (challengeLocked) return;
                              setChallengeVote((prev) => ({ ...prev, cardRank: rank }));
                            }}
                            className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                              challengeVote.cardRank === rank
                                ? 'border-gold bg-gold/20 text-gold'
                                : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{rank}</span>
                              {count > 0 && <span className="rounded-full bg-gold/20 px-1.5 text-[10px] text-gold">{count}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {guessPhase.needFingerprint && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">Hand rank</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {guessPhase.options.fingerprint.map((rank) => {
                        const count = guessPhase.voteCounts?.fingerprint?.[rank] || 0;
                        return (
                          <button
                            key={rank}
                            type="button"
                            onClick={() => {
                              if (challengeLocked) return;
                              setChallengeVote((prev) => ({ ...prev, handRank: rank }));
                            }}
                            className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                              challengeVote.handRank === rank
                                ? 'border-gold bg-gold/20 text-gold'
                                : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{rank}</span>
                              {count > 0 && <span className="rounded-full bg-gold/20 px-1.5 text-[10px] text-gold">{count}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mb-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={resetChallengeChoice}
                    disabled={challengeLocked}
                    className="btn-secondary text-xs"
                  >
                    Change choice
                  </button>
                  <button
                    type="button"
                    onClick={() => submitChallengeVote(true)}
                    disabled={challengeLocked || (guessPhase.needRetina && !challengeVote.cardRank) || (guessPhase.needFingerprint && !challengeVote.handRank)}
                    className="btn-primary text-sm"
                  >
                    {challengeLocked ? 'Locked in' : 'Confirm choice'}
                  </button>
                </div>

                <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">Live vote board</p>
                  <div className="space-y-2">
                    {guessPhase.playerVotes?.map((entry) => {
                      const label = entry.vote
                        ? `${entry.vote.cardRank || entry.vote.handRank || 'Selected'}${entry.vote.confirmed ? ' • Locked' : ' • Draft'}`
                        : 'No vote yet';

                      return (
                        <div key={entry.id} className="flex items-center justify-between gap-3 text-xs text-white/75">
                          <span>{entry.name}</span>
                          <span className={`rounded-full px-2 py-0.5 ${entry.vote?.confirmed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gold/10 text-gold'}`}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {challengeVote.cardRank || challengeVote.handRank ? (
                  <div className="mt-2 text-center text-xs text-gold/90">
                    {challengeLocked ? 'Locked in:' : 'Current draft:'}{' '}
                    {guessPhase.needRetina && challengeVote.cardRank ? `Card ${challengeVote.cardRank}` : ''}
                    {guessPhase.needRetina && guessPhase.needFingerprint && challengeVote.cardRank && challengeVote.handRank ? ' · ' : ''}
                    {guessPhase.needFingerprint && challengeVote.handRank ? `Hand ${challengeVote.handRank}` : ''}
                  </div>
                ) : (
                  <div className="mt-2 text-center text-xs text-white/50">
                    Select an option, then confirm when ready.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hero - bottom */}
          <div className="flex-shrink-0 py-2 sm:py-3">
            <div className="flex items-end justify-center gap-3 sm:gap-4">
              <div className="flex gap-1.5 sm:gap-2 rounded-2xl border border-gold/15 bg-black/20 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                {myCards.map((c, i) => (
                  <Card key={i} card={c} size="lg" />
                ))}
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-black/20 px-2 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.15)]">
                <span className="text-sm font-medium text-gold">{me?.name} (bạn)</span>
                {currentChipColor && me?.chips?.[currentChipColor] != null && (
                  <Chip
                    value={me.chips[currentChipColor]}
                    color={currentChipColor}
                    small
                    onClick={() => setSelectedChip(me.chips[currentChipColor])}
                    selected={selectedChip === me.chips[currentChipColor]}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setEmoteTarget(myId)}
                  className="text-xs text-white/40 hover:text-white/70 mt-1"
                >
                  💬
                </button>
              </div>
            </div>

            {myBestHand && (
              <div className="glass-panel mt-3 mx-auto max-w-xl rounded-2xl p-3 text-left shadow-[0_15px_28px_rgba(0,0,0,0.18)] border border-gold/20">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-gold/80">Best hand</span>
                  <span className="text-sm font-semibold text-white">{myBestHand.name}</span>
                </div>

                <div className="mb-2 flex flex-wrap gap-2">
                  {myBestHand.combo?.map((card, index) => (
                    <Card key={`${card.rank}-${card.suit}-${index}`} card={card} size="sm" />
                  ))}
                </div>

                <p className="text-xs text-white/70">
                  {myBestHand.combo
                    ? `Combination: ${myBestHand.combo.map(formatCardLabel).join(' · ')}`
                    : 'Need 5 cards to evaluate a full hand'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile log overlay */}
      {showMobileLog && (
        <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden bg-felt-dark/95 border-t border-white/10 p-4 max-h-48 overflow-y-auto safe-bottom">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-white/50">Nhật ký</span>
            <button type="button" onClick={() => setShowMobileLog(false)} className="text-white/50">×</button>
          </div>
          {room.gameLog?.slice(-15).map((log, i) => (
            <p key={i} className="text-xs text-white/60">{log.message}</p>
          ))}
        </div>
      )}

      {/* Recent emotes */}
      <div className="fixed top-20 right-2 z-20 space-y-1 max-w-[200px] pointer-events-none">
        {emotes.slice(-3).map((e) => (
          <div key={e.id} className="bg-black/60 rounded-lg px-2 py-1 text-xs border border-white/10">
            <span className="text-gold">{e.fromName}:</span> {e.text}
          </div>
        ))}
      </div>

      {emoteTarget && (
        <EmoteMenu targetPlayerId={emoteTarget} onClose={() => setEmoteTarget(null)} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showRankings && <HandRankingsModal onClose={() => setShowRankings(false)} />}
    </div>
  );
}

function PlayerSlot({ player, currentChipColor, isChipPhase, onChipClick, onEmote, showCards }) {
  const chipVal = currentChipColor ? player.chips?.[currentChipColor] : null;

  return (
    <div className="player-slot glass-panel flex flex-col items-center gap-1 min-w-[72px] sm:min-w-[88px] rounded-2xl px-2 py-2 border border-white/10">
      <div className="flex gap-0.5">
        {showCards && player.cards ? (
          player.cards.map((c, i) => <Card key={i} card={c} size="sm" />)
        ) : (
          <>
            <Card faceDown size="sm" />
            <Card faceDown size="sm" />
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onEmote}
        className="text-xs sm:text-sm font-medium text-white/80 hover:text-gold truncate max-w-[80px] sm:max-w-[100px]"
      >
        {player.name}
      </button>
      {chipVal != null && (
        <Chip
          value={chipVal}
          color={currentChipColor}
          small
          onClick={isChipPhase ? onChipClick : undefined}
        />
      )}
      {player.voteBadge && (
        <div className="rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
          {player.voteBadge}
        </div>
      )}
      {/* Past chips */}
      <div className="flex gap-0.5">
        {['white', 'yellow', 'orange', 'red']
          .filter((c) => c !== currentChipColor && player.chips?.[c] != null)
          .map((c) => (
            <Chip key={c} value={player.chips[c]} color={c} small />
          ))}
      </div>
    </div>
  );
}
