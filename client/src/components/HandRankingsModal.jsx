import Modal from './Modal';

const RANKINGS = [
  { rank: 1, name: 'High Card', example: 'A♠ K♦ 9♣ 5♥ 2♠' },
  { rank: 2, name: 'Pair', example: 'K♠ K♦ 9♣ 5♥ 2♠' },
  { rank: 3, name: 'Two Pair', example: 'K♠ K♦ 9♣ 9♥ 2♠' },
  { rank: 4, name: 'Three of a Kind', example: '9♠ 9♦ 9♣ K♥ 2♠' },
  { rank: 5, name: 'Straight', example: '9♠ 8♦ 7♣ 6♥ 5♠' },
  { rank: 6, name: 'Flush', example: 'K♠ J♠ 9♠ 5♠ 2♠' },
  { rank: 7, name: 'Full House', example: 'K♠ K♦ K♣ 9♥ 9♠' },
  { rank: 8, name: 'Four of a Kind', example: '9♠ 9♦ 9♣ 9♥ K♠' },
  { rank: 9, name: 'Straight Flush', example: '9♠ 8♠ 7♠ 6♠ 5♠' },
  { rank: 10, name: 'Royal Flush', example: 'A♠ K♠ Q♠ J♠ 10♠' },
];

export default function HandRankingsModal({ onClose }) {
  return (
    <Modal title="Xếp hạng bài Poker" onClose={onClose}>
      <p className="text-white/50 text-xs mb-4">
        Từ yếu (1) đến mạnh (10). Dùng 2 lá tay + 5 lá chung, chọn bộ 5 lá tốt nhất.
      </p>
      <div className="space-y-2">
        {RANKINGS.map((r) => (
          <div
            key={r.rank}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5"
          >
            <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-bold flex items-center justify-center flex-shrink-0">
              {r.rank}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-white">{r.name}</p>
              <p className="text-xs text-white/40 font-mono truncate">{r.example}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
