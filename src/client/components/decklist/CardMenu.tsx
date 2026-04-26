import React from 'react';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { SR } from '../../theme';
import type { BoardKey } from './CardListView';
import { BOARD_LABELS } from './CardListView';

const ALL_BOARDS: BoardKey[] = ['MAIN', 'SIDE', 'COMMANDER', 'CONSIDERING'];

interface CardMenuProps {
  anchorEl: HTMLElement | null;
  board: BoardKey;
  effectiveCount: number;
  hasArtOverride?: boolean;
  onClose: () => void;
  onAddOne: () => void;
  onRemoveOne: () => void;
  onRemoveAll: () => void;
  onOpenSetCount: () => void;
  onSetPortrait?: () => void;
  onSelectArt?: () => void;
  onMove: (toBoard: BoardKey) => void;
}

const CardMenu = ({
  anchorEl, board, effectiveCount, hasArtOverride,
  onClose, onAddOne, onRemoveOne, onRemoveAll, onOpenSetCount,
  onSetPortrait, onSelectArt, onMove,
}: CardMenuProps) => {
  const close = (action?: () => void) => () => { action?.(); onClose(); };

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      PaperProps={{ sx: { backgroundColor: SR.surfacePanel, border: `0.5px solid ${SR.border}`, borderRadius: 1, minWidth: 160 } }}
    >
      <MenuItem onClick={close(onAddOne)} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Add 1</MenuItem>
      <MenuItem onClick={close(onOpenSetCount)} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Set count</MenuItem>
      <MenuItem onClick={close(onRemoveOne)} disabled={effectiveCount <= 0} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Remove 1</MenuItem>
      <MenuItem onClick={close(onRemoveAll)} disabled={effectiveCount <= 0} sx={{ fontFamily: SR.fontUi, fontSize: 12, color: SR.accentRed }}>Remove all</MenuItem>
      {(onSetPortrait || onSelectArt) && <Divider sx={{ borderColor: SR.border, my: '4px' }} />}
      {onSetPortrait && (
        <MenuItem onClick={close(onSetPortrait)} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>Set as portrait</MenuItem>
      )}
      {onSelectArt && (
        <MenuItem onClick={close(onSelectArt)}
          sx={{ fontFamily: SR.fontUi, fontSize: 12, color: hasArtOverride ? SR.accentTealLight : undefined }}>
          {hasArtOverride ? 'Change printing (custom)' : 'Select printing'}
        </MenuItem>
      )}
      <Divider sx={{ borderColor: SR.border, my: '4px' }} />
      {ALL_BOARDS.filter(b => b !== board).map(target => (
        <MenuItem key={target} onClick={close(() => onMove(target))} sx={{ fontFamily: SR.fontUi, fontSize: 12 }}>
          Move to {BOARD_LABELS[target]}
        </MenuItem>
      ))}
    </Menu>
  );
};

export default CardMenu;
