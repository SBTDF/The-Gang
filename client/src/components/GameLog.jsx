import { useEffect, useRef } from 'react';

export default function GameLog({ logs }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  if (!logs?.length) return null;

  return (
    <div className="hidden lg:block w-48 flex-shrink-0">
      <div className="bg-black/30 rounded-xl border border-white/10 h-full max-h-48 overflow-hidden flex flex-col">
        <p className="text-xs text-white/50 px-3 py-2 border-b border-white/10">Nhật ký</p>
        <div ref={ref} className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
          {logs.slice(-20).map((log, i) => (
            <p key={i} className="text-[11px] text-white/60 leading-tight">
              {log.message}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
