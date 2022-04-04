const { expect } = require('chai');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { network } = require('hardhat');
const Token = artifacts.require('Token');
const Referral = artifacts.require('Referral');
const Staking = artifacts.require('Staking');

const ONE_ETHER = new BN(10).pow(new BN(18));
const DAY = new BN(86400);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let RWRD, TKN, REF, STAKING, START_TIME;

contract (
    'Staking',
    ([
        deployer,
        owner,
        user1,
        user2,
        user3,
        burnAddress
    ]) => {

        beforeEach(async () => {
            RWRD = await Token.new();
            await RWRD.mint(user1, ONE_ETHER.mul(new BN(75)));
            await RWRD.mint(user2, ONE_ETHER.mul(new BN(75)));
            await RWRD.mint(user3, ONE_ETHER.mul(new BN(50)));
            TKN = await Token.new();
            await TKN.mint(user1, ONE_ETHER.mul(new BN(100)));
            await TKN.mint(user2, ONE_ETHER.mul(new BN(100)));
            await TKN.mint(user3, ONE_ETHER.mul(new BN(100)));
            REF = await Referral.new();
            await REF.setReferrer(user2, user1);
            await REF.setReferrer(user3, user2);

            await time.advanceBlock();
            START_TIME = (await time.latest()).add(DAY);

            STAKING = await Staking.new(RWRD.address, REF.address, ONE_ETHER, START_TIME, new BN(2), new BN(300), burnAddress);
            await STAKING.setReferralOwnerWithdrawAwait(DAY);
            await STAKING.setReferralPercent(new BN(400));
            await STAKING.setMinReferralReward(new BN(ONE_ETHER.mul(new BN(2500))));
            await STAKING.transferOwnership(owner);

            await RWRD.approve(STAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user1});
            await RWRD.approve(STAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user2});
            await RWRD.approve(STAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user3});

            await TKN.approve(STAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user1});
            await TKN.approve(STAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user2});
            await TKN.approve(STAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user3});
          })

        it('One pool math and workflow test', async () => {

            await STAKING.deposit(0, ONE_ETHER.mul(new BN(75)), {from: user1});
            await STAKING.deposit(0, ONE_ETHER.mul(new BN(25)), {from: user2});

            await time.increase(time.duration.hours(12));

            expect(await STAKING.pendingReward(0, user1)).bignumber.equal(new BN(0));
            expect(await STAKING.pendingReward(0, user2)).bignumber.equal(new BN(0));

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.div(new BN(2)))).toNumber()]);

            await expectRevert(STAKING.withdraw(0, 0, {from: user1}), "Cannot withdraw yet");

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(3)).div(new BN(4)))).toNumber()]);

            await STAKING.deposit(0, ONE_ETHER.mul(new BN(50)), {from: user2});

            REWARD = ONE_ETHER.mul(DAY).mul(new BN(3)).div(new BN(16));
            REFERRAL_REWARD = REWARD.mul(new BN(4)).div(new BN(100));
            FEE = REWARD.mul(new BN(3)).div(new BN(100));
            REWARD = REWARD.sub(FEE);
            expect(await RWRD.balanceOf(user2)).bignumber.equal(REWARD);
            expect(await RWRD.balanceOf(burnAddress)).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.referralDetails(user1, 0)).bignumber.equal(REFERRAL_REWARD);

            await expectRevert(STAKING.getReferralReward({from: user1}), "Not enough referral reward collected");
            await STAKING.setMinReferralReward(new BN(0), {from: owner});

            await STAKING.getReferralReward({from: user1});
            expect(await STAKING.referralDetails(user1, 0)).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(user1)).bignumber.equal(REFERRAL_REWARD);
            await RWRD.burn(await RWRD.balanceOf(user1), {from: user1});

            await STAKING.getFees({from: owner});
            expect(await STAKING.feesCollected()).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(FEE.div(new BN(2)));

            await RWRD.burn(await RWRD.balanceOf(user2), {from: user2});
            await RWRD.burn(await RWRD.balanceOf(burnAddress), {from: burnAddress});
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(3)).div(new BN(2)))).toNumber()]);

            await STAKING.withdraw(0, 0, {from: user1});

            REWARD = ONE_ETHER.mul(DAY).mul(new BN(15)).div(new BN(16));
            REFERRAL_REWARD = REWARD.mul(new BN(4)).div(new BN(100));
            FEE = REWARD.mul(new BN(3)).div(new BN(100));
            REWARD = REWARD.sub(FEE);
            expect(await RWRD.balanceOf(user1)).bignumber.equal(REWARD);
            expect(await RWRD.balanceOf(burnAddress)).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(REFERRAL_REWARD);

            await STAKING.getReferralRewardFor(ZERO_ADDRESS, {from: owner});
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(REFERRAL_REWARD);
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await STAKING.getFees({from: owner});
            expect(await STAKING.feesCollected()).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(FEE.div(new BN(2)));

            await RWRD.burn(await RWRD.balanceOf(user1), {from: user1});
            await RWRD.burn(await RWRD.balanceOf(burnAddress), {from: burnAddress});
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(2)))).toNumber()]);

            await STAKING.withdraw(0, ONE_ETHER.mul(new BN(75)), {from: user2});

            REWARD = ONE_ETHER.mul(DAY).mul(new BN(10)).div(new BN(16));
            REFERRAL_REWARD = REWARD.mul(new BN(4)).div(new BN(100));
            FEE = REWARD.mul(new BN(3)).div(new BN(100));
            REWARD = REWARD.sub(FEE);
            expect(await RWRD.balanceOf(user2)).bignumber.equal(ONE_ETHER.mul(new BN(75)).add(REWARD));
            expect(await RWRD.balanceOf(burnAddress)).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.referralDetails(user1, 0)).bignumber.equal(REFERRAL_REWARD);

            await STAKING.getReferralReward({from: user1});
            expect(await STAKING.referralDetails(user1, 0)).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(user1)).bignumber.equal(REFERRAL_REWARD);
            await RWRD.burn(await RWRD.balanceOf(user1), {from: user1});

            await STAKING.getFees({from: owner});
            expect(await STAKING.feesCollected()).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(FEE.div(new BN(2)));

            await RWRD.burn(await RWRD.balanceOf(user2), {from: user2});
            await RWRD.burn(await RWRD.balanceOf(burnAddress), {from: burnAddress});
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(9)).div(new BN(4)))).toNumber()]);

            await expectRevert(STAKING.withdraw(0, ONE_ETHER.mul(new BN(75)), {from: user1}), "Cannot withdraw yet");

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(10)).div(new BN(4)))).toNumber()]);

            await STAKING.withdraw(0, ONE_ETHER.mul(new BN(75)), {from: user1});

            REWARD = ONE_ETHER.mul(DAY).mul(new BN(12)).div(new BN(16));
            REFERRAL_REWARD = REWARD.mul(new BN(4)).div(new BN(100));
            FEE = REWARD.mul(new BN(3)).div(new BN(100));
            REWARD = REWARD.sub(FEE);
            expect(await RWRD.balanceOf(user1)).bignumber.equal(ONE_ETHER.mul(new BN(75)).add(REWARD));
            expect(await RWRD.balanceOf(burnAddress)).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(REFERRAL_REWARD);

            await STAKING.getReferralRewardFor(ZERO_ADDRESS, {from: owner});
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(REFERRAL_REWARD);
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await STAKING.getFees({from: owner});
            expect(await STAKING.feesCollected()).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(FEE.div(new BN(2)));

            await RWRD.burn(await RWRD.balanceOf(user1), {from: user1});
            await RWRD.burn(await RWRD.balanceOf(burnAddress), {from: burnAddress});
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(4)))).toNumber()]);

            await STAKING.deposit(0, ONE_ETHER.mul(new BN(50)), {from: user3});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(5)))).toNumber()]);

            await STAKING.withdraw(0, ONE_ETHER.mul(new BN(50)), {from: user3});

            REWARD = ONE_ETHER.mul(DAY);
            REFERRAL_REWARD = REWARD.mul(new BN(4)).div(new BN(100));
            FEE = REWARD.mul(new BN(3)).div(new BN(100));
            REWARD = REWARD.sub(FEE);
            expect(await RWRD.balanceOf(user3)).bignumber.equal(ONE_ETHER.mul(new BN(50)).add(REWARD));
            expect(await RWRD.balanceOf(burnAddress)).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.referralDetails(user2, 0)).bignumber.equal(REFERRAL_REWARD);

            await expectRevert(STAKING.getReferralRewardFor(user2, {from: owner}), "Not enough time passed");
            await STAKING.setReferralOwnerWithdrawAwait(0, {from: owner});

            await STAKING.getReferralRewardFor(user2, {from: owner});
            expect(await STAKING.referralDetails(user2, 0)).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(REFERRAL_REWARD);
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await STAKING.getFees({from: owner});
            expect(await STAKING.feesCollected()).bignumber.equal(new BN(0));
            expect(await RWRD.balanceOf(owner)).bignumber.equal(FEE.div(new BN(2)));

            await RWRD.burn(await RWRD.balanceOf(user3), {from: user3});
            await RWRD.burn(await RWRD.balanceOf(burnAddress), {from: burnAddress});
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});
        })

        it('Cross-pool math and workflow test', async () => {

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.div(new BN(2)))).toNumber()]);

            await STAKING.deposit(0, ONE_ETHER.mul(new BN(75)), {from: user1});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY)).toNumber()]);

            await STAKING.addPool(TKN.address, new BN(1), new BN(200), true, {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(5)).div(new BN(4)))).toNumber()]);

            await STAKING.deposit(1, ONE_ETHER.mul(new BN(100)), {from: user2});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(6)).div(new BN(4)))).toNumber()]);

            await STAKING.setPoolAllocPoint(1, 2, true, {from: owner});
            await STAKING.setPoolFeePercentage(1, new BN(300), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(2)))).toNumber()]);

            await STAKING.setRewardPerSecond(ONE_ETHER.mul(new BN(2)), true, {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(9)).div(new BN(4)))).toNumber()]);

            await STAKING.withdraw(1, ONE_ETHER.mul(new BN(100)), {from: user2});

            REWARD = ONE_ETHER.mul(DAY).mul(new BN(7)).div(new BN(12));
            REFERRAL_REWARD = REWARD.mul(new BN(4)).div(new BN(100));
            FEE = REWARD.mul(new BN(3)).div(new BN(100));
            REWARD = REWARD.sub(FEE);
            expect(await RWRD.balanceOf(user2)).bignumber.equal(ONE_ETHER.mul(new BN(75)).add(REWARD));
            expect(await TKN.balanceOf(user2)).bignumber.equal(ONE_ETHER.mul(new BN(100)));
            expect(await RWRD.balanceOf(burnAddress)).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.referralDetails(user1, 0)).bignumber.equal(REFERRAL_REWARD);

            await RWRD.burn(await RWRD.balanceOf(burnAddress), {from: burnAddress});
            await STAKING.getFees({from: owner});
            await RWRD.burn(await RWRD.balanceOf(owner), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(new BN(10)).div(new BN(4)))).toNumber()]);

            await STAKING.withdraw(0, ONE_ETHER.mul(new BN(75)), {from: user1});

            REWARD = ONE_ETHER.mul(DAY).mul(new BN(19)).div(new BN(12));
            REFERRAL_REWARD = REWARD.mul(new BN(4)).div(new BN(100));
            FEE = REWARD.mul(new BN(3)).div(new BN(100));
            REWARD = REWARD.sub(FEE);
            expect(await RWRD.balanceOf(user1)).bignumber.equal(ONE_ETHER.mul(new BN(75)).add(REWARD));
            expect(await RWRD.balanceOf(burnAddress)).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(new BN(2)));
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(REFERRAL_REWARD);
        })
    }
)