const axios = require('axios');
const { ethers } = require('ethers');

const fs = require('fs');

const multicall = require('../abi/Multicall.json');
const erc20 = require('../abi/ERC20.json');

const defaultPrecision = 2;

async function run() {
	try {
		const lists = await getLists();
		const data = await getData();
		validateInputs(lists);
		const tokens = mergeTokenLists(lists);
		const metadata = await getMetadata(tokens, data.metadataOverwrite);
		await generate(lists, data, metadata);
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
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

	const trustwalletListUrl
		= 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/allowlist.json';
	const trustwalletListResponse = await axios.get(trustwalletListUrl);
	const trustwalletList = trustwalletListResponse.data;

	return {
		coingecko,
		color,
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
	const infuraKey = '237c3102f39b4940abbe12dc49165cd6';

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

function validateInputs(lists, network) {
	validateNetworkInputs(lists, 'kovan');
	validateNetworkInputs(lists, 'homestead');
}

function validateNetworkInputs(lists, network) {
	// Check that addresses are checksummed
	validateAddressesChecksummed(lists.eligible[network]);
	validateAddressesChecksummed(lists.listed[network]);
	validateAddressesChecksummed(lists.ui[network]);
	validateAddressesChecksummed(lists.untrusted[network]);
	// Check that lists don't have duplicates
	validateNoDuplicates(lists.eligible[network], lists.ui[network]);
	validateNoDuplicates(lists.ui[network], lists.untrusted[network]);
	validateNoDuplicates(lists.listed[network], lists.untrusted[network]);
}

function validateAddressesChecksummed(tokens) {
	for (const address of tokens) {
		const checksummedAddress = ethers.utils.getAddress(address);
		if (address !== checksummedAddress) {
			console.warn(`Address not checksummed: ${address} (should be ${checksummedAddress})`);
		}
	}
}

function validateNoDuplicates(listA, listB) {
	for (const address of listA) {
		if (listB.includes(address)) {
			console.warn(`Duplicate address: ${address}`);
		}
	}
}

run();
