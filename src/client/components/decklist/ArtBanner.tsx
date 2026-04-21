import React from 'react';
import Box from '@mui/material/Box';
import { SR } from '../../theme';

interface Props { deckName: string; }

const ArtBanner = ({ deckName }: Props) => (
  <Box sx={{
    height: 190, flexShrink: 0, position: 'relative', overflow: 'hidden',
    backgroundColor: SR.surfaceInk, display: 'flex', alignItems: 'flex-end',
  }}>
    {/* Subtle grid lines */}
    <Box sx={{
      position: 'absolute', inset: 0,
      backgroundImage: `
        repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.025) 39px, rgba(255,255,255,0.025) 40px),
        repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.025) 39px, rgba(255,255,255,0.025) 40px)
      `,
    }} />
    {/* Card-back placeholder on the right */}
    <Box sx={{
      position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
      width: 108, height: 150, borderRadius: '8px',
      backgroundColor: SR.surfaceInkMid,
      border: `0.5px solid ${SR.borderDark}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
    }}>
      <Box sx={{ fontFamily: SR.fontMono, fontSize: 9, color: SR.textFaint, letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.6 }}>
        deck<br />portrait
      </Box>
    </Box>
    {/* Bottom gradient for readability */}
    <Box sx={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(to bottom, rgba(30,34,40,0.05) 0%, rgba(30,34,40,0.65) 100%)',
    }} />
    {/* Deck name */}
    <Box sx={{ position: 'relative', zIndex: 1, padding: '0 22px 16px' }}>
      <Box sx={{
        fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 22,
        color: SR.textLight, letterSpacing: '0.03em', lineHeight: 1.2,
      }}>
        {deckName}
      </Box>
    </Box>
  </Box>
);

export default ArtBanner;
