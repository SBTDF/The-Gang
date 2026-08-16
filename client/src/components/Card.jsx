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

export default function Card({ card, faceDown = false, size = 'md' }) {
  const sizes = {
    sm: 'w-10 h-14 text-xs',
    md: 'w-14 h-20 sm:w-16 sm:h-24 text-sm sm:text-base',
    lg: 'w-16 h-24 sm:w-20 sm:h-28 text-base sm:text-lg',
  };

  if (faceDown || !card) {
    return (
      <div
        className={`${sizes[size]} rounded-lg bg-gradient-to-br from-indigo-900 to-indigo-950 border-2 border-gold/40 shadow-card flex items-center justify-center flex-shrink-0`}
      >
        <span className="text-gold/60 text-lg sm:text-xl font-display">G</span>
      </div>
    );
  }

  const suitClass = SUIT_COLORS[card.suit];

  return (
    <div
      className={`${sizes[size]} rounded-lg bg-white border border-gray-200 shadow-card flex flex-col items-center justify-between py-1 px-0.5 flex-shrink-0 select-none`}
    >
      <span className={`font-bold leading-none ${suitClass}`}>{card.rank}</span>
      <span className={`text-xl sm:text-2xl leading-none ${suitClass}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={`font-bold leading-none rotate-180 ${suitClass}`}>{card.rank}</span>
    </div>
  );
}
