import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";

export function requestRecovery(
  toAddress: string,
  amount: number
): InputTransactionData {
  const amountInOctas = BigInt(Math.round(amount * 100000000)); // Convert to octas (8 decimal places) using BigInt for precision
  return {
    data: {
      function: `${import.meta.env.VITE_MODULE_ADDRESS}::token_recovery::request_recovery`,
      typeArguments: ["0x1::aptos_coin::AptosCoin"],
      functionArguments: [toAddress, amountInOctas.toString()] // Pass amount as string to handle large numbers
    }
  };
}
