import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export interface Deck { id: string; name: string; }
export interface User { username: string; email: string; name: string; decks: Deck[]; }

interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  isSuccess: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  isSuccess: false,
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { data, isLoading, isSuccess } = useQuery({
    queryKey: ['sessionLookup'],
    queryFn: () => axios.get('/api/user/me'),
    retry: false,
  });

  const user: User | null = data?.data?.user ?? null;

  return (
    <UserContext.Provider value={{ user, isLoading, isSuccess }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;
