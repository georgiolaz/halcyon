const { expect } = require("chai");
const { ethers } = require("hardhat");
const { AddressZero, MaxUint256 } = require("@ethersproject/constants");
const { parseUnits } = require("@ethersproject/units");
const { BigNumber } = require("@ethersproject/bignumber");

describe("MultiChainSwap", function () {
  let multiChainSwapA, multiChainSwapB, zetaMock, pancakeswapRouter, USDCTokenContract;
  let deployer, account1;
  let WETH;

  const chainAId = 1;
  const chainBId = 2;
  const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const ZETA_USDC_PRICE = BigNumber.from("1455462180");

  const addZetaEthLiquidity = async () => {
    const tx1 = await zetaMock.approve(pancakeswapRouter.address, MaxUint256);
    await tx1.wait();

    // 2 ZETA = 1 ETH
    const tx2 = await pancakeswapRouter.addLiquidityETH(
      zetaMock.address,
      parseUnits("2000"),
      0,
      0,
      deployer.address,
      (await getNow()) + 360,
      { value: parseUnits("1000") }
    );
    await tx2.wait();
  };

  const clearUSDCBalance = async (account) => {
    const balance = await USDCTokenContract.balanceOf(account.address);
    const w = ethers.Wallet.createRandom();
    const tx = await USDCTokenContract.connect(account).transfer(w.address, balance);
    await tx.wait();
  };
 
  const swapZetaToUSDC = async (signer, zetaAmount) => {
    const path = [zetaMock.address, WETH, USDC_ADDR];
    const tx = await pancakeswapRouter
      .connect(signer)
      .swapExactTokensForTokens(zetaAmount, 0, path, signer.address, (await getNow()) + 360);

    await tx.wait();
  };

  const getNow = async () => {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  };
  
  beforeEach(async () => {
    [deployer, account1] = await ethers.getSigners();

    const router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    
    pancakeswapRouter = await ethers.getContractAt(
      "IPancakeRouter02",
      router
    );
    WETH = await pancakeswapRouter.WETH();

    USDCTokenContract = await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      USDC_ADDR
    );

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
    
    await clearUSDCBalance(deployer);
    await clearUSDCBalance(account1);
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

    it("Should revert if the destinationOutToken isn't provided", async () => {
      await expect(
        multiChainSwapA.swapTokensForTokensCrossChain(
          zetaMock.address,
          BigNumber.from(10),
          ethers.utils.solidityPack(["address"], [account1.address]),
          AddressZero,
          false,
          0,
          chainBId,
          MaxUint256
        )
      ).to.be.revertedWith("OutTokenInvariant");
    });

    it("Should not perform any trade if the input token is Zeta", async () => {
      await addZetaEthLiquidity();
      await swapZetaToUSDC(deployer, parseUnits("10"));

      expect(await zetaMock.balanceOf(account1.address)).to.be.eq(0);

      const ZETA_TO_TRANSFER = parseUnits("1");

      const tx1 = await zetaMock.approve(multiChainSwapA.address, ZETA_TO_TRANSFER);
      await tx1.wait();

      const tx3 = await USDCTokenContract.approve(multiChainSwapA.address, ZETA_USDC_PRICE);
      await tx3.wait();

      /* const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        zetaMock.address,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        zetaMock.address,
        false,
        0,
        chainBId,
        MaxUint256
      );

      const result = await tx2.wait(); */
    });

    it("Should trade the input token for Zeta", async () => {
      await addZetaEthLiquidity();
      await swapZetaToUSDC(deployer, parseUnits("10"));

      expect(await zetaMock.balanceOf(account1.address)).to.be.eq(0);

      const ZETA_TO_TRANSFER = parseUnits("1");

      const tx1 = await zetaMock.approve(multiChainSwapA.address, ZETA_TO_TRANSFER);
      await tx1.wait();

      const tx3 = await USDCTokenContract.approve(multiChainSwapA.address, ZETA_USDC_PRICE);
      await tx3.wait();

      /* const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        zetaMock.address,
        false,
        0,
        chainBId,
        MaxUint256
      ); */

      /* const result = await tx2.wait();
      const eventNames = parseUniswapLog(result.logs);
      expect(eventNames.filter((e) => e === "Swap")).to.have.lengthOf(2); */
    });
  });
});
