// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./interfaces/ZetaInterfaces.sol";
import "./interfaces/ZetaMPI.sol";

contract CrossChainSwap is Ownable {
    address public zetaMpi;
    address public zetaToken;
    ZetaMPI internal _zeta;

    mapping(uint256 => bool) public availableChainIds;

    constructor(address _zetaMpiInput, address _zetaTokenInput) {
        zetaMpi = _zetaMpiInput;
        zetaToken = _zetaTokenInput;
        _zeta = ZetaMPI(_zetaMpiInput);
    }

    function addAvailableChainId(uint256 _destinationChainId) external onlyOwner {
        require(!availableChainIds[_destinationChainId], "CrossChainSwap: destinationChainId already enabled");

        availableChainIds[_destinationChainId] = true;
    }

    function removeAvailableChainId(uint256 _destinationChainId) external onlyOwner {
        require(availableChainIds[_destinationChainId], "CrossChainSwap: destinationChainId not available");

        delete availableChainIds[_destinationChainId];
    }

    // todo: swap function
}
