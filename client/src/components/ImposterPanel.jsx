import { useMemo, useState } from 'react';
import { socket } from '../socket';
import { GAME_MODES } from '../imposterMode';
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

export default function ImposterPanel({
  room,
  myId,
  myRole,
  privateChallengeState,
  falseTrailAdvice,
  crewVerificationRequest,
  crewVerificationResult,
}) {
  const [adviceTarget, setAdviceTarget] = useState('');
  const [adviceChip, setAdviceChip] = useState('');
  const [rerouteChip, setRerouteChip] = useState('');
  const [verificationTarget, setVerificationTarget] = useState('');
  const [verificationVerifier, setVerificationVerifier] = useState('');

  const players = room?.players || [];
  const otherPlayers = useMemo(() => players.filter((player) => player.id !== myId), [players, myId]);
  const currentSelections = room?.roundSelections || {};
  const availableChips = room?.availableChips || [];
  const falseTrail = privateChallengeState?.falseTrail;
  const blueprint = privateChallengeState?.blueprint;
  const verification = privateChallengeState?.verification;

  if (room?.gameMode !== GAME_MODES.IMPOSTER || !myRole) return null;

  const sendAdvice = () => {
    if (!adviceTarget || adviceChip === '') return;
    socket.emit('IMPOSTER_ADVICE', {
      targetPlayerId: adviceTarget,
      suggestedChipValue: Number(adviceChip),
    });
    setAdviceChip('');
  };

  const requestVerification = () => {
    if (!verificationTarget || !verificationVerifier) return;
    socket.emit('REQUEST_CREW_VERIFICATION', {
      targetPlayerId: verificationTarget,
      verifierPlayerId: verificationVerifier,
    });
  };

  if (myRole === 'IMPOSTER') {
    const adviceTargetChip = currentSelections[adviceTarget];

    return (
      <div className="relative z-20 mx-auto mb-4 w-full max-w-4xl rounded-2xl border border-red-300/25 bg-red-950/20 p-3 shadow-lg sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-200/80">Secret role</div>
            <div className="text-lg font-bold text-red-200">You are the Imposter</div>
          </div>
          <span className="rounded-full border border-red-200/25 px-3 py-1 text-xs text-red-100/70">Keep blending in</span>
        </div>

        {privateChallengeState?.openBook && (
          <IntelSection title="Open Book — Crew Hand Recon">
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
          <IntelSection title="Blueprint — Position Blueprint">
            {privateChallengeState.blueprint.ranking ? (
              <div className="space-y-1 text-xs text-white/80">
                <div>{privateChallengeState.blueprint.ranking.map((entry) => `${entry.position}. ${entry.playerName}`).join(' · ')}</div>
                <div className="text-white/60">Ideal chips: {privateChallengeState.blueprint.assignment.map((entry) => `${entry.playerName} → ${entry.chipValue}`).join(' · ')}</div>
              </div>
            ) : (
              <div className="text-xs text-white/80">
                {privateChallengeState.blueprint.target?.playerName} belongs at position {privateChallengeState.blueprint.target?.position} and should use chip {privateChallengeState.blueprint.target?.idealChipValue}.
              </div>
            )}
          </IntelSection>
        )}

        {falseTrail && (
          <IntelSection title={`False Trail — Legal Decoy Suggestion (${falseTrail.used}/${falseTrail.maxUses})`}>
            <div className="flex flex-wrap items-center gap-2">
              <select value={adviceTarget} onChange={(event) => { setAdviceTarget(event.target.value); setAdviceChip(''); }} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">
                <option value="">Choose player</option>
                {otherPlayers.map((player) => <option key={player.id} value={player.id}>{player.name} ({currentSelections[player.id] ?? 'no chip'})</option>)}
              </select>
              <select value={adviceChip} onChange={(event) => setAdviceChip(event.target.value)} disabled={!adviceTarget || adviceTargetChip == null} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">
                <option value="">Suggest available chip</option>
                {availableChips.filter((value) => value !== adviceTargetChip).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <button type="button" onClick={sendAdvice} disabled={!adviceTarget || adviceChip === '' || falseTrail.used >= falseTrail.maxUses} className="btn-secondary px-2 py-1 text-xs">Send suggestion</button>
            </div>
            <p className="mt-2 text-[11px] text-red-100/60">Suggestions are private and never change the selected chip.</p>
          </IntelSection>
        )}
      </div>
    );
  }

  const reroute = blueprint?.reroute ? blueprint : null;

  return (
    <div className="relative z-20 mx-auto mb-4 w-full max-w-4xl rounded-2xl border border-emerald-300/25 bg-emerald-950/20 p-3 shadow-lg sm:p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Secret role</div>
      <div className="text-lg font-bold text-emerald-200">You are Crew</div>

      {privateChallengeState?.openBook?.forecast && (
        <IntelSection title={`Open Book — Community Forecast (Level ${privateChallengeState.openBook.level})`}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/80">
            {privateChallengeState.openBook.forecast.map(({ index, card }) => <Card key={`${index}-${card.rank}-${card.suit}`} card={card} size="sm" />)}
          </div>
          <p className="mt-2 text-[11px] text-white/60">These are actual upcoming community cards. The board order is unchanged.</p>
        </IntelSection>
      )}

      {reroute && (
        <IntelSection title={`Blueprint — Reroute (${reroute.used}/${reroute.maxUses} used)`}>
          <div className="flex flex-wrap items-center gap-2">
            <select value={rerouteChip} onChange={(event) => setRerouteChip(event.target.value)} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">
              <option value="">Choose a different available chip</option>
              {availableChips.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button type="button" onClick={() => { socket.emit('CREW_REROUTE', { replacementChipValue: Number(rerouteChip) }); setRerouteChip(''); }} disabled={rerouteChip === '' || reroute.used >= reroute.maxUses} className="btn-secondary px-2 py-1 text-xs">Reroute a Crew decision</button>
          </div>
          <p className="mt-2 text-[11px] text-white/60">The server applies this use to one eligible, unconfirmed Crew decision in the current phase.</p>
        </IntelSection>
      )}

      {verification && (
        <IntelSection title={`False Trail — Crew Verification (${verification.used}/${verification.maxUses} used)`}>
          <div className="flex flex-wrap items-center gap-2">
            <select value={verificationTarget} onChange={(event) => setVerificationTarget(event.target.value)} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">
              <option value="">Review player</option>
              {otherPlayers.filter((player) => currentSelections[player.id] != null).map((player) => <option key={player.id} value={player.id}>{player.name} ({currentSelections[player.id]})</option>)}
            </select>
            <select value={verificationVerifier} onChange={(event) => setVerificationVerifier(event.target.value)} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white">
              <option value="">Choose verifier</option>
              {otherPlayers.filter((player) => player.id !== verificationTarget).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
            <button type="button" onClick={requestVerification} disabled={!verificationTarget || !verificationVerifier || verification.used >= verification.maxUses} className="btn-secondary px-2 py-1 text-xs">Request review</button>
          </div>
          {crewVerificationRequest && (
            <div className="mt-3 rounded-lg border border-gold/25 bg-gold/10 p-2 text-xs text-white/85">
              <p>{crewVerificationRequest.requesterName} asks you to review {crewVerificationRequest.targetName}'s chip {crewVerificationRequest.chipValue}.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => socket.emit('RESPOND_CREW_VERIFICATION', { requestId: crewVerificationRequest.requestId, accepted: true })} className="btn-primary px-2 py-1 text-xs">Accept</button>
                <button type="button" onClick={() => socket.emit('RESPOND_CREW_VERIFICATION', { requestId: crewVerificationRequest.requestId, accepted: false })} className="btn-secondary px-2 py-1 text-xs">Ask reconsider</button>
              </div>
            </div>
          )}
          {crewVerificationResult && (
            <p className="mt-2 text-xs text-emerald-100/80">
              {crewVerificationResult.decision === 'PENDING'
                ? `Review requested for ${crewVerificationResult.targetName}.`
                : `${crewVerificationResult.verifierName} ${crewVerificationResult.decision === 'ACCEPTED' ? 'accepted' : 'asked for reconsideration'} chip ${crewVerificationResult.chipValue}.`}
            </p>
          )}
        </IntelSection>
      )}

      {falseTrailAdvice && (
        <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-200/10 p-3 text-sm text-amber-100">
          {falseTrailAdvice.fromName} privately suggests chip {falseTrailAdvice.suggestedChipValue} for the {falseTrailAdvice.phase} decision. Current choice: {falseTrailAdvice.currentChipValue}.
        </div>
      )}
    </div>
  );
}
