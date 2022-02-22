const { ethers } = require("hardhat");

const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

const name = "Ultra Token";
const symbol = "ULTRA";

const rewardPerBlock = ethers.utils.parseEther("100");
const startBlock = 1000;
const bonusEndBlock = 1500;

async function main() {

    const Staking = await ethers.getContractFactory("Staking");
    const UltraToken = await ethers.getContractFactory("UltraToken");

    const ultra = await UltraToken.deploy(name, symbol);
    const staking = await Staking.deploy(
        ultra.address,
        rewardPerBlock,
        startBlock,
        bonusEndBlock
    );
        
    await fuultrael.grantRole(MINTER_ROLE, staking.address)

    console.log("Ultra Token deployed to:", ultra.address);
    console.log("Staking deployed to:", staking.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });


module.exports = {
    rewardPerBlock,
    startBlock,
    bonusEndBlock,
    name,
    symbol

}
  