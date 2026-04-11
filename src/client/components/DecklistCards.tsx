import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import CardImage, { Card, CARD_WIDTH, cardDisplayName } from "./CardImage";

const GRID_COLS = 3;
const GRID_GAP = 4; // px

// Fixed panel width so the grid never reflows: cols × cardWidth + gaps + padding + border
export const DECKLIST_PANEL_WIDTH = GRID_COLS * CARD_WIDTH + (GRID_COLS - 1) * GRID_GAP + 2 * GRID_GAP + 2;

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
    <Box sx={{ ...containerSx, display: "grid", gridTemplateColumns: `repeat(${GRID_COLS}, ${CARD_WIDTH}px)`, gap: `${GRID_GAP}px`, p: `${GRID_GAP}px` }}>
      {currentCards.map((card) => {
        const removing = pendingRemoves.has(card.id);
        return (
          <CardImage
            key={card.id}
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
        );
      })}
      {addedCards.map((card) => (
        <CardImage
          key={card.id}
          card={card}
          addedHighlight
          action={
            <Button size="small" variant="contained" disableElevation onClick={() => onUndo(card.id)}>
              Undo
            </Button>
          }
        />
      ))}
    </Box>
  );
};

export default DecklistCards;
