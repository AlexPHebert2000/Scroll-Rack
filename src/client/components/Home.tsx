import React from 'react';
import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { SR } from '../theme';

const Home = (): ReactElement => {
  const navigate = useNavigate();

  const q = useQuery({ queryKey: ['sessionLookup'], queryFn: () => axios.get('/api/user/me') });
  const user: { username: string; decks: { name: string; id: string }[] } = q.data?.data.user;

  if (!q.isSuccess) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography sx={{ fontFamily: SR.fontUi, fontSize: 14, color: SR.textMuted }}>
          Please{' '}
          <Box component={Link} to="/login" sx={{ color: SR.accentTeal, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            log in
          </Box>
          {' '}or{' '}
          <Box component={Link} to="/signup" sx={{ color: SR.accentTeal, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            sign up
          </Box>
          {' '}to view your decklists.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 720 }}>
      <Typography sx={{ fontFamily: SR.fontDisplay, fontWeight: 600, fontSize: 24, letterSpacing: '0.03em', color: SR.textPrimary, mb: 3 }}>
        Your Decks
      </Typography>

      {user?.decks?.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {user.decks.map(({ name, id }) => (
            <Box
              key={id}
              onClick={() => navigate(`/deck/${id}`)}
              sx={{
                display: 'flex', alignItems: 'center',
                padding: '10px 14px',
                borderBottom: `0.5px solid ${SR.border}`,
                backgroundColor: SR.surfaceApp,
                cursor: 'pointer',
                '&:first-of-type': { borderTop: `0.5px solid ${SR.border}`, borderRadius: '6px 6px 0 0' },
                '&:last-of-type': { borderRadius: '0 0 6px 6px' },
                '&:hover': { backgroundColor: SR.surfacePanel },
              }}
            >
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: SR.accentTealLight, flexShrink: 0, mr: 1.5,
              }} />
              <Typography sx={{ fontFamily: SR.fontUi, fontSize: 14, color: SR.textPrimary, flex: 1 }}>
                {name}
              </Typography>
              <Typography sx={{ fontFamily: SR.fontMono, fontSize: 11, color: SR.textFaint }}>
                main
              </Typography>
            </Box>
          ))}
        </Box>
      ) : (
        <Typography sx={{ fontFamily: SR.fontUi, fontSize: 14, color: SR.textMuted }}>
          No decks yet. Create one with the + button above.
        </Typography>
      )}
    </Box>
  );
};

export default Home;
