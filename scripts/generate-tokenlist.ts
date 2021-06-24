require("dotenv").config();

import fs from "fs";
import fleek from "@fleekhq/fleek-storage-js";

import { getMetadata } from "../src/metadata";
import { MinimalTokenInfo, Network } from "../src/types";
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
    const metadataOverwriteFile = await fs.readFileSync(
      "data/metadataOverwrite.json"
    );
    const metadataOverwrite = JSON.parse(metadataOverwriteFile.toString());

    const listedFile = await fs.readFileSync("lists/listed.json");
    const listed = JSON.parse(listedFile.toString());
    const listedMetadata = await getAllMetadata(listed, metadataOverwrite);
    const listedTokens = await getTokens(listedMetadata);
    await generate("listed", listedTokens);

    const vettedFile = await fs.readFileSync("lists/vetted.json");
    const vetted = JSON.parse(vettedFile.toString());
    const vettedMetadata = await getAllMetadata(vetted, metadataOverwrite);
    const vettedTokens = await getTokens(vettedMetadata);
    await generate("vetted", vettedTokens);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function generate(name: string, tokens: any[]) {
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
    tokens,
  };
  const listFileName = `generated/${name}.tokenlist.json`;
  await fs.writeFileSync(listFileName, JSON.stringify(list, null, 4));

  try {
    await ipfsPin(`assets/${name}.tokenlist.json`, list, fleekConfig);
    console.log(`Tokenlist uploaded for ${name}`);
  } catch (e) {
    console.log(e.message);
  }
}

async function getAllMetadata(
  tokens: Record<Network, string[]>,
  overwrite: Record<Network, Record<string, MinimalTokenInfo>>
) {
  const kovan = await getMetadata("kovan", tokens.kovan, overwrite.kovan);
  const homestead = await getMetadata(
    "homestead",
    tokens.homestead,
    overwrite.homestead
  );

  return {
    kovan,
    homestead,
  };
}

async function getTokens(
  metadata: Record<Network, Record<string, MinimalTokenInfo>>
): Promise<TokenInfo[]> {
  const assets = await loadAssets();

  const tokens = [];
  for (const address in metadata.homestead) {
    const chainId = 1;
    const token = metadata.homestead[address];
    const { decimals, symbol, name } = token;
    tokens.push({
      address,
      chainId,
      name,
      symbol,
      decimals,
      logoURI: getLogoURI(assets, address),
    });
  }
  for (const address in metadata.kovan) {
    const chainId = 42;
    const token = metadata.kovan[address];
    const { decimals, symbol, name } = token;
    tokens.push({
      address,
      chainId,
      name,
      symbol,
      decimals,
      logoURI: getLogoURI(assets, address),
    });
  }
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
