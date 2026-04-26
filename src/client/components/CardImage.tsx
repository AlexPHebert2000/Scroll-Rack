import React, { useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";

export interface CardArtFace { name: string; imageUrl: string | null; artCropUrl: string | null; }
export interface CardArt {
  id: string; oracleId: string; name: string;
  imageUrl: string | null; artCropUrl: string | null;
  set: string | null; setName: string | null; artist: string | null;
  faces: CardArtFace[];
}

export interface CardFace { name: string; typeLine?: string | null; cmc?: number | null; }
export interface Card {
  id: string; name: string;
  oracleId?: string | null;
  typeLine?: string | null; cmc?: number | null; manaCost?: string | null;
  oracleText?: string | null; layout?: string | null;
  faces: CardFace[];
  defaultArt?: CardArt | null;
}

export const cardDisplayName = (card: Card) =>
  card.faces?.length > 0 ? card.faces.map((f) => f.name).join(" // ") : card.name;

export interface CardImageProps {
  card: Card;
  art?: CardArt | null;
  action?: React.ReactNode;
  dimmed?: boolean;
  addedHighlight?: boolean;
  faceIdx?: number;
  onFlipFace?: () => void;
}

const circularSx = {
  width: "clamp(24px, 2.3vw, 36px)",
  height: "clamp(24px, 2.3vw, 36px)",
  padding: 0,
};

const CardImage = ({ card, art, action, dimmed, addedHighlight, faceIdx: externalFaceIdx, onFlipFace }: CardImageProps) => {
  const [internalFaceIdx, setInternalFaceIdx] = useState(0);
  const faceIdx = externalFaceIdx !== undefined ? externalFaceIdx : internalFaceIdx;
  const resolvedArt = art ?? card.defaultArt ?? null;
  const isMultiFace = (card.faces?.length ?? 0) >= 2;

  let imageUrl: string | null = null;
  if (isMultiFace) {
    const artFace = resolvedArt?.faces?.find(f => f.name === card.faces[faceIdx]?.name);
    imageUrl = artFace?.imageUrl ?? resolvedArt?.imageUrl ?? null;
  } else {
    imageUrl = resolvedArt?.imageUrl ?? null;
  }

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        opacity: dimmed ? 0.4 : 1,
        outline: addedHighlight ? "3px solid" : "none",
        outlineColor: "success.main",
        borderRadius: 2,
        transition: "opacity 0.15s",
        "& .card-overlay": { opacity: 0, transition: "opacity 0.15s" },
        "&:hover .card-overlay": { opacity: 1 },
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={cardDisplayName(card)}
          style={{ width: "100%", display: "block", borderRadius: 8 }}
        />
      ) : (
        <Box
          sx={{
            width: "100%",
            aspectRatio: "745 / 1040",
            bgcolor: "action.selected",
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 1,
          }}
        >
          <Typography variant="caption" align="center">{cardDisplayName(card)}</Typography>
        </Box>
      )}

      {isMultiFace && externalFaceIdx === undefined && (
        <IconButton
          className="card-overlay"
          size="small"
          onClick={() => setInternalFaceIdx((i) => (i === 0 ? 1 : 0))}
          title={faceIdx === 0 ? "Show back face" : "Show front face"}
          sx={{
            ...circularSx,
            position: "absolute",
            bottom: 6,
            right: 6,
            bgcolor: "rgba(0,0,0,0.65)",
            color: "white",
            fontSize: "1rem",
            "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
          }}
        >
          ↺
        </IconButton>
      )}

      {action && (
        <Box className="card-overlay" sx={{ position: "absolute", top: 4, right: 4 }}>
          {action}
        </Box>
      )}
    </Box>
  );
};

export default CardImage;
