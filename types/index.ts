export type Token = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  tags: string[];
  daily_volume: number;
  created_at: string;
  freeze_authority: null | string;
  mint_authority: null | string;
  permanent_delegate: null | string;
  minted_at: null | string;
  extensions: {
    coingeckoId: string;
  };
};
