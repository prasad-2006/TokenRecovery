import { useState, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestRecovery } from "@/entry-functions/token-recovery";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TokenRecovery() {
  const { account, signAndSubmitTransaction } = useWallet();
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const checkInitialized = async () => {
      if (!account) return;
      
      try {
        const resources = await aptosClient().getAccountResources({
          accountAddress: account.address,
        });
        
        const recoveryStore = resources.find(
          (r) => r.type === `${import.meta.env.VITE_MODULE_ADDRESS}::token_recovery::RecoveryStore`
        );
        
        setInitialized(!!recoveryStore);
      } catch (error) {
        console.error("Error checking initialization status:", error);
      }
    };

    checkInitialized();
  }, [account]);

  const handleInitialize = async () => {
    if (!account) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        data: {
          function: `${import.meta.env.VITE_MODULE_ADDRESS}::token_recovery::initialize_recovery`,
          functionArguments: [],
          typeArguments: []
        }
      };
      const txResult = await signAndSubmitTransaction(payload);
      
      // Wait for transaction confirmation
      await aptosClient().waitForTransactionWithResult(txResult.hash);
      
      toast({
        title: "Success",
        description: "Token recovery initialized successfully",
      });
      
      setInitialized(true);
    } catch (error: any) {
      console.error("Error initializing token recovery:", error);
      if (error.message?.includes("already exists")) {
        setInitialized(true);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to initialize token recovery",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async () => {
    if (!account) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please connect your wallet first",
      });
      return;
    }

    if (!toAddress || !amount) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in both recipient address and amount",
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid amount greater than 0",
      });
      return;
    }

    // Validate address format
    if (!toAddress.startsWith("0x") || toAddress.length !== 66) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid Aptos address",
      });
      return;
    }

    try {
      setLoading(true);
      const payload = requestRecovery(toAddress, numAmount);
      const txResult = await signAndSubmitTransaction(payload);
      
      // Wait for transaction confirmation
      await aptosClient().waitForTransactionWithResult(txResult.hash);
      
      toast({
        title: "Success",
        description: "Token recovery request submitted and confirmed",
      });
      
      // Reset form
      setToAddress("");
      setAmount("");
    } catch (error: any) {
      console.error("Error requesting token recovery:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit token recovery request",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Recovery</CardTitle>
        <CardDescription>
          Request recovery for tokens sent to wrong addresses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {!initialized ? (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                You need to initialize token recovery before you can use it.
              </p>
              <Button
                variant="default"
                disabled={loading}
                onClick={handleInitialize}
              >
                {loading ? "Initializing..." : "Initialize Token Recovery"}
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="toAddress">Recipient Address</Label>
                <Input
                  id="toAddress"
                  placeholder="Enter the correct recipient address"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount to recover"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button
                variant="default"
                disabled={loading || !toAddress || !amount}
                onClick={handleRecovery}
              >
                {loading ? "Processing..." : "Request Recovery"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
