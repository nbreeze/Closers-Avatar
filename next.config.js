const withImages = require("next-images");
const withTM = require("next-transpile-modules")(["three", "drei"]);

module.exports = withTM(withImages());
