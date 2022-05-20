// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IPancakePair.sol";

interface IWBNB is IERC20 {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
}

contract ZapPancakeswapV2 {
    using SafeERC20 for IERC20;

    IPancakeRouter02 public immutable router;

    address public immutable wBNB;
    uint256 public constant MIN_AMOUNT = 1000;

    constructor(address _router, address _wBNB) {
        // Safety checks to ensure WBNB token address
        IWBNB(_wBNB).deposit{value: 0}();
        IWBNB(_wBNB).withdraw(0);

        router = IPancakeRouter02(_router);
        wBNB = _wBNB;
    }

    receive() external payable {
        assert(msg.sender == wBNB);
    }

    //--------------- private functions ----------------//

    function _removeLiquidity(address _pair, address _to) private {
        IERC20(_pair).safeTransfer(_pair, IERC20(_pair).balanceOf(address(this)));
        (uint256 amount0, uint256 amount1) = IPancakePair(_pair).burn(_to);

        require(amount0 >= MIN_AMOUNT, "PancakeswapV2Router: INSUFFICIENT_A_AMOUNT");
        require(amount1 >= MIN_AMOUNT, "PancakeswapV2Router: INSUFFICIENT_B_AMOUNT");
    }

    function _returnAssets(address[] memory tokens) private {
        uint256 balance;
        for (uint256 i; i < tokens.length; i++) {
            balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                if (tokens[i] == wBNB) {
                    IWBNB(wBNB).withdraw(balance);
                    (bool success,) = msg.sender.call{value: balance}(new bytes(0));
                    require(success, "BNB transfer failed");
                } else {
                    IERC20(tokens[i]).safeTransfer(msg.sender, balance);
                }
            }
        }
    }

    function _approveTokenIfNeeded(address _token, address _spender) private {
        if (IERC20(_token).allowance(address(this), _spender) == 0) {
            IERC20(_token).safeApprove(_spender, type(uint256).max);
        }
    }
}
