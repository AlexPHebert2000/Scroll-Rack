import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { SR } from '../theme';

export interface Change { action: string; card: { id: string; name: string }; }
export interface Commit { id: string; description: string; createdAt: string; changes: Change[]; }

interface Props {
  open: boolean;
  onClose: () => void;
  branchName: string;
  commits: Commit[];
  onBranchFrom: (args: { commitId: string; branchName: string }) => void;
  isBranching?: boolean;
}

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const shortHash = (id: string) => id.slice(0, 7);

const CommitRow = ({ commit, isHead, onBranchClick, isBranching, isLast }: {
  commit: Commit; isHead: boolean; isLast: boolean;
  onBranchClick: () => void; isBranching?: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', pl: 2, pr: 2 }}>
      {/* Branch line + dot */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 1.5, mt: '14px', flexShrink: 0 }}>
        <Box sx={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          backgroundColor: isHead ? SR.accentTealLight : SR.border,
        }} />
        {!isLast && <Box sx={{ width: '0.5px', flex: 1, minHeight: 24, backgroundColor: SR.border }} />}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, py: '8px' }}>
        {/* Main row — always visible */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            onClick={() => setExpanded((p) => !p)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, flex: 1,
              cursor: 'pointer',
              '&:hover .commit-msg': { color: SR.textPrimary },
            }}
          >
            <Box sx={{
              fontFamily: SR.fontMono, fontSize: 10, color: SR.accentGold,
              backgroundColor: SR.accentGoldLight,
              border: `0.5px solid ${SR.accentGoldBorder}`,
              borderRadius: '3px', padding: '1px 6px', flexShrink: 0,
            }}>
              {shortHash(commit.id)}
            </Box>
            {isHead && (
              <Box sx={{
                fontFamily: SR.fontUi, fontSize: 10, fontWeight: 500, color: SR.accentTeal,
                backgroundColor: SR.accentTealBg, border: `0.5px solid ${SR.accentTealLight}`,
                borderRadius: '3px', padding: '1px 6px', flexShrink: 0,
              }}>
                HEAD
              </Box>
            )}
            <Typography className="commit-msg" sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textMuted, flex: 1, transition: 'color 100ms' }}>
              {commit.description}
            </Typography>
          </Box>

          {!isHead && (
            <Button
              size="small"
              variant="text"
              disabled={isBranching}
              onClick={onBranchClick}
              aria-label={`Branch from ${commit.description}`}
              sx={{ fontSize: 11, color: SR.textFaint, minWidth: 0, px: 1, flexShrink: 0 }}
            >
              Branch here
            </Button>
          )}
        </Box>

        {/* Expandable diff */}
        <Collapse in={expanded} unmountOnExit>
          <Box sx={{
            mt: 1, mb: 1, backgroundColor: SR.surfaceInk, borderRadius: '6px',
            padding: '10px 12px', fontFamily: SR.fontMono, fontSize: 11, lineHeight: 1.8,
          }}>
            <Box sx={{ color: SR.diffHash, mb: 0.5 }}>commit {shortHash(commit.id)}</Box>
            {commit.changes.length === 0 ? (
              <Box sx={{ color: SR.diffMeta }}>No changes recorded.</Box>
            ) : (
              commit.changes.map((ch) => (
                <Box
                  key={`${ch.action}-${ch.card.id}`}
                  sx={{ color: ch.action === 'ADD' ? SR.diffAdd : SR.diffRemove }}
                >
                  {ch.action === 'ADD' ? '+ ' : '− '}{ch.card.name}
                </Box>
              ))
            )}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

const CommitHistory = ({ open, onClose, branchName, commits, onBranchFrom, isBranching }: Props) => {
  const [confirmBranch, setConfirmBranch] = useState<Commit | null>(null);
  const [branchNameInput, setBranchNameInput] = useState('');

  const handleBranchClick = (commit: Commit) => {
    setBranchNameInput(toSlug(commit.description));
    setConfirmBranch(commit);
  };

  const handleBranchConfirm = () => {
    if (confirmBranch) {
      onBranchFrom({ commitId: confirmBranch.id, branchName: branchNameInput });
      setConfirmBranch(null);
    }
  };

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose}>
        <Box sx={{ width: 340, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: SR.surfacePanel }}>

          <Box sx={{ p: '14px 20px', borderBottom: `0.5px solid ${SR.border}` }}>
            <Typography sx={{ fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 14, letterSpacing: '0.03em', color: SR.textPrimary }}>
              Commit History
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: SR.accentTealLight }} />
              <Typography sx={{ fontFamily: SR.fontMono, fontSize: 11, color: SR.textMuted }}>{branchName}</Typography>
            </Box>
          </Box>

          {commits.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textMuted }}>No commits yet.</Typography>
            </Box>
          ) : (
            <Box sx={{ overflow: 'auto', flex: 1, pt: 1 }}>
              {commits.map((commit, index) => (
                <CommitRow
                  key={commit.id}
                  commit={commit}
                  isHead={index === 0}
                  isLast={index === commits.length - 1}
                  onBranchClick={() => handleBranchClick(commit)}
                  isBranching={isBranching}
                />
              ))}
            </Box>
          )}
        </Box>
      </Drawer>

      <Dialog open={!!confirmBranch} onClose={() => setConfirmBranch(null)} maxWidth="xs" fullWidth>
        <DialogTitle>New Branch</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: SR.fontUi, fontSize: 13, color: SR.textMuted, mb: 2 }}>
            Creates a new branch at &ldquo;{confirmBranch?.description}&rdquo;.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Branch name"
            value={branchNameInput}
            onChange={(e) => setBranchNameInput(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmBranch(null)} variant="outlined">Cancel</Button>
          <Button variant="contained" disabled={!branchNameInput.trim()} onClick={handleBranchConfirm}>
            Create Branch
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CommitHistory;
