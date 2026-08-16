import { socket } from '../socket';

const EMOTES = [
  { id: 'higher', label: 'Tôi nên cao hơn', icon: '⬆️' },
  { id: 'lower', label: 'Bạn quá cao', icon: '⬇️' },
  { id: 'agree', label: 'Đồng ý', icon: '👍' },
  { id: 'swap', label: 'Đổi chỗ', icon: '🔄' },
  { id: 'question', label: '?', icon: '❓' },
  { id: 'safe', label: 'An toàn', icon: '✅' },
  { id: 'danger', label: 'Nguy hiểm', icon: '⚠️' },
];

export default function EmoteMenu({ targetPlayerId, onClose }) {
  const send = (emoteId) => {
    socket.emit('SEND_EMOTE', { emoteId, targetPlayerId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-felt-dark border border-gold/30 rounded-2xl p-4 w-full max-w-xs shadow-2xl">
        <p className="text-xs text-white/50 mb-3 text-center">Phản ứng nhanh</p>
        <div className="grid grid-cols-2 gap-2">
          {EMOTES.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => send(e.id)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-sm transition-all"
            >
              <span>{e.icon}</span>
              <span className="truncate">{e.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
