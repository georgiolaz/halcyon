// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ZetaInterfaces {
    struct SendInput {
        /// @dev Id of the chain receiving the message
        uint256 destinationChainId;
        /// @dev Expressed in bytes since it can be a non-evm address
        bytes destinationAddress;
        /// @dev The maximum amount of gas to pay for the transaction on the other chain.
        uint256 gasLimit;
        /// @dev An arbitrary message to send to the other contract.
        bytes message;
        /// @dev The amount of Zeta to send to the other chain, 0 in this case since our focus is on the message.
        uint256 zetaAmount;
        /// @dev Parameters for the Zeta engine.
        bytes zetaParams;
    }

    struct ZetaMessage {
        bytes originSenderAddress;
        uint256 originChainId;
        address destinationAddress;
        uint256 zetaAmount;
        bytes message;
    }

    struct ZetaRevert {
        address originSenderAddress;
        uint256 originChainId;
        bytes destinationAddress;
        uint256 destinationChainId;
        uint256 zetaAmount;
        bytes message;
    }
}
