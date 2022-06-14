const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ZapPancakeswapV2", function () {
  before(async () => {
    const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const wBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

    const ZapFactory = await ethers.getContractFactory("ZapPancakeswapV2");
    const zapFactory = await ZapFactory.deploy(router, wBNB);
    await zapFactory.deployed();
  });

  it("Estimate swap", async function () {
  });
});
