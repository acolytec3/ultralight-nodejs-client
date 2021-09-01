import process = require("process");
import debug = require("debug");
import { ENR, Discv5 } from "@chainsafe/discv5";
import {
  getBindAddress,
  readPeerId,
  readEnr,
  readEnrs,
  writePeerId,
  writeEnr,
  writeEnrs,
  createPeerId,
  createEnr,
} from "./util";
import jayson from "jayson/promise";
import axios from "axios";
import { Multiaddr } from "multiaddr";

exports.command = ["$0", "run"];

exports.describe = "Run Ultralight - a Typescripted Ethereum Portal Client";

exports.builder = {
  p: {
    alias: "peer-id-file",
    demandOption: false,
    describe: "PeerId file -- e.g. ./peer-id.json",
    type: "string",
  },
  e: {
    alias: "local-enr-file",
    demandOption:false,
    describe: "Local ENR file -- e.g. ./local-enrs",
    type: "string",
  },
  b: {
    alias: "bootstrap-enrs-file",
    demandOption: false,
    describe: "Bootstrap ENRs file, line delimited",
    type: "string",
  },
  a: {
    alias: "bind-address",
    default: "/ip4/0.0.0.0/udp/5500",
    describe: "Multiaddr of the bind address (Must use UDP or WSS transport)",
    type: "string",
  },
  o: {
    alias: "output-enrs-file",
    demandOption: true,
    default: "./output-enrs",
    describe: "Output ENRs file, line delimited",
    type: "string",
  },
  f: {
    alias: "full-node-endpoint",
    default: "https://cloudflare-eth.com",
    describe:
      "HTTP endpoint for full node for validating network data (e.g. Infura/Cloudflare/Alchemy)",
    type: "string",
  },
  "rpc-port": {
    alias: "rpc-port",
    default: 3000,
    describe: "Port exposed by RPC server",
    type: "number",
  },
};

interface IInput {
  p: string;
  e: string;
  b: string;
  a: string;
  o: string;
  f: string;
  "rpc-port": number;
}

exports.handler = function (argv: IInput): void {
  process.on("SIGTERM", () => stop(argv.p, argv.e, argv.o));
  process.on("SIGINT", () => stop(argv.p, argv.e, argv.o));
  process.on("SIGHUP", () => save(argv.p, argv.e, argv.o));
  init(argv.p, argv.e, argv.b, argv.a).then(() =>
    start(argv.f, argv["rpc-port"])
  );
};

const log = debug("discv5:cli");
log.enabled = true;
let discv5wss: Discv5;
let discv5udp: Discv5;
let server: jayson.Server;

const foundEnrs: Record<string, ENR> = {};

async function init(
  peerIdFile: string | undefined,
  enrFile: string | undefined,
  bootstrapEnrsFile: string | undefined,
  bindAddressString: string
): Promise<void> {
  const peerId = peerIdFile ? await readPeerId(peerIdFile) : await createPeerId();
  const localEnr = peerIdFile && enrFile ? readEnr(enrFile) : createEnr(peerId);
  const bootstrapEnrs = bootstrapEnrsFile ? readEnrs(bootstrapEnrsFile) : [];
  const bindAddress = getBindAddress(bindAddressString).toOptions();
  localEnr.setLocationMultiaddr(new Multiaddr(bindAddressString));
  discv5udp = Discv5.create({
    enr: localEnr,
    peerId,
    multiaddr: new Multiaddr(`/ip4/${bindAddress.host}/udp/${bindAddress.port}`),
    config: { requestRetries: 3 },
    transport: "udp"
  });
  discv5wss = Discv5.create({
    enr: localEnr,
    peerId,
    multiaddr: new Multiaddr(`/ip4/${bindAddress.host}/tcp/${bindAddress.port+1}`),
    config: { requestRetries: 3},
    transport: "wss"
  });
  discv5udp.enr.setLocationMultiaddr(new Multiaddr(`/ip4/${bindAddress.host}/udp/${bindAddress.port}`));
  discv5wss.enr.setLocationMultiaddr(new Multiaddr(`/ip4/${bindAddress.host}/tcp/${bindAddress.port+1}`));
  bootstrapEnrs.forEach((enr) => {
    log(`Adding bootstrap enr: ${enr.encodeTxt()}`);
    discv5udp.addEnr(enr);
  });
}

