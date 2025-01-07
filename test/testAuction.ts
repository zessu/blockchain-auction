import hre, { ignition } from "hardhat";
const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
import { auctionModule } from "../ignition/modules/auctiondeployment";

describe("Auction", () => {
  async function setUpSmartContracts() {
    // ...
    var [owner, alice, bob, carl, dave] = await hre.ethers.getSigners();

    // Smart contract deployment
    var usdc = await hre.ethers.deployContract("USDCMockCoin", [owner]);

    const { auction } = await ignition.deploy(auctionModule, {
      parameters: {
        DeployAuction: {
          initialOwner: owner.address,
          usdcAddress: await usdc.getAddress(),
        },
      },
    });
    var auctionAddress = await auction.getAddress();

    var nft = await hre.ethers.deployContract("HeartsNFT", [
      owner.address,
      owner.address,
    ]);

    const ONE_MILLION_USDC = 1000000000000n;
    await usdc.mint(alice.address, ONE_MILLION_USDC);
    await usdc.mint(bob.address, ONE_MILLION_USDC);

    // alice and bob give USDC allowance to the Auction contract
    await usdc.connect(alice).approve(auctionAddress, ONE_MILLION_USDC);
    await usdc.connect(bob).approve(auctionAddress, ONE_MILLION_USDC);

    // carl and dave receive both an NFT
    await nft.safeMint(carl.address); // id: 0
    await nft.safeMint(dave.address); // id: 1

    var tokenIdCarl = 0;
    var tokenIdDave = 1;

    // give allowance to both carl and dave's NFTs to the auction contract
    await nft.connect(carl).approve(auctionAddress, tokenIdCarl);
    await nft.connect(dave).approve(auctionAddress, tokenIdDave);

    return {
      auction,
      nft,
      usdc,
      owner,
      alice,
      bob,
      carl,
      dave,
      tokenIdCarl,
      tokenIdDave,
    };
  }

  describe("Auction Creation", () => {
    it("USDC Address should be the same", async () => {
      const { usdc, auction } = await loadFixture(setUpSmartContracts);

      expect(await usdc.getAddress()).to.be.equal(await auction.usdcToken());
    });

    it("Auction counter increases in one", async () => {
      const { auction, nft, carl, tokenIdCarl } = await loadFixture(
        setUpSmartContracts
      );
      var prevAuctionCounter = await auction.auctionCounter();

      var nftAddress = await nft.getAddress();
      var duration = 10 * 60; // ten minutes
      await auction
        .connect(carl)
        .createAuction(nftAddress, tokenIdCarl, duration);

      var afterAuctionCounter = await auction.auctionCounter();

      expect(afterAuctionCounter - prevAuctionCounter).to.equal(
        1,
        "Counter does not increase in one"
      );
    });

    it("NFT is transferred to the contract", async () => {
      const { auction, nft, carl, tokenIdCarl } = await loadFixture(
        setUpSmartContracts
      );

      expect(await nft.ownerOf(tokenIdCarl)).to.equal(
        carl.address,
        "Prior owner incorrect"
      );

      var nftAddress = await nft.getAddress();
      var duration = 10 * 60; // ten minutes
      await auction
        .connect(carl)
        .createAuction(nftAddress, tokenIdCarl, duration);

      expect(await nft.ownerOf(tokenIdCarl)).to.equal(
        await auction.getAddress(),
        "Current owner incorrect"
      );
    });
  });
});
