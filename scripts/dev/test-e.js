const fs = require("fs");
const entries = fs.readdirSync("E:" + "\\", { withFileTypes: true });
console.log("OK:", entries.length, "entries");
