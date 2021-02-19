const axios = require('axios');
const { ethers } = require('ethers');

const fs = require('fs');

const multicall = require('../abi/Multicall.json');
const erc20 = require('../abi/ERC20.json');

const DEFAULT_PRECISION = 3;

async function run() {
	try {
		const lists = await getLists();
		const data = await getData();
		verifyInputs(lists);
		const tokens = mergeTokenLists(lists);
		const metadata = await getMetadata(tokens, data.metadataOverwrite);
		await generate(lists, data, metadata);
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}

async function generate(lists, data, metadata) {
	await generateNetwork('kovan', lists, data, metadata);
	await generateNetwork('homestead', lists, data, metadata);
}

async function generateNetwork(network, lists, data, metadata) {
	const untrusted = lists.untrusted[network];
	const listedTokens = {
		ether: {
			address: 'ether',
			name: 'Ether',
			symbol: 'ETH',
			decimals: 18,
			precision: 4,
			hasIcon: true,
			logoUrl: getLogoUrl(data.assets, 'ether'),
		},
	};
	for (const address of lists.listed[network]) {
		listedTokens[address] = {
			address,
			name: metadata[network][address].name,
			symbol: metadata[network][address].symbol,
			decimals: metadata[network][address].decimals,
			precision: data.precision[network][address] || DEFAULT_PRECISION,
			hasIcon: data.assets.trustwallet.includes(address),
			logoUrl: getLogoUrl(data.assets, address),
		};
	}
	const uiTokens = {};
	for (const address of Object.keys(lists.eligible[network])) {
		const color = getColor(network, address, data);
		uiTokens[address] = {
			address,
			id: data.coingecko[network][address] || '',
			name: metadata[network][address].name,
			symbol: metadata[network][address].symbol,
			decimals: metadata[network][address].decimals,
			precision: data.precision[network][address] || DEFAULT_PRECISION,
			color: data.color[network][address] || color,
			hasIcon: data.assets.trustwallet.includes(address),
			logoUrl: getLogoUrl(data.assets, address),
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
			precision: data.precision[network][address] || DEFAULT_PRECISION,
			color: data.color[network][address] || color,
			hasIcon: data.assets.trustwallet.includes(address),
			logoUrl: getLogoUrl(data.assets, address),
		};
	}
	const dexData = {
		tokens: listedTokens,
		untrusted,
	};
	const pmData = {
		tokens: uiTokens,
		untrusted,
	};
	const dexFileName = `generated/dex/registry.${network}.json`;
	await fs.writeFileSync(dexFileName, JSON.stringify(dexData, null, 4));
	const pmFileName = `generated/pm/registry.${network}.json`;
	await fs.writeFileSync(pmFileName, JSON.stringify(pmData, null, 2));
}

async function getLists() {
	const eligibleFile = await fs.readFileSync('lists/eligible.json');
	const eligible = JSON.parse(eligibleFile);
	const listedFile = await fs.readFileSync('lists/listed.json');
	const listed = JSON.parse(listedFile);
	const uiFile = await fs.readFileSync('lists/ui-not-eligible.json');
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
	const metadataOverwriteFile = await fs.readFileSync('data/metadataOverwrite.json');
	const metadataOverwrite = JSON.parse(metadataOverwriteFile);
	const precisionFile = await fs.readFileSync('data/precision.json');
	const precision = JSON.parse(precisionFile);

	const localAssetDirFiles = await fs.readdirSync('assets');
	const localAssets = localAssetDirFiles
		.filter(assetFile => assetFile !== 'index.json')
		.map(assetFile => assetFile.split('.png')[0]);

	const trustwalletListUrl
		= 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/allowlist.json';
	const trustwalletListResponse = await axios.get(trustwalletListUrl);
	const trustwalletList = trustwalletListResponse.data;

	const assets = {
		local: localAssets,
		trustwallet: trustwalletList,
	}

	return {
		coingecko,
		color,
		precision,
		metadataOverwrite,
		assets,
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

function getLogoUrl(assets, address) {
	address = getMainnetAddress(address);
	if (address === 'ether') {
		return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
	}
	if (assets.local.includes(address.toLowerCase())) {
		return `https://raw.githubusercontent.com/balancer-labs/assets/master/assets/${address.toLowerCase()}.png`
	}
	if (assets.trustwallet.includes(address)) {
		return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${address}/logo.png`;
	}
	return '';
}

function getMainnetAddress(address) {
	const map = {
		'0x1528F3FCc26d13F7079325Fb78D9442607781c8C': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
		'0xef13C0c8abcaf5767160018d268f9697aE4f5375': '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
		'0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
		'0x8c9e6c40d3402480ACE624730524fACC5482798c': '0x1985365e9f78359a9B6AD760e32412f4a445E862',
		'0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
		'0xd0A1E359811322d97991E03f863a0C30C2cF029C': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
		'0x1f1f156E0317167c11Aa412E3d1435ea29Dc3cCE': '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
		'0x86436BcE20258a6DcfE48C9512d4d49A30C4d8c4': '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
		'0x37f03a12241E9FD3658ad6777d289c3fb8512Bc9': '0x960b236A07cf122663c4303350609A66A7B288C0',
		'0xccb0F4Cf5D3F97f4a55bb5f5cA321C3ED033f244': '0xE41d2489571d322189246DaFA5ebDe1F4699F498',
	};
	return map[address] || address;
}

function mergeTokenLists(lists) {
	const kovan = [];
	const homestead = [];

	for (const datasetName in lists) {
		if (datasetName === 'untrusted') {
			continue;
		}

		const dataset = lists[datasetName];

		let dataset_kovan = [];
		if (dataset.kovan instanceof Array) {
			dataset_kovan = dataset.kovan;
		} else {
			dataset_kovan = Object.keys(dataset.kovan);
		}

		let dataset_homestead = [];
		if (dataset.homestead instanceof Array) {
			dataset_homestead = dataset.homestead;
		} else {
			dataset_homestead = Object.keys(dataset.homestead);
		}

		for (const token of dataset_kovan) {
			kovan.push(token);
		}

		for (const token of dataset_homestead) {
			homestead.push(token);
		}
	}

	return {
		kovan,
		homestead,
	};
}

function verifyInputs(lists) {
	verifyNetworkInputs(lists, 'kovan');
	verifyNetworkInputs(lists, 'homestead');
}

function verifyNetworkInputs(lists, network) {
	// Check that addresses are checksummed
	verifyAddressesChecksummed(Object.keys(lists.eligible[network]));
	verifyAddressesChecksummed(lists.listed[network]);
	verifyAddressesChecksummed(lists.ui[network]);
	verifyAddressesChecksummed(lists.untrusted[network]);
	// Check that lists don't have duplicates
	verifyNoDuplicates(Object.keys(lists.eligible[network]), lists.ui[network]);
	verifyNoDuplicates(lists.ui[network], lists.untrusted[network]);
	verifyNoDuplicates(lists.listed[network], lists.untrusted[network]);
}

function verifyAddressesChecksummed(tokens) {
	for (const address of tokens) {
		const checksummedAddress = ethers.utils.getAddress(address);
		if (address !== checksummedAddress) {
			const error = `Address not checksummed: ${address} (should be ${checksummedAddress})`;
			throw error;
		}
	}
}

function verifyNoDuplicates(listA, listB) {
	for (const address of listA) {
		if (listB.includes(address)) {
			console.warn(`Duplicate address: ${address}`);
		}
	}
}

run();
