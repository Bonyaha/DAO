# DAO Project

This is a simplified DAO project.


### Addresses for sepolia test network
Deployed Contracts:
- GovernanceToken: 0x356E3d5ef3B36C34a5D93e8Ff0742D33cD6884D5
- TimelockController: 0xBFB3fbFe94fe417c62926Aa9dA56FF159af23e8d
- Governor: 0xA64fFB0e4CF1F49ea2dbCE4C871FF8d39481D9FC
- Box: 0x62525AF0351783c15fe79334dB33A4d0E32eDB4d

Deployed Contracts in local network:
- GovernanceToken: 0x5FbDB2315678afecb367f032d93F642f64180aa3
- TimelockController: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
- Governor: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
- Box: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

### Commands for verifying
`npx hardhat verify --network sepolia <TOKEN_ADDRESS> <_keepPercentage>` - GovernanceToken

`npx hardhat verify --network sepolia --constructor-args arguments.js 0xBFB3fbFe94fe417c62926Aa9dA56FF159af23e8d` - TimelockController

`npx hardhat verify --network sepolia <GOVERNOR_ADDRESS> <TOKEN_ADDRESS> <TIMELOCK_ADDRESS> <VOTING_DELAY> <VOTING_PERIOD> <QUORUM_PERCENTAGE>` - Governor

`npx hardhat verify --network sepolia <BOX_ADDRESS> <TIMELOCK_ADDRESS>` - Box

### Command for running scripts
npx hardhat run scripts/<name_of_file> --network sepolia

/*(for running locally)*/
- npx hardhat node (in separate window)
- npx hardhat run scripts/<name_of_file> --network localhost