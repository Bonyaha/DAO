// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";


contract Box is Ownable {
    uint256 private value;
    event ValueChanged(uint256 newValue);

  constructor(address initialOwner) Ownable(initialOwner) {}

    function store(uint256 newValue) public onlyOwner {
        value = newValue;
        emit ValueChanged(newValue);
    }

    function retrieve() public view returns (uint256) {
				return value;
		}
}