async function start(endpoint: string, rpcport: number): Promise<void> {
  server = new jayson.Server({
    epn_enr: async function () {
      const enr = discv5udp.enr.encodeTxt(discv5udp.keypair.privateKey);
      return enr;
    },
    epn_nodeId: async function () {
      return discv5udp.enr.nodeId;
    },
    epn_isStarted: async function () {
      return discv5udp.isStarted();
    },
    admin_addEnr: async function (args: string[]) {
      try {
        discv5udp.addEnr(args[0]);
      } catch (err) {
        log(`Error adding ENR: ${err}`);
      }
      return null;
    },
    epn_findContent: async function (args: string[]) {
      const content = args[0];
      const msg = Buffer.from(content);
      await discv5udp.broadcastTalkReq(msg, "portal");
    },
    eth_getBalance: async function (args: string[]) {
      const account = args[0];
      try {
        const res = await axios.post(endpoint, {
          headers: {
            "Content-Type": "application/json",
          },
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [account, "latest"],
        });
        return res.data;
      } catch (err) {
        console.log(err);
      }
    },
    eth_getBlockByHash: async function (args: string[]) {
      const blockHash = args[0];
      try {
        const res = await axios.post(endpoint, {
          headers: {
            "Content-Type": "application/json",
          },
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBlockByHash",
          params: [blockHash, false],
        });
        return res.data;
      } catch (err) {
        console.log(err);
      }
    },
    eth_getTransactionByHash: async function (args: string[]) {
      const transactionHash = args[0];
      try {
        const res = await axios.post(endpoint, {
          headers: {
            "Content-Type": "application/json",
          },
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBlockByHash",
          params: [transactionHash, false],
        });
        return res.data;
      } catch (err) {
        console.log(err);
      }
    },
  });
  server.on("request", (msg) => {
    log(`RPC Message Received: Method - ${msg.method} - params: ${msg.params}`);
  });
  await server.http().listen(rpcport, function () {
    log(`rpc server listening on port ${rpcport}`);
  });
  try {
    await discv5udp.start();
    await discv5wss.start();
  } catch (err) {
    log(`Error starting Discv5: ${err.message}`);
  }

  log(
    `Service started on ${discv5udp.bindAddress} with local node id: ${discv5udp.enr.nodeId}`
  );
  log(
    `Service started on ${discv5wss.bindAddress} with local node id: ${discv5wss.enr.nodeId}`
  );
  log(`UDP service ENR is ${discv5udp.enr.encodeTxt(discv5udp.keypair.privateKey)}`);
  log(`WSS service ENR is ${discv5wss.enr.encodeTxt(discv5wss.keypair.privateKey)}`);
  discv5udp.on("discovered", (enr) => log(`Discovered node with id: ${enr.id}`));
  discv5udp.on("enrAdded", (enr) => log(`Added ENR: ${enr.encodeTxt()}`));
  discv5udp.on("talkReqReceived", (srcId, enr, msg) => {
    log(`Received message from ${srcId}`);
    const response = msg.request.toString("utf-8") + "back at you";
    discv5udp.sendTalkResp(srcId, msg.id, Buffer.from(response));
  });
  discv5udp.on("talkRespReceived", (srcId, enr, msg) => log(`Received ${msg.response.toString("utf-8")} from node ${srcId}`));
}

async function save(
  peerIdFile: string,
  enrFile: string,
  outputFile: string
): Promise<void> {
  const peerId = await discv5udp.peerId();
  writePeerId(peerIdFile ?? "./peer-id.json", peerId);
  writeEnr(enrFile ?? "./local-enrs", discv5udp.enr, peerId);
  writeEnrs(outputFile, Object.values(foundEnrs));
}

async function stop(
  peerIdFile: string,
  enrFile: string,
  outputFile: string
): Promise<void> {
  await save(peerIdFile, enrFile, outputFile);
  await discv5udp.stop();
  await discv5wss.stop();
  await server.http().removeAllListeners();
  log("Service stopped");
  process.exit(0);
}
