const { ethers, network } = require("hardhat")
const { toUtf8Bytes, keccak256 } = ethers
const { addresses, updateProposalId } = require("../addresses")

/* async function updateAddressesFile(networkName, proposalId) {
	const addressesPath = path.join(__dirname, '..', 'addresses.js')

	// Read the current addresses file content
	let addressesContent = fs.readFileSync(addressesPath, 'utf8')
	console.log(`typeof addressesContent: ${typeof addressesContent}`)
	console.log(`addressesContent: ${addressesContent}`)

	// Create the new proposalId object
	const newProposalId = {
		id: proposalId.toString()
	}

	// Parse the existing content to get the current structure
	// Remove 'module.exports = ' and parse the remaining object
	const currentAddresses = eval('(' + addressesContent.replace('module.exports = ', '') + ')')
	console.log(`typeof currentAddresses: ${typeof currentAddresses}`)
	console.log(currentAddresses)
	// Update the proposalId for the specific network
	currentAddresses[networkName] = {
		...currentAddresses[networkName],
		proposalId: newProposalId
	}

	// Convert back to string format with proper formatting
	const updatedContent = 'module.exports = ' + JSON.stringify(currentAddresses, null, 2)
		.replace(/"([^"]+)":/g, '$1:') // Convert "key": to key:
		.replace(/"/g, '"')            // Replace straight quotes with curved quotes

	// Write back to the file
	fs.writeFileSync(addressesPath, updatedContent)
	console.log(`Updated addresses.js with new proposal ID for network ${networkName}`)
} */

async function main() {
	// Get network information
	const networkName = network.name
	const isLocalNetwork = ['localhost', 'hardhat'].includes(networkName)
	console.log(`Running on network: ${networkName}`)

	const config = addresses[networkName]
	//console.log(config)
	const GOVERNOR_ADDRESS = config.governor.address
	const BOX_ADDRESS = config.box.address
	const GOVERNANCE_TOKEN_ADDRESS = config.governanceToken.address

	console.log(`Using governor address: ${GOVERNOR_ADDRESS}`)
	console.log(`Using box address: ${BOX_ADDRESS}`)
	console.log(`Using governance token address: ${GOVERNANCE_TOKEN_ADDRESS}`)

	const [proposer] = await ethers.getSigners()
	console.log("Creating proposal with account:", proposer.address)

	// Get contract instances
	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const box = await ethers.getContractAt("Box", BOX_ADDRESS)
	const governanceToken = await ethers.getContractAt("GovernanceToken", GOVERNANCE_TOKEN_ADDRESS)

	// Ensure proposer has tokens and has delegated them
	console.log("Checking token balance and delegation...")
	const balance = await governanceToken.balanceOf(proposer.address)
	if (balance === 0n) {
		console.log("Claiming tokens...")
		const claimTx = await governanceToken.claimTokens()
		await claimTx.wait()
	}

	const votes = await governanceToken.getVotes(proposer.address)
	if (votes === 0n) {
		console.log("Delegating tokens...")
		const delegateTx = await governanceToken.delegate(proposer.address)
		await delegateTx.wait()

		// Wait for one block - use appropriate method based on network
		if (isLocalNetwork) {
			console.log("Mining block on local network...")
			await network.provider.send("evm_mine")
		} else {
			console.log("Waiting for next block on test/main network...")
			await ethers.provider.waitForBlock(await ethers.provider.getBlockNumber() + 1)
		}
	}

	// Get the total number of proposals
	const proposalCount = await governor.getNumberOfProposals()
	console.log(`Total number of proposals: ${proposalCount}`)

	// Create proposal
	console.log("Creating proposal...")
	//const newValue = 42 // The value we want to store in the Box contract
	const newValue = process.env.PROPOSAL_VALUE
console.log(`newValue: ${newValue}`);

	const encodedFunctionCall = box.interface.encodeFunctionData("store", [newValue])
	const descriptionString = `Proposal #${await governor.getNumberOfProposals() + 1n}: Store ${newValue} in Box`

	// Propose
	console.log("Proposing...")
	const proposeTx = await governor.propose(
		[box.target],         // target contract
		[0],                  // value in ETH
		[encodedFunctionCall], // encoded function call
		descriptionString      // description
	)

	const proposeReceipt = await proposeTx.wait()
	const newProposalId = proposeReceipt.logs[0].args[0]
	console.log("Proposal created with ID:", newProposalId.toString())

	updateProposalId(networkName, newProposalId,newValue)

	// Get proposal state and details
	const state = await governor.state(newProposalId)
	const snapshot = await governor.proposalSnapshot(newProposalId)
	const deadline = await governor.proposalDeadline(newProposalId)

	console.log("\nProposal Details:")
	console.log("- State:", getProposalState(state))
	console.log("- Snapshot Block:", snapshot.toString())
	console.log("- Deadline Block:", deadline.toString())
	console.log("- Description:", descriptionString)
	console.log("- Description Hash:", keccak256(toUtf8Bytes(descriptionString)))

	console.log("\nNext Steps:")
	console.log("1. Wait for the voting delay period")
	console.log("2. Cast votes using the proposalId")
	console.log("3. Wait for the voting period to end")
	console.log("4. Queue and execute the proposal if it passed")
}

function getProposalState(state) {
	const states = {
		0: "Pending",
		1: "Active",
		2: "Canceled",
		3: "Defeated",
		4: "Succeeded",
		5: "Queued",
		6: "Expired",
		7: "Executed"
	}
	return states[state] || "Unknown"
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})