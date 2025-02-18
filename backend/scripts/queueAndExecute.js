const { ethers } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers


async function main() {

	// Determine if we're on a local network
	const isLocalNetwork = ['localhost', 'hardhat'].includes(network.name)
	console.log(`Running on network: ${network.name} (local: ${isLocalNetwork})`);

	// Get contract addresses - either from command line args or predefined values
	let GOVERNOR_ADDRESS, BOX_ADDRESS, PROPOSAL_ID

	if (process.argv.length >= 5 && !isLocalNetwork) {
		// Get addresses from command line args when on non-local networks
		[, , GOVERNOR_ADDRESS, BOX_ADDRESS, GOVERNANCE_TOKEN_ADDRESS] = process.argv
		console.log("Using provided contract addresses")
	} else {
		// Default addresses for local development
		GOVERNOR_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
		BOX_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
		PROPOSAL_ID = "5230289835011103672823903198228406806565753183275807746014809080855812650699"
		console.log("Using default local contract addresses")
	}

	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const proposalId = PROPOSAL_ID
	const boxAddress = BOX_ADDRESS
	const value = process.env.PROPOSAL_VALUE || 42
	const description = `Proposal #1: Store 42 in Box`
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
	const currentBlock = await ethers.provider.getBlockNumber();

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




	// Re-check state after possible fast-forwarding
	const updatedState = await governor.state(proposalId);

	// If proposal is in Queued state
	if (updatedState == 5) { // 5 = Queued
		try {
			// Get the earliest execution time
			const proposalEta = await governor.proposalEta(proposalId)
			const latestBlock = await ethers.provider.getBlock('latest')
			const currentTimestamp = BigInt(latestBlock.timestamp)

			console.log(`Proposal ETA: ${new Date(Number(proposalEta) * 1000).toLocaleString()}`)
			console.log(`Current time: ${new Date(Number(currentTimestamp) * 1000).toLocaleString()}`)

			if (currentTimestamp < proposalEta) {
				const waitTime = Number(proposalEta - currentTimestamp)
				console.log(`Proposal is in timelock. Need to wait ${waitTime} more seconds before execution.`)
				if (isLocalNetwork) {
					console.log(`Fast-forwarding time by ${waitTime} seconds...`)
					await network.provider.send("evm_increaseTime", [waitTime])
					await network.provider.send("evm_mine")
					console.log(`Time fast-forwarded`)
				} else {
					console.log(`That's approximately ${Math.ceil(waitTime / 60)} minutes or ${Math.ceil(waitTime / 3600)} hours.`)
					console.log(`Please run this script again at or after: ${new Date(Number(proposalEta) * 1000).toLocaleString()}`)
					return
				}
				
			}

			// If we're past the timelock period, execute
			console.log("Timelock period has passed. Executing proposal...")
			const executeTx = await governor.execute(
				[boxAddress],
				[0],
				[encodedFunctionCall],
				descriptionHash
			)
			console.log(`Execute transaction submitted: ${executeTx.hash}`)
			await executeTx.wait()
			console.log("Proposal executed successfully!")

			// Verify the change
			const newValue = await box.retrieve()
			console.log(`New value in Box: ${newValue}`)
		} catch (error) {
			if (error.message.includes("TimelockController: operation is not ready")) {
				console.log("Proposal cannot be executed yet because the timelock period hasn't passed.")

				// Try to get the proposal eta
				try {
					const proposalEta = await governor.proposalEta(proposalId)
					const latestBlock = await ethers.provider.getBlock('latest')
					const currentTimestamp = BigInt(latestBlock.timestamp)
					const waitTime = Number(proposalEta - currentTimestamp)

					console.log(`Proposal ETA: ${new Date(Number(proposalEta) * 1000).toLocaleString()}`)
					console.log(`Current time: ${new Date(Number(currentTimestamp) * 1000).toLocaleString()}`)
					console.log(`Need to wait ${waitTime} more seconds (about ${Math.ceil(waitTime / 60)} minutes).`)
				} catch (etaError) {
					console.log("Could not determine execution time.")
				}
			} else {
				console.error("Error executing proposal:", error.message)
			}
		}
	} else if (updatedState == 4) { // 4 = Succeeded
		console.log("Proposal has succeeded but not yet queued. Queueing it now...")
		try {
			const queueTx = await governor.queue(
				[boxAddress],
				[0],
				[encodedFunctionCall],
				descriptionHash
			)
			console.log(`Queue transaction submitted: ${queueTx.hash}`)
			await queueTx.wait()
			console.log("Proposal queued successfully!")
			console.log("Note: You'll need to wait for the timelock period before executing.")
			console.log("Run this script again to check when execution is possible.")
		} catch (error) {
			console.error("Error queueing proposal:", error.message)
		}
	} else if (updatedState == 1) { // 1 = Active
		console.log(`Proposal is still in Active state. Voting period has not ended.`)
		console.log(`Waiting for block ${deadline} to be reached (current: ${currentBlock}).`)

		if (!isLocalNetwork) {
			console.log(`Estimated time remaining: ${(Number(deadline) - currentBlock) * 12} seconds`)
			console.log(`Please run this script again after block ${deadline} is reached.`)
		}
	}

else if (updatedState == 7) { // 7 = Executed
		console.log("Proposal has already been executed!")
		// Verify the change
		const newValue = await box.retrieve()
		console.log(`Current value in Box: ${newValue}`)
	} else {
		console.log(`Cannot proceed with proposal in state: ${states[Number(state)]}`)
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})