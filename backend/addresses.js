const addresses = {
  localhost: {
    governor: {
      address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
      constructorArgs: [
        "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
      ]
    },
    box: {
      address: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      constructorArgs: []
    },
    governanceToken: {
      address: "0x5FbDB2315678afecb367f032d93F642f64180aa3"
    },
    proposalId: {
      id: "112115418503741894548631205559819236479911196672021576501768627831266486142474"
    }
  },
  sepolia: {
    governor: {
      address: "0xDb205026Bd520c1F12aD3dEB98E964630563Dd5B",
      constructorArgs: [
        "0x44C493AEe3f2a76a67eb5Fb3c24035DAb4940189",
        "0x00DE143cC00490a2B1304dc011e8f912EBb1036C"
      ]
    },
    box: {
      address: "0x7ecd1F83375FE57ce8011Ad616a8843198804F5F",
      constructorArgs: []
    },
    governanceToken: {
      address: "0x00DE143cC00490a2B1304dc011e8f912EBb1036C"
    },
    proposalId: {
      id: "80090939037550615567396618929278916023758678559693765428266163124982260612328"
    }
  }
}

function updateProposalId(network, newId) {
  // Update in memory
  addresses[network].proposalId.id = newId.toString()

  // Write changes to file
  const filePath = require('path').join(__dirname, 'addresses.js')
  const addressesString = JSON.stringify(addresses, null, 2)
  .replace(/"([^"]+)":/g, '$1:') // Remove quotes from property names  
  
  const content = `const addresses = ${addressesString}

${updateProposalId.toString()}

module.exports = {
  addresses,
  updateProposalId
}`

  require('fs').writeFileSync(filePath, content)
}

module.exports = {
  addresses,
  updateProposalId
}