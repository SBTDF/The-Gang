# The Gang — Heist Poker

Game bài poker hợp tác online, chơi được trên trình duyệt PC và điện thoại.

## Cách chạy local

### 1. Cài dependencies

```bash
cd server
npm install

cd ../client
npm install
```

### 2. Chạy server (terminal 1)

```bash
cd server
npm run dev
```

Server chạy tại `http://localhost:3001`

### 3. Chạy client (terminal 2)

```bash
cd client
npm run dev
```

Mở `http://localhost:5173` trên trình duyệt.

### 4. Test multiplayer

Mở 3 tab/cửa sổ trình duyệt (hoặc dùng incognito):
1. Tab 1: Tạo phòng, copy mã phòng
2. Tab 2 & 3: Vào phòng bằng mã
3. Host bấm "Bắt đầu Heist"

## Cấu trúc

```
The Gang/
├── client/          # React + Vite + Tailwind
├── server/          # Node.js + Socket.io
├── The_Gang_P1.md   # Spec phần 1
└── The_Gang_P2.md   # Spec phần 2
```

## Deploy

### Backend (Render.com)
- Root Directory: repository root
- Build command: `bash ./render-build.sh`
- Start command: `npm start`
- Flow: `npm ci` → build the client → start Express
- Express serves `client/dist` and Socket.IO runs on the same service

### Frontend (Vercel)
This is an optional separate-frontend deployment. If used:
- Root Directory: `client`
- Framework: Vite
- Env: `VITE_SERVER_URL=https://your-backend.onrender.com`

For the primary single-service Render deployment, build and serve from the repository root:

Hoặc build client và serve từ server:
```bash
npm ci --include=dev
npm run build --workspace client
npm start
```

## Tính năng MVP

- [x] Tạo/vào phòng (3-6 người)
- [x] Chia bài, community cards (Flop/Turn/River)
- [x] Hệ thống chip (trắng/vàng/cam/đỏ) — lấy & cướp
- [x] Showdown với đánh giá bài poker
- [x] Vault/Alarm (3 heist thắng/thua)
- [x] UI responsive (mobile + desktop)
- [x] Luật chơi & xếp hạng bài
- [x] Emote/phản ứng nhanh
- [x] Thử thách tùy chọn (Quick Access, Noise Sensor, v.v.)
