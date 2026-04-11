import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Grid from "@mui/material/Grid";
import CardImage, { Card, cardDisplayName } from "./CardImage";

interface Props {
  currentCards: Card[];
  addedCards: Card[];
  pendingRemoves: Set<string>;
  viewMode: "list" | "images";
  onRemove: (cardId: string) => void;
  onUndo: (cardId: string) => void;
}

const DecklistCards = ({ currentCards, addedCards, pendingRemoves, viewMode, onRemove, onUndo }: Props) => {
  const containerSx = { overflow: "auto", flex: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 };

  if (viewMode === "list") {
    return (
      <List dense sx={containerSx}>
        {currentCards.map((card) => {
          const removing = pendingRemoves.has(card.id);
          return (
            <ListItem
              key={card.id}
              sx={{ textDecoration: removing ? "line-through" : "none", opacity: removing ? 0.5 : 1 }}
              secondaryAction={
                removing
                  ? <Button size="small" onClick={() => onUndo(card.id)}>Undo</Button>
                  : <IconButton size="small" onClick={() => onRemove(card.id)} aria-label="remove">✕</IconButton>
              }
            >
              <ListItemText primary={cardDisplayName(card)} />
            </ListItem>
          );
        })}
        {addedCards.map((card) => (
          <ListItem
            key={card.id}
            sx={{ color: "success.main" }}
            secondaryAction={<Button size="small" color="inherit" onClick={() => onUndo(card.id)}>Undo</Button>}
          >
            <ListItemText primary={`+ ${cardDisplayName(card)}`} />
          </ListItem>
        ))}
      </List>
    );
  }

  return (
    <Box sx={containerSx}>
      <Grid container spacing={2} sx={{ p: 1 }}>
        {currentCards.map((card) => {
          const removing = pendingRemoves.has(card.id);
          return (
            <Grid item xs={4} key={card.id}>
              <CardImage
                card={card}
                dimmed={removing}
                action={
                  removing ? (
                    <Button size="small" variant="contained" disableElevation onClick={() => onUndo(card.id)}>
                      Undo
                    </Button>
                  ) : (
                    <IconButton
                      size="small"
                      onClick={() => onRemove(card.id)}
                      aria-label="remove"
                      sx={{ bgcolor: "rgba(0,0,0,0.55)", color: "white", "&:hover": { bgcolor: "rgba(0,0,0,0.8)" } }}
                    >
                      ✕
                    </IconButton>
                  )
                }
              />
            </Grid>
          );
        })}
        {addedCards.map((card) => (
          <Grid item xs={4} key={card.id}>
            <CardImage
              card={card}
              addedHighlight
              action={
                <Button size="small" variant="contained" disableElevation onClick={() => onUndo(card.id)}>
                  Undo
                </Button>
              }
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default DecklistCards;
