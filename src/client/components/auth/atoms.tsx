import React from 'react';
import type { ReactElement } from 'react';
import { styled, keyframes } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { SR } from '../../theme';

export const AuthLabel = styled('label')({
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: SR.textFaint,
  fontFamily: SR.fontUi,
});

export const AuthInput = styled('input', {
  shouldForwardProp: (p) => p !== 'hasError',
})<{ hasError?: boolean }>(({ hasError }) => ({
  backgroundColor: SR.surfaceApp,
  border: `0.5px solid ${hasError ? SR.accentRed : SR.border}`,
  borderRadius: 6,
  padding: '10px 12px',
  fontFamily: SR.fontUi,
  fontSize: 14,
  color: SR.textPrimary,
  outline: 'none',
  width: '100%',
  transition: 'border-color 0.15s',
  '&:focus': { borderColor: hasError ? SR.accentRed : SR.accentTeal },
  '&::placeholder': { color: SR.textFaint },
}));

const spinKf = keyframes`to { transform: translate(-50%, -50%) rotate(360deg); }`;

export const SubmitBtn = styled('button', {
  shouldForwardProp: (p) => p !== 'loading',
})<{ loading?: boolean }>(({ loading }) => ({
  marginTop: 8,
  background: SR.accentTeal,
  color: loading ? 'transparent' : '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '11px 16px',
  fontFamily: SR.fontUi,
  fontSize: 14,
  fontWeight: 500,
  cursor: loading ? 'default' : 'pointer',
  width: '100%',
  position: 'relative',
  overflow: 'hidden',
  transition: 'background 0.15s',
  '&:hover': { background: '#165A4A' },
  '&:active': { background: '#124D3F' },
  ...(loading && {
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 16,
      height: 16,
      border: '1.5px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: `${spinKf} 0.7s linear infinite`,
    },
  }),
}));

export const Field = ({ id, label, error, children }: {
  id: string; label: string; error?: string; children: ReactElement;
}) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
    <AuthLabel htmlFor={id}>{label}</AuthLabel>
    {children}
    {error && (
      <Box sx={{ fontSize: 11, color: SR.accentRed, fontFamily: SR.fontMono }}>{error}</Box>
    )}
  </Box>
);
