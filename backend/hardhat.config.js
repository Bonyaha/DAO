require("@nomicfoundation/hardhat-toolbox")
require("hardhat-contract-sizer")
require("dotenv").config()
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
    hardhat: {
      mining: {
        auto: true,
        interval: 1000 // Mine new block every second
      }
    },
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL,
      accounts: [process.env.SEPOLIA_PRIVATE_KEY],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY
  },
  contractSizer: {
    runOnCompile: false,  // Runs automatically when compiling
    only: ["MyGovernor"], // Specify contracts to measure (optional)
  },
  paths: {
    artifacts: "../frontend/src/artifacts"
  },
  sourcify: {
    enabled: true
  }
};

