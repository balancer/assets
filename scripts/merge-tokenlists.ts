import fs from "fs";

import { List, Network } from "../src/types";
import { TokenList } from "@uniswap/token-lists";
import { mergeTokenLists } from "../src/tokenlists/merge";

async function run() {
  try {
    await mergeTokenListsByPath(
      `generated/${Network.Homestead}.${List.Listed}.tokenlist.json`,
      `generated/${Network.Kovan}.${List.Listed}.tokenlist.json`,
      `generated/${List.Listed}.tokenlist.json`
    );
    await mergeTokenListsByPath(
      `generated/${Network.Homestead}.${List.Vetted}.tokenlist.json`,
      `generated/${Network.Kovan}.${List.Vetted}.tokenlist.json`,
      `generated/${List.Vetted}.tokenlist.json`
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function mergeTokenListsByPath(
  mergerPath: string,
  mergedPath: string,
  outputPath: string
) {
  const mergerFile = await fs.readFileSync(mergerPath);
  const merger: TokenList = JSON.parse(mergerFile.toString());

  const mergedFile = await fs.readFileSync(mergedPath);
  const merged: TokenList = JSON.parse(mergedFile.toString());

  const output: TokenList = mergeTokenLists(merger, merged);

  await fs.writeFileSync(outputPath, JSON.stringify(output, null, 4));
}

run();
