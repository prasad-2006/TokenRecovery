import { useEffect, useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { InputTransactionData } from "@aptos-labs/wallet-adapter-core";
// Internal components
import { toast } from "@/components/ui/use-toast";
import { aptosClient } from "@/utils/aptosClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMessageContent } from "@/view-functions/getMessageContent";
import { writeMessage } from "@/entry-functions/writeMessage";

export function MessageBoard() {
  const { account, signAndSubmitTransaction } = useWallet();
  const queryClient = useQueryClient();

  const [messageContent, setMessageContent] = useState<string>();
  const [newMessageContent, setNewMessageContent] = useState<string>();

  const { data } = useQuery({
    queryKey: ["message-content"],
    refetchInterval: 10_000,
    queryFn: async () => {
      try {
        const content = await getMessageContent();

        return {
          content,
        };
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error,
        });
        return {
          content: "",
        };
      }
    },
  });

  const initializeMessageBoard = async () => {
    if (!account) {
      return;
    }

    try {
      const payload = {
        data: {
          function: `${account.address}::message_board::init_module_for_test`,
          typeArguments: [],
          functionArguments: []
        }
      };
      await signAndSubmitTransaction(payload);
      toast({
        title: "Success",
        description: "Message board initialized successfully",
      });
    } catch (error: any) {
      // Ignore if already initialized
      if (!error.message?.includes("already exists")) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
      }
    }
  };

  const onClickButton = async () => {
    if (!account || !newMessageContent) {
      return;
    }

    try {
      // Try to initialize first
      await initializeMessageBoard();
      
      const committedTransaction = await signAndSubmitTransaction(
        writeMessage({
          content: newMessageContent,
        }),
      );
      const executedTransaction = await aptosClient().waitForTransaction({
        transactionHash: committedTransaction.hash,
      });
      queryClient.invalidateQueries({
        queryKey: ["message-content"],
      });
      toast({
        title: "Success",
        description: `Transaction succeeded, hash: ${executedTransaction.hash}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (data) {
      setMessageContent(data.content);
    }
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <h4 className="text-lg font-medium">Message content: {messageContent}</h4>
      New message{" "}
      <Input disabled={!account} placeholder="yoho" onChange={(e) => setNewMessageContent(e.target.value)} />
      <Button
        disabled={!account || !newMessageContent || newMessageContent.length === 0 || newMessageContent.length > 100}
        onClick={onClickButton}
      >
        Write
      </Button>
    </div>
  );
}
