const axios = require('axios');

const fs = require('fs');

const coingeckoClient = axios.create({
	baseURL: 'https://api.coingecko.com/api/v3',
});

async function run() {
	try {
		const lists = await getLists();
		const data = await getData();
		const tokens = mergeTokenLists(lists);
		const ids = await getMissingIds(tokens, data.coingecko);
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}

async function getMissingIds(tokens, coingecko) {
	const kovan = await getMissingNetworkIds(tokens.kovan, coingecko.kovan);
	const homestead = await getMissingNetworkIds(tokens.homestead, coingecko.homestead);

	return {
		kovan,
		homestead,
	};
}

async function getMissingNetworkIds(tokens, coingecko) {
	for (const token of tokens) {
		const coingeckoId = coingecko[token];
		if (!coingeckoId) {
			let tokenInfo
			try {
				tokenInfo = await coingeckoClient.get(`coins/ethereum/contract/${token}`);
				console.log(token, coingeckoId, tokenInfo.data.id);
			} catch(e) {
				console.warn(`Coingecko ID not found for token: ${token}`);
				continue;
			}
		}
	}
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
		= 'https://raw.githubusercontent.com/trustwallet/assets/4ff402ed99d9028fb58ab3594b196e177390773b/blockchains/ethereum/allowlist.json';
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

run();
