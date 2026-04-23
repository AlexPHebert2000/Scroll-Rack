import React from 'react';
import Box from '@mui/material/Box';
import { SR } from '../../theme';
import type { CommitNode } from './graphUtils';

export interface Change { action: string; card: { id: string; name: string }; }
export interface Commit { id: string; description: string; createdAt: string; changes: Change[]; }

const GRAPH_BG = '#161B20';
const GRAPH_LEFT = 14;
const COL_W = 16;
const ROW_H = 72;
const NODE_R = 5;

interface PendingChange { action: 'ADD' | 'REMOVE' | 'MOVE'; cardName: string; }

interface Props {
  nodes: CommitNode[];
  branchColors: Record<string, string>;
  headCommitId: string | null;
  branchName: string;
  branchCommits: Commit[];
  pendingChanges: PendingChange[];
  selectedHash: string | null;
  onSelect: (id: string) => void;
}

const CommitGraph = ({
  nodes, branchColors, headCommitId, branchName, branchCommits, pendingChanges, selectedHash, onSelect,
}: Props) => {
  const numCols = nodes.length ? Math.max(...nodes.map(n => n.col)) + 1 : 1;
  const svgW = GRAPH_LEFT + numCols * COL_W + 8;
  const svgH = nodes.length * ROW_H;

  const cx = (col: number) => GRAPH_LEFT + col * COL_W;
  const cy = (row: number) => row * ROW_H + ROW_H / 2;

  const byId: Record<string, CommitNode> = {};
  nodes.forEach(n => { byId[n.id] = n; });

  const edges = nodes.flatMap(n => {
    const out: { from: CommitNode; to: CommitNode; name: string }[] = [];
    if (n.parentId && byId[n.parentId]) out.push({ from: n, to: byId[n.parentId], name: n.branchName });
    if (n.branchFromId && byId[n.branchFromId]) out.push({ from: n, to: byId[n.branchFromId], name: n.branchName });
    return out;
  });

  const branchNames = [...new Set(nodes.map(n => n.branchName))].sort((a, b) =>
    a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)
  );

  return (
    <Box sx={{
      width: 252, flexShrink: 0,
      backgroundColor: GRAPH_BG,
      borderRight: '0.5px solid #2C333D',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{ padding: '10px 12px 8px', borderBottom: '0.5px solid #2C333D', flexShrink: 0 }}>
        <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5060' }}>
          Commits
        </Box>
        <Box sx={{ display: 'flex', gap: '8px', mt: '6px', flexWrap: 'wrap' }}>
          {branchNames.map(name => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: branchColors[name] || '#4A5060' }} />
              <Box component="span" sx={{ fontFamily: SR.fontMono, fontSize: 9, color: '#4A5060' }}>{name}</Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Graph + commit rows (scrollable, takes remaining space above diff panel) */}
      <Box sx={{ flex: 1, overflowY: 'auto', position: 'relative', minHeight: 0 }}>
        <svg
          width={svgW}
          height={svgH}
          style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 1 }}
        >
          {edges.map((e, i) => {
            const x1 = cx(e.from.col), y1 = cy(e.from.row);
            const x2 = cx(e.to.col), y2 = cy(e.to.row);
            const color = branchColors[e.name] || '#4A5060';
            const d = x1 === x2
              ? `M${x1},${y1} L${x2},${y2}`
              : `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
            return <path key={i} d={d} stroke={color} strokeWidth="1.5" fill="none" strokeOpacity="0.7" />;
          })}
          {nodes.map(n => {
            const x = cx(n.col), y = cy(n.row);
            const color = branchColors[n.branchName] || '#4A5060';
            const isSel = n.id === selectedHash;
            return (
              <g key={n.id}>
                <circle cx={x} cy={y} r={isSel ? NODE_R + 2 : NODE_R}
                  fill={isSel ? color : GRAPH_BG} stroke={color} strokeWidth={isSel ? 2 : 1.5} />
                {isSel && <circle cx={x} cy={y} r={NODE_R - 1.5} fill={color} />}
              </g>
            );
          })}
        </svg>

        <Box sx={{ paddingLeft: `${svgW + 4}px` }}>
          {nodes.map(n => {
            const isSel = n.id === selectedHash;
            const isHead = n.id === headCommitId;
            const color = branchColors[n.branchName] || '#4A5060';
            return (
              <Box
                key={n.id}
                onClick={() => onSelect(n.id)}
                sx={{
                  height: ROW_H, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  padding: '0 10px 0 8px', cursor: 'pointer',
                  backgroundColor: isSel ? '#1E2228' : 'transparent',
                  borderLeft: `2px solid ${isSel ? color : 'transparent'}`,
                  transition: 'background 100ms',
                  '&:hover': { backgroundColor: '#1A1F24' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', mb: '2px' }}>
                  <Box component="span" sx={{ fontFamily: SR.fontMono, fontSize: 10, color: SR.accentGold }}>{n.shortId}</Box>
                  {isHead && (
                    <Box component="span" sx={{
                      fontFamily: SR.fontUi, fontSize: 9, fontWeight: 600,
                      color: SR.accentTealLight, backgroundColor: '#0D2E26',
                      padding: '1px 5px', borderRadius: '3px',
                      border: `0.5px solid ${SR.accentTealLight}`,
                    }}>HEAD</Box>
                  )}
                </Box>
                <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: isSel ? '#E4E0D6' : '#6A7080', lineHeight: 1.3 }}>
                  {n.description}
                </Box>
                <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, color: '#3A424E', mt: '1px' }}>
                  {n.relativeTime}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Diff history panel header */}
      <Box sx={{ borderTop: '0.5px solid #2C333D', flexShrink: 0, padding: '8px 12px 6px' }}>
        <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4A5060' }}>
          Diff history · {branchName}
        </Box>
      </Box>
      {/* Diff history content (40% of sidebar height) */}
      <Box sx={{ height: '40%', overflowY: 'auto', flexShrink: 0, borderTop: '0.5px solid #1E2228' }}>
        {pendingChanges.length > 0 && (
          <Box sx={{ padding: '9px 12px', borderBottom: '0.5px solid #2C333D', backgroundColor: '#1A1F24' }}>
            <Box sx={{ display: 'flex', gap: '6px', alignItems: 'baseline', mb: '3px' }}>
              <Box component="span" sx={{ fontFamily: SR.fontMono, fontSize: 10, color: '#4A5060' }}>working tree</Box>
              <Box component="span" sx={{
                fontFamily: SR.fontUi, fontSize: 9, fontWeight: 600,
                color: SR.accentTealLight, backgroundColor: '#0D2E26',
                padding: '1px 5px', borderRadius: '3px',
                border: `0.5px solid ${SR.accentTealLight}`,
              }}>uncommitted</Box>
            </Box>
            {pendingChanges.map((ch, i) => (
              <Box key={i} sx={{
                fontFamily: SR.fontMono, fontSize: 11, lineHeight: 1.7,
                color: ch.action === 'ADD' ? SR.diffAdd : ch.action === 'MOVE' ? SR.accentGold : SR.diffRemove,
              }}>
                {ch.action === 'ADD' ? '+ ' : ch.action === 'MOVE' ? '→ ' : '− '}{ch.cardName}
              </Box>
            ))}
          </Box>
        )}
        {branchCommits.map(c => (
          <Box key={c.id} sx={{ padding: '9px 12px', borderBottom: '0.5px solid #1E2228' }}>
            <Box sx={{ display: 'flex', gap: '6px', alignItems: 'baseline', mb: '3px' }}>
              <Box component="span" sx={{ fontFamily: SR.fontMono, fontSize: 10, color: SR.accentGold }}>{c.id.slice(0, 7)}</Box>
              <Box component="span" sx={{ fontFamily: SR.fontUi, fontSize: 10, color: '#3A424E' }}>
                {new Date(c.createdAt).toLocaleDateString()}
              </Box>
            </Box>
            <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: '#6A7080', mb: c.changes.length ? '4px' : 0 }}>
              {c.description}
            </Box>
            {c.changes.map((ch, i) => (
              <Box key={i} sx={{
                fontFamily: SR.fontMono, fontSize: 11, lineHeight: 1.7,
                color: ch.action === 'ADD' ? SR.diffAdd : SR.diffRemove,
              }}>
                {ch.action === 'ADD' ? '+ ' : '− '}{ch.card.name}
              </Box>
            ))}
          </Box>
        ))}
        {branchCommits.length === 0 && (
          <Box sx={{ padding: '16px 12px', fontFamily: SR.fontMono, fontSize: 11, color: '#4A5060' }}>
            No commits yet.
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CommitGraph;
