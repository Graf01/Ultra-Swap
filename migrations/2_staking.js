require('dotenv').config();

const {
    REWARD_TOKEN,
    REFERRAL_PROGRAM,
    REWARD_PER_SECOND,
    START_TIME,
    FIRST_POOL_ALLOC_POINT,
    FIRST_POOL_FEE_PERCENTAGE,
    BURN_ADDRESS,
    REFERRAL_OWNER_WITHDRAW_AWAIT,
    REFERRAL_PERCENT,
    MIN_REFERRAL_REWARD,
    OWNER
} = process.env;

const Staking = artifacts.require("Staking");

module.exports = async function (deployer, network) {
    if (network == "test") return;

    await deployer.deploy(
        Staking, REWARD_TOKEN, REFERRAL_PROGRAM, REWARD_PER_SECOND, START_TIME, FIRST_POOL_ALLOC_POINT, FIRST_POOL_FEE_PERCENTAGE, BURN_ADDRESS
    );

    let StakingInst = await Staking.deployed();
    await StakingInst.setReferralOwnerWithdrawAwait(REFERRAL_OWNER_WITHDRAW_AWAIT);
    await StakingInst.setReferralPercent(REFERRAL_PERCENT);
    await StakingInst.setMinReferralReward(MIN_REFERRAL_REWARD);
    await StakingInst.transferOwnership(OWNER);
};