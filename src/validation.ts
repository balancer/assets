import { TokenInfo, TokenList } from "@uniswap/token-lists";

export const validateTokenList = (tokenList: TokenList): boolean => {
  const { tokens } = tokenList;

  const tokensValid = tokens
    .map((token) => validateToken(token))
    .every((validity) => validity == true);

  return tokensValid;
};

const validateToken = (token: TokenInfo): boolean => {
  if (!token.address) return false;
  if (!token.chainId) return false;
  if (!token.name) return false;
  if (!token.symbol) return false;
  if (!token.decimals) return false;
  // Enforce that we have a logo for each token
  if (!token.logoURI) return false;

  // "(PoS)" is included in the names of tokens which are bridged to Polygon
  // We want to ensure that we strip these out.
  if (token.name.includes("(PoS)")) return false;

  return true;
};
