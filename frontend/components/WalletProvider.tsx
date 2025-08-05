import { PropsWithChildren, useEffect } from "react";
import { AptosWalletAdapterProvider, useWallet } from "@aptos-labs/wallet-adapter-react";
// Internal components
import { useToast } from "@/components/ui/use-toast";
// Internal constants
import { APTOS_API_KEY, NETWORK } from "@/constants";
// Internal utils
import { storage } from "@/utils/storage";

function WalletConnectionManager() {
  const { wallet, connect, account, disconnect } = useWallet();
  
  useEffect(() => {
    const reconnectWallet = async () => {
      const lastWallet = storage.getItem('lastWallet');
      if (!account && wallet && lastWallet === wallet.name) {
        try {
          await connect(wallet.name);
        } catch (error) {
          console.error("Failed to reconnect wallet:", error);
          // Clear stored wallet on error
          storage.removeItem('lastWallet');
        }
      }
    };

    if (wallet && account) {
      // Save current wallet when connected
      storage.setItem('lastWallet', wallet.name);
    }

    // Try to reconnect when wallet is available but not connected
    reconnectWallet();

    // Set up periodic connection check
    const checkInterval = setInterval(async () => {
      try {
        if (wallet && account) {
          // Verify connection is still valid
          const isStillConnected = await wallet.network.isConnected();
          if (!isStillConnected) {
            await disconnect();
            await reconnectWallet();
          }
        } else {
          await reconnectWallet();
        }
      } catch (error) {
        console.error("Connection check failed:", error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [wallet, account, connect, disconnect]);

  return null;
}

export function WalletProvider({ children }: PropsWithChildren) {
  const { toast } = useToast();

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{ network: NETWORK, aptosApiKeys: {[NETWORK]: APTOS_API_KEY} }}
      onError={(error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error || "Unknown wallet error",
        });
      }}
    >
      <WalletConnectionManager />
      {children}
    </AptosWalletAdapterProvider>
  );
}
