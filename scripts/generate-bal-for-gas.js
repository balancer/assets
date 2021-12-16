const fs = require('fs');

async function run() {
	try {

		const listedFile = await fs.readFileSync('lists/listed.json');
		const listed = JSON.parse(listedFile);

		const eligibleFile = await fs.readFileSync('lists/eligible.json');
		const uiFile = await fs.readFileSync('lists/ui-not-eligible.json');
		const eligible = JSON.parse(eligibleFile);
		const ui = JSON.parse(uiFile);

		const uniqueHomestead = [...new Set([...Object.keys(eligible.homestead), ...ui.homestead, ...listed.homestead])];
		const balForGas = {
			homestead: uniqueHomestead,
		};

		await generate('bal-for-gas', balForGas);
	} catch(e) {
		console.error(e);
		process.exit(1);
	}
}

async function generate(name, tokens) {
	const listFileName = `generated/${name}.json`;
	await fs.writeFileSync(listFileName, JSON.stringify(tokens, null, 2));
}

run();
