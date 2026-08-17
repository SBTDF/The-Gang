import { useMemo, useState } from 'react';
import { socket } from '../socket';
import { IMPOSTER_ADVICE, GAME_MODES } from '../imposterMode';
import Card from './Card';

function HandPreview({ hand }) {
  if (!hand?.cards?.length) return null;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {hand.cards.map((card, index) => <Card key={`${hand.playerId}-${index}`} card={card} size="sm" />)}
    </div>
  );
}

function IntelSection({ title, children }) {
  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-gold/85">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function ImposterPanel({ room, myId, myRole, privateChallengeState, falseTrailAdvice, sabotageClue }) {
  const [selectedAdviceTarget, setSelectedAdviceTarget] = useState('');
  const targetOptions = privateChallengeState?.targetOptions || [];
  const crewPlayers = useMemo(
    () => (room?.players || []).filter((player) => player.id !== myId && player.id !== room?.revealedImposterId),
    [room?.players, room?.revealedImposterId, myId],
  );

  if (room?.gameMode !== GAME_MODES.IMPOSTER || !myRole) return null;

  const selectTarget = (challengeId, targetPlayerId) => {
    socket.emit('SELECT_IMPOSTER_TARGET', { challengeId, targetPlayerId });
  };

  const openBookTargetOptions = targetOptions.find((item) => item.challengeId === 'openBook');
  const blueprintTargetOptions = targetOptions.find((item) => item.challengeId === 'blueprint');
  const falseTrail = privateChallengeState?.falseTrail;

  if (myRole === 'IMPOSTER') {
    const sendAdvice = (adviceId) => {
      if (!selectedAdviceTarget) return;
      socket.emit('IMPOSTER_ADVICE', {
        targetPlayerId: selectedAdviceTarget,
        adviceId,
      });
    };

    return (
      <div className="relative z-20 mx-auto mb-4 w-full max-w-4xl rounded-2xl border border-red-300/25 bg-red-950/20 p-3 shadow-lg sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-200/80">Secret role</div>
            <div className="text-lg font-bold text-red-200">You are the Imposter</div>
          </div>
          <span className="rounded-full border border-red-200/25 px-3 py-1 text-xs text-red-100/70">Keep blending in</span>
        </div>

        {(openBookTargetOptions || blueprintTargetOptions) && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {openBookTargetOptions && (
              <IntelSection title="Open Book — choose one Crew hand">
                <div className="flex flex-wrap gap-2">
                  {openBookTargetOptions.players.map((player) => (
                    <button key={player.playerId} type="button" onClick={() => selectTarget('openBook', player.playerId)} className="btn-secondary px-2 py-1 text-xs">
                      {player.playerName}
                    </button>
                  ))}
                </div>
              </IntelSection>
            )}
            {blueprintTargetOptions && (
              <IntelSection title="Blueprint — inspect one Crew position">
                <div className="flex flex-wrap gap-2">
                  {blueprintTargetOptions.players.map((player) => (
                    <button key={player.playerId} type="button" onClick={() => selectTarget('blueprint', player.playerId)} className="btn-secondary px-2 py-1 text-xs">
                      {player.playerName}
                    </button>
                  ))}
                </div>
              </IntelSection>
            )}
          </div>
        )}

        {privateChallengeState?.openBook && (
          <IntelSection title="Open Book intel">
            {privateChallengeState.openBook.hands ? (
              <div className="space-y-2">
                {privateChallengeState.openBook.hands.map((hand) => (
                  <div key={hand.playerId} className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                    <span className="w-28 truncate">{hand.playerName}</span><HandPreview hand={hand} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                <span>{privateChallengeState.openBook.target?.playerName}</span>
                <HandPreview hand={privateChallengeState.openBook.target} />
              </div>
            )}
          </IntelSection>
        )}

        {privateChallengeState?.blueprint && (
          <IntelSection title="Blueprint intel">
            {privateChallengeState.blueprint.ranking ? (
              <div className="text-xs text-white/80">
                {privateChallengeState.blueprint.ranking.map((entry) => `${entry.position}. ${entry.playerName}`).join(' · ')}
              </div>
            ) : (
              <div className="text-xs text-white/80">
                {privateChallengeState.blueprint.target?.playerName} belongs at position {privateChallengeState.blueprint.target?.position} and should use chip {privateChallengeState.blueprint.target?.idealChipValue}.
              </div>
            )}
          </IntelSection>
        )}

        {falseTrail && (
          <IntelSection title={`False Trail advice (${falseTrail.used}/${falseTrail.maxUses} used)`}>
            <div className="flex flex-wrap items-center gap-2">
              <select value={selectedAdviceTarget} onChange={(event) => setSelectedAdviceTarget(event.target.value)} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">
                <option value="">Choose Crew player</option>
                {crewPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
              {IMPOSTER_ADVICE.map((advice) => (
                <button key={advice.id} type="button" onClick={() => sendAdvice(advice.id)} disabled={!selectedAdviceTarget || falseTrail.used >= falseTrail.maxUses} className="btn-secondary px-2 py-1 text-xs">
                  {advice.label}
                </button>
              ))}
            </div>
          </IntelSection>
        )}
      </div>
    );
  }

  return (
    <div className="relative z-20 mx-auto mb-4 w-full max-w-4xl rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-3 shadow-lg sm:p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Secret role</div>
      <div className="text-lg font-bold text-emerald-200">You are Crew</div>

      {privateChallengeState?.openBook && (
        <IntelSection title="Open Book intel">
          {privateChallengeState.openBook.hands ? (
            <div className="space-y-2">
              {privateChallengeState.openBook.hands.map((hand) => (
                <div key={hand.playerId} className="flex flex-wrap items-center gap-2 text-xs text-white/80">
                  <span className="w-28 truncate">{hand.playerName}</span><HandPreview hand={hand} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
              <span>{privateChallengeState.openBook.target?.playerName}</span><HandPreview hand={privateChallengeState.openBook.target} />
            </div>
          )}
        </IntelSection>
      )}

      {privateChallengeState?.blueprint && (
        <IntelSection title="Blueprint clue">
          {privateChallengeState.blueprint.clue ? (
            <p className="text-sm text-white/85">{privateChallengeState.blueprint.clue.text}</p>
          ) : (
            <div className="text-xs text-white/80">
              {privateChallengeState.blueprint.assignment.map((entry) => `${entry.position}. ${entry.playerName}`).join(' · ')}
            </div>
          )}
        </IntelSection>
      )}

      {falseTrailAdvice && (
        <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-200/10 p-3 text-sm text-amber-100">
          {falseTrailAdvice.fromName} recommends: {falseTrailAdvice.label}
        </div>
      )}

      {sabotageClue && (
        <div className="mt-3 rounded-xl border border-emerald-300/25 bg-emerald-200/10 p-3 text-sm text-emerald-100">
          Sabotage clue: {sabotageClue.category}
          {sabotageClue.affectedPhase && ` · ${sabotageClue.affectedPhase} · ${sabotageClue.decisionType}`}
        </div>
      )}
    </div>
  );
}
