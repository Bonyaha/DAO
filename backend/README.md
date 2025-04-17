# DAO Project

This is a simplified DAO project.

Deployed Contracts:
- GovernanceToken: 0xfDc316600193DdfA09a906d592f5a45dD37e90aC
- TimelockController: 0x983C18ea2B6Cc139E2d1E1d93ba4892E0576C0D4
- Governor: 0xfaaFfd91071E1F97fc669c9aA815972F224d10bF
- Box: 0xaE3719980D24BCED036CB26744d7aC74e4D8D57b

### Addresses for Sepolia test network
Deployed Contracts:
- GovernanceToken: 
	* V3 - 0xfDc316600193DdfA09a906d592f5a45dD37e90aC
	*	V2 - 0x00DE143cC00490a2B1304dc011e8f912EBb1036C
	* V1 - 0x356E3d5ef3B36C34a5D93e8Ff0742D33cD6884D5
- TimelockController: 
	* V3 - 0x983C18ea2B6Cc139E2d1E1d93ba4892E0576C0D4
	* V2 - 0x44C493AEe3f2a76a67eb5Fb3c24035DAb4940189
	* V1 - 0xBFB3fbFe94fe417c62926Aa9dA56FF159af23e8d
- Governor: 
  * V3 - 0xfaaFfd91071E1F97fc669c9aA815972F224d10bF
	* V2 - 0xDb205026Bd520c1F12aD3dEB98E964630563Dd5B
	*	V1 - 0xA64fFB0e4CF1F49ea2dbCE4C871FF8d39481D9FC
- Box: 
	* V3 - 0xaE3719980D24BCED036CB26744d7aC74e4D8D57b
	* V2 - 0x7ecd1F83375FE57ce8011Ad616a8843198804F5F
	* V1 - 0x62525AF0351783c15fe79334dB33A4d0E32eDB4d


### Commands for verifying
`npx hardhat verify --network sepolia <TOKEN_ADDRESS> <_keepPercentage>` - GovernanceToken

`npx hardhat verify --network sepolia --constructor-args arguments.js 0xBFB3fbFe94fe417c62926Aa9dA56FF159af23e8d` - TimelockController

`npx hardhat verify --network sepolia <GOVERNOR_ADDRESS> <TOKEN_ADDRESS> <TIMELOCK_ADDRESS> <VOTING_DELAY> <VOTING_PERIOD> <QUORUM_PERCENTAGE>` - Governor

`npx hardhat verify --network sepolia <BOX_ADDRESS> <TIMELOCK_ADDRESS>` - Box

### Command for running scripts
`GOVERNOR_ADDRESS="<GOVERNOR_ADDRESS>" BOX_ADDRESS="<BOX_ADDRESS>" GOVERNANCE_TOKEN_ADDRESS="<TOKEN_ADDRESS>" npx hardhat run scripts/proposal.js --network sepolia`

/*(for running locally)*/
- `npx hardhat node` (in separate window)
- `npx hardhat run scripts/<name_of_file> --network localhost`
- `npx hardhat run scripts/checkProposalState.js --network localhost` - useful for checking state and other details of a proposal (it can be used in Sepolia as well)

### Command for testing
- `npx hardhat test`
- `npx hardhat test --grep <name_of_file>` (for testing one specific test)

### Flow of scripts
- deploy.js
- proposal.js
- vote.js
- queueAndExecute.js


### Hardhat accounts:
Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (10000 ETH)
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

Account #3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906 (10000 ETH)
Private Key: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6

Account #4: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 (10000 ETH)
Private Key: 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a

Account #5: 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc (10000 ETH)
Private Key: 0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba