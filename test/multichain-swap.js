const { expect } = require("chai");
const { ethers } = require("hardhat");
const { AddressZero, MaxUint256 } = require("@ethersproject/constants");
const { parseUnits } = require("@ethersproject/units");

describe("MultiChainSwap", function () {
  let multiChainSwap, zetaMock;
  let deployer, account1;

  before(async () => {
    [deployer, account1] = await ethers.getSigners();

    const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const wBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

    const ZetaMock = await ethers.getContractFactory("ZetaEthMock");
    zetaMock = await ZetaMock.deploy("10000000");
    await zetaMock.deployed();

    const ZetaConnector = await ethers.getContractFactory("MultiChainSwapZetaConnector");
    const zetaConnector = await ZetaConnector.deploy(zetaMock.address);
    await zetaConnector.deployed();

    const MultiChainSwap = await ethers.getContractFactory("MultiChainSwap");
    multiChainSwap = await MultiChainSwap.deploy(
        zetaConnector.address, 
        zetaMock.address,
        router
    );
    await multiChainSwap.deployed();
    console.log("MultiChainSwap deployed: ", multiChainSwap.address);
  });

  describe("swapETHForTokensCrossChain", () => {
    it("Should revert if the destinationChainId is not in the storage", async () => {
      await expect(
        multiChainSwap.swapETHForTokensCrossChain(
          ethers.utils.solidityPack(["address"], [account1.address]),
          zetaMock.address,
          false,
          0,
          10,
          MaxUint256,
          {
            value: parseUnits("1"),
          }
        )
      ).to.be.revertedWith("InvalidDestinationChainId");
    });
  });
});
