import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { styled, keyframes } from '@mui/material/styles';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import LogoMark from './LogoMark';
import { SR } from '../theme';

// ── Styled atoms ────────────────────────────────────────────────────────────

const AuthLabel = styled('label')({
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: SR.textFaint,
  fontFamily: SR.fontUi,
});

const AuthInput = styled('input', {
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

const SubmitBtn = styled('button', {
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

// ── Field ────────────────────────────────────────────────────────────────────

const Field = ({ id, label, error, children }: {
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

// ── Auth page (shared layout) ────────────────────────────────────────────────

export const AuthPage = ({ mode }: { mode: 'signin' | 'signup' }): ReactElement => {
  const navigate = useNavigate();

  // Sign in state
  const [siEmail, setSiEmail] = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siErrors, setSiErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [siLoading, setSiLoading] = useState(false);

  // Sign up state
  const [suUsername, setSuUsername] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suErrors, setSuErrors] = useState<{ username?: string; email?: string; password?: string; general?: string }>({});
  const [suLoading, setSuLoading] = useState(false);

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof siErrors = {};
    if (!siEmail.trim()) errs.email = 'required';
    if (!siPassword) errs.password = 'required';
    if (Object.keys(errs).length) { setSiErrors(errs); return; }
    setSiErrors({});
    setSiLoading(true);
    try {
      await axios.post('/api/user/login', { email: siEmail, password: siPassword });
      navigate('/');
    } catch (err: any) {
      setSiErrors({ general: err.response?.data?.error ?? 'Login failed' });
    } finally {
      setSiLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof suErrors = {};
    if (!suUsername.trim()) errs.username = 'username is required';
    if (!suEmail.trim() || !suEmail.includes('@')) errs.email = 'valid email required';
    if (suPassword.length < 8) errs.password = 'min 8 characters';
    if (Object.keys(errs).length) { setSuErrors(errs); return; }
    setSuErrors({});
    setSuLoading(true);
    try {
      await axios.post('/api/user', { name: suUsername, username: suUsername, email: suEmail, password: suPassword });
      navigate('/login');
    } catch (err: any) {
      setSuErrors({ general: err.response?.data?.error ?? 'Sign up failed' });
    } finally {
      setSuLoading(false);
    }
  };

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

  return (
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
          {/* Tabs */}
          <Box sx={{ display: 'flex', borderBottom: `0.5px solid ${SR.border}`, mb: '24px' }}>
            <Tab to="/login" label="Sign in" active={mode === 'signin'} />
            <Tab to="/signup" label="Sign up" active={mode === 'signup'} />
          </Box>

          {/* Sign in form */}
          {mode === 'signin' && (
            <Box component="form" onSubmit={handleSignin} sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {siErrors.general && (
                <Box sx={{ fontSize: 12, color: SR.accentRed, fontFamily: SR.fontUi }}>{siErrors.general}</Box>
              )}
              <Field id="email" label="Username or email" error={siErrors.email}>
                <AuthInput
                  id="email"
                  type="text"
                  value={siEmail}
                  onChange={(e) => setSiEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                  hasError={!!siErrors.email}
                />
              </Field>
              <Field id="password" label="Password" error={siErrors.password}>
                <AuthInput
                  id="password"
                  type="password"
                  value={siPassword}
                  onChange={(e) => setSiPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  hasError={!!siErrors.password}
                />
              </Field>
              <Box sx={{ textAlign: 'right' }}>
                <Box
                  component="a"
                  href="#"
                  sx={{ fontSize: 12, color: SR.textMuted, textDecoration: 'none', '&:hover': { color: SR.accentTeal } }}
                >
                  forgot password?
                </Box>
              </Box>
              <SubmitBtn type="submit" loading={siLoading}>
                {siLoading ? '' : 'Sign in'}
              </SubmitBtn>
            </Box>
          )}

          {/* Sign up form */}
          {mode === 'signup' && (
            <Box component="form" onSubmit={handleSignup} sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {suErrors.general && (
                <Box sx={{ fontSize: 12, color: SR.accentRed, fontFamily: SR.fontUi }}>{suErrors.general}</Box>
              )}
              <Field id="su-username" label="Username" error={suErrors.username}>
                <AuthInput
                  id="su-username"
                  type="text"
                  value={suUsername}
                  onChange={(e) => setSuUsername(e.target.value)}
                  placeholder="tarmogoyf42"
                  autoComplete="username"
                  hasError={!!suErrors.username}
                />
              </Field>
              <Field id="su-email" label="Email" error={suErrors.email}>
                <AuthInput
                  id="su-email"
                  type="email"
                  value={suEmail}
                  onChange={(e) => setSuEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  hasError={!!suErrors.email}
                />
              </Field>
              <Field id="su-password" label="Password" error={suErrors.password}>
                <AuthInput
                  id="su-password"
                  type="password"
                  value={suPassword}
                  onChange={(e) => setSuPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  hasError={!!suErrors.password}
                />
              </Field>
              <SubmitBtn type="submit" loading={suLoading}>
                {suLoading ? '' : 'Sign up'}
              </SubmitBtn>
            </Box>
          )}
        </Box>

        {/* Hash footer */}
        <Box sx={{ mt: '40px', fontFamily: SR.fontMono, fontSize: 10, color: SR.textFaint, letterSpacing: '0.04em', textAlign: 'center' }}>
          v1.0.0 · commit <Box component="span" sx={{ color: SR.accentGold }}>a3f9d12</Box>
        </Box>

      </Box>
    </Box>
  );
};

const Login = (): ReactElement => <AuthPage mode="signin" />;
export default Login;
