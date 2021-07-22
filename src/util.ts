import fs = require("fs");
import PeerId = require("peer-id");
import { ENR } from "@chainsafe/discv5";
import { Multiaddr } from "multiaddr";
export async function createPeerId(): Promise<PeerId> {
  return PeerId.create({ keyType: "secp256k1" });
}

export async function readPeerId(peerIdFile: string): Promise<PeerId> {
  return PeerId.createFromJSON(JSON.parse(fs.readFileSync(peerIdFile, "utf-8")));
}

export function writePeerId(peerIdFile: string, peerId: PeerId): void {
  return fs.writeFileSync(peerIdFile, JSON.stringify(peerId.toJSON(), null, 2));
}

export function createEnr(peerId: PeerId): ENR {
  return ENR.createFromPeerId(peerId);
}

export function readEnr(enrFile: string): ENR {
  return ENR.decodeTxt(fs.readFileSync(enrFile, "utf-8").trim());
}

export function writeEnr(enrFile: string, enr: ENR, peerId: PeerId): void {
  return fs.writeFileSync(enrFile, enr.encodeTxt(Buffer.from(peerId.privKey.marshal())));
}

export function readEnrs(filename: string): ENR[] {
  try {
    const enrs = fs.readFileSync(filename, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((str) => ENR.decodeTxt(str));
    return enrs;
  }
  catch (err) {
    console.log(err);
    return [];
  }
}

export function writeEnrs(filename: string, enrs: ENR[]): void {
  fs.writeFileSync(filename, enrs.map((enr) => enr.encodeTxt()).join("\n"));
}

export function getBindAddress(addr: string): Multiaddr {
  const mu = new Multiaddr(addr);
  const protoNames = mu.protoNames();
  if (protoNames.length !== 2 || protoNames[1] !== "udp") {
    throw new Error("Invalid bind address, must be a udp multiaddr");
  }
  return mu;
}
