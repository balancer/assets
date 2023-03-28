const { ethers } = require('ethers');
const axios = require('axios');
const multicall = require('../abi/Multicall.json');
const erc20 = require('../abi/ERC20.json');

async function getTokenMetadata(network, tokens, overwrite) {
	const infuraKey = process.env.INFURA_KEY || '93e3393c76ed4e1f940d0266e2fdbda2';

	const providers = {
		goerli: new ethers.providers.InfuraProvider('goerli', infuraKey),
		homestead: new ethers.providers.InfuraProvider('homestead', infuraKey),
	};

	const multicallContract = {
		goerli: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
		homestead: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
	};

	const provider = providers[network];
	const multicallAddress = multicallContract[network];

	const multi = new ethers.Contract(multicallAddress, multicall.abi, provider);
	const tokenMetadata = {};
	const erc20Contract = new ethers.utils.Interface(erc20.abi);
  for (const address of tokens) {
    if (address in overwrite) {
      tokenMetadata[address] = overwrite[address];
      continue;
    }

    const calls = [
      [address, erc20Contract.encodeFunctionData('decimals', [])],
      [address, erc20Contract.encodeFunctionData('symbol', [])],
      [address, erc20Contract.encodeFunctionData('name', [])]
    ]
    const [, response] = await multi.aggregate(calls);

    const [decimals] = erc20Contract.decodeFunctionResult('decimals', response[0]);
    const [symbol] = erc20Contract.decodeFunctionResult('symbol', response[1]);
    const [name] = erc20Contract.decodeFunctionResult('name', response[2]);
    tokenMetadata[address] = {
      decimals,
      symbol,
      name
    };
  }

	return tokenMetadata;
}

async function getTrustWalletAssetAddresses() {

	const trustwalletListUrl
		= 'https://raw.githubusercontent.com/trustwallet/assets/4ff402ed99d9028fb58ab3594b196e177390773b/blockchains/ethereum/allowlist.json';
	const trustwalletListResponse = await axios.get(trustwalletListUrl);
	const trustwalletList = trustwalletListResponse.data;

  // The trustwallet list above is frozen at a commit in the past
  // unfortunately they have removed that file from newer revisions
  // so trustwalletAdditional contains additional addresses for which
  // there is an icon in their repo
  const trustwalletAdditional = [
    "0x383518188C0C6d7730D91b2c03a03C837814a899" // OHM
  ]

  return trustwalletList.concat(trustwalletAdditional)
}

module.exports.getTokenMetadata = getTokenMetadata;
module.exports.getTrustWalletAssetAddresses = getTrustWalletAssetAddresses;
