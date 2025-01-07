import { createPublicClient, createWalletClient, http } from "viem";
import { localhost } from "viem/chains";
import hre from "hardhat";

describe("Auction Testing", () => {
  describe("Validating Input Values", () => {
    async function setUpSmartContracts() {
      // Create wallet and public clients
      const walletClient = createWalletClient({
        chain: { ...localhost, id: 31337 },
        transport: http(),
      });

      const publicClient = createPublicClient({
        chain: localhost,
        transport: http(),
      });

      // Get signer (first testing account)
      const [owner, minter] = await walletClient.getAddresses();

      // Dynamically load contract artifacts
      const usdcArtifact = await hre.artifacts.readArtifact("USDCMockCoin");
      const auctionArtifact = await hre.artifacts.readArtifact("Auction");
      const heartsArtifact = await hre.artifacts.readArtifact("HeartsNFT");

      const usdcHash = await walletClient.deployContract({
        abi: usdcArtifact.abi,
        bytecode: usdcArtifact.bytecode as `0x${string}`,
        args: [owner],
        account: owner,
      });

      const usdcReceipt = await publicClient.waitForTransactionReceipt({
        hash: usdcHash,
      });

      console.log(usdcReceipt.contractAddress);
      // Deploy the auction contract
      await walletClient.deployContract({
        abi: auctionArtifact.abi,
        bytecode: auctionArtifact.bytecode as `0x${string}`,
        args: [owner, usdcReceipt.contractAddress],
        account: owner,
      });

      await walletClient.deployContract({
        abi: heartsArtifact.abi,
        bytecode: heartsArtifact.bytecode as `0x${string}`,
        args: [owner, minter],
        account: owner,
      });
    }

    it("USDC Address should be the same", async () => {
      await setUpSmartContracts();
    });
  });
});
