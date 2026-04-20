import React, { useState } from 'react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import LogoMark from './LogoMark';
import { SR } from '../theme';

const fetchSession = () => axios.get('/api/user/me');

const NavBar = (): ReactElement => {
  const { isSuccess, data } = useQuery({ queryKey: ['sessionLookup'], queryFn: fetchSession });
  const username: string | undefined = data?.data?.user?.username;
  const initials = username ? username.slice(0, 2).toUpperCase() : '';

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [newDeckOpen, setNewDeckOpen] = useState(false);
  const [deckName, setDeckName] = useState('');

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    handleClose();
    await axios.post('/api/user/logout');
    queryClient.removeQueries({ queryKey: ['sessionLookup'] });
    navigate('/login');
  };

  const handleNewDeckOpen = () => setNewDeckOpen(true);
  const handleNewDeckClose = () => { setNewDeckOpen(false); setDeckName(''); };

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await axios.post('/api/deck', { name: deckName });
    handleNewDeckClose();
    navigate(`/deck/${data.deckId}`);
  };

  return (
    <AppBar position="sticky">
      <Toolbar sx={{ minHeight: '50px !important', px: '20px', gap: 2 }}>

        {/* Logo */}
        <Box
          component={Link}
          to="/"
          sx={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}
        >
          <LogoMark size={28} />
          <Box sx={{
            fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 11,
            color: SR.textLight, letterSpacing: '0.10em', lineHeight: 1.35,
          }}>
            SCROLL<br />RACK
          </Box>
        </Box>

        <Box sx={{ flex: 1 }} />

        {isSuccess ? (
          <>
            <IconButton
              onClick={handleNewDeckOpen}
              aria-label="new deck"
              sx={{ color: SR.surfaceInkDim, '&:hover': { color: SR.textLight } }}
            >
              <AddCircleOutlineIcon fontSize="small" />
            </IconButton>

            {/* User avatar */}
            <Box
              onClick={handleOpen}
              role="button"
              aria-label="profile"
              sx={{
                width: 30, height: 30, borderRadius: '50%',
                backgroundColor: SR.surfaceInkMid,
                border: `0.5px solid ${SR.borderDark}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: SR.accentTealLight, fontWeight: 500,
                fontFamily: SR.fontUi, cursor: 'pointer', flexShrink: 0,
                '&:hover': { backgroundColor: SR.surfaceInkSub },
              }}
            >
              {initials}
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  backgroundColor: SR.surfacePanel,
                  border: `0.5px solid ${SR.border}`,
                  borderRadius: 1,
                  mt: 0.5,
                  minWidth: 160,
                },
              }}
            >
              <MenuItem component={Link} to={`/profile/${username}`} onClick={handleClose}>
                My Account
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: SR.accentRed }}>
                Logout
              </MenuItem>
            </Menu>

            <Dialog
              open={newDeckOpen}
              onClose={handleNewDeckClose}
              PaperProps={{ component: 'form', onSubmit: handleCreateDeck }}
            >
              <DialogTitle>New Deck</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  label="Deck name"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  fullWidth
                  required
                  sx={{ mt: 1 }}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={handleNewDeckClose} variant="outlined">Cancel</Button>
                <Button type="submit" variant="contained" disabled={!deckName.trim()}>
                  Create
                </Button>
              </DialogActions>
            </Dialog>
          </>
        ) : (
          <Button
            component={Link}
            to="/login"
            sx={{ color: SR.textLight, fontSize: 12, fontFamily: SR.fontUi }}
          >
            Login
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default NavBar;
