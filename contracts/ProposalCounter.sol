// ProposalCounter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract ProposalCounter {
    uint256 public proposalCount;

    function incrementCount() public {
        proposalCount++;
    }

    function getCount() public view returns (uint256) {
        return proposalCount;
    }
}