import hre, { ignition } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
import { auctionModule } from "../ignition/modules/auctiondeployment";
import { HeartsNFT, USDCMockCoin, Auction } from "../typechain-types";
import { Contract } from "ethers";

type auctionReturn = {
  auction: Contract;
  nft: HeartsNFT;
  usdc: USDCMockCoin;
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carl: HardhatEthersSigner;
  dave: HardhatEthersSigner;
  tokenIdCarl: number;
  tokenIdDave: number;
};

describe("Auction", () => {
  async function setUpSmartContracts(): Promise<auctionReturn> {
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

    it("fires auction event", async () => {
      const { auction, nft, carl, tokenIdCarl } = await loadFixture(
        setUpSmartContracts
      );
      const nftAddress = await nft.getAddress();
      const duration = 10 * 60; // ten minutes
      const tx = await auction
        .connect(carl)
        .createAuction(nftAddress, tokenIdCarl, duration);
      const auctionId = 1;
      const biddingEndTime = (await time.latest()) + duration;
      expect(tx)
        .to.emit(auction, "AuctionCreated")
        .withArgs(auctionId, nftAddress, tokenIdCarl, biddingEndTime);
    });
  });

  describe("Place bid", () => {
    let auction: Auction,
      nft: HeartsNFT,
      usdc: USDCMockCoin,
      alice: HardhatEthersSigner,
      bob: HardhatEthersSigner,
      carl: HardhatEthersSigner,
      tokenIdCarl: number,
      dave: HardhatEthersSigner;
    let auctionId = 1;
    let biddingEndTime: number;

    beforeEach(async () => {
      ({ auction, nft, carl, tokenIdCarl, dave, alice, usdc, bob, dave } =
        await loadFixture(setUpSmartContracts));

      const nftAddress = await nft.getAddress();
      const duration = 10 * 60; // ten minutes
      const currentTime = await time.latest();
      biddingEndTime = currentTime + duration;

      await auction
        .connect(carl)
        .createAuction(nftAddress, tokenIdCarl, duration);
    });

    it("Reverts when bidding is after end time", async () => {
      const FIFTEEN_MINUTES = 15 * 60; // 15 minutes
      await time.increase(FIFTEEN_MINUTES);

      const TEN_USDC = 10000000n;
      await expect(auction.connect(alice).placeBid(auctionId, TEN_USDC))
        .to.be.revertedWithCustomError(auction, "BiddingIsEnded")
        .withArgs(biddingEndTime + 1);
    });

    it("transfer tokens", async () => {
      const TEN_USDC = 10000000n;
      var tx = await auction.connect(alice).placeBid(auctionId, TEN_USDC);
      await expect(tx).to.changeTokenBalances(
        usdc,
        [alice.address, await auction.getAddress()],
        [-TEN_USDC, TEN_USDC]
      );
    });

    it("should fail is bid is set lower than current highest bid", async () => {
      const TEN_USDC = 10000000n;
      await auction.connect(alice).placeBid(auctionId, TEN_USDC);

      const FIVE_USDC = 5000000n;
      expect(auction.connect(bob).placeBid(auctionId, FIVE_USDC))
        .to.be.revertedWithCustomError(auction, "BidShouldBeHigher")
        .withArgs(FIVE_USDC);
    });

    it("increases bid balance", async () => {
      const TEN_USDC = 10000000n;
      await auction.connect(alice).placeBid(auctionId, TEN_USDC);

      const aliceBid = await auction.bids(alice.address, auctionId);
      expect(aliceBid).to.equal(TEN_USDC);
    });

    it("sets the highest bidder", async () => {
      const TEN_USDC = 10000000n;
      await auction.connect(alice).placeBid(auctionId, TEN_USDC);
      const auctionDetails = await auction.auctions(auctionId);
      expect(auctionDetails.highestBidder).to.equal(alice.address);
    });

    it("sets the highest bid", async () => {
      const TEN_USDC = 10000000n;
      await auction.connect(alice).placeBid(auctionId, TEN_USDC);
      const auctionDetails = await auction.auctions(auctionId);
      expect(auctionDetails.highestBid).to.equal(TEN_USDC);
    });

     it("should emit bid placed event", async () => {
       const TEN_USDC = 10000000n;
       await expect(auction.connect(alice).placeBid(auctionId, TEN_USDC))
         .to.emit(auction, "BidPlaced")
         .withArgs(auctionId, alice.address, TEN_USDC);
     });
  });

  describe("End Auction", () => {
    it("", async () => {});
  });

  describe("Withdraw", () => {
    it("", async () => {});
  });
});
