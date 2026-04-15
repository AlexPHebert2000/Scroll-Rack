import React, { useState } from "react";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";

export interface Change { action: string; card: { id: string; name: string }; }
export interface Commit { id: string; description: string; createdAt: string; changes: Change[]; }

interface Props {
  open: boolean;
  onClose: () => void;
  branchName: string;
  commits: Commit[];
}

const CommitHistory = ({ open, onClose, branchName, commits }: Props) => {
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null);

  const toggleCommit = (commitId: string) => {
    setExpandedCommit((prev) => (prev === commitId ? null : commitId));
  };

  console.log(commits)

  return (
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
                    <ListItemButton
                      onClick={() => toggleCommit(commit.id)}
                      sx={{ borderRadius: 1, px: 1, py: 0.5 }}
                    >
                      <ListItemText
                        primary={commit.description}
                        secondary={new Date(commit.createdAt).toLocaleString()}
                        primaryTypographyProps={{ variant: "body2" }}
                        secondaryTypographyProps={{ variant: "caption" }}
                      />
                    </ListItemButton>

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
  );
};

export default CommitHistory;
