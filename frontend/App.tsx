import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
// Internal Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { WalletDetails } from "@/components/WalletDetails";
import { NetworkInfo } from "@/components/NetworkInfo";
import { AccountInfo } from "@/components/AccountInfo";
import { TransferAPT } from "@/components/TransferAPT";
import { MessageBoard } from "@/components/MessageBoard";
import { TopBanner } from "@/components/TopBanner";
import { TokenRecovery } from "@/components/TokenRecovery";

function App() {
  const { connected, account, connect, wallet } = useWallet();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to restore wallet connection
    const initializeWallet = async () => {
      const lastWallet = localStorage.getItem('aptos_dapp_lastWallet');
      if (wallet && !connected && !account && lastWallet === wallet.name) {
        try {
          await connect(wallet.name);
        } catch (error) {
          console.error("Failed to reconnect wallet:", error);
          localStorage.removeItem('aptos_dapp_lastWallet');
        }
      }
      setIsLoading(false);
    };

    initializeWallet();

    // Set up auto-refresh of connection status
    const refreshInterval = setInterval(async () => {
      if (!connected && wallet) {
        // If we lost connection, try to reconnect
        try {
          await connect(wallet.name);
        } catch {
          window.location.reload();
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(refreshInterval);
  }, [wallet, connected, account, connect]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <TopBanner />
      <Header />
      <div className="container mx-auto px-4 py-8">
        {connected ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Wallet and Network Information */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <WalletDetails />
                  <NetworkInfo />
                  <AccountInfo />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Transfer APT</CardTitle>
                </CardHeader>
                <CardContent>
                  <TransferAPT />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Token Recovery and Message Board */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Token Recovery System</CardTitle>
                </CardHeader>
                <CardContent>
                  <TokenRecovery />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Message Board</CardTitle>
                </CardHeader>
                <CardContent>
                  <MessageBoard />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle>Welcome to Token Recovery DApp</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-600">
                Please connect your wallet to access the token recovery system and other features.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default App;
