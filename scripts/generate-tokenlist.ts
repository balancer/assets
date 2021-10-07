require("dotenv").config();

import fs from "fs";
import fleek from "@fleekhq/fleek-storage-js";

import { chainIdMap, getNetworkMetadata } from "../src/metadata";
import {
  List,
  MetadataOverride,
  MinimalTokenInfo,
  Network,
} from "../src/types";
import { getLogoURI, loadAssets } from "../src/icons";
import { TokenInfo, TokenList } from "@uniswap/token-lists";
import { getCoingeckoMetadata } from "../src/coingecko";
import { validateTokenList } from "../src/validation";

type FleekConfig = {
  apiKey: string;
  apiSecret: string;
  bucket: string;
};

const fleekConfig: FleekConfig = {
  apiKey: process.env.FLEEK_API_KEY ?? "",
  apiSecret: process.env.FLEEK_API_SECRET ?? "",
  bucket: "balancer-team-bucket",
};

async function run() {
  try {
    // await buildNetworkLists(Network.Homestead);
    // await buildNetworkLists(Network.Kovan);
    // await buildNetworkLists(Network.Polygon);
    await buildNetworkLists(Network.Arbitrum);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function buildNetworkLists(network: Network) {
  const metadataOverwriteFile = await fs.readFileSync(
    `data/${network}.metadataOverwrite.json`
  );
  const metadataOverwrite = JSON.parse(metadataOverwriteFile.toString());

  await Promise.all([
    // buildListFromFile(List.Listed, network, metadataOverwrite),
    buildListFromFile(List.Vetted, network, metadataOverwrite),
    // buildListFromFile(List.Untrusted, network, metadataOverwrite),
  ]);
}

async function buildListFromFile(
  listType: List,
  network: Network,
  metadataOverwrite: Record<string, MetadataOverride>
) {
  const inputFile = await fs.readFileSync(`lists/${network}.${listType}.json`);
  const input: { tokens: string[] } = JSON.parse(inputFile.toString());
  const onchainMetadata = await getNetworkMetadata(network, input.tokens);
  const listedTokens = await getTokens(
    onchainMetadata,
    metadataOverwrite,
    network
  );
  await generate(listType, network, listedTokens);
}

async function generate(name: List, network: Network, tokens: TokenInfo[]) {
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
    version: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    tokens: tokens.sort((a, b) => (a.name > b.name ? 1 : -1)),
  };

  const listFileName = `generated/${network}.${name}.tokenlist.json`;
  await fs.writeFileSync(listFileName, JSON.stringify(list, null, 4));

  if (validateTokenList(list)) {
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
  const assets = await loadAssets();

  // TODO: rate limit this to prevent issues with coingecko
  const tokens = Object.entries(metadata).map(async ([address, tokenInfo]) => {
    const [mainnetAddress, coingeckoMeta] = await getCoingeckoMetadata(
      network,
      address
    );

    const name =
      metadataOverwrite[address]?.name ?? coingeckoMeta.name ?? tokenInfo.name;
    const symbol =
      metadataOverwrite[address]?.symbol ??
      tokenInfo.symbol ??
      coingeckoMeta.symbol;
    const decimals = tokenInfo.decimals;
    const logoURI =
      metadataOverwrite[address]?.logoURI ??
      getLogoURI(assets, mainnetAddress ?? address) ??
      coingeckoMeta.logoURI;

    return {
      address,
      chainId: chainIdMap[network],
      name,
      symbol,
      decimals,
      logoURI,
    };
  });

  return Promise.all(tokens);
}

async function ipfsPin(key: string, body: TokenList, config: FleekConfig) {
  if (!config.apiKey || !config.apiSecret) {
    throw new Error("No Fleek credentials provided");
  }

  const input = {
    ...config,
    key,
    data: JSON.stringify(body),
  };
  const result = await fleek.upload(input);
  const ipfsHash = result.hashV0;
  return ipfsHash;
}

run();
