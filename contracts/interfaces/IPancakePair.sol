// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IPancakePair {
    function factory() external view returns (address);
    
    function token0() external view returns (address);

    function token1() external view returns (address);

    function getReserves()
        external
        view
        returns (
            uint112 reserve0,
            uint112 reserve1,
            uint32 blockTimestampLast
        );
    
    function burn(address to) external returns (uint amount0, uint amount1);
}
