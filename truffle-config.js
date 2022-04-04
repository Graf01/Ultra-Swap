const HDWalletProvider = require('@truffle/hdwallet-provider');

require('dotenv').config();
const {
    BSCSCAN_API_KEY,
    MNEMONIC,
    DEPLOY_GAS_LIMIT,
    DEPLOY_GAS_PRICE
} = process.env;

const Web3 = require("web3");
const web3 = new Web3();

module.exports = {
    plugins: ['truffle-plugin-verify', 'truffle-contract-size'],

    api_keys: {
        bscscan: BSCSCAN_API_KEY
    },

    networks: {
        /* development: {
            host: "127.0.0.1",
            port: 7545,
            network_id: "*",
            gas: 30000000
        }, */
        bscMainnet: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://bsc-dataseed.binance.org"),
            network_id: 56,
            gasPrice: web3.utils.toWei(DEPLOY_GAS_PRICE, 'gwei'),
            gas: DEPLOY_GAS_LIMIT,
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        },
        bscTestnet: {
            provider: () => new HDWalletProvider(MNEMONIC, "https://data-seed-prebsc-2-s2.binance.org:8545"),
            network_id: 97,
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true,
            networkCheckTimeout: 999999
        }
    },

    compilers: {
        solc: {
            version: "0.8.12",
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 999999
                }
            }
        }
    }
};