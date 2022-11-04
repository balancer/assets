import { Interface } from "@ethersproject/abi";
import { Contract } from "@ethersproject/contracts";
import { InfuraProvider } from "@ethersproject/providers";
import { parseBytes32String } from "@ethersproject/strings";
import { TokenInfo } from "@uniswap/token-lists";

import { MinimalTokenInfo, Network } from "../types";

const infuraKey = "93e3393c76ed4e1f940d0266e2fdbda2";

const providers = {
  goerli: new InfuraProvider("goerli", infuraKey),
  homestead: new InfuraProvider("homestead", infuraKey),
  polygon: new InfuraProvider("matic", infuraKey),
  arbitrum: new InfuraProvider("arbitrum", infuraKey),
  optimism: new InfuraProvider("optimism", infuraKey),
};

export const chainIdMap = {
  homestead: 1,
  goerli: 5,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
};

const multicallContract = {
  homestead: "0x5ba1e12693dc8f9c48aad8770482f4739beed696",
  goerli: "0x5ba1e12693dc8f9c48aad8770482f4739beed696",
  polygon: "0xe2530198A125Dcdc8Fc5476e07BFDFb5203f1102",
  arbitrum: "0xd67950096d029af421a946ffb1e04c94caf8e256",
  optimism: "0x2dc0e2aa608532da689e89e237df582b783e552c",
};

const erc20ABI = [
  "function name() returns (string)",
  "function symbol() returns (string)",
  "function decimals() returns (uint256)",
];

const multicallABI = [
  "function tryAggregate(bool, tuple(address, bytes)[]) view returns (tuple(bool, bytes)[])",
];

const decodeERC20Metadata = (
  nameResponse: string,
  symbolResponse: string,
  decimalsResponse: string
): MinimalTokenInfo => {
  const erc20 = new Interface(erc20ABI);

  let name: string;
  try {
    [name] = erc20.decodeFunctionResult("name", nameResponse);
  } catch {
    try {
      name = parseBytes32String(nameResponse);
    } catch {
      name = "UNKNOWN";
    }
  }

  let symbol: string;
  try {
    [symbol] = erc20.decodeFunctionResult("symbol", symbolResponse);
  } catch {
    try {
      symbol = parseBytes32String(symbolResponse);
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

export async function getNetworkMetadata(
  network: Network,
  tokens: string[]
): Promise<Record<string, TokenInfo>> {
  const provider = providers[network];
  const multicallAddress = multicallContract[network];

  const multi = new Contract(multicallAddress, multicallABI, provider);
  const erc20 = new Interface(erc20ABI);
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
