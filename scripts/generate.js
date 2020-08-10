const axios = require('axios');
const { ethers } = require('ethers');

const fs = require('fs');

const multicall = require('../abi/Multicall.json');
const erc20 = require('../abi/ERC20.json');

const defaultPrecision = 2;

async function run() {
	const lists = await getLists();
	const data = await getData();
	const tokens = mergeTokenLists(lists);
	const metadata = await getMetadata(tokens, data.metadataOverwrite);
	await generate(lists, data, metadata);
}

async function generate(lists, data, metadata) {
	const dirExists = await fs.existsSync('generated');
	if (!dirExists) {
		await fs.mkdirSync('generated');
		await fs.mkdirSync('generated/pm');
		await fs.mkdirSync('generated/dex');
	}
	await generateNetwork('kovan', lists, data, metadata);
	await generateNetwork('homestead', lists, data, metadata);
}

async function generateNetwork(network, lists, data, metadata) {
	const untrusted = lists.untrusted[network];
	const listedTokens = {};
	for (const address of lists.listed[network]) {
		listedTokens[address] = {
			address,
			name: metadata[network][address].name,
			symbol: metadata[network][address].symbol,
			precision: data.precision[network][address] || defaultPrecision,
			hasIcon: data.trustwalletList.includes(address),
		};
	}
	const uiTokens = {};
	for (const address of lists.eligible[network]) {
		const color = getColor(network, address, data);
		uiTokens[address] = {
			address,
			id: data.coingecko[network][address] || '',
			name: metadata[network][address].name,
			symbol: metadata[network][address].symbol,
			decimals: metadata[network][address].decimals,
			precision: data.precision[network][address] || defaultPrecision,
			color: data.color[network][address] || color,
			hasIcon: data.trustwalletList.includes(address),
		};
	}
	for (const address of lists.ui[network]) {
		const color = getColor(network, address, data);
		uiTokens[address] = {
			address,
			id: data.coingecko[network][address] || '',
			name: metadata[network][address].name,
			symbol: metadata[network][address].symbol,
			decimals: metadata[network][address].decimals,
			precision: data.precision[network][address] || defaultPrecision,
			color: data.color[network][address] || color,
			hasIcon: data.trustwalletList.includes(address),
		};
	}
	const dexData = {
		...data.config[network],
		tokens: listedTokens,
		untrusted,
	};
	const pmData = {
		...data.config[network],
		tokens: uiTokens,
		untrusted,
	};
	const dexFileName = `generated/dex/${network}.json`;
	await fs.writeFileSync(dexFileName, JSON.stringify(dexData, null, 4));
	const pmFileName = `generated/pm/${network}.json`;
	await fs.writeFileSync(pmFileName, JSON.stringify(pmData, null, 2));
}

async function getLists() {
	const eligibleFile = await fs.readFileSync('lists/eligible.json');
	const eligible = JSON.parse(eligibleFile);
	const listedFile = await fs.readFileSync('lists/listed.json');
	const listed = JSON.parse(listedFile);
	const uiFile = await fs.readFileSync('lists/ui.json');
	const ui = JSON.parse(uiFile);
	const untrustedFile = await fs.readFileSync('lists/untrusted.json');
	const untrusted = JSON.parse(untrustedFile);
	return {
		eligible,
		listed,
		ui,
		untrusted,
	};
}

async function getData() {
	const coingeckoFile = await fs.readFileSync('data/coingecko.json');
	const coingecko = JSON.parse(coingeckoFile);
	const colorFile = await fs.readFileSync('data/color.json');
	const color = JSON.parse(colorFile);
	const configFile = await fs.readFileSync('data/config.json');
	const config = JSON.parse(configFile);
	const metadataOverwriteFile = await fs.readFileSync('data/metadataOverwrite.json');
	const metadataOverwrite = JSON.parse(metadataOverwriteFile);
	const precisionFile = await fs.readFileSync('data/precision.json');
	const precision = JSON.parse(precisionFile);

	const trustwalletListUrl 
		= 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/whitelist.json';
	const trustwalletListResponse = await axios.get(trustwalletListUrl);
	const trustwalletList = trustwalletListResponse.data;

	return {
		coingecko,
		color,
		config,
		precision,
		metadataOverwrite,
		trustwalletList,
	};
}

async function getMetadata(tokens, overwrite) {
	const kovan = await getNetworkMetadata('kovan', tokens.kovan, overwrite.kovan);
	const homestead = await getNetworkMetadata('homestead', tokens.homestead, overwrite.homestead);

	return {
		kovan,
		homestead,
	};
}

