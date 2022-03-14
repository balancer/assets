import { TokenList } from "@uniswap/token-lists";

export function mergeTokenLists(
  tokenListA: TokenList,
  tokenListB: TokenList
): TokenList {
  return {
    ...tokenListA,
    tokens: [...tokenListA.tokens, ...tokenListB.tokens].sort(
      (tokenA, tokenB) => (tokenA.name > tokenB.name ? 1 : -1)
    ),
  };
}
