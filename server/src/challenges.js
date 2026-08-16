/** Official challenge cards 1–10 (The Gang rulebook) */
export const CHALLENGE_DEFS = [
  {
    id: 'quickAccess',
    num: 1,
    name: 'Quick Access',
    desc: 'Bỏ chip trắng, lật ngay 3 lá chung và vào vòng 2',
  },
  {
    id: 'noiseSensor',
    num: 2,
    name: 'Noise Sensors',
    desc: 'Chip 1 sao (vòng 1–3) không thể đổi chủ sau khi lấy',
  },
  {
    id: 'motionDetector',
    num: 3,
    name: 'Motion Detector',
    desc: 'Flop có J/Q/K → người giữ chip trắng 1 sao rút bài mới',
  },
  {
    id: 'retinaScan',
    num: 4,
    name: 'Retina Scan',
    desc: 'Trước khi lật bài người chip đỏ cao nhất: đoán đúng 1 giá trị lá',
  },
  {
    id: 'hastyGetaway',
    num: 5,
    name: 'Hasty Getaway',
    desc: 'Bỏ chip cam, lật lá chung thứ 4 và vào vòng 4',
  },
  {
    id: 'ventilationShaft',
    num: 6,
    name: 'Ventilation Shaft',
    desc: 'Chip cao nhất (vòng 1–3) không thể đổi chủ sau khi lấy',
  },
  {
    id: 'laserTripwires',
    num: 7,
    name: 'Laser Tripwires',
    desc: 'Flop không có J/Q/K → người giữ chip trắng cao nhất rút bài mới',
  },
  {
    id: 'blackout',
    num: 8,
    name: 'Blackout',
    desc: 'Đầu mỗi vòng mới: ẩn chip vòng trước',
  },
  {
    id: 'fingerprintScan',
    num: 9,
    name: 'Fingerprint Scan',
    desc: 'Trước khi lật bài người chip đỏ cao nhất: đoán đúng hạng bài',
  },
  {
    id: 'securityCamera',
    num: 10,
    name: 'Security Cameras',
    desc: 'Mỗi người nhận 3 lá bài tay thay vì 2',
  },
];

export const HAND_RANK_OPTIONS = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
];

export const CARD_RANK_OPTIONS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Rounds 1–3 = white, yellow, orange chip phases */
const LOCKABLE_PHASES = new Set(['PRE_FLOP', 'FLOP', 'TURN']);

export function isLockablePhase(phase) {
  return LOCKABLE_PHASES.has(phase);
}

export function getLockableValues(room) {
  const n = room.players.length;
  const values = new Set();
  if (room.challenges.includes('noiseSensor')) values.add(1);
  if (room.challenges.includes('ventilationShaft')) values.add(n);
  return values;
}

export function shouldLockChip(room, chipValue) {
  if (!isLockablePhase(room.gameState)) return false;
  return getLockableValues(room).has(chipValue);
}

export function hasChallenge(room, id) {
  return room.challenges.includes(id);
}
