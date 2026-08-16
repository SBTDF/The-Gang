import { useState } from 'react';
import { socket } from '../socket';
import { useGameStore } from '../store/gameStore';
import RulesModal from './RulesModal';
import HandRankingsModal from './HandRankingsModal';

export default function MainMenu() {
  const { playerName, setPlayerName, roomCode, setRoomCode, setScreen } = useGameStore();
  const [showRules, setShowRules] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [mode, setMode] = useState('create');

  const handleCreate = () => {
    if (!playerName.trim()) return;
    socket.emit('CREATE_ROOM', { playerName: playerName.trim() });
  };

  const handleJoin = () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    socket.emit('JOIN_ROOM', {
      playerName: playerName.trim(),
      roomCode: roomCode.trim().toUpperCase(),
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center space-y-2">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-gold tracking-tight">
            The Gang
          </h1>
          <p className="text-white/60 text-sm sm:text-base">
            Heist Poker — Phối hợp bằng chip, không nói bài
          </p>
        </header>

        <div className="space-y-4 bg-black/25 rounded-2xl p-5 sm:p-6 border border-white/10">
          <input
            type="text"
            placeholder="Tên của bạn"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="input-field !tracking-normal !normal-case !text-left"
            maxLength={16}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'create' ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-white/5 text-white/60'
              }`}
            >
              Tạo phòng
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'join' ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-white/5 text-white/60'
              }`}
            >
              Vào phòng
            </button>
          </div>

          {mode === 'join' && (
            <input
              type="text"
              placeholder="Mã phòng (ABCD)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="input-field"
              maxLength={4}
            />
          )}

          <button
            type="button"
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={!playerName.trim() || (mode === 'join' && roomCode.length < 4)}
            className="btn-primary w-full"
          >
            {mode === 'create' ? 'Tạo phòng mới' : 'Tham gia'}
          </button>
        </div>

        <div className="flex gap-3 justify-center">
          <button type="button" onClick={() => setShowRules(true)} className="btn-secondary text-sm">
            📜 Luật chơi
          </button>
          <button type="button" onClick={() => setShowRankings(true)} className="btn-secondary text-sm">
            🃏 Xếp hạng bài
          </button>
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showRankings && <HandRankingsModal onClose={() => setShowRankings(false)} />}
    </div>
  );
}
