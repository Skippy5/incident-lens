import { Link, useNavigate } from 'react-router-dom';
import { computeKpis, deltaPct, halfDelta } from '../lib/kpis';
import { buildStory } from '../lib/story';
import { fmtHours, fmtN, fmtPct } from '../lib/format';
import { useDatasetStore } from '../store';

export default function Overview() {
  const rows = useDatasetStore((s) => s.filtered);
  const meta = useDatasetStore((s) => s.meta);
  const nav = useNavigate();
  const k = computeKpis(rows);
  const { prior, recent } = halfDelta(rows);
  const kp = computeKpis(prior);
  const kr = computeKpis(recent.length ? recent : rows);
  const redact = meta?.kind === 'upload';
  const story = buildStory(rows, redact);

  const cards = [
    {
      label: 'Tickets in scope',
      value: fmtN(k.n),
      delta: deltaPct(kr.n, kp.n),
      to: '/trends',
    },
    {
      label: 'Median MTTR',
      value: fmtHours(k.medianMttr),
      delta: kp.medianMttr != null && kr.medianMttr != null ? kr.medianMttr - kp.medianMttr : null,
      deltaKind: 'hours' as const,
      to: '/ops',
    },
    {
      label: 'SLA miss %',
      value: fmtPct(k.slaMissPct),
      delta: kp.slaMissPct != null && kr.slaMissPct != null ? kr.slaMissPct - kp.slaMissPct : null,
      to: '/ops',
    },
    {
      label: 'Bounce rate',
      value: fmtPct(k.bounceRate),
      delta: kr.bounceRate - kp.bounceRate,
      to: '/flow',
    },
    {
      label: 'Ping-pong %',
      value: fmtPct(k.pingPongPct),
      delta: kr.pingPongPct - kp.pingPongPct,
      to: '/ops',
    },
    {
      label: 'Open / unresolved',
      value: fmtN(k.openCount),
      delta: deltaPct(kr.openCount, kp.openCount),
      to: '/ops',
    },
  ];

  return (
    <div>
      <div className="kpis">
        {cards.map((c) => (
          <button key={c.label} type="button" className="card kpi clickable" onClick={() => nav(c.to)}>
            <div className="label">{c.label}</div>
            <div className="value">{c.value}</div>
            <div className="delta">
              {c.delta == null
                ? 'vs prior half —'
                : 'deltaKind' in c && c.deltaKind === 'hours'
                  ? `${c.delta >= 0 ? '+' : ''}${Number(c.delta).toFixed(1)}h vs prior half`
                  : `${c.delta >= 0 ? '+' : ''}${Number(c.delta).toFixed(1)} vs prior half`}
            </div>
          </button>
        ))}
      </div>
      <div className="card story">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Story</h2>
        {story.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </div>
      <div className="jumps">
        <Link className="card jump" to="/flow">
          <h3>Flow</h3>
          <p>Where work is born, where it travels, where it is resolved.</p>
        </Link>
        <Link className="card jump" to="/words">
          <h3>Words</h3>
          <p>What people actually write, clustered into phrases.</p>
        </Link>
        <Link className="card jump" to="/trends">
          <h3>Trends</h3>
          <p>Volume, MTTR, and rising language over the date span.</p>
        </Link>
        <Link className="card jump" to="/ops">
          <h3>Ops</h3>
          <p>MTTR, bounce, SLA, mix, heatmap, and ping-pong.</p>
        </Link>
      </div>
    </div>
  );
}
