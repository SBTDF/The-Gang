const CHIP_STYLES = {
  white: 'bg-chip-white text-gray-800 border-gray-300',
  yellow: 'bg-chip-yellow text-gray-900 border-yellow-600',
  orange: 'bg-chip-orange text-white border-orange-700',
  red: 'bg-chip-red text-white border-red-700',
};

export default function Chip({ value, color = 'white', locked = false, selected = false, onClick, small = false }) {
  const size = small ? 'w-9 h-9 text-sm' : 'w-11 h-11 sm:w-12 sm:h-12 text-base';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`
        ${size} rounded-full border-2 font-bold shadow-chip
        flex items-center justify-center flex-shrink-0
        transition-all duration-150
        ${CHIP_STYLES[color] || CHIP_STYLES.white}
        ${onClick ? 'cursor-pointer hover:scale-110 active:scale-95' : 'cursor-default'}
        ${selected ? 'ring-2 ring-gold ring-offset-2 ring-offset-felt scale-110' : ''}
        ${locked ? 'opacity-60 line-through' : ''}
      `}
    >
      {value}
    </button>
  );
}
