const axios = require('axios');

const fs = require('fs');

const coingeckoClient = axios.create({
	baseURL: 'https://api.coingecko.com/api/v3',
});

const ITEMS_PER_BATCH = 50; // 414 HTTP error handling

async function check() {
	const data = await getData();
	const coinIds = data.coingecko.homestead;
	const addressPrices = await getPriceByAddresses(coinIds);
	const symbolPrices = await getPriceBySymbols(coinIds);
	comparePrices(coinIds, addressPrices, symbolPrices);
}

async function getPriceByAddresses(coinIds) {
	const prices = {};
	const addresses = Object.keys(coinIds);
	for (let i = 0; i < addresses.length / ITEMS_PER_BATCH; i++) {
		const addressSlice = addresses.slice(ITEMS_PER_BATCH * i, ITEMS_PER_BATCH * (i + 1));
		const contractAddressesString = addressSlice.join(',');
		const priceResponse = await coingeckoClient.get(`simple/token_price/ethereum`, {
			params: {
				contract_addresses: contractAddressesString,
				vs_currencies: 'usd'
			},
		});
		for (const address of addressSlice) {
			const priceInfo = priceResponse.data[address.toLowerCase()];
			if (!priceInfo) {
				prices[address] = 0;
			} else {
				prices[address] = priceInfo.usd;
			}
		}
	}
	return prices;
}

async function getPriceBySymbols(coinIds) {
	const prices = {};
	const addresses = Object.keys(coinIds);
	for (let i = 0; i < addresses.length / ITEMS_PER_BATCH; i++) {
		const addressSlice = addresses.slice(ITEMS_PER_BATCH * i, ITEMS_PER_BATCH * (i + 1));
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

function comparePrices(coinIds, addressPrices, symbolPrices) {
	for (const address in coinIds) {
		const addressPrice = addressPrices[address];
		const symbolPrice = symbolPrices[address];
		const diff = Math.abs(addressPrice - symbolPrice) / addressPrice;
		if (diff > 0.01) {
			console.log(`Price mismatch for ${address}: ${addressPrice} vs ${symbolPrice}`);
		}
	}
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
