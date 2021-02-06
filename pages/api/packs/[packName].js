export default (req, res) => {
	const {
		query: { packName },
	} = req;

	if (req.method !== "GET") {
		res.statusCode = 404;
		return;
	}

	res
		.writeHead(301, {
			Location: process.env.PACK_BASEURL + packName,
		})
		.end();
};
