import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Box from '@mui/material/Box';
import { SR } from '../../theme';
import { AuthInput, SubmitBtn, Field } from './atoms';

const SignUpForm = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!username.trim()) errs.username = 'username is required';
    if (!email.trim() || !email.includes('@')) errs.email = 'valid email required';
    if (password.length < 8) errs.password = 'min 8 characters';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      await axios.post('/api/user', { name: username, username, email, password });
      navigate('/login');
    } catch (err: any) {
      setErrors({ general: err.response?.data?.error ?? 'Sign up failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {errors.general && (
        <Box sx={{ fontSize: 12, color: SR.accentRed, fontFamily: SR.fontUi }}>{errors.general}</Box>
      )}
      <Field id="su-username" label="Username" error={errors.username}>
        <AuthInput
          id="su-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="tarmogoyf42"
          autoComplete="username"
          hasError={!!errors.username}
        />
      </Field>
      <Field id="su-email" label="Email" error={errors.email}>
        <AuthInput
          id="su-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          hasError={!!errors.email}
        />
      </Field>
      <Field id="su-password" label="Password" error={errors.password}>
        <AuthInput
          id="su-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          hasError={!!errors.password}
        />
      </Field>
      <SubmitBtn type="submit" loading={loading}>
        {loading ? '' : 'Sign up'}
      </SubmitBtn>
    </Box>
  );
};

export default SignUpForm;
