import axios from "axios";
import fs from "fs";

type Assets = {
  local: string[];
  trustWallet: string[];
};

export async function loadAssets(): Promise<Assets> {
  const localAssetDirFiles: string[] = await fs.readdirSync("assets");
  const localAssets = localAssetDirFiles
    .filter((assetFile) => assetFile !== "index.json")
    .map((assetFile) => assetFile.split(".png")[0]);

  const trustwalletListUrl =
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/allowlist.json";
  const trustwalletListResponse = await axios.get(trustwalletListUrl);
  const trustwalletList = trustwalletListResponse.data;

  return {
    local: localAssets,
    trustWallet: trustwalletList,
  };
}

export function getLogoURI(
  assets: Assets,
  address: string
): string | undefined {
  address = getMainnetAddress(address);
  if (address === "ether") {
    return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png";
  }
  if (assets.local.includes(address.toLowerCase())) {
    return `https://raw.githubusercontent.com/balancer-labs/assets/master/assets/${address.toLowerCase()}.png`;
  }
  if (assets.trustWallet.includes(address)) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
  }
  return undefined;
}

function getMainnetAddress(address: string): string {
  const map: Record<string, string> = {
    "0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1":
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    "0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7":
      "0xba100000625a3754423978a60c9317c58a424e3D",
    "0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115":
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "0xAf9ac3235be96eD496db7969f60D354fe5e426B0":
      "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
    "0x04DF6e4121c27713ED22341E7c7Df330F56f289B":
      "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "0x8F4beBF498cc624a0797Fe64114A6Ff169EEe078":
      "0xbC396689893D065F41bc2C6EcbeE5e0085233447",
    "0x1C8E3Bcb3378a443CC591f154c5CE0EBb4dA9648":
      "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  };
  return map[address] || address;
}
