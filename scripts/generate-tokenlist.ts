require("dotenv").config();

import fs from "fs";

import { chainIdMap, getNetworkMetadata } from "../src/metadata";
import {
  List,
  MetadataOverride,
  MinimalTokenInfo,
  Network,
} from "../src/types";
import { getExistingMetadata, getMainnetAddress } from "../src/icons";
import {
  isVersionUpdate,
  minVersionBump,
  nextVersion,
  TokenInfo,
  TokenList,
} from "@uniswap/token-lists";
import { getCoingeckoMetadata } from "../src/coingecko";
import { validateTokenList } from "../src/tokenlists/validation";
import { FleekConfig, ipfsPin } from "../src/ipfs";

const fleekConfig: FleekConfig = {
  apiKey: process.env.FLEEK_API_KEY ?? "",
  apiSecret: process.env.FLEEK_API_SECRET ?? "",
  bucket: "balancer-team-bucket",
};

let network: Network = process.argv[2] as Network;
if (network && !Object.values(Network).includes(network)) {
  if (network.toString() === "mainnet") {
    network = Network.Homestead;
  } else {
    throw new Error(`Invalid network: "${network}"`);
  }
}

run(network);

async function run(network?: Network) {
  try {
    if (network) {
      await buildNetworkLists(network);
    } else {
      // await buildNetworkLists(Network.Homestead);
      await buildNetworkLists(Network.Kovan);
      await buildNetworkLists(Network.Polygon);
      await buildNetworkLists(Network.Arbitrum);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function buildNetworkLists(network: Network) {
  console.log(`Building ${network} tokenlists\n`);
  const metadataOverwriteFile = await fs.readFileSync(
    `data/${network}.metadataOverwrite.json`
  );
  const metadataOverwrite = JSON.parse(metadataOverwriteFile.toString());

  await buildListFromFile(List.Listed, network, metadataOverwrite);
  await buildListFromFile(List.Vetted, network, metadataOverwrite);
  await buildListFromFile(List.Untrusted, network, metadataOverwrite);
}

async function buildListFromFile(
  listType: List,
  network: Network,
  metadataOverwrite: Record<string, MetadataOverride>
) {
  console.log(`Building ${listType} tokenlist`);
  const { tokens }: { tokens: string[] } = JSON.parse(
    fs.readFileSync(`lists/${network}.${listType}.json`).toString()
  );
  const onchainMetadata = await getNetworkMetadata(network, tokens);

  let currentTokenList: TokenList | undefined;
  try {
    currentTokenList = JSON.parse(
      fs
        .readFileSync(`generated/${network}.${listType}.tokenlist.json`)
        .toString()
    );
  } catch {
    // Most likely a new tokenlist which we haven't generated before
  }

  const existingMetadata = await getExistingMetadata(
    network,
    currentTokenList?.tokens
  );
  const listedTokens = await getTokens(
    onchainMetadata,
    {
      ...existingMetadata,
      ...metadataOverwrite,
    },
    network
  );

  await generate(listType, network, listedTokens, currentTokenList);
}

async function generate(
  name: List,
  network: Network,
  tokens: TokenInfo[],
  oldTokenList?: TokenList
) {
  let newVersion = { major: 0, minor: 1, patch: 0 };
  if (oldTokenList) {
    newVersion = nextVersion(
      oldTokenList.version,
      minVersionBump(oldTokenList.tokens, tokens)
    );

    if (!isVersionUpdate(oldTokenList.version, newVersion)) {
      console.log("Tokenlist is unchanged");
      return;
    }
  }

  const nowTimestamp = Date.now();
  const dayTimestamp = nowTimestamp - (nowTimestamp % (24 * 60 * 60 * 1000));
  const date = new Date(dayTimestamp);
  const timestamp = date.toISOString();
  const list = {
    name: "Balancer",
    timestamp,
    logoURI:
      "https://raw.githubusercontent.com/balancer-labs/pebbles/master/images/pebbles-pad.256w.png",
    keywords: ["balancer", name],
    version: newVersion,
    tokens: tokens.sort((a, b) => (a.name > b.name ? 1 : -1)),
  };

  const listFileName = `generated/${network}.${name}.tokenlist.json`;
  await fs.writeFileSync(listFileName, JSON.stringify(list, null, 4));

  if (name === List.Untrusted || validateTokenList(list)) {
    try {
      await ipfsPin(
        `assets/${network}.${name}.tokenlist.json`,
        list,
        fleekConfig
      );
      console.log(`Tokenlist uploaded for ${name}`);
    } catch (e) {
      console.log(e.message);
    }
  } else {
    throw Error("TokenList is invalid");
  }
}

async function getTokens(
  metadata: Record<string, MinimalTokenInfo>,
  metadataOverwrite: Record<string, MetadataOverride>,
  network: Network
): Promise<TokenInfo[]> {
  const tokens = await Object.entries(metadata).reduce(
    async (acc: Promise<TokenInfo[]>, [address, tokenInfo], index) => {
      // wait for previous tokens to be queried
      const prev = await acc;

      const token = await getTokenMetadata(
        address,
        tokenInfo,
        metadataOverwrite[getMainnetAddress(address).toLowerCase()] ?? {},
        network
      );

      // Coingecko rate limits their API to 10 calls/second
      if (index > 0 && index % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      return Promise.all([...prev, token]);
    },
    Promise.resolve([])
  );

  return tokens;
}

async function getTokenMetadata(
  address: string,
  onchainMetadata: MinimalTokenInfo,
  metadataOverwrite: MetadataOverride,
  network: Network
): Promise<TokenInfo> {
  // If we have an override for all metadata fields then just return early
  if (
    metadataOverwrite.name &&
    metadataOverwrite.symbol &&
    metadataOverwrite.decimals &&
    metadataOverwrite.logoURI
  ) {
    return {
      address,
      chainId: chainIdMap[network],
      name: metadataOverwrite.name,
      symbol: metadataOverwrite.symbol,
      decimals: metadataOverwrite.decimals,
      logoURI: metadataOverwrite?.logoURI,
    };
  }

  const [mainnetAddress, coingeckoMeta] = await getCoingeckoMetadata(
    network,
    address
  );

  const name =
    metadataOverwrite.name ?? coingeckoMeta.name ?? onchainMetadata.name;
  const symbol =
    metadataOverwrite.symbol ?? onchainMetadata.symbol ?? coingeckoMeta.symbol;
  const decimals = onchainMetadata.decimals;
  const logoURI = metadataOverwrite.logoURI ?? coingeckoMeta.logoURI;

  return {
    address,
    chainId: chainIdMap[network],
    name,
    symbol,
    decimals,
    logoURI,
  };
}
