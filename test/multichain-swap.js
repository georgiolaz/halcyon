const { expect } = require("chai");
const { ethers } = require("hardhat");
const { AddressZero, MaxUint256 } = require("@ethersproject/constants");
const { parseUnits } = require("@ethersproject/units");
const { BigNumber } = require("@ethersproject/bignumber");

const HARDHAT_CHAIN_ID = 1337;

describe("MultiChainSwap Test Suite", function () {
  let multiChainSwapA, multiChainSwapB, zetaMock, pancakeswapRouter, USDCTokenContract;
  let zetaConnector;
  let deployer, account1;
  let WETH;

  const chainAId = 1;
  const chainBId = 2;
  const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  const ZETA_USDC_PRICE = BigNumber.from("1455462180");

  const encoder = new ethers.utils.AbiCoder();

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
    zetaConnector = await ZetaConnector.deploy(zetaMock.address);
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

      const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        zetaMock.address,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        zetaMock.address,
        false,
        0,
        chainBId,
        MaxUint256
      );

      const result = await tx2.wait();
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

      const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        zetaMock.address,
        false,
        0,
        chainBId,
        MaxUint256
      );

      /* const result = await tx2.wait();
      const eventNames = parseUniswapLog(result.logs);
      expect(eventNames.filter((e) => e === "Swap")).to.have.lengthOf(2); */
    });

    it("Should trade zeta for the output token", async () => {
      await addZetaEthLiquidity();
      await swapZetaToUSDC(deployer, parseUnits("10"));

      expect(await zetaMock.balanceOf(account1.address)).to.be.eq(0);

      const ZETA_TO_TRANSFER = parseUnits("1");

      const tx1 = await zetaMock.approve(multiChainSwapA.address, ZETA_TO_TRANSFER);
      await tx1.wait();

      const tx3 = await USDCTokenContract.approve(multiChainSwapA.address, ZETA_USDC_PRICE);
      await tx3.wait();

      const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        zetaMock.address,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId,
        MaxUint256
      );

      const result = await tx2.wait();
      /* const eventNames = parseUniswapLog(result.logs);
      expect(eventNames.filter((e) => e === "Swap")).to.have.lengthOf(2); */
    });

    it("Should trade input token for zeta and zeta for the output token", async () => {
      await addZetaEthLiquidity();
      await swapZetaToUSDC(deployer, parseUnits("10"));

      expect(await zetaMock.balanceOf(account1.address)).to.be.eq(0);

      const ZETA_TO_TRANSFER = parseUnits("1");

      const tx1 = await zetaMock.approve(multiChainSwapA.address, ZETA_TO_TRANSFER);
      await tx1.wait();

      const tx3 = await USDCTokenContract.approve(multiChainSwapA.address, ZETA_USDC_PRICE);
      await tx3.wait();

      const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId,
        MaxUint256
      );

      const result = await tx2.wait();
      /* const eventNames = parseUniswapLog(result.logs);
      expect(eventNames.filter((e) => e === "Swap")).to.have.lengthOf(4); */
    });

    it("Should emit a SentTokenSwap event", async () => {
      await addZetaEthLiquidity();
      await swapZetaToUSDC(deployer, parseUnits("10"));

      const senderInitialZetaBalance = await zetaMock.balanceOf(deployer.address);
      expect(await zetaMock.balanceOf(account1.address)).to.be.eq(0);

      const ZETA_TO_TRANSFER = parseUnits("1");

      const tx1 = await zetaMock.approve(multiChainSwapA.address, ZETA_TO_TRANSFER);
      await tx1.wait();

      const tx3 = await USDCTokenContract.approve(multiChainSwapA.address, ZETA_USDC_PRICE);
      await tx3.wait();

      const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId,
        MaxUint256
      );

      const result = await tx2.wait();
      /* const eventNames = parseZetaLog(result.logs);

      expect(eventNames.filter((e) => e === "Swapped")).to.have.lengthOf(1); */
    });

    it("Should revert if the destinationChainId is not in the storage", async () => {
      const call = multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId + 5,
        MaxUint256
      );

      await expect(call).to.be.revertedWith("InvalidDestinationChainId");
    });

    it("Should revert if the originInputToken isn't provided", async () => {
      const call = multiChainSwapA.swapTokensForTokensCrossChain(
        AddressZero,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId,
        MaxUint256
      );

      await expect(call).to.be.revertedWith("MissingOriginInputTokenAddress");
    });

    it("Should revert if the destinationOutToken isn't provided", async () => {
      const call = multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        AddressZero,
        false,
        0,
        chainBId,
        MaxUint256
      );

      await expect(call).to.be.revertedWith("OutTokenInvariant");
    });

    it("Should emit a SentTokenSwap event", async () => {
      await addZetaEthLiquidity();
      await swapZetaToUSDC(deployer, parseUnits("10"));

      const senderInitialZetaBalance = await zetaMock.balanceOf(deployer.address);
      expect(await zetaMock.balanceOf(account1.address)).to.be.eq(0);

      const ZETA_TO_TRANSFER = parseUnits("1");

      const tx1 = await zetaMock.approve(multiChainSwapA.address, ZETA_TO_TRANSFER);
      await tx1.wait();

      const tx3 = await USDCTokenContract.approve(multiChainSwapA.address, ZETA_USDC_PRICE);
      await tx3.wait();

      const tx2 = await multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId,
        MaxUint256
      );

      const result = await tx2.wait();
      /* const eventNames = parseZetaLog(result.logs);

      expect(eventNames.filter((e) => e === "Swapped")).to.have.lengthOf(1); */
    });

    it("Should revert if the destinationChainId is not in the storage", async () => {
      const call = multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId + 5,
        MaxUint256
      );

      await expect(call).to.be.revertedWith("InvalidDestinationChainId");
    });

    it("Should revert if the originInputToken isn't provided", async () => {
      const call = multiChainSwapA.swapTokensForTokensCrossChain(
        AddressZero,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        USDC_ADDR,
        false,
        0,
        chainBId,
        MaxUint256
      );

      await expect(call).to.be.revertedWith("MissingOriginInputTokenAddress");
    });

    it("Should revert if the destinationOutToken isn't provided", async () => {
      const call = multiChainSwapA.swapTokensForTokensCrossChain(
        USDC_ADDR,
        ZETA_USDC_PRICE,
        ethers.utils.solidityPack(["address"], [account1.address]),
        AddressZero,
        false,
        0,
        chainBId,
        MaxUint256
      );

      await expect(call).to.be.revertedWith("OutTokenInvariant");
    });
  });

  describe("onZetaMessage", () => {
    it("Should revert if the caller is not ZetaConnector", async () => {
      await expect(
        multiChainSwapA.onZetaMessage({
          originSenderAddress: ethers.utils.solidityPack(["address"], [multiChainSwapA.address]),
          originChainId: chainBId,
          destinationAddress: multiChainSwapB.address,
          zetaAmount: 0,
          message: encoder.encode(["address"], [multiChainSwapA.address]),
        })
      ).to.be.revertedWith("InvalidCaller");
    });

    it("Should revert if the originSenderAddress it not in interactorsByChainId", async () => {
      await expect(
        zetaConnector.callOnZetaMessage(
          ethers.utils.solidityPack(["address"], [multiChainSwapB.address]),
          chainAId,
          multiChainSwapB.address,
          0,
          encoder.encode(["address"], [multiChainSwapB.address])
        )
      ).to.be.revertedWith("InvalidZetaMessageCall");
    });
  });

  /* describe("onZetaRevert", () => {
    it("Should revert if the caller is not ZetaConnector", async () => {
      await expect(
        multiChainSwapA.onZetaRevert({
          zetaTxSenderAddress: deployer.address,
          sourceChainId: chainAId,
          destinationAddress: ethers.utils.solidityPack(["address"], [multiChainSwapB.address]),
          destinationChainId: chainBId,
          zetaValueAndGas: 0,
          message: encoder.encode(["address"], [multiChainSwapA.address]),
        })
      ).to.be.revertedWith("InvalidCaller");
    });

    it("Should trade the returned Zeta back for the input zeta token", async () => {
      await addZetaEthLiquidity();
      await swapZetaToUSDC(deployer, parseUnits("10"));

      const tx1 = await zetaMock.transfer(multiChainSwapA.address, parseUnits("100"));
      await tx1.wait();

      const originAddressInitialZetaBalance = await zetaMock.balanceOf(deployer.address);

      const message = encoder.encode(
        ["bytes32", "address", "address", "uint256", "bytes", "address", "bool", "uint256", "bool"],
        [
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          deployer.address,
          zetaMock.address,
          0,
          "0xffffffff",
          multiChainSwapA.address,
          true,
          0,
          false,
        ]
      );

      const tx2 = await zetaConnector.callOnZetaRevert(
        multiChainSwapA.address,
        HARDHAT_CHAIN_ID,
        chainBId,
        encoder.encode(["address"], [multiChainSwapB.address]),
        10,
        0,
        message
      );

      await tx2.wait();

      const originAddressFinalZetaBalance = await zetaMock.balanceOf(deployer.address);
      expect(originAddressFinalZetaBalance).to.be.eq(originAddressInitialZetaBalance.add(10));
    });
  }); */
});
