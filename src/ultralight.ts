import process = require("process");
import debug = require("debug");
import randomBytes = require("randombytes");
import {
  ENR,
  Discv5,
  toHex,
} from "@chainsafe/discv5";
import {
  getBindAddress,
  readPeerId, readEnr, readEnrs,
  writePeerId, writeEnr, writeEnrs,
} from "./util";
import jayson from "jayson/promise";
import axios from "axios";
exports.command = ["$0", "run"];

exports.describe = "Run Ultralight - a Typescripted Ethereum Portal Client";

exports.builder = {
  "p": {
    alias: "peer-id-file",
    demandOption: true,
    default: "./peer-id.json",
    describe: "PeerId file",
    type: "string",
  },
  "e": {
    alias: "local-enr-file",
    default: "./local-enr",
    describe: "Local ENR file",
    type: "string",
  },
  "b": {
    alias: "bootstrap-enrs-file",
    demandOption: true,
    default: "./bootstrap-enrs",
    describe: "Bootstrap ENRs file, line delimited",
    type: "string"
  },
  "a": {
    alias: "bind-address",
    default: "/ip4/0.0.0.0/udp/5500",
    describe: "Multiaddr of the bind address (Must use UDP transport)",
    type: "string"
  },
  "o": {
    alias: "output-enrs-file",
    demandOption: true,
    default: "./output-enrs",
    describe: "Output ENRs file, line delimited",
    type: "string",
  },
  "f": {
    alias: "full-node-endpoint",
    demandOption: true,
    default: "https://cloudflare-eth.com",
    describe: "HTTP endpoint for full node for validating network data (e.g. Infura/Cloudflare/Alchemy)",
    type: "string"
  }
};

interface IInput {
  p: string;
  e: string;
  b: string;
  a: string;
  o: string;
  f: string;
}

exports.handler = function (argv: IInput): void {
  process.on("SIGTERM", () => stop(argv.p, argv.e, argv.o));
  process.on("SIGINT", () => stop(argv.p, argv.e, argv.o));
  process.on("SIGHUP", () => save(argv.p, argv.e, argv.o));
  init(argv.p, argv.e, argv.b, argv.a).then(() => start(argv.f));
};

const log = debug("discv5:cli");
log.enabled = true;
let discv5: Discv5;
let server: jayson.Server;

const foundEnrs: Record<string, ENR> = {};

async function init(
  peerIdFile: string,
  enrFile: string,
  bootstrapEnrsFile: string,
  bindAddressString: string,

): Promise<void> {
  const peerId = await readPeerId(peerIdFile);
  const localEnr = readEnr(enrFile);
  const bootstrapEnrs = readEnrs(bootstrapEnrsFile);
  const bindAddress = getBindAddress(bindAddressString);

  discv5 = Discv5.create({ enr: localEnr, peerId, multiaddr: bindAddress });
  bootstrapEnrs.forEach((enr) => {
    log("Adding bootstrap enr: %s", enr.encodeTxt());
    discv5.addEnr(enr);
  });
}

async function start(endpoint: string): Promise<void> {
  server = new jayson.Server({
    epn_enr: async function () {
      const enr = discv5.enr.encodeTxt(discv5.keypair.privateKey);
      return enr;
    },
    epn_nodeId: async function () {
      return discv5.enr.nodeId;
    },
    admin_addEnr: async function (args: string[]) {
      discv5.addEnr(args[0]);
      return null;
    },
    eth_getBalance: async function (args: string[]) {
      const account = args[0];
      try {
        const res = await axios.post(endpoint,
          {
            headers: {
              "Content-Type": "application/json"
            },
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getBalance",
            params: [
              account, "latest"
            ],
          });
        return res.data;
      }
      catch (err) { console.log(err); }
    },
    eth_getBlockByHash: async function (args: string[]) {
      const blockHash = args[0];
      try {
        const res = await axios.post(endpoint,
          {
            headers: {
              "Content-Type": "application/json"
            },
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getBlockByHash",
            params: [
              blockHash, false
            ],
          });
        return res.data;
      }
      catch (err) { console.log(err); }
    },
    eth_getTransactionByHash: async function (args: string[]) {
      console.log("they want em blockhash!", args[0]);
      const transactionHash = args[0];
      try {
        const res = await axios.post(endpoint,
          {
            headers: {
              "Content-Type": "application/json"
            },
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getBlockByHash",
            params: [
              transactionHash, false
            ],
          });
        return res.data;
      }
      catch (err) { console.log(err); }
    }
  });
  
  await server.http().listen(3000, function () { log("rpc server listening on port 3000"); });
  await discv5.start();
  log("Service started on %s with local node id: %s", discv5.bindAddress, discv5.enr.nodeId);

  while (discv5.isStarted()) {
    const nodeId = toHex(randomBytes(32));
    log("Find node: %s", nodeId);
    const nearest = await discv5.findNode(nodeId);
    if (discv5.isStarted()) {
      nearest.forEach((enr) => foundEnrs[enr.nodeId] = enr);
      log("%d total enrs in the table", discv5.kadValues().length);
      log("%d total connected peers", discv5.connectedPeerCount);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function save(
  peerIdFile: string,
  enrFile: string,
  outputFile: string,
): Promise<void> {
  const peerId = await discv5.peerId();
  writePeerId(peerIdFile, peerId);
  writeEnr(enrFile, discv5.enr, peerId);
  writeEnrs(outputFile, Object.values(foundEnrs));
}

async function stop(
  peerIdFile: string,
  enrFile: string,
  outputFile: string,
): Promise<void> {
  await save(peerIdFile, enrFile, outputFile);
  await discv5.stop();
  log("Service stopped");
  process.exit(0);
}

