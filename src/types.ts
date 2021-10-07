import { TokenInfo } from "@uniswap/token-lists";

export enum Network {
  Homestead = "homestead",
  Kovan = "kovan",
  Polygon = "polygon",
  Arbitrum = "arbitrum",
}

export enum List {
  Listed = "listed",
  Vetted = "vetted",
  Untrusted = "untrusted",
}

export type MinimalTokenInfo = Pick<TokenInfo, "name" | "symbol" | "decimals">;
export type MetadataOverride = Partial<TokenInfo>;