async function getNetworkMetadata(network, tokens, overwrite) {
	const infuraKey = '93e3393c76ed4e1f940d0266e2fdbda2';

	const providers = {
		kovan: new ethers.providers.InfuraProvider('kovan', infuraKey),
		homestead: new ethers.providers.InfuraProvider('homestead', infuraKey),
	};

	const multicallContract = {
		kovan: '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A',
		homestead: '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441',
	};

	const provider = providers[network];
	const multicallAddress = multicallContract[network];

	const multi = new ethers.Contract(multicallAddress, multicall.abi, provider);
	const calls = [];
	const erc20Contract = new ethers.utils.Interface(erc20.abi);
	tokens.forEach(token => {
		calls.push([token, erc20Contract.encodeFunctionData('decimals', [])]);
		calls.push([token, erc20Contract.encodeFunctionData('symbol', [])]);
		calls.push([token, erc20Contract.encodeFunctionData('name', [])]);
	});
	const tokenMetadata = {};
	const [, response] = await multi.aggregate(calls);
	for (let i = 0; i < tokens.length; i++) {
		const address = tokens[i];
		if (address in overwrite) {
			tokenMetadata[address] = overwrite[address];
			continue;
		}
		const [decimals] = erc20Contract.decodeFunctionResult('decimals', response[3 * i]);
		const [symbol] = erc20Contract.decodeFunctionResult('symbol', response[3 * i + 1]);
		const [name] = erc20Contract.decodeFunctionResult('name', response[3 * i + 2]);
		tokenMetadata[tokens[i]] = {
			decimals,
			symbol,
			name
		};
	}
	return tokenMetadata;
}

function getConfig(network, dapp) {
	const chainIdMap = {
		kovan: 42,
		homestead: 1,
	};
	const subgraphMap = {
		kovan: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan',
		homestead: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
	};
	const alchemyMap = {
		dex: {
			kovan: 'Fa315qKOTy_ksUH1VS1zXAxuKo83s_Ko',
			homestead: '9dfRcK-MHFPzMkZSjPFj4-T9jv31UZXd',
		},
		pm: {
			kovan: 'C467LJc7Aa761LLxlcxXvhIG9HzDTtKw',
			homestead: 'Q08AP-nlA-yUiQnIiAVlyWK4tbXjRMmD',
		},
	};
	const alchemyNetwork = {
		homestead: mainnet,
		kovan,
	};
	const addressMap = {
		kovan: {
			bFactory: "0x8f7F78080219d4066A8036ccD30D588B416a40DB",
			bActions: "0x1266F7220cCc4f1957b3f1EA713F3F434Fc3BDc7",
			dsProxyRegistry: "0x130767E0cf05469CF11Fa3fcf270dfC1f52b9072",
			proxy: "0xD9c8ae0ecF77D0F7c1C28B4F6991A041963545d6",
			weth: "0xd0A1E359811322d97991E03f863a0C30C2cF029C",
			multicall: "0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A",
		},
		homestead: {
			bFactory: "0x9424B1412450D0f8Fc2255FAf6046b98213B76Bd",
			bActions: "0x54b28bB7930976839C61f142746cADDBE819A742",
			dsProxyRegistry: "0x4678f0a6958e4D2Bc4F1BAF7Bc52E8F3564f3fE4",
			proxy: "0x6317C5e82A06E1d8bf200d21F4510Ac2c038AC81",
			weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
			multicall: "0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441",
		},
	};
	const dappId = '3f1c3cfc-7dd5-4e8a-aa03-71ff7396d9fe';
	return {
		network,
		chainId: chainIdMap[network],
		defaultPrecision: 2,
		subgraphUrl: subgraphMap[network],
		alchemyWsUrl: `wss://eth-${alchemyNetwork[network]}.ws.alchemyapi.io/v2/${alchemyMap[dapp][network]}`,
		addresses: addressMap[network],
		connectors: {
			injected: {
				id: "injected",
				name: "MetaMask",
			},
			walletconnect: {
				id: "walletconnect",
				name: "WalletConnect",
			},
			portis: {
				id: "portis",
				name: "Portis",
				options: {
					network,
					dappId,
				},
			},
			walletlink: {
				id: "walletlink",
				name: "Coinbase",
				options: {
					appName: "Balancer Pool Management",
					darkMode: true,
					chainId: chainIdMap[network],
					ethJsonrpcUrl:
						`https://eth-${alchemyNetwork[network]}.alchemyapi.io/v2/${alchemyMap[dapp][network]}`,
				},
			},
		},
	};
}

function getColor(network, address, data) {
	if (network !== 'homestead') {
		return;
	}
	let sum = 0;
	for (const char of address) {
		if (char === 'x') {
			continue;
		}
		const charValue = parseInt(char, 16);
		sum += charValue;
	}
	const colorList = data.color.list;
	return colorList[sum % colorList.length];
}

function mergeTokenLists(lists) {
	const kovan = [];
	const homestead = [];

	for (const datasetName in lists) {
		if (datasetName === 'untrusted') {
			continue;
		}

		const dataset = lists[datasetName];
		for (const token of dataset.kovan) {
			kovan.push(token);
		}

		for (const token of dataset.homestead) {
			homestead.push(token);
		}
	}

	return {
		kovan,
		homestead,
	};
}

run();
