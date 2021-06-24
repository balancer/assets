import fs from "fs";

import { List, Network } from "../src/types";
import { TokenList } from "@uniswap/token-lists";

async function run() {
  try {
    await mergeTokenLists(
      `generated/${Network.Homestead}.${List.Listed}.tokenlist.json`,
      `generated/${Network.Kovan}.${List.Listed}.tokenlist.json`,
      `generated/${List.Listed}.tokenlist.json`
    );
    await mergeTokenLists(
      `generated/${Network.Homestead}.${List.Vetted}.tokenlist.json`,
      `generated/${Network.Kovan}.${List.Vetted}.tokenlist.json`,
      `generated/${List.Vetted}.tokenlist.json`
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function mergeTokenLists(
  mergerPath: string,
  mergedPath: string,
  outputPath: string
) {
  const mergerFile = await fs.readFileSync(mergerPath);
  const merger: TokenList = JSON.parse(mergerFile.toString());

  const mergedFile = await fs.readFileSync(mergedPath);
  const merged: TokenList = JSON.parse(mergedFile.toString());

  const output: TokenList = {
    ...merger,
    tokens: [...merger.tokens, ...merged.tokens],
  };

  await fs.writeFileSync(outputPath, JSON.stringify(output, null, 4));
}

run();
