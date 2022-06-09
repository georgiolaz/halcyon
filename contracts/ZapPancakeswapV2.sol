// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IPancakePair.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IVault.sol";

import "./libraries/FixedPointMathLib.sol";

contract ZapPancakeswapV2 {
    using SafeERC20 for IERC20;
    using SafeERC20 for IVault;

    IPancakeRouter02 public immutable router;

    address public immutable wBNB;
    uint256 public constant MIN_AMOUNT = 1000;

    constructor(address _router, address _wBNB) {
        // Safety checks to ensure WBNB token address
        IWETH(_wBNB).deposit{value: 0}();
        IWETH(_wBNB).withdraw(0);

        router = IPancakeRouter02(_router);
        wBNB = _wBNB;
    }

    receive() external payable {
        assert(msg.sender == wBNB);
    }

    function halcyonInETH (address _vault, uint256 _tokenAmountOutMin) external payable {

        IWETH(wBNB).deposit{value: msg.value}();

        _swapAndStake(_vault, _tokenAmountOutMin, wBNB);
    }

    function halcyonIn (address _vault, uint256 _tokenAmountOutMin, address _tokenIn, uint256 _tokenInAmount) external {
        // require(tokenInAmount >= minimumAmount, "Insignificant input amount");
        require(IERC20(_tokenIn).allowance(msg.sender, address(this)) >= _tokenInAmount, "Input token is not approved");

        IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), _tokenInAmount);

        _swapAndStake(_vault, _tokenAmountOutMin, _tokenIn);
    }

    function beefOut (address _vault, uint256 _withdrawAmount) external {
        (IVault vault, IPancakePair pair) = _getVaultPair(_vault);

        IERC20(_vault).safeTransferFrom(msg.sender, address(this), _withdrawAmount);
        vault.withdraw(_withdrawAmount);

        if (pair.token0() != wBNB && pair.token1() != wBNB) {
            return _removeLiquidity(address(pair), msg.sender);
        }

        _removeLiquidity(address(pair), address(this));

        address[] memory tokens = new address[](2);
        tokens[0] = pair.token0();
        tokens[1] = pair.token1();

        _returnAssets(tokens);
    }

    //--------------- private functions ----------------//

    function _swapAndStake(address _vault, uint256 _tokenAmountOutMin, address _tokenIn) private {
        (IVault vault, IPancakePair pair) = _getVaultPair(_vault);

        (uint256 reserveA, uint256 reserveB,) = pair.getReserves();
        // require(reserveA > minimumAmount && reserveB > minimumAmount, 'Liquidity pair reserves too low');

        bool isInputA = pair.token0() == _tokenIn;
        require(isInputA || pair.token1() == _tokenIn, "Input token not present in liquidity pair");

        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = isInputA ? pair.token1() : pair.token0();

        uint256 fullInvestment = IERC20(_tokenIn).balanceOf(address(this));
        uint256 swapAmountIn;
        if (isInputA) {
            swapAmountIn = _getSwapAmount(fullInvestment, reserveA, reserveB);
        } else {
            swapAmountIn = _getSwapAmount(fullInvestment, reserveB, reserveA);
        }

        _approveTokenIfNeeded(path[0], address(router));
        uint256[] memory swapedAmounts = router
            .swapExactTokensForTokens(swapAmountIn, _tokenAmountOutMin, path, address(this), block.timestamp);

        _approveTokenIfNeeded(path[1], address(router));
        (,, uint256 amountLiquidity) = router
            .addLiquidity(path[0], path[1], fullInvestment - (swapedAmounts[0]), swapedAmounts[1], 1, 1, address(this), block.timestamp);

        _approveTokenIfNeeded(address(pair), address(vault));
        vault.deposit(amountLiquidity);

        vault.safeTransfer(msg.sender, vault.balanceOf(address(this)));
        _returnAssets(path);
    }

    function _removeLiquidity(address _pair, address _to) private {
        IERC20(_pair).safeTransfer(_pair, IERC20(_pair).balanceOf(address(this)));
        (uint256 amount0, uint256 amount1) = IPancakePair(_pair).burn(_to);

        require(amount0 >= MIN_AMOUNT, "PancakeswapV2Router: INSUFFICIENT_A_AMOUNT");
        require(amount1 >= MIN_AMOUNT, "PancakeswapV2Router: INSUFFICIENT_B_AMOUNT");
    }

    function _getVaultPair (address _vault) private view returns (IVault vault, IPancakePair pair) {
        vault = IVault(_vault);
        // todo
        pair = IPancakePair(vault.want());

        require(pair.factory() == router.factory(), "Incompatible liquidity pair factory");
    }

    function _returnAssets(address[] memory tokens) private {
        uint256 balance;
        for (uint256 i; i < tokens.length; i++) {
            balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                if (tokens[i] == wBNB) {
                    IWETH(wBNB).withdraw(balance);
                    (bool success,) = msg.sender.call{value: balance}(new bytes(0));
                    require(success, "BNB transfer failed");
                } else {
                    IERC20(tokens[i]).safeTransfer(msg.sender, balance);
                }
            }
        }
    }

    function _getSwapAmount(uint256 investmentA, uint256 reserveA, uint256 reserveB) private view returns (uint256 swapAmount) {
        uint256 halfInvestment = investmentA / 2;
        uint256 nominator = router.getAmountOut(halfInvestment, reserveA, reserveB);
        uint256 denominator = router.quote(halfInvestment, reserveA + halfInvestment, reserveB - nominator);
        swapAmount = investmentA - (FixedPointMathLib.sqrt(halfInvestment * halfInvestment * nominator / denominator));
    }

    function _approveTokenIfNeeded(address _token, address _spender) private {
        if (IERC20(_token).allowance(address(this), _spender) == 0) {
            IERC20(_token).safeApprove(_spender, type(uint256).max);
        }
    }
}
