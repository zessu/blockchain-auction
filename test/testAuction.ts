import hre, { ignition } from "hardhat";
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
import { auctionModule } from "../ignition/modules/auctiondeployment";
import { HeartsNFT, USDCMockCoin } from "../typechain-types";
import { Contract } from "ethers";

type auctionReturn = {
  auction: Contract;
  nft: HeartsNFT;
  usdc: USDCMockCoin;
  owner: string;
  alice: string;
  bob: string;
  carl: string;
  dave: string;
  tokenIdCarl: number;
  tokenIdDave: number;
};

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

  describe("Saving an auction", () => {
    it("saves all the details correctly", async () => {
      const { auction, nft, carl, owner, tokenIdCarl } = await loadFixture(
        setUpSmartContracts
      );

      // comparison object
      type TestCases = {
        nftAddress: string | null;
        tokenId: string | null;
        biddingEndTime: number | null;
        highestBidder: string | null;
        highestBid: number | null;
        auctionEnded: boolean | null;
        auctionCreator: string | null;
      };

      let testCases = {
        nftAddress: null,
        tokenId: null,
        biddingEndTime: null,
        highestBidder: null,
        highestBid: null,
        auctionEnded: null,
        auctionCreator: null,
      } as TestCases;

      const nftAddress = await nft.getAddress();
      const duration = 10 * 60;

      await auction
        .connect(carl)
        .createAuction(nftAddress, tokenIdCarl, duration);

      const highestBidder = hre.ethers.ZeroAddress;
      const highestBid = 0;
      const auctionEnded = false;
      const auctionCreator = carl.address;
      const lastBlockTime = await time.latest(); // checked after auction run
      const biggingEndTime = lastBlockTime + duration;

      testCases["nftAddress"] = nftAddress;
      testCases["tokenId"] = tokenIdCarl;
      testCases["biddingEndTime"] = biggingEndTime;
      testCases["highestBidder"] = highestBidder;
      testCases["highestBid"] = highestBid;
      testCases["auctionEnded"] = auctionEnded;
      testCases["auctionCreator"] = auctionCreator;

      // check that the auction at index 1 has similar properties

      const auctionResponse = await auction.auctions(1);
      expect(auctionResponse.nftAddress).to.equal(testCases.nftAddress);
      expect(auctionResponse.tokenId).to.equal(testCases.tokenId);
      expect(auctionResponse.biddingEndTime).to.equal(testCases.biddingEndTime);
      expect(auctionResponse.highestBidder).to.equal(testCases.highestBidder);
      expect(auctionResponse.highestBid).to.equal(testCases.highestBid);
      expect(auctionResponse.auctionEnded).to.equal(testCases.auctionEnded);
      expect(auctionResponse.auctionCreator).to.equal(testCases.auctionCreator);
    });
  });
});
