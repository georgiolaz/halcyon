// SPDX-License-Identifier: MIT
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
        require(!availableChainIds[_destinationChainId], "destChainId already enabled");

        availableChainIds[_destinationChainId] = true;
    }

    function removeAvailableChainId(uint256 _destinationChainId) external onlyOwner {
        require(availableChainIds[_destinationChainId], "destChainId not available");

        delete availableChainIds[_destinationChainId];
    }

    function send(
        uint256 destinationChainId,
        bytes calldata destinationAddress,
        uint256 zetaAmount
    ) external {
        require(availableChainIds[destinationChainId], "destinationChainId not available");
        require(zetaAmount != 0, "zetaAmount should be greater than 0");

        bool success1 = ERC20(zetaToken).increaseAllowance(zetaMpi, zetaAmount);
        bool success2 = ERC20(zetaToken).transferFrom(msg.sender, address(this), zetaAmount);
        require((success1 && success2) == true, "error transferring Zeta");

        _zeta.send(
            ZetaInterfaces.SendInput({
                destinationChainId: destinationChainId,
                destinationAddress: destinationAddress,
                gasLimit: 2500000,
                message: abi.encode(),
                zetaAmount: zetaAmount,
                zetaParams: abi.encode("")
            })
        );
    }
}
