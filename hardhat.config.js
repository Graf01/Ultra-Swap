require("@nomiclabs/hardhat-truffle5");

module.exports = {

  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 999999,
      },
    },
  },

  networks: {
    hardhat: {
      mining: {
        auto: true,
        interval: 0,
        mempool: {
          order: "fifo"
        }
      }
    }
  }
};
