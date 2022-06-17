const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiChainSwap", function () {
  before(async () => {
    const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const wBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

    const ZetaMock = await ethers.getContractFactory("ZetaEthMock");
    const zetaMock = await ZetaMock.deploy("10000000");
    await zetaMock.deployed();

    const ZetaConnector = await ethers.getContractFactory("MultiChainSwapZetaConnector");
    const zetaConnector = await ZetaConnector.deploy(zetaMock.address);
    await zetaConnector.deployed();

    const MultiChainSwap = await ethers.getContractFactory("MultiChainSwap");
    const multiChainSwap = await MultiChainSwap.deploy(
        zetaConnector.address, 
        zetaMock.address,
        router
    );
    await multiChainSwap.deployed();
    console.log("MultiChainSwap deployed: ", multiChainSwap.address);
  });

  it("swapETHForTokensCrossChain", async function () {
  });
});
