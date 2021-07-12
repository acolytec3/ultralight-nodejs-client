import yargs = require("yargs");

yargs
  .command(require("./ultralight"))
  .command(require("./init"))
  .help()
  .argv;
