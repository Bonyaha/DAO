function HeaderBanner() {
	return (
		<div className="bg-gradient-to-b from-teal-400 to-blue-500 rounded-lg p-6 text-white text-center">
			<p className="text-lg mb-4">
				Shape the future of our decentralized community. Join our DAO and have a say in our collective decision-making process. Participate in discussions, propose new ideas, and cast your vote on important issues.
			</p>
			<div className="flex justify-center space-x-4">
				<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
					JOIN DISCORD!
				</button>
				<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
					READ THE DOCS
				</button>
			</div>
		</div>
	)
}

export default HeaderBanner