const d3dx = require("../../modules/d3dx");
const fs = require("fs");

let result;

result = new d3dx.TextFormatParser().parse(fs.readFileSync("./scripts/tests/d3dx/text.x"));
console.log(result);

result = new d3dx.BinaryFormatParser().parse(fs.readFileSync("./scripts/tests/d3dx/bin1.x"));
console.log(result);

result = new d3dx.BinaryFormatParser().parse(fs.readFileSync("./scripts/tests/d3dx/bin2.x"));
console.log(result);

fs.writeFileSync(`./scripts/artifacts/bin2.x.json`, JSON.stringify(result, null, 2));
