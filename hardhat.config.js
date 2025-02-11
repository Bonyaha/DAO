require("@nomicfoundation/hardhat-toolbox")
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.22",
  settings: {
    optimizer: {
      enabled: true,
      runs: 1,
    },
    viaIR: true,   
    metadata: {
      bytecodeHash: "none",
    },    
    debug: {
      revertStrings: "strip"
    }
  },
};
