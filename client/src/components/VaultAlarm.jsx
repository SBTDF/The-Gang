const PHASE_LABELS = {
  PRE_FLOP: 'Pre-Flop — Chip Trắng',
  FLOP: 'Flop — Chip Vàng',
  TURN: 'Turn — Chip Cam',
  RIVER: 'River — Chip Đỏ',
  SHOWDOWN: 'Showdown',
  HEIST_RESULT: 'Kết quả Heist',
  GAME_OVER: 'Kết thúc',
};

export default function VaultAlarm({ vault, alarms, heistNumber, phase }) {
  return (
    <div className="flex items-center justify-between gap-1 px-2 py-2 sm:gap-2 sm:px-3 bg-black/30 rounded-xl border border-white/10">
      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        <span className="text-[10px] sm:text-xs text-white/50">Vault</span>
        <div className="flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-5 h-7 sm:w-6 sm:h-8 rounded-sm border ${
                i <= vault
                  ? 'bg-emerald-600 border-emerald-400'
                  : 'bg-white/5 border-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="text-center min-w-0 flex-1 px-1 sm:px-2">
        <p className="text-[10px] sm:text-xs text-gold/80 font-medium truncate">
          Heist #{heistNumber}
        </p>
        <p className="text-[10px] sm:text-xs text-white/50 truncate">
          {PHASE_LABELS[phase] || phase}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
        <div className="flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-5 h-7 sm:w-6 sm:h-8 rounded-sm border ${
                i <= alarms
                  ? 'bg-red-700 border-red-400 animate-pulse'
                  : 'bg-white/5 border-white/20'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] sm:text-xs text-white/50">Alarm</span>
      </div>
    </div>
  );
}
