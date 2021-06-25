import { TokenInfo } from "@uniswap/token-lists";
import axios from "axios";
import { getAddress } from "ethers/lib/utils";
import { Network } from "./types";

const coingeckoClient = axios.create({
  baseURL: "https://api.coingecko.com/api/v3",
});

const platformIdMap: Record<Network, string> = {
  [Network.Homestead]: "ethereum",
  [Network.Kovan]: "ethereum",
  [Network.Polygon]: "polygon-pos",
};

export const getCoingeckoMetadata = async (
  network: Network,
  address: string
): Promise<[string | null, Partial<TokenInfo>]> => {
  if (network === Network.Kovan) return [null, {}];

  let data;
  try {
    const response = await coingeckoClient.get(
      `coins/${platformIdMap[network]}/contract/${address.toLowerCase()}`
    );

    data = response.data;
  } catch (e) {
    console.warn(`Coingecko ID not found for token: ${address}`);
    return [null, {}];
  }

  const {
    name,
    symbol,
    image: { large: logoURI },
  } = data;

  let mainnetAddress = null;
  try {
    mainnetAddress = getAddress(data.platforms.ethereum);
  } catch {
    // eslint-disable-next-line no-empty
  }
  return [
    mainnetAddress,
    {
      address,
      name,
      symbol,
      logoURI,
    },
  ];
};
