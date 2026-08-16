const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

export default function Card({ card, faceDown = false, size = 'md', highlight = false }) {
  const sizes = {
    sm: 'w-10 h-14 text-[10px]',
    md: 'w-12 h-16 sm:w-16 sm:h-24 text-xs sm:text-base',
    lg: 'w-14 h-20 sm:w-20 sm:h-28 text-sm sm:text-lg',
  };

  const highlightClass = highlight ? 'ring-2 ring-yellow-300 ring-offset-1 ring-offset-black/30 shadow-[0_0_0_2px_rgba(250,204,21,0.35),0_12px_25px_rgba(0,0,0,0.38)]' : '';

  if (faceDown || !card) {
    if (card?.hidden) {
      return (
        <div
          className={`${sizes[size]} rounded-xl border-2 border-gold/45 bg-gradient-to-br from-[#1a254d] via-[#101a35] to-[#0d162d] shadow-[0_10px_25px_rgba(0,0,0,0.35)] flex items-center justify-center flex-shrink-0 ring-1 ring-white/5 ${highlightClass}`}
        >
          <div className="flex h-full w-full items-center justify-center rounded-[0.7rem] border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent">
            <span className="text-gold text-xl sm:text-2xl font-black tracking-widest">?</span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`${sizes[size]} rounded-xl border-2 border-gold/45 bg-gradient-to-br from-[#1a254d] via-[#101a35] to-[#0d162d] shadow-[0_10px_25px_rgba(0,0,0,0.35)] flex items-center justify-center flex-shrink-0 ring-1 ring-white/5 ${highlightClass}`}
      >
        <div className="flex h-full w-full items-center justify-center rounded-[0.7rem] border border-gold/20 bg-gradient-to-br from-gold/10 to-transparent">
          <span className="text-gold/70 text-lg sm:text-xl font-display tracking-widest">G</span>
        </div>
      </div>
    );
  }

  const suitClass = SUIT_COLORS[card.suit];

  return (
    <div
      className={`${sizes[size]} rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 shadow-[0_12px_25px_rgba(0,0,0,0.38)] flex flex-col items-center justify-between py-1 px-0.5 flex-shrink-0 select-none transition-transform duration-200 hover:-translate-y-1 ${highlightClass}`}
    >
      <span className={`font-black leading-none ${suitClass}`}>{card.rank}</span>
      <span className={`text-xl sm:text-2xl leading-none ${suitClass}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={`font-black leading-none rotate-180 ${suitClass}`}>{card.rank}</span>
    </div>
  );
}
