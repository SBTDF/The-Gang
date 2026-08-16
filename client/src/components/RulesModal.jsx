import Modal from './Modal';

export default function RulesModal({ onClose }) {
  return (
    <Modal title="Luật chơi — The Gang" onClose={onClose}>
      <section>
        <h3 className="font-semibold text-gold mb-1">Mục tiêu</h3>
        <p>
          Phối hợp xếp hạng bài poker từ yếu đến mạnh bằng chip — không được nói chi tiết bài
          riêng. Hoàn thành 3 heist để thắng. Thất bại 3 heist = thua.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-gold mb-1">Các vòng</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li><strong>Pre-Flop</strong> — 2 lá bài + chip trắng (1→N)</li>
          <li><strong>Flop</strong> — 3 lá chung + chip vàng</li>
          <li><strong>Turn</strong> — 1 lá chung + chip cam</li>
          <li><strong>River</strong> — 1 lá chung + chip đỏ</li>
          <li><strong>Showdown</strong> — Lật bài theo thứ tự chip đỏ (1→N)</li>
        </ol>
      </section>
      <section>
        <h3 className="font-semibold text-gold mb-1">Chip</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Mỗi người chỉ giữ <strong>1 chip</strong> mỗi màu</li>
          <li>Lấy chip từ pool giữa bàn hoặc cướp từ người khác</li>
          <li>Chip thể hiện vị trí tương đối sức mạnh bài — không nói bài cụ thể</li>
          <li>Khi tất cả đã có chip, vòng tự chuyển tiếp</li>
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gold mb-1">Showdown</h3>
        <p>
          Người chip đỏ thấp nhất lật trước. Mỗi bài phải ≥ bài trước. Nếu thứ tự sai → Heist
          thất bại. Đúng hết → Heist thành công.
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-gold mb-1">Giao tiếp</h3>
        <p>
          Không chat tự do. Dùng emoji/phản ứng nhanh để phối hợp vị trí chip (cao hơn, thấp
          hơn, đồng ý, v.v.).
        </p>
      </section>
    </Modal>
  );
}
