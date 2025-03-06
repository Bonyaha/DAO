const fs = require('fs')
const path = require('path')

// Load addresses from JSON file
const filePath = path.join(__dirname, 'addresses.json')
const addresses = JSON.parse(fs.readFileSync(filePath, 'utf8'))

function updateProposalId(network, newId,newValue) {
console.log(`newValue: ${newValue}`);

  // Update in memory
  addresses[network].proposalId.id = newId.toString()
  addresses[network].proposalValue.value = newValue.toString()


  // Write back to the JSON file
  fs.writeFileSync(filePath, JSON.stringify(addresses, null, 2))
}

module.exports = {
  addresses,
  updateProposalId
}