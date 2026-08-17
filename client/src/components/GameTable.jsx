import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store/gameStore';
import { evaluateBestHand, formatCardLabel, getHighlightCardKeys } from '../utils/handUtils';
import Card from './Card';
import Chip from './Chip';
import VaultAlarm from './VaultAlarm';
import GameLog from './GameLog';
import EmoteMenu from './EmoteMenu';
import RulesModal from './RulesModal';
import HandRankingsModal from './HandRankingsModal';
import ImposterPanel from './ImposterPanel';

const PHASE_HINTS = {
  PRE_FLOP: 'Chọn chip trắng — số càng cao = bài càng mạnh',
  FLOP: 'Chọn chip vàng',
  TURN: 'Chọn chip cam',
  RIVER: 'Chọn chip đỏ — quyết định thứ tự Showdown',
};

const EMOTE_BUBBLE_CLASS = 'pointer-events-none absolute left-full top-1/2 z-30 ml-2 w-max max-w-[min(70vw,260px)] -translate-y-1/2 rounded-full border border-yellow-300/80 bg-[#fef3c7]/95 px-3 py-1.5 text-sm font-semibold leading-tight text-slate-900 shadow-[0_10px_18px_rgba(0,0,0,0.32)] animate-pulse transition-opacity duration-200';
const OPPONENT_EMOTE_BUBBLE_CLASS = 'pointer-events-none fixed z-[100] w-max max-w-[min(70vw,260px)] rounded-full border border-yellow-300/80 bg-[#fef3c7]/95 px-3 py-1.5 text-sm font-semibold leading-tight text-slate-900 shadow-[0_10px_18px_rgba(0,0,0,0.32)] animate-pulse';

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
    myRole,
    privateChallengeState,
    falseTrailAdvice,
    sabotageClue,
  } = useGameStore();

  const [showRules, setShowRules] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [emoteTarget, setEmoteTarget] = useState(null);
  const [showMobileLog, setShowMobileLog] = useState(false);
  const [tradeTarget, setTradeTarget] = useState(null);
  const [challengeVote, setChallengeVote] = useState({ cardRank: null, handRank: null });
  const [challengeLocked, setChallengeLocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [selectedChipColor, setSelectedChipColor] = useState(null);

  if (!room) return null;

  const { players, communityCards, gameState, currentChipColor, availableChips, lockedChips } = room;
  const guessPhase = room?.guessPhase;
  const localRoundChoice = selectedChipColor === currentChipColor ? selectedChip : null;
  const myRoundChoice = room.roundSelections?.[myId] ?? localRoundChoice ?? null;
  const myConfirmed = !!room.roundConfirmed?.[myId];
  const confirmedCount = Object.values(room.roundConfirmed || {}).filter(Boolean).length;
  const tradePlayers = room.tradeOffer ? new Set([room.tradeOffer.fromPlayerId, room.tradeOffer.toPlayerId]) : new Set();
  const tradeNotice = room.tradeOffer
    ? `${players.find((p) => p.id === room.tradeOffer.fromPlayerId)?.name ?? 'Player'} is initiating a trade with ${players.find((p) => p.id === room.tradeOffer.toPlayerId)?.name ?? 'player'}`
    : null;

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

  useEffect(() => {
    setSelectedChip(null);
    setSelectedChipColor(null);
  }, [currentChipColor, setSelectedChip]);

  const opponents = players.filter((p) => p.id !== myId);
  const me = players.find((p) => p.id === myId);
  const myChipValue = me?.chips?.[currentChipColor];
  const isChipPhase = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState);
  const isHost = room.hostId === myId;

  const myBestHand = useMemo(() => {
    if (!myCards?.length || !communityCards) return null;
    return evaluateBestHand(myCards, communityCards);
  }, [myCards, communityCards]);

  const myHighlightKeys = useMemo(() => getHighlightCardKeys(myBestHand), [myBestHand]);
  const currentSelfChip = isChipPhase ? (myRoundChoice ?? me?.chips?.[currentChipColor] ?? null) : (me?.chips?.[currentChipColor] ?? null);
  const selfPastChips = ['white', 'yellow', 'orange', 'red'].filter((chipColor) => chipColor !== currentChipColor && me?.chips?.[chipColor] != null);
  const myEmote = emotes.filter((e) => ((e.fromId === myId || e.targetPlayerId === myId) && (e.expiresAt ?? 0) > now)).at(-1) ?? null;
  const tradeTimeLeftMs = room.tradeOffer && room.tradeOffer.expiresAt ? Math.max(0, room.tradeOffer.expiresAt - now) : 0;
  const getEmoteForPlayer = (playerId) => emotes.filter((e) => ((e.fromId === playerId || e.targetPlayerId === playerId) && (e.expiresAt ?? 0) > now)).at(-1) ?? null;

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
    if (!isChipPhase || myConfirmed) return;

    if (selectedChip === value && !targetPlayerId) {
      setSelectedChip(null);
      setSelectedChipColor(null);
      return;
    }

    if (targetPlayerId) {
      socket.emit('SELECT_CHIP', { chipValue: value, targetPlayerId });
      setSelectedChip(null);
      setSelectedChipColor(null);
      return;
    }

    setSelectedChip(value);
    setSelectedChipColor(currentChipColor);
    socket.emit('SELECT_CHIP', { chipValue: value });
  };

  const handleReturnChip = () => {
    if (!isChipPhase || myConfirmed || myRoundChoice == null) return;
    setSelectedChip(null);
    setSelectedChipColor(null);
    socket.emit('RETURN_CHIP');
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

  const handleConfirmRoundChoice = () => {
    if (!isChipPhase) return;
    socket.emit('CONFIRM_CHIP_SELECTION', { chipValue: myRoundChoice });
  };

  const handleSelfChipClick = () => {
    setSelectedChip(currentSelfChip);
    setSelectedChipColor(currentChipColor);
  };

  const handleReturnToLobby = () => {
    socket.emit('RETURN_TO_LOBBY');
  };

  const handleRequestTrade = (targetPlayerId) => {
    if (!isChipPhase || !currentChipColor || myConfirmed) return;
    if (room.tradeOffer && (room.tradeOffer.fromPlayerId === myId || room.tradeOffer.toPlayerId === myId)) return;
    if (room.tradeOffer && (room.tradeOffer.fromPlayerId === targetPlayerId || room.tradeOffer.toPlayerId === targetPlayerId)) return;
    const myChoice = myRoundChoice;
    const targetChoice = room.roundSelections?.[targetPlayerId] ?? null;
    if (myChoice == null || targetChoice == null) return;
    socket.emit('REQUEST_TRADE', {
      targetPlayerId,
      fromChipValue: myChoice,
      toChipValue: targetChoice,
    });
  };

  const handleTradeResponse = (accept) => {
    socket.emit('RESPOND_TRADE', { accept });
  };

  const handleNextHeist = () => {
    useGameStore.setState({ heistResult: null, showdownStep: null, falseTrailAdvice: null, sabotageClue: null });
    socket.emit('NEXT_HEIST');
  };

  if (gameOver) {
    const revealedImposter = gameOver.imposterPlayerId
      ? players.find((player) => player.id === gameOver.imposterPlayerId)
      : null;
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
        {gameOver.gameMode === 'IMPOSTER' && revealedImposter && (
          <p className="text-red-200/80">
            The Imposter was <span className="font-semibold text-red-200">{revealedImposter.name}</span>.
          </p>
        )}
        <button type="button" onClick={handleReturnToLobby} disabled={!isHost} className="btn-primary mt-6">
          Return to lobby
        </button>
      </div>
    );
  }

  return (
    <div className="game-shell flex flex-col px-2 pt-2 sm:px-4 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
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

      <ImposterPanel
        room={room}
        myId={myId}
        myRole={myRole}
        privateChallengeState={privateChallengeState}
        falseTrailAdvice={falseTrailAdvice}
        sabotageClue={sabotageClue}
      />

      {/* Main game area */}
      <div className="flex flex-col gap-3 pb-2 lg:flex-row lg:flex-1 lg:min-h-0">
        <GameLog logs={room.gameLog} />

        <div className="flex min-w-0 flex-col lg:flex-1 lg:min-h-0">
          {/* Opponents - top area */}
          <div className="flex flex-shrink-0 flex-wrap justify-center gap-2 px-1 py-2 sm:gap-4">
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
                  onTrade={() => setTradeTarget(p.id)}
                  emote={getEmoteForPlayer(p.id)}
                  showCards={gameState === 'SHOWDOWN' && p.cards}
                  roundSelections={room.roundSelections}
                  roundConfirmed={room.roundConfirmed}
                  tradeDisabled={tradePlayers.has(p.id) || (room.tradeOffer && (room.tradeOffer.fromPlayerId === p.id || room.tradeOffer.toPlayerId === p.id))}
                  now={now}
                />
              );
            })}
          </div>

          {/* Table center */}
          <div className="felt-table mx-auto flex w-full max-w-2xl min-w-0 flex-none flex-col items-center justify-center p-2 shadow-[0_25px_50px_rgba(0,0,0,0.28)] sm:p-6 lg:flex-1 lg:min-h-0">
            {/* Community cards */}
            <div className="mb-3 max-w-full rounded-2xl border border-gold/20 bg-black/20 px-2 py-2 shadow-inner shadow-black/20 sm:mb-6 sm:px-3">
              <div className="flex justify-center gap-1 sm:gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Card
                    key={i}
                    card={communityCards[i]}
                    faceDown={!communityCards[i] || !!communityCards[i]?.hidden}
                    size="md"
                  />
                ))}
              </div>
            </div>

            {/* Chip pool */}
            {isChipPhase && (
              <div className="glass-panel w-full max-w-full rounded-2xl border border-gold/10 px-3 py-3 text-center shadow-[0_8px_20px_rgba(0,0,0,0.15)] space-y-2 sm:px-4">
                <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-gold/80 sm:tracking-[0.22em]">{PHASE_HINTS[gameState]}</p>
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
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button type="button" onClick={handleReturnChip} className="btn-secondary text-xs" disabled={myConfirmed || myRoundChoice == null}>
                    Return to center
                  </button>
                  <button type="button" onClick={handleConfirmRoundChoice} className="btn-primary text-xs" disabled={!myRoundChoice || myConfirmed}>
                    {myConfirmed ? 'Locked in' : 'Confirm choice'}
                  </button>
                </div>
                <p className="text-xs text-gold/80">
                  Confirmed: {confirmedCount}/{players.length}
                </p>
                {myRoundChoice != null && (
                  <p className="text-xs text-gold/80">
                    Chip of you: {myRoundChoice} — use Trade button to propose a swap instead of stealing.
                  </p>
                )}
              </div>
            )}

            {/* Showdown */}
            {gameState === 'SHOWDOWN' && showdownStep && !showdownStep.done && (
              <div className="glass-panel rounded-2xl border border-gold/15 px-3 py-4 text-center shadow-sm space-y-3 sm:px-5">
                <p className="text-gold font-display text-xl tracking-wide">
                  {showdownStep.playerName} lật bài
                </p>
                <div className="flex flex-wrap justify-center gap-2">
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

                <button type="button" onClick={handleNextHeist} className="btn-primary">
                  Heist tiếp theo
                </button>
                {isHost && (
                  <button type="button" onClick={handleReturnToLobby} className="btn-secondary">
                    Return to lobby
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
                            className={`rounded-lg border px-3 py-2 text-sm transition-all ${challengeVote.cardRank === rank
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
                            className={`rounded-lg border px-3 py-2 text-sm transition-all ${challengeVote.handRank === rank
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

                <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
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
            <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
              <div className="flex gap-1.5 sm:gap-2 rounded-2xl border border-gold/15 bg-black/20 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                {myCards.map((c, i) => (
                  <Card key={i} card={c} size="lg" />
                ))}
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-black/20 px-2 py-2 shadow-[0_8px_18px_rgba(0,0,0,0.15)] relative">
                <div className="relative flex flex-col items-center">
                  <span className="text-sm font-medium text-gold">{me?.name} (bạn)</span>
                  {myEmote && (
                    <div className={EMOTE_BUBBLE_CLASS}>
                      {myEmote.text}
                    </div>
                  )}
                </div>
                {currentSelfChip != null && (
                  <Chip
                    value={currentSelfChip}
                    color={currentChipColor}
                    small
                    onClick={handleSelfChipClick}
                    selected={selectedChip === currentSelfChip}
                  />
                )}
                {selfPastChips.length > 0 && (
                  <div className="flex gap-0.5">
                    {selfPastChips.map((chipColor) => (
                      <Chip key={`${me?.id ?? 'me'}-${chipColor}`} value={me.chips[chipColor]} color={chipColor} small />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {myBestHand && (
              <div className="glass-panel mx-auto mt-3 w-full max-w-xl rounded-2xl border border-gold/20 p-3 text-left shadow-[0_15px_28px_rgba(0,0,0,0.18)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-gold/80">Best hand</span>
                    <button
                      type="button"
                      onClick={() => setEmoteTarget(myId)}
                      className="text-xs text-white/50 hover:text-white/80"
                      aria-label="Send emote"
                    >
                      💬
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-white">{myBestHand.name}</span>
                </div>

                <div className="mb-2 flex flex-wrap gap-2">
                  {myBestHand.combo?.map((card, index) => (
                    <Card
                      key={`${card.rank}-${card.suit}-${index}`}
                      card={card}
                      faceDown={!!card?.hidden}
                      size="sm"
                      highlight={myHighlightKeys.includes(`${card.rank}-${card.suit}`)}
                    />
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

      {room.leaderboard?.length > 0 && (
        <div className="relative z-10 mx-auto mt-3 w-full max-w-xl rounded-2xl border border-gold/20 bg-black/60 p-3 shadow-[0_16px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm lg:fixed lg:right-4 lg:top-20 lg:mx-0 lg:mt-0 lg:w-[300px] lg:max-w-[calc(100vw-2rem)] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-gold/80">Final Ranking</p>
          <div className="space-y-2">
            {room.leaderboard.map((entry) => {
              const highlightKeys = getHighlightCardKeys(entry.hand);
              const chipStrength = entry.chipValue === 1
                ? 'Weakest'
                : entry.chipValue === players.length
                  ? 'Strongest'
                  : 'Middle';
              return (
                <div key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                    <span className="min-w-0 flex-1 break-words text-white/80">
                      Chip {entry.chipValue ?? '—'} ({chipStrength}) · {entry.name}
                    </span>
                    <span className="max-w-[45%] shrink-0 text-right text-gold">{entry.hand?.name || 'Unknown'}</span>
                  </div>
                  <p className="mb-1 text-[10px] text-white/50">
                    {entry.tied ? `Tied hand #${entry.handPlacement}` : `Hand rank #${entry.handPlacement}`}
                  </p>
                  {(entry.hand?.combo || []).length > 0 && (
                    <div className="flex gap-1.5">
                      {(entry.hand.combo || []).map((card, idx) => (
                        <Card
                          key={`${entry.id}-${idx}-${card.rank}-${card.suit}`}
                          card={card}
                          faceDown={!!card?.hidden}
                          size="sm"
                          highlight={highlightKeys.includes(`${card.rank}-${card.suit}`)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tradeNotice && (
        <div className="fixed top-20 left-1/2 z-30 -translate-x-1/2 rounded-full border border-gold/30 bg-black/60 px-3 py-1.5 text-xs text-gold shadow-[0_8px_22px_rgba(0,0,0,0.25)]">
          {tradeNotice}
        </div>
      )}

      {room.tradeOffer && (myId === room.tradeOffer.fromPlayerId || myId === room.tradeOffer.toPlayerId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-gold/20 p-5 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gold/80">Trade request</p>
            <h3 className="mt-3 text-xl font-semibold text-white">
              {room.tradeOffer.fromPlayerId === myId ? 'Waiting for reply' : `${players.find((p) => p.id === room.tradeOffer.fromPlayerId)?.name ?? 'A player'} wants to trade`}
            </h3>
            <p className="mt-3 text-sm text-white/75">
              {room.tradeOffer.fromPlayerId === myId ? 'You offered to trade your chip' : 'Offer: trade chip '}{' '}
              <span className="font-bold text-gold">{room.tradeOffer.fromChipValue}</span>
              {' '}for{' '}
              <span className="font-bold text-gold">{room.tradeOffer.toChipValue}</span>
            </p>
            <p className="mt-2 text-xs text-white/50">
              {Math.ceil((tradeTimeLeftMs ?? 0) / 1000)}s left
            </p>
            {room.tradeOffer.toPlayerId === myId && (
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={() => handleTradeResponse(false)} className="btn-secondary text-xs">Deny</button>
                <button type="button" onClick={() => handleTradeResponse(true)} className="btn-primary text-xs">Accept</button>
              </div>
            )}
            {room.tradeOffer.fromPlayerId === myId && (
              <div className="mt-4 flex justify-center">
                <span className="text-xs text-white/50">Waiting for {players.find((p) => p.id === room.tradeOffer.toPlayerId)?.name ?? 'opponent'} to respond</span>
              </div>
            )}
          </div>
        </div>
      )}

      {tradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-gold/20 p-5 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gold/80">Propose trade</p>
            <h3 className="mt-3 text-xl font-semibold text-white">Trade with {players.find((p) => p.id === tradeTarget)?.name}</h3>
            <p className="mt-3 text-sm text-white/70">
              You offer chip <span className="font-bold text-gold">{selectedChip ?? me?.chips?.[currentChipColor] ?? '—'}</span>
              {' '}for their chip <span className="font-bold text-gold">{players.find((p) => p.id === tradeTarget)?.chips?.[currentChipColor] ?? '—'}</span>
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => setTradeTarget(null)} className="btn-secondary text-xs">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  handleRequestTrade(tradeTarget);
                  setTradeTarget(null);
                }}
                className="btn-primary text-xs"
              >
                Send request
              </button>
            </div>
          </div>
        </div>
      )}

      {emoteTarget && (
        <EmoteMenu targetPlayerId={emoteTarget} onClose={() => setEmoteTarget(null)} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showRankings && <HandRankingsModal onClose={() => setShowRankings(false)} />}
    </div>
  );
}

function PlayerSlot({
  player,
  currentChipColor,
  isChipPhase,
  onChipClick,
  onEmote,
  onTrade,
  showCards,
  roundSelections,
  roundConfirmed,
  tradeDisabled,
  emote,
  now,
}) {
  const slotRef = useRef(null);
  const chipVal = isChipPhase ? roundSelections?.[player.id] ?? player.chips?.[currentChipColor] ?? null : player.chips?.[currentChipColor] ?? null;
  const isConfirmed = !!roundConfirmed?.[player.id];
  const emoteAge = emote ? (now - (emote.createdAt ?? Date.now())) : 0;
  const emoteOpacity = emote ? Math.max(0, 1 - emoteAge / 1500) : 0;

  return (
    <div ref={slotRef} className="player-slot glass-panel relative flex min-w-0 flex-col items-center gap-1 overflow-visible rounded-2xl border border-white/10 px-1.5 py-2 sm:min-w-[88px] sm:px-2">
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
      {emote && (
        <OpponentEmoteBubble anchorRef={slotRef} emote={emote} opacity={emoteOpacity} />
      )}
      <button
        type="button"
        onClick={onEmote}
        className="text-xs sm:text-sm font-medium text-white/80 hover:text-gold truncate max-w-[80px] sm:max-w-[100px]"
      >
        {player.name}
      </button>
      {chipVal != null && (
        <div className="flex flex-col items-center gap-1">
          <Chip
            value={chipVal}
            color={currentChipColor}
            small
            onClick={isChipPhase ? onChipClick : undefined}
          />
          {isChipPhase && isConfirmed && (
            <div className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-300">
              Confirmed
            </div>
          )}
        </div>
      )}
      {player.voteBadge && (
        <div className="rounded-full border border-gold/50 bg-gold/10 px-2 py-0.5 text-[10px] text-gold">
          {player.voteBadge}
        </div>
      )}
      {isChipPhase && onTrade && (
        <button
          type="button"
          onClick={tradeDisabled ? undefined : onTrade}
          disabled={tradeDisabled}
          className={`px-2 py-1 text-[10px] rounded-lg border ${tradeDisabled ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed' : 'btn-secondary'}`}
        >
          {tradeDisabled ? 'Trading' : 'Trade'}
        </button>
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

function OpponentEmoteBubble({ anchorRef, emote, opacity }) {
  const bubbleRef = useRef(null);
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    let frame = null;

    const updatePosition = () => {
      if (!anchorRef.current || !bubbleRef.current) return;

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const bubbleRect = bubbleRef.current.getBoundingClientRect();
      const gap = 8;
      const viewportPadding = 8;
      const rightPosition = anchorRect.right + gap;
      const leftPosition = anchorRect.left - bubbleRect.width - gap;

      let left = rightPosition;
      if (rightPosition + bubbleRect.width > window.innerWidth - viewportPadding && leftPosition >= viewportPadding) {
        left = leftPosition;
      }

      left = Math.max(
        viewportPadding,
        Math.min(left, window.innerWidth - bubbleRect.width - viewportPadding)
      );

      const centeredTop = anchorRect.top + (anchorRect.height - bubbleRect.height) / 2;
      const top = Math.max(
        viewportPadding,
        Math.min(centeredTop, window.innerHeight - bubbleRect.height - viewportPadding)
      );

      setPosition({ left, top });
    };

    const schedulePositionUpdate = () => {
      if (frame != null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };

    schedulePositionUpdate();
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedulePositionUpdate) : null;
    if (resizeObserver && anchorRef.current) resizeObserver.observe(anchorRef.current);

    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedulePositionUpdate);
      window.removeEventListener('scroll', schedulePositionUpdate, true);
      resizeObserver?.disconnect();
    };
  }, [anchorRef, emote.id, emote.createdAt, emote.text]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={bubbleRef}
      className={OPPONENT_EMOTE_BUBBLE_CLASS}
      style={{
        left: position ? `${position.left}px` : '0px',
        top: position ? `${position.top}px` : '0px',
        opacity,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {emote.text}
    </div>,
    document.body
  );
}
