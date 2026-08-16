import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export default function ErrorToast() {
  const { error, clearError } = useGameStore();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(clearError, 3500);
    return () => clearTimeout(t);
  }, [error, clearError]);

  if (!error) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-red-900/90 border border-red-500/50 text-white text-sm font-medium shadow-xl max-w-[90vw] text-center animate-pulse">
      {error}
    </div>
  );
}
