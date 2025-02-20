const { ethers } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers
const addresses = require("../addresses")

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

	//console.log(`Using governor address: ${GOVERNOR_ADDRESS}`)	

	
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

	// Re-check state after possible fast-forwarding
	const updatedState = await governor.state(proposalId)

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

			if (isLocalNetwork) {
				// On local network, immediately fast-forward and execute
				const proposalEta = await governor.proposalEta(proposalId)
				const latestBlock = await ethers.provider.getBlock("latest")
				const currentTimestamp = BigInt(latestBlock.timestamp)

				if (currentTimestamp < proposalEta) {
					const waitTime = Number(proposalEta - currentTimestamp) + 1 // Add 1 second buffer
					console.log(`Fast-forwarding time by ${waitTime} seconds to bypass timelock...`)
					await network.provider.send("evm_increaseTime", [waitTime])
					await network.provider.send("evm_mine")
					console.log(`Time fast-forwarded`)
				}

				console.log("Executing proposal...")
				const executeTx = await governor.execute(
					[boxAddress],
					[0],
					[encodedFunctionCall],
					descriptionHash
				)
				console.log(`Execute transaction submitted: ${executeTx.hash}`)
				await executeTx.wait()
				console.log("Proposal executed successfully!")

				const newValue = await box.retrieve()
				console.log(`New value in Box: ${newValue}`)
			}
			else {
				console.log("Note: You'll need to wait for the timelock period before executing.")
				console.log("Run this script again to check when execution is possible.")
			}


		} catch (error) {
			console.error("Error queueing proposal:", error.message)
		}
	}
	else if (updatedState == 1) { // 1 = Active
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