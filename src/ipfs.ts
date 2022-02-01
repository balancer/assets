import fleek from "@fleekhq/fleek-storage-js";
import { TokenList } from "@uniswap/token-lists";

export type FleekConfig = {
  apiKey: string;
  apiSecret: string;
  bucket: string;
};

export async function ipfsPin(
  key: string,
  body: TokenList,
  config: FleekConfig
): Promise<string> {
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
