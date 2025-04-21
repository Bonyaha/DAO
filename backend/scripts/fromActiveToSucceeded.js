const { ethers } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers
const {addresses} = require("../addresses")

async function main() {
	// Get network information
	const networkName = network.name
	const isLocalNetwork = ['localhost', 'hardhat'].includes(networkName)
	console.log(`Running on network: ${networkName}`)

	const config = addresses[network.name]
	//console.log(config)
	const GOVERNOR_ADDRESS = config.governor.address
	const BOX_ADDRESS = config.box.address
	const PROPOSAL_ID = config.proposalId.id
	const PROPOSAL_VALUE = config.proposalValue.value

	//console.log(`Using governor address: ${GOVERNOR_ADDRESS}`)	


	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const proposalId = PROPOSAL_ID
	const boxAddress = BOX_ADDRESS
	const value = PROPOSAL_VALUE || 77
	const description = `Proposal #${await governor.getNumberOfProposals()}: Store ${value} in Box`
	//const description = `test#3`


	if (!proposalId || !boxAddress) {
		throw new Error("Please set PROPOSAL_ID and BOX_ADDRESS environment variables")
	}

	const box = await ethers.getContractAt("Box", boxAddress)
	// Encode function call
	const encodedFunctionCall = box.interface.encodeFunctionData("store", [value])
	const descriptionHash = keccak256(toUtf8Bytes(description))

	// Check proposal state
	const state = await governor.state(proposalId)
	const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Expired', 'Executed']
	console.log(`Current proposal state: ${states[Number(state)]}`)

	const deadline = await governor.proposalDeadline(proposalId)
	const currentBlock = await ethers.provider.getBlockNumber()

	// For local networks, speed up time if needed
	if (isLocalNetwork && state == 1) { // 1 = Active
		if (currentBlock < deadline) {
			console.log(`Proposal is active. Fast-forwarding to end of voting period...`)
			const blocksToMine = Number(deadline) - currentBlock + 1
			console.log(`Mining ${blocksToMine} blocks to reach deadline...`)

			// Mine blocks to reach the deadline
			for (let i = 0; i < blocksToMine; i++) {
				await network.provider.send("evm_mine")
				if (i % 10 === 0 || i === blocksToMine - 1) {
					console.log(`Mined ${i + 1}/${blocksToMine} blocks...`)
				}
			}

			console.log(`Fast-forwarded to block ${await ethers.provider.getBlockNumber()}`)
			// Check state again after mining blocks
			const newState = await governor.state(proposalId)
			console.log(`New proposal state: ${states[Number(newState)]}`)

			if (newState != 4) { // If not Succeeded
				console.log(`Proposal did not succeed after voting period. Current state: ${states[Number(newState)]}`)
				return
			}
		}
	}

	
}

// Run main function if script is executed directly
	main()
		.then(() => process.exit(0))
		.catch((error) => {
			console.error(error)
			process.exit(1)
		})