import { ethers } from "ethers";
import { TokenInfo } from "@uniswap/token-lists";

import { MinimalTokenInfo, Network } from "./types";

const infuraKey = "93e3393c76ed4e1f940d0266e2fdbda2";

const providers = {
  kovan: new ethers.providers.InfuraProvider("kovan", infuraKey),
  homestead: new ethers.providers.InfuraProvider("homestead", infuraKey),
};

const chainIdMap = {
  homestead: 1,
  kovan: 42,
};

const multicallContract = {
  kovan: "0x5ba1e12693dc8f9c48aad8770482f4739beed696",
  homestead: "0x5ba1e12693dc8f9c48aad8770482f4739beed696",
};

const erc20ABI = [
  "function name() returns (string)",
  "function symbol() returns (string)",
  "function decimals() returns (uint256)",
];

const multicallABI = [
  "function tryAggregate(bool, tuple(address, bytes)[]) view returns (tuple(bool, bytes)[])",
];

const metadataIsInvalid = ({ name, symbol }: MinimalTokenInfo): boolean =>
  name === "UNKNOWN" || symbol === "UNKNOWN";

export const getMetadata = async (
  network: Network,
  tokens: string[],
  overwrite: Record<string, MinimalTokenInfo>,
  acceptBadMetadata = false
): Promise<Record<string, MinimalTokenInfo>> => {
  const onchainMetadata = await getNetworkMetadata(network, tokens);

  // Overwrite any addresses for which we have our own metadata
  const metadata = {
    ...onchainMetadata,
    ...overwrite,
  };

  // console.log(metadata);

  if (!acceptBadMetadata && Object.values(metadata).some(metadataIsInvalid)) {
    Object.entries(metadata)
      .filter(([, token]) => metadataIsInvalid(token))
      .forEach(([address]) => console.log(`Metadata missing for: ${address}`));
    throw new Error("Missing metadata");
  }

  return metadata;
};

const decodeERC20Metadata = (
  nameResponse: string,
  symbolResponse: string,
  decimalsResponse: string
): MinimalTokenInfo => {
  const erc20 = new ethers.utils.Interface(erc20ABI);

  let name: string;
  try {
    [name] = erc20.decodeFunctionResult("name", nameResponse);
  } catch {
    try {
      name = ethers.utils.parseBytes32String(nameResponse);
    } catch {
      name = "UNKNOWN";
    }
  }

  let symbol: string;
  try {
    [symbol] = erc20.decodeFunctionResult("symbol", symbolResponse);
  } catch {
    try {
      symbol = ethers.utils.parseBytes32String(symbolResponse);
    } catch {
      symbol = "UNKNOWN";
    }
  }

  let decimals: number;
  try {
    const [decimalsBN] = erc20.decodeFunctionResult(
      "decimals",
      decimalsResponse
    );
    decimals = decimalsBN.toNumber();
  } catch {
    decimals = 18;
  }

  return {
    name,
    symbol,
    decimals,
  };
};

async function getNetworkMetadata(
  network: Network,
  tokens: string[]
): Promise<Record<string, TokenInfo>> {
  const provider = providers[network];
  const multicallAddress = multicallContract[network];

  const multi = new ethers.Contract(multicallAddress, multicallABI, provider);
  const erc20 = new ethers.utils.Interface(erc20ABI);
  const calls: [string, string][] = [];
  tokens.forEach((token) => {
    calls.push([token, erc20.encodeFunctionData("name", [])]);
    calls.push([token, erc20.encodeFunctionData("symbol", [])]);
    calls.push([token, erc20.encodeFunctionData("decimals", [])]);
  });
  const response = await multi.tryAggregate(false, calls);

  const tokenMetadata = tokens.reduce((acc, address, index) => {
    acc[address] = {
      address,
      chainId: chainIdMap[network],
      ...decodeERC20Metadata(
        response[3 * index][1],
        response[3 * index + 1][1],
        response[3 * index + 2][1]
      ),
    };

    return acc;
  }, {} as Record<string, TokenInfo>);

  return tokenMetadata;
}
