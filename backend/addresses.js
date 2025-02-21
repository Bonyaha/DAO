const fs = require('fs')
const path = require('path')

// Load addresses from JSON file
const filePath = path.join(__dirname, 'addresses.json')
const addresses = JSON.parse(fs.readFileSync(filePath, 'utf8'))

function updateProposalId(network, newId) {
  // Update in memory
  addresses[network].proposalId.id = newId.toString()

  // Write back to the JSON file
  fs.writeFileSync(filePath, JSON.stringify(addresses, null, 2))
}

module.exports = {
  addresses,
  updateProposalId
}