require("@nomiclabs/hardhat-truffle5");
require("@nomiclabs/hardhat-ethers")
require('hardhat-docgen')
require('hardhat-deploy')
require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-web3")
require("@nomiclabs/hardhat-etherscan")
require("solidity-coverage")
require("hardhat-gas-reporter")
require('dotenv').config()


const kovanURL = `https://eth-kovan.alchemyapi.io/v2/${process.env.ALCHEMY_KOVAN}`
const goerliURL = `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_GOERLI}`
const rinkebyURL = `https://eth-rinkeby.alchemyapi.io/v2/${process.env.ALCHEMY_RINKEBY}`
const mainnetURL = `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_MAINNET}`
const fantomTestnetURL = "https://rpcapi-tracing.testnet.fantom.network" //"https://rpc.testnet.fantom.network/";

module.exports = {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      saveDeployments: true,
      forking: {
        url: fantomTestnetURL
      }
    },
    kovan: {
      url: kovanURL,
      chainId: 42,
      gas: 12000000,
      accounts: {mnemonic: process.env.MNEMONIC},
      saveDeployments: true,
      skipIfAlreadyDeployed: true
    },
    fantom: {
      url: "https://rpc.ftm.tools/",
      chainId: 250,
      accounts: {mnemonic: process.env.MNEMONIC},
      saveDeployments: true,
      skipIfAlreadyDeployed: true
    },
    fantom_testnet: {
      url: fantomTestnetURL,
      chainId: 0xfa2,
      accounts: {mnemonic: process.env.MNEMONIC},
      saveDeployments: true,
      skipIfAlreadyDeployed: true,
      // verify: {
      //   etherscan: {
      //     apiKey: process.env.FTMSCAN_TESTNET_API_KEY
      //   }
      // },
    
    },
    goerli: {
      url: goerliURL,
      chainId: 5,
      gasPrice: 1000,
      accounts: {mnemonic: process.env.MNEMONIC},
      saveDeployments: true
    },
    rinkeby: {
      url: rinkebyURL,
      chainId: 4,
      gasPrice: "auto",
      accounts: {mnemonic: process.env.MNEMONIC},
      saveDeployments: true
    },
    mainnet: {
      url: mainnetURL,
      chainId: 1,
      gasPrice: 20000000000,
      accounts: {mnemonic: process.env.MNEMONIC},
      saveDeployments: true
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
  etherscan: {
    apiKey: {
      rinkeby: process.env.ETHERSCAN_API_KEY,
      fantom_testnet: process.env.FTMSCAN_TESTNET_API_KEY,
    }
  },
  
  solidity: {
    version: "0.8.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      metadata: {
        // do not include the metadata hash, since this is machine dependent
        // and we want all generated code to be deterministic
        // https://docs.soliditylang.org/en/v0.7.6/metadata.html
        bytecodeHash: "none",
      },
    },
  },
  namedAccounts: {
    deployer: 0,
    alice: 1,
    bob: 2,
    charlie: 3
  },
  paths: {
    sources: "contracts",
  },
  docgen: {
    path: './docs',
    clear: true,
    runOnCompile: false,
  },
  gasReporter: {
    currency: 'USD',
    enabled: (process.env.REPORT_GAS === "true") ? true : false
  },
  mocha: {
    timeout: 50000000
  },

}
