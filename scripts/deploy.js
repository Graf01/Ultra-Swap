const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');


const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

const name = "Ultra Token";
const symbol = "ULTRA";

const rewardPerSecond = ethers.utils.parseEther("1");
const startTime = 1648659177;
const bonusEndBlock = 1500;

const DAY = BigNumber.from(86400);
const ONE_ETHER = BigNumber.from(10).pow(BigNumber.from(18));

let tokenAddress;
let referralAddress;
let firstPoolAllocPoint;
let firstPoolFeePercentage;
let burnAddress;


async function main() {

    const Staking = await ethers.getContractFactory("Staking");
    const UltraToken = await ethers.getContractFactory("UltraToken");
    const ReferralProgram = await ethers.getContractFactory("ReferralProgram");
    const referral = await ReferralProgram.deploy("0x528e7c77B8F3001B512e8BF305b03CeA420951cd", false);

    const ultra = await UltraToken.deploy(name, symbol);

    tokenAddress = ultra.address;
    referralAddress = referral.address;
    firstPoolAllocPoint = BigNumber.from(2);
    firstPoolFeePercentage = BigNumber.from(300);
    burnAddress = "0x528e7c77B8F3001B512e8BF305b03CeA420951cd";

    console.log("Deploying with: ");
    console.log("tokenAddress = ", tokenAddress);
    console.log("referralAddress = ", referralAddress);
    console.log("rewardPerSecond = ", rewardPerSecond.toString());
    console.log("startTime = ", startTime);
    console.log("firstPoolAllocPoint = ", firstPoolAllocPoint.toString());
    console.log("firstPoolFeePercentage = ", firstPoolFeePercentage.toString());
    console.log("burnAddress = ", burnAddress);


    const staking = await Staking.deploy(
      tokenAddress,
      referralAddress,
      rewardPerSecond,
      startTime,
      firstPoolAllocPoint,
      firstPoolFeePercentage,
      burnAddress
    );

    console.log("Ultra Token deployed to:", ultra.address);
    console.log("Staking deployed to:", staking.address);
    console.log("Referral Program deployed to:", referral.address);
    await ultra.grantRole(MINTER_ROLE, staking.address);
    await staking.setReferralOwnerWithdrawAwait(DAY);
    await staking.setReferralPercent(BigNumber.from(400));
    await staking.setMinReferralReward(BigNumber.from(ONE_ETHER.mul(BigNumber.from(2500))));

     

  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });

module.exports = {
  tokenAddress,
  referralAddress,
  rewardPerSecond,
  startTime,
  firstPoolAllocPoint,
  firstPoolFeePercentage,
  burnAddress,
  name, 
  symbol
}


// Ultra Token deployed to: 0x1299e57e05c2Cf8C3f31C83AE96A4C3f5a083D4a
//https://rinkeby.etherscan.io/address/0x415D35b24bc64DdFFd19775E7dEB8ED275604c48#code

// Staking deployed to: 0xb7EBCc19b825faE376d4D0F0cA39b263055601F8
//https://rinkeby.etherscan.io/address/0xb7EBCc19b825faE376d4D0F0cA39b263055601F8#code

// Referral Program deployed to: 0x882A5106f0CeE3b90E8d2B6DEb0D305dC4959De1
// https://rinkeby.etherscan.io/address/0x882A5106f0CeE3b90E8d2B6DEb0D305dC4959De1#writeContract