import { AptosClient } from "aptos";

export function getAptosClient(): AptosClient {
  const nodeUrl = process.env.APTOS_NODE_URL || "https://fullnode.devnet.aptoslabs.com/v1";
  return new AptosClient(nodeUrl);
}
