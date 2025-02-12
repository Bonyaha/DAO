require("@nomicfoundation/hardhat-toolbox")
require("hardhat-contract-sizer")
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      metadata: {
        bytecodeHash: "none",
      }
    }
  },
  contractSizer: {
    runOnCompile: true,  // Runs automatically when compiling
    only: ["MyGovernor"], // Specify contracts to measure (optional)
  }
};

