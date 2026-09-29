import React from 'react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';

import LogoMark from './LogoMark';
import SignInForm from './auth/SignInForm';
import SignUpForm from './auth/SignUpForm';
import { SR } from '../theme';

const Tab = ({ to, label, active }: { to: string; label: string; active: boolean }) => (
  <Box
    component={Link}
    to={to}
    sx={{
      flex: 1, textAlign: 'center', padding: '10px 0',
      fontSize: 12, fontWeight: 500, letterSpacing: '0.06em',
      textTransform: 'uppercase', fontFamily: SR.fontUi,
      textDecoration: 'none',
      color: active ? SR.textPrimary : SR.textFaint,
      borderBottom: active ? `1.5px solid ${SR.accentTeal}` : '1.5px solid transparent',
      marginBottom: '-0.5px',
      transition: 'color 0.15s, border-color 0.15s',
      '&:hover': { color: active ? SR.textPrimary : SR.textMuted },
    }}
  >
    {label}
  </Box>
);

export const AuthPage = ({ mode }: { mode: 'signin' | 'signup' }): ReactElement => (
  <Box sx={{
    minHeight: '100vh', backgroundColor: SR.surfaceApp,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '48px 24px' }}>

      {/* Brand block */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', mb: '40px' }}>
        <Box sx={{
          fontFamily: SR.fontDisplay, fontSize: 33, fontWeight: 500,
          letterSpacing: '0.04em', color: SR.textPrimary, mb: '-12px',
        }}>
          Scroll Rack
        </Box>
        <LogoMark size={100} />
        <Box sx={{
          fontFamily: SR.fontMono, fontSize: 11, color: SR.textMuted,
          letterSpacing: '0.02em', mt: '-4px',
        }}>
          branch · commit · merge
        </Box>
      </Box>

      {/* Card */}
      <Box sx={{
        backgroundColor: SR.surfacePanel,
        border: 'none',
        borderRadius: '8px',
        width: '100%', maxWidth: 360,
        padding: '32px',
        mt: '-9px',
      }}>
        <Box sx={{ display: 'flex', borderBottom: `0.5px solid ${SR.border}`, mb: '24px' }}>
          <Tab to="/login" label="Sign in" active={mode === 'signin'} />
          <Tab to="/signup" label="Sign up" active={mode === 'signup'} />
        </Box>

        {mode === 'signin' ? <SignInForm /> : <SignUpForm />}
      </Box>

      {/* Hash footer */}
      <Box sx={{ mt: '40px', fontFamily: SR.fontMono, fontSize: 10, color: SR.textFaint, letterSpacing: '0.04em', textAlign: 'center' }}>
        v1.0.0 · commit <Box component="span" sx={{ color: SR.accentGold }}>a3f9d12</Box>
      </Box>

    </Box>
  </Box>
);

const Login = (): ReactElement => <AuthPage mode="signin" />;
export default Login;
