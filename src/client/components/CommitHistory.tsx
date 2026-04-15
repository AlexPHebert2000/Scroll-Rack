import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

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

const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const CommitHistory = ({ open, onClose, branchName, commits, onBranchFrom, isBranching }: Props) => {
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);
  const [confirmBranch, setConfirmBranch] = useState<Commit | null>(null);
  const [branchNameInput, setBranchNameInput] = useState("");

  const toggleCommit = (commitId: string) => {
    setExpandedCommit((prev) => (prev === commitId ? null : commitId));
  };

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
        <Box sx={{ width: 320, display: "flex", flexDirection: "column", height: "100%" }}>

          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="h6">Commit History</Typography>
            <Typography variant="caption" color="text.secondary">{branchName}</Typography>
          </Box>

          {commits.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">No commits yet.</Typography>
            </Box>
          ) : (
            <List dense sx={{ overflow: "auto", flex: 1, pt: 1 }}>
              {commits.map((commit, index) => (
                <Box key={commit.id}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", pl: 2 }}>

                    {/* Tree line + dot */}
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mr: 1.5, mt: 0.5 }}>
                      <Box sx={{
                        width: 10, height: 10, borderRadius: "50%",
                        bgcolor: index === 0 ? "primary.main" : "text.disabled",
                        flexShrink: 0,
                      }} />
                      {index < commits.length - 1 && (
                        <Box sx={{ width: 2, flex: 1, minHeight: 24, bgcolor: "divider" }} />
                      )}
                    </Box>

                    {/* Commit row */}
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <ListItemButton
                          onClick={() => toggleCommit(commit.id)}
                          sx={{ borderRadius: 1, px: 1, py: 0.5, flex: 1 }}
                        >
                          <ListItemText
                            primary={commit.description}
                            secondary={new Date(commit.createdAt).toLocaleString()}
                            primaryTypographyProps={{ variant: "body2" }}
                            secondaryTypographyProps={{ variant: "caption" }}
                          />
                        </ListItemButton>

                        {index > 0 && (
                          <Button
                            size="small"
                            variant="text"
                            disabled={isBranching}
                            onClick={() => handleBranchClick(commit)}
                            sx={{ minWidth: 0, px: 1, fontSize: "0.7rem" }}
                            aria-label={`Branch from ${commit.description}`}
                          >
                            Branch here
                          </Button>
                        )}
                      </Box>

                      <Collapse in={expandedCommit === commit.id} unmountOnExit>
                        <Box sx={{ pl: 1, pb: 1 }}>
                          {commit.changes.length === 0 ? (
                            <Typography variant="caption" color="text.secondary">No changes recorded.</Typography>
                          ) : (
                            commit.changes.map((change) => (
                              <Typography
                                key={`${change.action}-${change.card.id}`}
                                variant="caption"
                                display="block"
                                color={change.action === "add" ? "success.main" : "error.main"}
                              >
                                {change.action === "add" ? "+ " : "− "}{change.card.name}
                              </Typography>
                            ))
                          )}
                        </Box>
                      </Collapse>
                    </Box>

                  </Box>
                </Box>
              ))}
            </List>
          )}

        </Box>
      </Drawer>

      {/* Branch confirmation dialog */}
      <Dialog open={!!confirmBranch} onClose={() => setConfirmBranch(null)} maxWidth="xs" fullWidth>
        <DialogTitle>New Branch</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Creates a new branch with the deck state at &ldquo;{confirmBranch?.description}&rdquo;.
            You&apos;ll be switched to it.
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
          <Button onClick={() => setConfirmBranch(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!branchNameInput.trim()}
            onClick={handleBranchConfirm}
          >
            Create Branch
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CommitHistory;
