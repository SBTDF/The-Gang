import { useState } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store/gameStore';
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

  if (!room) return null;

  const { players, communityCards, gameState, currentChipColor, availableChips, lockedChips } =
    room;
  const opponents = players.filter((p) => p.id !== myId);
  const me = players.find((p) => p.id === myId);
  const myChipValue = me?.chips?.[currentChipColor];
  const isChipPhase = ['PRE_FLOP', 'FLOP', 'TURN', 'RIVER'].includes(gameState);
  const isHost = room.hostId === myId;

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
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1 space-y-2">
        <VaultAlarm
          vault={room.vault}
          alarms={room.alarms}
          heistNumber={room.heistNumber}
          phase={gameState}
        />
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
      <div className="flex-1 flex min-h-0 px-2 sm:px-4 pb-2 gap-3">
        <GameLog logs={room.gameLog} />

        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Opponents - top area */}
          <div className="flex-shrink-0 flex flex-wrap justify-center gap-2 sm:gap-4 py-2">
            {opponents.map((p) => (
              <PlayerSlot
                key={p.id}
                player={p}
                currentChipColor={currentChipColor}
                isChipPhase={isChipPhase}
                onChipClick={() => handlePlayerChipClick(p)}
                onEmote={() => setEmoteTarget(p.id)}
                emote={emotes.find((e) => e.targetPlayerId === p.id || e.fromId === p.id)}
                showCards={gameState === 'SHOWDOWN' && p.cards}
              />
            ))}
          </div>

          {/* Table center */}
          <div className="flex-1 felt-table mx-auto w-full max-w-2xl flex flex-col items-center justify-center p-3 sm:p-6 min-h-0">
            {/* Community cards */}
            <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <Card
                  key={i}
                  card={communityCards[i]}
                  faceDown={!communityCards[i]}
                  size="md"
                />
              ))}
            </div>

            {/* Chip pool */}
            {isChipPhase && (
              <div className="text-center space-y-2">
                <p className="text-xs text-white/50">{PHASE_HINTS[gameState]}</p>
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
              <div className="text-center space-y-3 animate-fade-in">
                <p className="text-gold font-display text-lg">
                  {showdownStep.playerName} lật bài
                </p>
                <div className="flex justify-center gap-2">
                  {showdownStep.cards?.map((c, i) => (
                    <Card key={i} card={c} size="md" />
                  ))}
                </div>
                <p className="text-sm text-white/70">{showdownStep.hand?.name}</p>
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
          </div>

          {/* Hero - bottom */}
          <div className="flex-shrink-0 py-2 sm:py-3">
            <div className="flex items-end justify-center gap-3 sm:gap-4">
              <div className="flex gap-1.5 sm:gap-2">
                {myCards.map((c, i) => (
                  <Card key={i} card={c} size="lg" />
                ))}
              </div>
              <div className="flex flex-col items-center gap-1">
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
    <div className="flex flex-col items-center gap-1 min-w-[72px] sm:min-w-[88px]">
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
