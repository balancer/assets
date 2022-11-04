import { getAddress } from "@ethersproject/address";
import { TokenInfo } from "@uniswap/token-lists";
import axios from "axios";
import fs from "fs";
import { MetadataOverride, Network } from "../types";

export type Assets = {
  local: string[];
  trustWallet: string[];
};

export const networkNameMap: Record<Network, string> = {
  [Network.Homestead]: "ethereum",
  [Network.Goerli]: "ethereum",
  [Network.Polygon]: "polygon",
  [Network.Arbitrum]: "ethereum",
  [Network.Optimism]: "ethereum",
};

export async function getExistingMetadata(
  network: Network,
  knownTokenInfo?: TokenInfo[]
): Promise<Record<string, MetadataOverride>> {
  // Pull the trustwallet tokenlist for the network of interest
  const trustwalletListUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${networkNameMap[network]}/tokenlist.json`;
  const trustwalletListResponse = await axios.get(trustwalletListUrl);
  const trustwalletTokenList = trustwalletListResponse.data.tokens;

  // Create fake TokenInfo for the local images
  const localAssetDirFiles: string[] = fs.readdirSync("assets");
  const localAssets = localAssetDirFiles.map((assetFile) => {
    const address = assetFile.split(".png")[0];
    return {
      address: address,
      logoURI: `https://raw.githubusercontent.com/balancer-labs/assets/master/assets/${address.toLowerCase()}.png`,
    };
  });

  const tokenInfo: TokenInfo[] = [
    ...trustwalletTokenList,
    ...localAssets,
    ...(knownTokenInfo ?? []),
  ];

  // Note that we're doing a shallow merge here
  return tokenInfo.reduce((acc, info) => {
    acc[getAddress(info.address)] = info;
    return acc;
  }, {} as Record<string, MetadataOverride>);
}

export function getMainnetAddress(address: string): string {
  const map: Record<string, string> = {
    // Goerli
    "0xfA8449189744799aD2AcE7e0EBAC8BB7575eff47":
      "0xba100000625a3754423978a60c9317c58a424e3D",
    "0x8c9e6c40d3402480ACE624730524fACC5482798c":
      "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "0x1f1f156E0317167c11Aa412E3d1435ea29Dc3cCE":
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb":
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0x37f03a12241E9FD3658ad6777d289c3fb8512Bc9":
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    "0x829f35cEBBCd47d3c120793c12f7A232c903138B":
      "0x956F47F50A910163D8BF957Cf5846D573E7f87CA",
    "0xFF386a3d08f80AC38c77930d173Fa56C6286Dc8B":
      "0x6810e776880C02933D47DB1b9fc05908e5386b96",
    "0x4Cb1892FdDF14f772b2E39E299f44B2E5DA90d04":
      "0x71fc860F7D3A592A4a98740e39dB31d25db65ae8",
    "0x811151066392fd641Fe74A9B55a712670572D161":
      "0x9bA00D6856a4eDF4665BcA2C2309936572473B7E",
    "0x89534a24450081Aa267c79B07411e9617D984052":
      "0x02d60b84491589974263d922d9cc7a3152618ef6",
    "0xeFD681A82970AC5d980b9B2D40499735e7BF3F1F":
      "0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c",
    "0x0595D1Df64279ddB51F1bdC405Fe2D0b4Cc86681":
      "0x9210f1204b5a24742eba12f710636d76240df3d0",
    "0x5cEA6A84eD13590ED14903925Fa1A73c36297d99":
      "0x804cdb9116a10bb78768d3252355a1b18067bf8f",
    "0x13ACD41C585d7EbB4a9460f7C8f50BE60DC080Cd":
      "0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2"
  };
  return map[address] || address;
}
