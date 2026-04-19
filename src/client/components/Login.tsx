import React, {useState} from 'react';
import type { ReactElement } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Input from '@mui/material/Input';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';


const Login = () :ReactElement => {
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const navigate = useNavigate()

  const handleInputChange = ( e : React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, setState : React.Dispatch<React.SetStateAction<string>> ) => {
    setState(e.target.value)
  }

  const handleSumbit = async () => {
    try{
      await axios.post('/api/user/login', {email, password});
      navigate("/");
    }
    catch(e :any){
      console.error(e.response?.data);
    }
  }

  return (
    <Box sx={{backgroundColor:"lightgray", padding: 3, borderRadius: 2}}>
      <FormControl>
        <InputLabel htmlFor='email'>Email </InputLabel>
        <Input
          id='email'
          value={email}
          onChange={(e) => {handleInputChange(e, setEmail)}}
          autoComplete='email'
          required
          autoFocus
        />
      </FormControl>
      <FormControl>
        <InputLabel htmlFor='password'>Password </InputLabel>
        <Input
          id='password'
          type='password'
          value={password}
          onChange={(e) => {handleInputChange(e, setPassword)}}
          autoComplete='current-password'
          required
        />
      </FormControl>
      <Button variant='contained' onClick={handleSumbit}>Login</Button>
      <Typography variant='body2'>
        Don't have an account? <Link to='/signup'>Sign up</Link>
      </Typography>
    </Box>
  )
}

export default Login