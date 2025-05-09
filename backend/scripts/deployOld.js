const { ethers } = require("hardhat")
const fs = require("fs")
const path = require("path")

async function main() {
	const [deployer] = await ethers.getSigners()
	console.log("Deploying contracts with the account:", deployer.address)

	// Deploy Governance Token
	console.log("Deploying Governance Token...")
	const GovernanceToken = await ethers.getContractFactory("GovernanceToken")
	const governanceToken = await GovernanceToken.deploy(10) // Keep 10% of tokens
	await governanceToken.waitForDeployment()
	console.log("GovernanceToken deployed to:", governanceToken.target)

	// Deploy Timelock
	console.log("Deploying TimelockController...")
	const minDelay = 3600 // 1 hour, this is the minimum time that must pass between when a proposal is queued and when it can be executed
	const proposers = []
	const executors = []
	const admin = deployer.address

	const TimelockController = await ethers.getContractFactory("TimelockController")
	const timelock = await TimelockController.deploy(
		minDelay,
		proposers,
		executors,
		admin
	)
	await timelock.waitForDeployment()
	console.log("TimelockController deployed to:", timelock.target)

	// Deploy Governor
	console.log("Deploying Governor...")
	const MyGovernor = await ethers.getContractFactory("MyGovernor")
	const governor = await MyGovernor.deploy(
		governanceToken.target,
		timelock.target,
		25, // 1 block voting delay
		50, // 50 blocks voting period
		5 // 5% quorum
	)
	await governor.waitForDeployment()
	console.log("Governor deployed to:", governor.target)

	// Deploy Box
	console.log("Deploying Box...")
	const Box = await ethers.getContractFactory("Box")
	const box = await Box.deploy(timelock.target) // Timelock is the owner
	await box.waitForDeployment()
	console.log("Box deployed to:", box.target)

	// Setup roles
	console.log("Setting up roles...")
	const proposerRole = await timelock.PROPOSER_ROLE()
	const executorRole = await timelock.EXECUTOR_ROLE()
	const adminRole = await timelock.DEFAULT_ADMIN_ROLE()

	// Grant governor the proposer role
	console.log("Granting proposer role to Governor...")
	const proposerTx = await timelock.grantRole(proposerRole, governor.target)
	await proposerTx.wait()

	// Grant executor role to anyone
	console.log("Granting executor role to anyone...")
	const executorTx = await timelock.grantRole(executorRole, ethers.ZeroAddress)
	await executorTx.wait()

	// Revoke admin role from deployer
	console.log("Revoking admin role from deployer...")
	const revokeTx = await timelock.revokeRole(adminRole, deployer.address)
	await revokeTx.wait()

	console.log("DAO deployment completed!")
	console.log("----------------------------------------------------")
	console.log("Deployed Contracts:")
	console.log("- GovernanceToken:", governanceToken.target)
	console.log("- TimelockController:", timelock.target)
	console.log("- Governor:", governor.target)
	console.log("- Box:", box.target)

	// Load existing addresses.json or create a new one
	let addresses = {}
	const addressesPath = path.join(__dirname, "../addresses.json");
	if (fs.existsSync(addressesPath)) {
		addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"))
	}

	// Get the current network name
	const networkName = hre.network.name

	// Update or create the network-specific data
	addresses[networkName] = {
		governor: {
			address: governor.target,
			constructorArgs: [governanceToken.target, timelock.target],
		},
		box: {
			address: box.target,
			constructorArgs: [],
		},
		governanceToken: {
			address: governanceToken.target,
		},
		proposalId: addresses[networkName]?.proposalId, // Preserve existing proposalId if it exists
	}

	// Write the updated addresses.json to frontend/src
	const frontendAddressesPath = path.join(__dirname, "../../frontend/src/addresses.json")
	fs.writeFileSync(frontendAddressesPath, JSON.stringify(addresses, null, 2))

	console.log("Addresses written to frontend/src/addresses.json");

}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})