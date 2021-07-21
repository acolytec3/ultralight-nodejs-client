# Ultralight

A prototype for an Ethereum Portal Client, written in Typescript.  Completely indebted to [Chainsafe](https://chainsafe.io/) for the underlying [`discv5`](https://github.com/chainsafe/discv5) implementation and [`discv5-cli`](https://github.com/chainsafe/discv5-cli)

## Usage

`ultralight --help` - Help text

`ultralight init` - Initializes new PeerId and ENR in local directory

`ultralight [run]` - Runs Ultralight

`ultralight -f [https://my_infura_access_point]` - Runs Ultralight with an HTTP Web3 Provider for sourcing balance/block data; defaults to Cloudflare 

Note: A UDP Multiaddr, PeerId, Local ENR, and Output ENRs files must be provided to run Ultralight.

## JSON-RPC Calls

Ultralight exposes a JSON-RPC interface at `localhost:3000` with tbe below API calls available:

`eth_getBlockByHash` - follows standard Ethereum JSON-RPC call; proxies to Cloudflare Ethereum gateway (or the HTTP web3 provider provided in arguments)

`eth_getBalance` - follows standard Ethereum JSON-RPC call; proxies to Cloudflare Ethereum gateway (or the HTTP web3 provider provided in arguments)

`epn_enr` - returns the current ENR of the Ultralight node

`epn_nodeId` - returns the node ID of the Ultralight node

`epn_addEnr` - Add ENR for a bootstrap node to Ultralight's address book
## Logging

Additional logs may be configured with the `DEBUG` environment variable.

eg: `DEBUG=discv5* ultralight`

## License

Apache 2.0
