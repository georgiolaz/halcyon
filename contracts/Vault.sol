// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./libraries/FixedPointMathLib.sol";
import "./interfaces/IWETH.sol";

contract Vault is ERC20, Ownable, ReentrancyGuard {
    using Address for address payable;
    using FixedPointMathLib for uint256;
    using SafeERC20 for IERC20;
    
    IERC20 public asset;

    event Deposit(address indexed _caller, address indexed _owner, uint256 _amount, uint256 _shares);
    event Withdraw(
        address indexed _caller,
        address indexed _receiver,
        uint256 _amount,
        uint256 _shares
    );

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        asset = _asset;
    }

    function depositETH() external payable returns (uint256) {
        uint256 amount = msg.value;
        IWETH(address(asset)).deposit{value: amount}();
        return deposit(amount, msg.sender);
    }

    function withdrawETH() external nonReentrant returns (uint256 withdrawn) {

    }

    function deposit(uint256 _amount, address _receiver) public virtual returns (uint256 shares) {
        // Check for rounding error since we round down in previewDeposit.
        require((shares = previewDeposit(_amount)) != 0, "ZERO_SHARES");

        // Need to transfer before minting or ERC777s could reenter.
        asset.safeTransferFrom(msg.sender, address(this), _amount);

        _mint(_receiver, shares);

        emit Deposit(msg.sender, _receiver, _amount, shares);

        afterDeposit(_amount, shares);
    }

    function withdraw(uint256 _amount, address _receiver) external nonReentrant returns (uint256 shares) {
        shares = previewWithdraw(_amount);

        beforeWithdraw(_amount, shares);
        
        _burn(msg.sender, shares);

        emit Withdraw(msg.sender, _receiver, _amount, shares);

        asset.safeTransfer(_receiver, _amount);
    }

    function previewDeposit(uint256 _amount) public view returns (uint256) {
        return convertToShares(_amount);
    }

    function previewWithdraw(uint256 _amount) public view virtual returns (uint256) {
        uint256 supply = totalSupply(); // Saves an extra SLOAD if totalSupply is non-zero.

        return supply == 0 ? _amount : _amount.mulDivUp(supply, totalAssets());
    }

    function totalAssets() public view returns (uint256) {
    }

    function convertToShares(uint256 assets) public view virtual returns (uint256) {
        uint256 supply = totalSupply(); // Saves an extra SLOAD if totalSupply is non-zero.

        return supply == 0 ? assets : assets.mulDivDown(supply, totalAssets());
    }

    function beforeWithdraw(uint256 _amount, uint256 _shares) internal {}

    function afterDeposit(uint256 _amount, uint256 _shares) internal {}
}
