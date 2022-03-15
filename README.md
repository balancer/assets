# Balancer Asset Repository

## How to add a token to Balancer

To add a token, the bytecode must be verified.  For example [https://etherscan.io/verifyContract](Verify Contract on Etherscan)
Furthermore, it must not be a rebasing token, as these are incompatible with the balancer v2 vault

The tokens should be added to the appropriate list(s) below and then pull requested so they can be subject to community review.  In most cases, for a token to be on the balancer ui, it should be added to `/lists/listed.json` and `/lists/ui-not-eligible.json`. These addresses must be checksummed.

If a custom token icon is to be used, a png named `<token address>.png` should be added to the `/assets/` folder, and the token address should be added to `/assets/index.json`. These addresses must NOT be checksummed; i.e., they should be all lowercase.

If the token is incompatible with balancer - such as a rebasing token - please add it to `/lists/untrusted.json`

## Lists

Lists of tokens are found in the `/lists` directory

* `listed.json`: assets listed on balancer.exchange
* `ui-not-eligible.json`: assets vetted by community members
* `untrusted.json`: assets that are incompatible with Balancer
* `eligible.json`: DEPRECATED, only relevant to V1 liquidity mining

## Generated

To generate, run `npm run generate`.
