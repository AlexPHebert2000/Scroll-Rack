import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { SR } from '../../theme';
import type { Card } from '../CardImage';
import { cardDisplayName } from '../CardImage';

interface Props {
  open: boolean;
  onClose: () => void;
  currentCards: Card[];
  pendingAdds: Set<string>;
  pendingRemoves: Set<string>;
  onAdd: (card: Card) => void;
  onRemove: (id: string) => void;
  onUndo: (id: string) => void;
}

const PREVIEW_W = 220;
const PREVIEW_H = Math.round(PREVIEW_W * (1040 / 745));
const PREVIEW_DELAY = 500;

const SearchDrawer = ({ open, onClose, currentCards, pendingAdds, pendingRemoves, onAdd, onRemove, onUndo }: Props) => {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [preview, setPreview] = useState<{ imgUrl: string; x: number; y: number } | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const mousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    return () => {
      clearTimeout(previewTimerRef.current);
    };
  }, []);

  const startPreview = (imgUrl: string) => {
    clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setPreview({ imgUrl, x: mousePos.current.x, y: mousePos.current.y });
    }, PREVIEW_DELAY);
  };

  const clearPreview = () => {
    clearTimeout(previewTimerRef.current);
    setPreview(null);
  };

  const searchQ = useQuery<Card[]>({
    queryKey: ['drawerSearch', activeQuery],
    queryFn: () =>
      axios.get<Card[]>(`/api/scryfall/search?qString=${encodeURIComponent(activeQuery)}`).then(r => r.data),
    enabled: activeQuery.length > 0,
  });

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.trim().length > 1) {
      debounceRef.current = setTimeout(() => setActiveQuery(val.trim()), 380);
    } else {
      setActiveQuery('');
    }
  };

  const results = searchQ.data ?? [];
  const width = 400;

  const previewLeft = preview ? Math.max(8, preview.x - PREVIEW_W - 24) : 0;
  const previewTop = preview
    ? Math.max(8, Math.min(window.innerHeight - PREVIEW_H - 8, preview.y - PREVIEW_H / 2))
    : 0;

  return (
    <>
      <Box sx={{
        width: open ? width : 0, flexShrink: 0, overflow: 'hidden',
        borderLeft: open ? `0.5px solid ${SR.border}` : 'none',
        backgroundColor: SR.surfacePanel,
        display: 'flex', flexDirection: 'column',
        transition: 'width 200ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Fixed-width inner so content doesn't wrap during animation */}
        <Box sx={{ width: width, display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Header */}
          <Box sx={{
            padding: '12px 14px 10px', borderBottom: `0.5px solid ${SR.border}`,
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', color: SR.textFaint }}>
              Search cards
            </Box>
            <Box
              component="button"
              onClick={onClose}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                color: SR.textFaint, display: 'flex', alignItems: 'center', borderRadius: '4px',
                '&:hover': { color: SR.textPrimary },
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" />
              </svg>
            </Box>
          </Box>

          {/* Search input */}
          <Box sx={{ padding: '10px 12px', borderBottom: `0.5px solid ${SR.border}`, flexShrink: 0 }}>
            <Box
              component="input"
              ref={inputRef}
              value={query}
              onChange={handleInput}
              placeholder="Card name or query…"
              sx={{
                display: 'block', width: '100%',
                fontFamily: SR.fontUi, fontSize: 12, color: SR.textPrimary,
                backgroundColor: SR.surfaceApp, border: `0.5px solid ${SR.border}`,
                borderRadius: '5px', padding: '6px 10px', outline: 'none',
                boxSizing: 'border-box',
                '&:focus': { borderColor: SR.accentTeal },
              }}
            />
            {activeQuery && !searchQ.isFetching && results.length > 0 && (
              <Box sx={{ fontFamily: SR.fontMono, fontSize: 10, color: SR.textFaint, mt: '6px' }}>
                {results.length} results
              </Box>
            )}
          </Box>

          {/* Results */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {searchQ.isFetching && (
              <Box sx={{ padding: '20px 14px', fontFamily: SR.fontMono, fontSize: 11, color: SR.textFaint }}>
                Searching…
              </Box>
            )}
            {!searchQ.isFetching && activeQuery && results.length === 0 && (
              <Box sx={{ padding: '20px 14px', fontFamily: SR.fontUi, fontSize: 12, color: SR.textFaint }}>
                No results for "{activeQuery}"
              </Box>
            )}
            {!searchQ.isFetching && !activeQuery && (
              <Box sx={{ padding: '20px 14px' }}>
                <Box sx={{ fontFamily: SR.fontUi, fontSize: 11, color: SR.textFaint, lineHeight: 1.7 }}>
                  Search by name, type, or Scryfall syntax —{' '}
                  <Box component="span" sx={{ fontFamily: SR.fontMono, color: SR.textMuted }}>t:creature c:g</Box>
                </Box>
              </Box>
            )}
            {results.map(card => {
              const inDeck = currentCards.some(c => c.id === card.id);
              const staged = pendingAdds.has(card.id);
              const removing = pendingRemoves.has(card.id);
              const imgUrl = card.faces?.[0]?.imageUrl || card.imageUrl;

              return (
                <Box
                  key={card.id}
                  onMouseEnter={(e: React.MouseEvent) => {
                    mousePos.current = { x: e.clientX, y: e.clientY };
                    if (imgUrl) startPreview(imgUrl);
                  }}
                  onMouseMove={(e: React.MouseEvent) => {
                    mousePos.current = { x: e.clientX, y: e.clientY };
                  }}
                  onMouseLeave={clearPreview}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 12px', borderBottom: `0.5px solid ${SR.border}`,
                    transition: 'background 80ms',
                    '&:hover': { backgroundColor: SR.surfaceCard },
                  }}
                >
                  {/* Thumbnail */}
                  <Box sx={{
                    height: 120, borderRadius: '3px', flexShrink: 0, overflow: 'hidden',
                    border: `0.5px solid ${SR.border}`, backgroundColor: SR.surfaceCard,
                  }}>
                    {imgUrl && (
                      <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </Box>

                  {/* Card info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {cardDisplayName(card)}
                    </Box>
                    {card.typeLine && (
                      <Box sx={{ fontFamily: SR.fontUi, fontSize: 10, color: SR.textFaint, mt: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {card.typeLine}
                      </Box>
                    )}
                  </Box>

                  {/* Add / undo button */}
                  <Box
                    component="button"
                    onClick={() => staged || (inDeck && !removing) ? onUndo(card.id) : onAdd(card)}
                    sx={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: '5px', cursor: 'pointer',
                      backgroundColor: staged ? SR.accentTeal : SR.surfaceCard,
                      border: `0.5px solid ${staged ? SR.accentTeal : SR.border}`,
                      color: staged ? '#E0F5EF' : SR.textMuted,
                      fontFamily: SR.fontMono, fontSize: staged ? 10 : 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 120ms',
                    }}
                  >
                    {staged ? '✓' : '+'}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {preview && createPortal(
        <Box sx={{
          position: 'fixed',
          left: previewLeft,
          top: previewTop,
          width: PREVIEW_W,
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
          zIndex: 9999,
        }}>
          <img src={preview.imgUrl} alt="" style={{ width: '100%', display: 'block' }} />
        </Box>,
        document.body
      )}
    </>
  );
};

export default SearchDrawer;
