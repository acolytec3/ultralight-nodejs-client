# Ultralight

A prototype for an Ethereum Portal Client, written in Typescript.  Completely indebted to [Chainsafe](https://chainsafe.io/) for the underlying [`discv5`](https://github.com/chainsafe/discv5) implementation and [`discv5-cli`](https://github.com/chainsafe/discv5-cli)

## Usage

### Getting Started

`ultralight [run]` - Runs Ultralight
### CLI Options

`--help` - Help text

`init` - Initializes new PeerId and ENR in local directory

`-f [https://my_HTTP_web3_provider_access_point]` - Runs Ultralight with an HTTP Web3 Provider for sourcing balance/block data; defaults to Cloudflare 

`--rpc-port 1234` - Runs Ultralight with the JSON-RPC port set to `1234`; defaults to 3000


## JSON-RPC Calls

Ultralight exposes a JSON-RPC interface at `localhost:[rpc-port]` with tbe below API calls available:

`eth_getBlockByHash` - follows standard Ethereum JSON-RPC call; proxies to Cloudflare Ethereum gateway (or the HTTP web3 provider provided in arguments)

`eth_getBalance` - follows standard Ethereum JSON-RPC call; proxies to Cloudflare Ethereum gateway (or the HTTP web3 provider provided in arguments)

`epn_enr` - returns the current ENR of the Ultralight node

`epn_nodeId` - returns the node ID of the Ultralight node

`admin_addEnr` - Add ENR for a bootstrap node to Ultralight's address book

`epn_findContent` - submits a request for content to the portal network; takes a single string as a parameter
## Logging

Additional logs may be configured with the `DEBUG` environment variable.

eg: `DEBUG=discv5* ultralight`

## License

Apache 2.0
