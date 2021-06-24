require("dotenv").config();

import fs from "fs";
import fleek from "@fleekhq/fleek-storage-js";

import { getMetadata } from "../src/metadata";
import { List, MinimalTokenInfo, Network } from "../src/types";
import { getLogoURI, loadAssets } from "../src/icons";
import { TokenInfo, TokenList } from "@uniswap/token-lists";

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
    await buildNetworkLists(Network.Homestead);
    await buildNetworkLists(Network.Kovan);
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
    buildListFromFile(List.Listed, network, metadataOverwrite),
    buildListFromFile(List.Vetted, network, metadataOverwrite),
    buildListFromFile(List.Untrusted, network, metadataOverwrite),
  ]);
}

async function buildListFromFile(
  listType: List,
  network: Network,
  metadataOverwrite: Record<string, MinimalTokenInfo>
) {
  const listedFile = await fs.readFileSync(`lists/${network}.${listType}.json`);
  const listed: { tokens: string[] } = JSON.parse(listedFile.toString());
  const listedMetadata = await getMetadata(
    network,
    listed.tokens,
    metadataOverwrite,
    listType === List.Untrusted
  );
  const listedTokens = await getTokens(listedMetadata);
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
}

async function getTokens(
  metadata: Record<string, MinimalTokenInfo>
): Promise<TokenInfo[]> {
  const assets = await loadAssets();

  const tokens = Object.entries(metadata).map(([address, tokenInfo]) => {
    return {
      address,
      chainId: 1,
      ...tokenInfo,
      logoURI: getLogoURI(assets, address),
    };
  });
  return tokens;
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
