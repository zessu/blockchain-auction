import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export const auctionModule = buildModule("DeployAuction", (m) => {
  const owner = m.getAccount(0);
  const initialOwner = m.getParameter("initialOwner", owner);
  const usdcAddress = m.getParameter(
    "usdcAddress",
    "0x0000000000000000000000000000000000000000"
  );
  const auction = m.contract("Auction", [initialOwner, usdcAddress]);

  return { auction };
});
