'use client';
import React, { useEffect } from 'react';
import { createContext, ReactNode, useContext, useState } from 'react';
import { Connection } from '@solana/web3.js';
import { Token } from '../types';
import { getTokenList } from '../api/getTokenList';

/////////////////////////////////////////////////////////////////////////////

type AppContextType = {
  tokenList: Token[];
  connection: Connection;
};

/////////////////////////////////////////////////////////////////////////////

const defaultValue = {
  tokenList: [] as Token[],
  connection: new Connection(
    'https://fabled-green-frog.solana-mainnet.quiknode.pro/f7944976a48ec80e8628553e4636a3adff6c1ca5'
  ),
};

const AppContext = createContext(defaultValue);

/////////////////////////////////////////////////////////////////////////////

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [tokenList, setTokenList] = useState([] as Token[]);

  useEffect(() => {
    getTokenList().then((list) => setTokenList(list));
  }, []);

  return (
    <AppContext.Provider
      value={{
        ...defaultValue,
        tokenList,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

/////////////////////////////////////////////////////////////////////////////

export function useAppContext() {
  return useContext(AppContext);
}
