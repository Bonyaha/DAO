// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract GovernanceToken is ERC20, ERC20Permit, ERC20Votes {
    event TokenTransfer(
        address indexed from,
        address indexed to,
        uint256 amount
    );
    event TokenMinted(address indexed to, uint256 amount);
    event TokenBurned(address indexed from, uint256 amount);

    uint256 constant TOKENS_PER_USER = 1000;
    uint256 constant TOTAL_SUPPLY = 1000000e18;

    mapping(address => bool) public s_claimedTokens;
    address[] public s_holders;

    constructor(
        uint256 _keepPercentage
    ) ERC20("MyToken", "MTK") ERC20Permit("MyToken") {
        uint256 keepAmount = (TOTAL_SUPPLY * _keepPercentage) / 100;
        super._mint(msg.sender, TOTAL_SUPPLY);
        _transfer(msg.sender, address(this), TOTAL_SUPPLY - keepAmount);
        s_holders.push(msg.sender);
    }

    function claimTokens() external {
        require(!s_claimedTokens[msg.sender], "Already claimed tokens");
        s_claimedTokens[msg.sender] = true;
        _transfer(address(this), msg.sender, TOKENS_PER_USER * 10 ** 18);
        s_holders.push(msg.sender);
    }

    function getTokenHolders() external view returns (uint256) {
        return s_holders.length;
    }


    // The following functions are overrides required by Solidity.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
        if (from == address(0)) {
            // Mint operation
            emit TokenMinted(to, value);
        } else if (to == address(0)) {
            // Burn operation
            emit TokenBurned(from, value);
        } else {
            // Transfer operation
            emit TokenTransfer(from, to, value);
        }
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

}