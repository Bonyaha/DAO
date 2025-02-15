require("@nomicfoundation/hardhat-toolbox")
require("hardhat-contract-sizer")
require("dotenv").config();
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
  networks: {
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL,
      accounts: [process.env.SEPOLIA_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },
  contractSizer: {
    runOnCompile: true,  // Runs automatically when compiling
    only: ["MyGovernor"], // Specify contracts to measure (optional)
  }
};

