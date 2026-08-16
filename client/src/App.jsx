import { useEffect } from 'react';
import { socket } from './socket';
import { useGameStore } from './store/gameStore';
import MainMenu from './components/MainMenu';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import ErrorToast from './components/ErrorToast';

export default function App() {
  const { screen, setMyId, setRoom, setMyCards, setError, setShowdownStep, setGameOver, setHeistResult, addEmote } =
    useGameStore();

  useEffect(() => {
    setMyId(socket.id);

    socket.on('connect', () => setMyId(socket.id));

    socket.on('ROOM_CREATED', ({ roomCode }) => {
      useGameStore.setState({ roomCode, screen: 'lobby' });
    });

    socket.on('ROOM_JOINED', ({ roomCode }) => {
      useGameStore.setState({ roomCode, screen: 'lobby' });
    });

    socket.on('ROOM_STATE', (room) => {
      setRoom(room);
      if (room.gameState !== 'LOBBY') {
        useGameStore.setState({ screen: 'game' });
      }
      if (room.gameState === 'HEIST_RESULT' && room.lastHeistSuccess != null) {
        setHeistResult({ success: room.lastHeistSuccess });
      }
      if (room.gameState === 'GAME_OVER') {
        setGameOver({
          result: room.vault >= 3 ? 'WIN' : 'LOSE',
          vault: room.vault,
          alarms: room.alarms,
        });
        useGameStore.setState({ screen: 'gameover' });
      }
    });

    socket.on('YOUR_CARDS', ({ cards }) => setMyCards(cards));

    socket.on('ERROR', ({ message }) => setError(message));

    socket.on('SHOWDOWN_STEP', (step) => setShowdownStep(step));

    socket.on('HEIST_RESULT', (result) => setHeistResult(result));

    socket.on('GAME_OVER', (data) => {
      setGameOver(data);
      useGameStore.setState({ screen: 'gameover' });
    });

    socket.on('EMOTE_RECEIVED', (emote) => addEmote(emote));

    return () => {
      socket.off('connect');
      socket.off('ROOM_CREATED');
      socket.off('ROOM_JOINED');
      socket.off('ROOM_STATE');
      socket.off('YOUR_CARDS');
      socket.off('ERROR');
      socket.off('SHOWDOWN_STEP');
      socket.off('HEIST_RESULT');
      socket.off('GAME_OVER');
      socket.off('EMOTE_RECEIVED');
    };
  }, []);

  return (
    <div className="h-full flex flex-col safe-top safe-bottom">
      {screen === 'menu' && <MainMenu />}
      {screen === 'lobby' && <Lobby />}
      {(screen === 'game' || screen === 'gameover') && <GameTable />}
      <ErrorToast />
    </div>
  );
}
