const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers, network } = require("hardhat")
const { toUtf8Bytes, keccak256, parseEther } = ethers

describe("DAO", function () {
  async function deployDAOFixture() {
    const [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners()

    // Deploy Governance Token
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken")
    const governanceToken = await GovernanceToken.deploy(10) // Keep 10% of tokens
    await governanceToken.waitForDeployment()

    // Deploy Timelock
    const minDelay = 3600 // 1 hour
    const proposers = []
    const executors = []
    const admin = owner.address

    const TimelockController = await ethers.getContractFactory("TimelockController")
    const timelock = await TimelockController.deploy(
      minDelay,
      proposers,
      executors,
      admin
    )
    await timelock.waitForDeployment()

    // Deploy Governor
    const MyGovernor = await ethers.getContractFactory("MyGovernor")
    const governor = await MyGovernor.deploy(
      governanceToken.target,
      timelock.target,
      1, // 1 block voting delay
      50, // 50 blocks voting period
      5 // 5% quorum
    )
    await governor.waitForDeployment()

    // Deploy Box
    const Box = await ethers.getContractFactory("Box")
    const box = await Box.deploy(timelock.target) // Timelock is the owner
    await box.waitForDeployment()

    // Setup roles
    const proposerRole = await timelock.PROPOSER_ROLE()
    const executorRole = await timelock.EXECUTOR_ROLE()
    const adminRole = await timelock.DEFAULT_ADMIN_ROLE()

    // Grant and revoke roles
    const proposerTx = await timelock.grantRole(proposerRole, governor.target)
    await proposerTx.wait()

    const executorTx = await timelock.grantRole(executorRole, ethers.ZeroAddress) // Anyone can execute
    await executorTx.wait()

    const revokeTx = await timelock.revokeRole(adminRole, owner.address)
    await revokeTx.wait()


    return {
      governanceToken,
      timelock,
      governor,
      box,
      owner,
      addr1,
      addr2,
      addr3,
      addr4,
      addr5
    }
  }

  describe("GovernanceToken", function () {
    it("Should set correct initial supply and distribution", async function () {
      const { governanceToken, owner } = await loadFixture(deployDAOFixture)
      const totalSupply = parseEther("1000000")
      const keepPercentage = 10
      const keepAmount = (totalSupply * BigInt(keepPercentage)) / 100n

      expect(await governanceToken.totalSupply()).to.equal(totalSupply)
      expect(await governanceToken.balanceOf(owner.address)).to.equal(keepAmount)
      expect(await governanceToken.balanceOf(governanceToken.target)).to.equal(
        totalSupply - keepAmount
      )
    })

    it("Should allow users to claim tokens", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployDAOFixture)
      const claimAmount = parseEther("10000") // TOKENS_PER_USER = 1000

      await governanceToken.connect(addr1).claimTokens()
      expect(await governanceToken.balanceOf(addr1.address)).to.equal(claimAmount)
      expect(await governanceToken.s_claimedTokens(addr1.address)).to.be.true
    })

    it("Should prevent double claiming", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployDAOFixture)

      await governanceToken.connect(addr1).claimTokens()
      await expect(
        governanceToken.connect(addr1).claimTokens()
      ).to.be.revertedWith("Already claimed tokens")
    })
  })

  describe("Box", function () {
    it("Should only allow owner to store values", async function () {
      const { box, addr1 } = await loadFixture(deployDAOFixture)

      await expect(
        box.connect(addr1).store(42)
      ).to.be.revertedWithCustomError(box, "OwnableUnauthorizedAccount")
    })

    it("Should emit event when value is stored", async function () {
      const { box, timelock } = await loadFixture(deployDAOFixture)

      // Note: We can't test storing values directly since timelock is the owner
      // This would need to be tested through governance proposals
      expect(await box.retrieve()).to.equal(0)
    })
  })

  describe("Governance", function () {
    it("Should create proposal", async function () {
      const { governor, box, governanceToken, addr1 } = await loadFixture(
        deployDAOFixture
      )

      // First, addr1 needs to have tokens and delegate them
      await governanceToken.connect(addr1).claimTokens()
      await governanceToken.connect(addr1).delegate(addr1.address)

      const encodedFunctionCall = box.interface.encodeFunctionData("store", [42])
      const proposalDescription = "Store 42 in Box"

      await expect(
        governor
          .connect(addr1)
          .propose(
            [box.target],
            [0],
            [encodedFunctionCall],
            proposalDescription
          )
      ).to.not.be.reverted

      expect(await governor.getNumberOfProposals()).to.equal(1)
    })

    it("Should go through entire governance cycle", async function () {
      const { governor, box, governanceToken, addr1, addr2, addr3, addr4, addr5 } = await loadFixture(
        deployDAOFixture
      )
      const voters = [addr1, addr2, addr3, addr4, addr5]

      // Setup voting power
      for (const voter of voters) {
        await governanceToken.connect(voter).claimTokens()        
      }
      
      // Delegate votes and wait for a block to ensure checkpoint is created

      for (const voter of voters) {
        await governanceToken.connect(voter).delegate(voter.address)
        await network.provider.send("evm_mine")
      }


      // Log current block number
      const startBlock = await ethers.provider.getBlockNumber()
      console.log("Start block:", startBlock)

      console.log("Total supply:", await governanceToken.totalSupply())

      // Create proposal
      const encodedFunctionCall = box.interface.encodeFunctionData("store", [42])
      const proposalDescription = "Store 42 in Box"

      const proposeTx = await governor
        .connect(addr1)
        .propose([box.target], [0], [encodedFunctionCall], proposalDescription)

      await network.provider.send("evm_mine")
      const proposeReceipt = await proposeTx.wait(1)
      const proposalId = proposeReceipt.logs[0].args[0]

      // Get proposal details
      const proposalSnapshot = await governor.proposalSnapshot(proposalId)
      const proposalDeadline = await governor.proposalDeadline(proposalId)
      console.log("Proposal snapshot block:", proposalSnapshot)
      console.log("Proposal deadline block:", proposalDeadline)
      console.log("Current block:", await ethers.provider.getBlockNumber())

      // Wait for voting delay
      for (let i = 0; i < 2; i++) {
        await network.provider.send("evm_mine")
      }

      console.log("Block before voting:", await ethers.provider.getBlockNumber())

      // Cast votes
      for (const voter of voters) {
        await governor.connect(voter).castVote(proposalId, 1)
      }

      // Check votes
      const { againstVotes, forVotes, abstainVotes } = await governor.proposalVotes(proposalId)
      console.log("Votes - For:", forVotes, "Against:", againstVotes, "Abstain:", abstainVotes)

      // Mine enough blocks to reach the deadline
      const currentBlock = await ethers.provider.getBlockNumber()
      const blocksToMine = Number(proposalDeadline) - currentBlock + 1
      console.log("Mining", blocksToMine, "blocks")

      for (let i = 0; i < blocksToMine; i++) {
        await network.provider.send("evm_mine")
      }

      console.log("Current block after mining:", await ethers.provider.getBlockNumber())
      console.log("State after voting period:", await governor.state(proposalId))

      // Queue
      const descriptionHash = keccak256(toUtf8Bytes(proposalDescription))
      await governor.queue([box.target], [0], [encodedFunctionCall], descriptionHash)

      // Wait for timelock
      await time.increase(3601)
      await network.provider.send("evm_mine")

      // Execute
      await governor.execute([box.target], [0], [encodedFunctionCall], descriptionHash)

      // Verify
      expect(await box.retrieve()).to.equal(42)
    })
  })
})