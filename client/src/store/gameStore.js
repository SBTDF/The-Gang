import { create } from 'zustand';

export const useGameStore = create((set) => ({
  screen: 'menu',
  playerName: '',
  roomCode: '',
  myId: null,
  room: null,
  myCards: [],
  error: null,
  emotes: [],
  showdownStep: null,
  gameOver: null,
  heistResult: null,
  selectedChip: null,

  setScreen: (screen) => set({ screen }),
  setPlayerName: (playerName) => set({ playerName }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setMyId: (myId) => set({ myId }),
  setRoom: (room) => set({ room }),
  setMyCards: (myCards) => set({ myCards }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setShowdownStep: (showdownStep) => set({ showdownStep }),
  setGameOver: (gameOver) => set({ gameOver }),
  setHeistResult: (heistResult) => set({ heistResult }),
  setSelectedChip: (selectedChip) => set({ selectedChip }),
  addEmote: (emote) =>
    set((s) => ({
      emotes: [...s.emotes.slice(-8), { ...emote, id: Date.now() }],
    })),
  reset: () =>
    set({
      screen: 'menu',
      room: null,
      myCards: [],
      error: null,
      emotes: [],
      showdownStep: null,
      gameOver: null,
      heistResult: null,
      selectedChip: null,
    }),
}));
