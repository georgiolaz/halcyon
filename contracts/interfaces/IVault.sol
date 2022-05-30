// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault is IERC20 {
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _shares) external;
    // todo
    function want() external pure returns (address);
}
