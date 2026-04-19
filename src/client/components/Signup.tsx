import React, { useState } from 'react';
import type { ReactElement } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Input from '@mui/material/Input';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

const Signup = (): ReactElement => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    setState: React.Dispatch<React.SetStateAction<string>>
  ) => {
    setState(e.target.value);
  };

  const handleSubmit = async () => {
    setError('');
    try {
      await axios.post('/api/user', { name, email, username, password });
      navigate('/login');
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Sign up failed');
    }
  };

  return (
    <Box sx={{ backgroundColor: 'lightgray', padding: 3, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FormControl>
        <InputLabel htmlFor='name'>Name</InputLabel>
        <Input
          id='name'
          value={name}
          onChange={(e) => handleInputChange(e, setName)}
          autoComplete='name'
          required
          autoFocus
        />
      </FormControl>
      <FormControl>
        <InputLabel htmlFor='username'>Username</InputLabel>
        <Input
          id='username'
          value={username}
          onChange={(e) => handleInputChange(e, setUsername)}
          autoComplete='username'
          required
        />
      </FormControl>
      <FormControl>
        <InputLabel htmlFor='email'>Email</InputLabel>
        <Input
          id='email'
          value={email}
          onChange={(e) => handleInputChange(e, setEmail)}
          autoComplete='email'
          required
        />
      </FormControl>
      <FormControl>
        <InputLabel htmlFor='password'>Password</InputLabel>
        <Input
          id='password'
          type='password'
          value={password}
          onChange={(e) => handleInputChange(e, setPassword)}
          autoComplete='new-password'
          required
        />
      </FormControl>
      {error && <Typography color='error' variant='body2'>{error}</Typography>}
      <Button variant='contained' onClick={handleSubmit}>Sign Up</Button>
      <Typography variant='body2'>
        Already have an account? <Link to='/login'>Log in</Link>
      </Typography>
    </Box>
  );
};

export default Signup;
