

function ActionButtons() {
	return (
		<div className="bg-blue-500 p-4 mt-8 flex flex-wrap justify-center space-x-4 rounded-lg">
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				CURRENT VALUE
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				GET FUNDS
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				PROPOSE
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				VOTE
			</button>
			<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
				EXECUTE
			</button>
		</div>
	)
}

export default ActionButtons