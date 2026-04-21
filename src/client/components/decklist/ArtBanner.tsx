import React from 'react';
import Box from '@mui/material/Box';
import { SR } from '../../theme';

interface Props { deckName: string; portraitUrl: string | null; onChangePortrait?: () => void; }

const PortraitIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="1" width="10" height="10" rx="1.5" />
    <circle cx="4.5" cy="4.5" r="1.5" />
    <path d="M1 8.5 L3.5 6.5 L5.5 8 L8 5.5 L11 8.5" />
  </svg>
);

const ArtBanner = ({ deckName, portraitUrl, onChangePortrait }: Props) => (
  <Box sx={{
    height: 160, flexShrink: 0, overflow: 'hidden',
    backgroundColor: SR.surfaceInk, display: 'flex', position: 'relative',
  }}>
    {/* Left half — deck name centered */}
    <Box sx={{
      width: '50%', display: 'flex', alignItems: 'center',
      padding: '0 32px', position: 'relative', zIndex: 1,
    }}>
      <Box sx={{
        fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 26,
        color: SR.textLight, letterSpacing: '0.03em', lineHeight: 1.2,
      }}>
        {deckName}
      </Box>
    </Box>

    {/* Right half — art image or placeholder */}
    <Box sx={{ width: '50%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {portraitUrl ? (
        <Box sx={{
          position: 'absolute', inset: 0,
          maskImage: 'linear-gradient(to right, transparent 0%, black 28%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 28%)',
        }}>
          <Box
            component="img"
            src={portraitUrl}
            alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }}
          />
        </Box>
      ) : (
        <>
          {/* Subtle grid lines */}
          <Box sx={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.025) 39px, rgba(255,255,255,0.025) 40px),
              repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.025) 39px, rgba(255,255,255,0.025) 40px)
            `,
          }} />
          {/* Card-back placeholder */}
          <Box sx={{
            position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
            width: 90, height: 126, borderRadius: '6px',
            backgroundColor: SR.surfaceInkMid,
            border: `0.5px solid ${SR.borderDark}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Box sx={{ fontFamily: SR.fontMono, fontSize: 9, color: SR.textFaint, letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.6 }}>
              deck<br />portrait
            </Box>
          </Box>
        </>
      )}
    </Box>

    {/* Change portrait button — absolute bottom right */}
    {onChangePortrait && (
      <Box
        component="button"
        onClick={onChangePortrait}
        sx={{
          position: 'absolute', bottom: 12, right: 14, zIndex: 2,
          background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.18)',
          borderRadius: '5px', padding: '5px 10px', cursor: 'pointer',
          fontFamily: SR.fontUi, fontSize: 10, color: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', gap: '5px',
          backdropFilter: 'blur(4px)',
          '&:hover': { background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.9)' },
          transition: 'background 120ms, color 120ms',
        }}
      >
        <PortraitIcon />
        change portrait
      </Box>
    )}
  </Box>
);

export default ArtBanner;
