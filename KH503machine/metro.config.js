const blacklist = require('metro-config/src/defaults/blacklist');

module.exports = {
  maxWorkers: 2,
  resolver: {
    useWatchman: false,
    blacklistRE: blacklist([/\/\.local-run\/.*/, /\/android\/.*\/build\/.*/]),
  },
};
