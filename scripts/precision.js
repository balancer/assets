const axios = require('axios');

const fs = require('fs');

const coingeckoClient = axios.create({
	baseURL: 'https://api.coingecko.com/api/v3',
});

const DEFAULT_PRECISION = 3;

async function check() {
	const data = await getData();
	const coinIds = data.coingecko.homestead;
	const symbolPrices = await getPriceBySymbols(coinIds);
	const precision = getPrecision(symbolPrices);
	console.log(precision);
}

async function getPriceBySymbols(coinIds) {
	const prices = {};
	const addresses = Object.keys(coinIds);
	for (let i = 0; i < addresses.length / 50; i++) {
		const addressSlice = addresses.slice(50 * i, 50 * (i + 1));
		const idsString = addressSlice.map(address => coinIds[address]).join(',');
		const priceResponse = await coingeckoClient.get(`simple/price`, {
			params: {
				ids: idsString,
				vs_currencies: 'usd'
			},
		});
		for (const address of addressSlice) {
			const priceInfo = priceResponse.data[coinIds[address]];
			prices[address] = priceInfo 
				? priceInfo.usd
				: undefined;
		}
	}
	return prices;
}

function getPrecision(prices) {
	const precisions = {};
	for (const address in prices) {
		const price = prices[address];
		let precision;
		if (price) {
			if (price < 2) {
				precision = 2;
			} else if (price < 20) {
				precision = 3;
			} else if (price < 200) {
				precision = 4;
			} else if (price < 2000) {
				precision = 5;
			} else {
				precision = 6;
			}
		} else {
			precision = DEFAULT_PRECISION;
		}
		precisions[address] = precision;
	}
	return precisions;
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

check();
