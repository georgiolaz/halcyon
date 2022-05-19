// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./ZetaInterfaces.sol";

interface ZetaMPI {
    /**
     * @dev Sends a message to a contract on a different chain.
     * The flow goes like this:
     * HelloWorld contract (origin chain)
     * -> ZetaMPI contract (origin chain)
     * -> Zeta VM
     * -> ZetaMPI contract (destination chain)
     * -> HelloWorld contract (destination chain)
     */
    function send(ZetaInterfaces.SendInput calldata input) external;
}
