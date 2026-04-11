import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardImage, { Card, cardDisplayName } from "./CardImage";

interface Props {
  results: Card[];
  currentCards: Card[];
  pendingAdds: Set<string>;
  pendingRemoves: Set<string>;
  viewMode: "list" | "images";
  activeSearch: string;
  isFetching: boolean;
  onAdd: (card: Card) => void;
  onRemove: (cardId: string) => void;
  onUndo: (cardId: string) => void;
}

const SearchResults = ({
  results, currentCards, pendingAdds, pendingRemoves,
  viewMode, activeSearch, isFetching,
  onAdd, onRemove, onUndo,
}: Props) => {
  const containerSx = { overflow: "auto", flex: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 };

  const empty = activeSearch && results.length === 0 && !isFetching;

  if (viewMode === "list") {
    return (
      <List dense sx={containerSx}>
        {results.map((card) => {
          const alreadyInDeck = currentCards.some((c) => c.id === card.id);
          const staged = pendingAdds.has(card.id);
          const stagingRemoval = pendingRemoves.has(card.id);

          return (
            <ListItem
              key={card.id}
              secondaryAction={
                staged ? (
                  <Button size="small" onClick={() => onUndo(card.id)}>Undo</Button>
                ) : alreadyInDeck && !stagingRemoval ? (
                  <Button size="small" color="error" onClick={() => onRemove(card.id)}>Remove</Button>
                ) : (
                  <Button size="small" color="success" onClick={() => onAdd(card)}>Add</Button>
                )
              }
            >
              <ListItemText
                primary={cardDisplayName(card)}
                secondary={
                  staged ? "staged to add"
                  : alreadyInDeck && !stagingRemoval ? "in deck"
                  : stagingRemoval ? "staged to remove"
                  : undefined
                }
              />
            </ListItem>
          );
        })}
        {empty && <ListItem><ListItemText secondary="No results found." /></ListItem>}
      </List>
    );
  }

  return (
    <Box sx={containerSx}>
      <Grid container spacing={2} sx={{ p: 1 }}>
        {results.map((card) => {
          const alreadyInDeck = currentCards.some((c) => c.id === card.id);
          const staged = pendingAdds.has(card.id);
          const stagingRemoval = pendingRemoves.has(card.id);

          return (
            <Grid item xs={6} key={card.id}>
              <CardImage
                card={card}
                dimmed={stagingRemoval}
                addedHighlight={staged}
                action={
                  staged ? (
                    <Button size="small" variant="contained" disableElevation onClick={() => onUndo(card.id)}>
                      Undo
                    </Button>
                  ) : alreadyInDeck && !stagingRemoval ? (
                    <IconButton
                      size="small"
                      onClick={() => onRemove(card.id)}
                      sx={{ bgcolor: "rgba(180,0,0,0.75)", color: "white", "&:hover": { bgcolor: "rgba(180,0,0,0.95)" } }}
                    >
                      ✕
                    </IconButton>
                  ) : (
                    <IconButton
                      size="small"
                      onClick={() => onAdd(card)}
                      sx={{ bgcolor: "rgba(0,120,0,0.75)", color: "white", "&:hover": { bgcolor: "rgba(0,120,0,0.95)" } }}
                    >
                      +
                    </IconButton>
                  )
                }
              />
            </Grid>
          );
        })}
      </Grid>
      {empty && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No results found.</Typography>
      )}
    </Box>
  );
};

export default SearchResults;
