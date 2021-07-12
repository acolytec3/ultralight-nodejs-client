import {
  writePeerId, writeEnr, createPeerId, createEnr,
} from "./util";

exports.command = "init";

exports.describe = "Initialize new PeerId and ENR";

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
};

interface IInput {
  p: string;
  e: string;
}

async function init(
  peerIdFile: string,
  enrFile: string,
): Promise<void> {
  const peerId = await createPeerId();
  const enr = createEnr(peerId);
  writePeerId(peerIdFile, peerId);
  writeEnr(enrFile, enr, peerId);
}

exports.handler = function(argv: IInput): void {
  init(argv.p, argv.e);
};
