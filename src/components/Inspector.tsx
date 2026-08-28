import { useEffect, useMemo, useState } from 'react';
import { fmtDateTime, priShort } from '../lib/format';
import { useDatasetStore } from '../store';

export function Inspector() {
  const open = useDatasetStore((s) => s.inspectorOpen);
  const selection = useDatasetStore((s) => s.selection);
  const rows = useDatasetStore((s) => s.rows);
  const close = useDatasetStore((s) => s.closeInspector);
  const filterHub = useDatasetStore((s) => s.filterHubToSelection);
  const [sort, setSort] = useState<'number' | 'priority' | 'opened'>('opened');
  const [expand, setExpand] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const tickets = useMemo(() => {
    if (!selection) return [];
    const set = new Set(selection.ticketNumbers);
    const list = rows.filter((r) => set.has(r.number));
    return list.sort((a, b) => {
      if (sort === 'number') return a.number.localeCompare(b.number);
      if (sort === 'priority') return a.priority.localeCompare(b.priority);
      return (a.opened_at?.getTime() ?? 0) - (b.opened_at?.getTime() ?? 0);
    });
  }, [selection, rows, sort]);

  if (!open) return null;

  return (
    <aside className="inspector" aria-label="Ticket inspector">
      <header>
        <h2>
          {selection?.title ?? 'Tickets'} · {tickets.length}
        </h2>
        <button type="button" className="xbtn" onClick={close} aria-label="Close inspector">
          ×
        </button>
      </header>
      {!selection || !tickets.length ? (
        <div className="empty">Click a flow, word, or bar to see the tickets.</div>
      ) : (
        <>
          {selection.filterHint?.groups?.length ? (
            <div style={{ padding: '8px 12px' }}>
              <button type="button" className="chip" onClick={filterHub}>
                Filter hub to this
              </button>
            </div>
          ) : null}
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table>
              <thead>
                <tr>
                  <th>
                    <button type="button" className="chip" onClick={() => setSort('number')}>
                      number
                    </button>
                  </th>
                  <th>
                    <button type="button" className="chip" onClick={() => setSort('priority')}>
                      pri
                    </button>
                  </th>
                  <th>
                    <button type="button" className="chip" onClick={() => setSort('opened')}>
                      opened
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 200).map((r) => (
                  <tr key={r.number}>
                    <td colSpan={3}>
                      <button
                        type="button"
                        className="loop-row"
                        onClick={() => setExpand(expand === r.number ? null : r.number)}
                      >
                        <span className="ticket-no">{r.number}</span> {priShort(r.priority)}{' '}
                        {fmtDateTime(r.opened_at)} · {r.assignment_group}
                        <div>{r.short_description}</div>
                      </button>
                      {expand === r.number ? (
                        <pre className="notes">
                          {(r.work_notes || r.close_notes || r.description || 'No notes.') as string}
                        </pre>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </aside>
  );
}
