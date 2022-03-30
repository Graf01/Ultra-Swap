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
