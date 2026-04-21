import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Box from '@mui/material/Box';
import { SR } from '../../theme';
import { AuthInput, SubmitBtn, Field } from './atoms';

const SignInForm = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!identifier.trim()) errs.identifier = 'required';
    if (!password) errs.password = 'required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await axios.post('/api/user/login', { identifier, password });
      navigate('/');
    } catch (err: any) {
      setErrors({ general: err.response?.data?.error ?? 'Login failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {errors.general && (
        <Box sx={{ fontSize: 12, color: SR.accentRed, fontFamily: SR.fontUi }}>{errors.general}</Box>
      )}
      <Field id="identifier" label="Username or email" error={errors.identifier}>
        <AuthInput
          id="identifier"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="you@example.com"
          autoComplete="username"
          hasError={!!errors.identifier}
        />
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <AuthInput
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          hasError={!!errors.password}
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
      <SubmitBtn type="submit" loading={loading}>
        {loading ? '' : 'Sign in'}
      </SubmitBtn>
    </Box>
  );
};

export default SignInForm;
