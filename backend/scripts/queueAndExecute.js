const { ethers } = require("hardhat")
const { keccak256, toUtf8Bytes } = ethers

const GOVERNOR_ADDRESS = "0xA64fFB0e4CF1F49ea2dbCE4C871FF8d39481D9FC"
const BOX_ADDRESS = "0x62525AF0351783c15fe79334dB33A4d0E32eDB4d"
const PROPOSAL_ID = "13333668535660679219098534105939188806920359908433547209339039615474533999535"

async function main() {
	const governor = await ethers.getContractAt("MyGovernor", GOVERNOR_ADDRESS)
	const proposalId = PROPOSAL_ID
	const boxAddress = BOX_ADDRESS
	const value = process.env.PROPOSAL_VALUE || 42
	const description = `Proposal #3: Store 42 in Box`
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

	// If proposal is in Queued state
	if (state == 5) { // 5 = Queued
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
				console.log(`That's approximately ${Math.ceil(waitTime / 60)} minutes or ${Math.ceil(waitTime / 3600)} hours.`)
				console.log(`Please run this script again at or after: ${new Date(Number(proposalEta) * 1000).toLocaleString()}`)
				return
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
	} else if (state == 4) { // 4 = Succeeded
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
	} else if (state == 7) { // 7 = Executed
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