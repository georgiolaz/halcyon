const { expect } = require("chai");
const { ethers } = require("hardhat");
const { AddressZero, MaxUint256 } = require("@ethersproject/constants");
const { parseUnits } = require("@ethersproject/units");
const { BigNumber } = require("@ethersproject/bignumber");

describe("MultiChainSwap", function () {
  let multiChainSwapA, multiChainSwapB, zetaMock;
  let deployer, account1;

  const chainAId = 1;
  const chainBId = 2;

  beforeEach(async () => {
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
    multiChainSwapA = await MultiChainSwap.deploy(
        zetaConnector.address, 
        zetaMock.address,
        router
    );
    await multiChainSwapA.deployed();
    console.log("multiChainSwapA deployed: ", multiChainSwapA.address);

    multiChainSwapB = await MultiChainSwap.deploy(
      zetaConnector.address, 
      zetaMock.address,
      router
    );
    await multiChainSwapB.deployed();
    console.log("multiChainSwapB deployed: ", multiChainSwapB.address);

    const encodedCrossChainAddressB = ethers.utils.solidityPack(["address"], [multiChainSwapB.address]);
    multiChainSwapA.setInteractorByChainId(chainBId, encodedCrossChainAddressB);

    const encodedCrossChainAddressA = ethers.utils.solidityPack(["address"], [multiChainSwapA.address]);
    multiChainSwapB.setInteractorByChainId(chainAId, encodedCrossChainAddressA);
  });

  describe("swapETHForTokensCrossChain", () => {
    it("Should revert if the destinationChainId is not in the storage", async () => {
      await expect(
        multiChainSwapA.swapETHForTokensCrossChain(
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

    it("Should revert if the originInputToken isn't provided", async () => {
      await expect(
        multiChainSwapA.swapTokensForTokensCrossChain(
          AddressZero,
          BigNumber.from(10),
          ethers.utils.solidityPack(["address"], [account1.address]),
          zetaMock.address,
          false,
          0,
          chainBId,
          MaxUint256
        )
      ).to.be.revertedWith("MissingOriginInputTokenAddress");
    });
  });
});
