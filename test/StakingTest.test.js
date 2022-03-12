const { expect, use } = require('chai');
const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { BigNumber } = require('ethers');

const { network, ethers, waffle } = require('hardhat');

const ONE_ETHER = BigNumber.from(10).pow(BigNumber.from(18));
const DAY = BigNumber.from(86400);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let ULTRA, TKN, REF, STAKING, START_TIME;

describe (
    'Staking',
    () => {

        const accounts = waffle.provider.getWallets();
        const deployer = accounts[0];
        const owner = accounts[1];
        const user1 = accounts[2]; 
        const user2 = accounts[3];
        const user3 = accounts[4];
        const burnAddress = accounts[5];
        beforeEach(async () => {
            const Token = await ethers.getContractFactory("Token")
            const Ultra = await ethers.getContractFactory("UltraToken");
            ULTRA = await Ultra.deploy("Ultra Token", "UT"); //await Token.new();  
            await ULTRA.connect(deployer).grantRole("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", deployer.address)
            await ULTRA.connect(deployer).mint(user1.address, ONE_ETHER.mul(BigNumber.from(75)));
            await ULTRA.connect(deployer).mint(user2.address, ONE_ETHER.mul(BigNumber.from(75)));
            await ULTRA.connect(deployer).mint(user3.address, ONE_ETHER.mul(BigNumber.from(50)));
            TKN = await Token.deploy();
            await TKN.mint(user1.address, ONE_ETHER.mul(BigNumber.from(100)));
            await TKN.mint(user2.address, ONE_ETHER.mul(BigNumber.from(100)));
            await TKN.mint(user3.address, ONE_ETHER.mul(BigNumber.from(100)));
            const Referral = await ethers.getContractFactory("ReferralProgram");
            REF = await Referral.deploy(owner.address, false);
            await REF.connect(user2)["registrate(address)"](user1.address);
            await REF.connect(user3)["registrate(address)"](user2.address);
            await time.advanceBlock();
            START_TIME = BigNumber.from((await time.latest()).toString()).add(DAY);
            const Staking = await ethers.getContractFactory("Staking");

            STAKING = await Staking.deploy(ULTRA.address, REF.address, ONE_ETHER, START_TIME, BigNumber.from(2), BigNumber.from(300), burnAddress.address);

            await STAKING.setReferralOwnerWithdrawAwait(DAY);
            await STAKING.setReferralPercent(BigNumber.from(400));
            await STAKING.setMinReferralReward(BigNumber.from(ONE_ETHER.mul(BigNumber.from(2500))));
            await STAKING.transferOwnership(owner.address);

            await ULTRA.connect(user1).approve(STAKING.address, ONE_ETHER.mul(BigNumber.from(1000)));
            await ULTRA.connect(user2).approve(STAKING.address, ONE_ETHER.mul(BigNumber.from(1000)));
            await ULTRA.connect(user3).approve(STAKING.address, ONE_ETHER.mul(BigNumber.from(1000)));

            await TKN.connect(user1).approve(STAKING.address, ONE_ETHER.mul(BigNumber.from(1000)));
            await TKN.connect(user2).approve(STAKING.address, ONE_ETHER.mul(BigNumber.from(1000)));
            await TKN.connect(user3).approve(STAKING.address, ONE_ETHER.mul(BigNumber.from(1000)));

          })

        it('One pool math and workflow test', async () => {

            await STAKING.connect(user1).deposit(0, ONE_ETHER.mul(BigNumber.from(75)));
            await STAKING.connect(user2).deposit(0, ONE_ETHER.mul(BigNumber.from(25)));

            await time.increase(time.duration.hours(12).toString());

            expect(await STAKING.pendingReward(0, user1.address)).equal(BigNumber.from(0));
            expect(await STAKING.pendingReward(0, user2.address)).equal(BigNumber.from(0));

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.div(BigNumber.from(2)))).toNumber()]);

            await expectRevert(STAKING.connect(user1).withdraw(0, 0), "Cannot get rewards yet");

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(3)).div(BigNumber.from(4)))).toNumber()]);

            await STAKING.connect(user2).deposit(0, ONE_ETHER.mul(BigNumber.from(50)));

            REWARD = ONE_ETHER.mul(DAY).mul(BigNumber.from(3)).div(BigNumber.from(16));
            REFERRAL_REWARD = REWARD.mul(BigNumber.from(4)).div(BigNumber.from(100));
            FEE = REWARD.mul(BigNumber.from(3)).div(BigNumber.from(100));
            REWARD = REWARD.sub(FEE);
            expect(await ULTRA.balanceOf(user2.address)).bignumber.equal(REWARD);
            expect(await ULTRA.balanceOf(burnAddress.address)).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.referralDetails(user1.address, 0)).bignumber.equal(REFERRAL_REWARD);

            await expectRevert(STAKING.connect(user1).getReferralReward(), "Not enough referral reward collected");
            await STAKING.connect(owner).setMinReferralReward(BigNumber.from(0), );

            await STAKING.connect(user1).getReferralReward();
            expect(await STAKING.referralDetails(user1.address, 0)).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(user1.address)).bignumber.equal(REFERRAL_REWARD);
            await ULTRA.connect(user1).burn(await ULTRA.balanceOf(user1.address));

            await STAKING.connect(owner).getFees();
            expect(await STAKING.feesCollected()).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(FEE.div(BigNumber.from(2)));

            await ULTRA.connect(user2).burn(await ULTRA.balanceOf(user2.address));
            await ULTRA.connect(burnAddress).burn(await ULTRA.balanceOf(burnAddress));
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner.address));

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(3)).div(BigNumber.from(2)))).toNumber()]);

            await STAKING.connect(user1).withdraw(0, 0);

            REWARD = ONE_ETHER.mul(DAY).mul(BigNumber.from(15)).div(BigNumber.from(16));
            REFERRAL_REWARD = REWARD.mul(BigNumber.from(4)).div(BigNumber.from(100));
            FEE = REWARD.mul(BigNumber.from(3)).div(BigNumber.from(100));
            REWARD = REWARD.sub(FEE);
            expect(await ULTRA.balanceOf(user1.address)).bignumber.equal(REWARD);
            expect(await ULTRA.balanceOf(burnAddress.address)).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(REFERRAL_REWARD);

            await STAKING.connect(owner).getReferralRewardFor(ZERO_ADDRESS);
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(REFERRAL_REWARD);
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner));

            await STAKING.connect(owner).getFees();
            expect(await STAKING.feesCollected()).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(FEE.div(BigNumber.from(2)));

            await ULTRA.connect(user1).burn(await ULTRA.balanceOf(user1.address));
            await ULTRA.connect(burnAddress).burn(await ULTRA.balanceOf(burnAddress.address));
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner.address));

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(2)))).toNumber()]);

            await STAKING.connect(user2).withdraw(0, ONE_ETHER.mul(BigNumber.from(75)));

            REWARD = ONE_ETHER.mul(DAY).mul(BigNumber.from(10)).div(BigNumber.from(16));
            REFERRAL_REWARD = REWARD.mul(BigNumber.from(4)).div(BigNumber.from(100));
            FEE = REWARD.mul(BigNumber.from(3)).div(BigNumber.from(100));
            REWARD = REWARD.sub(FEE);
            expect(await ULTRA.balanceOf(user2.address)).bignumber.equal(ONE_ETHER.mul(BigNumber.from(75)).add(REWARD));
            expect(await ULTRA.balanceOf(burnAddress.address)).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.referralDetails(user1.address, 0)).bignumber.equal(REFERRAL_REWARD);

            await STAKING.connect(user1).getReferralReward();
            expect(await STAKING.referralDetails(user1.address, 0)).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(user1.address)).bignumber.equal(REFERRAL_REWARD);
            await ULTRA.connect(user1).burn(await ULTRA.balanceOf(user1.address));

            await STAKING.connect(owner).getFees();
            expect(await STAKING.feesCollected()).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(FEE.div(BigNumber.from(2)));

            await ULTRA.connect(user2).burn(await ULTRA.balanceOf(user2.address));
            await ULTRA.connect(burnAddress).burn(await ULTRA.balanceOf(burnAddress.address));
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner.address));

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(9)).div(BigNumber.from(4)))).toNumber()]);

            await expectRevert(STAKING.connect(user1).withdraw(0, ONE_ETHER.mul(BigNumber.from(75))), "Cannot withdraw yet");

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(10)).div(BigNumber.from(4)))).toNumber()]);

            await STAKING.connect(user1).withdraw(0, ONE_ETHER.mul(BigNumber.from(75)));

            REWARD = ONE_ETHER.mul(DAY).mul(BigNumber.from(12)).div(BigNumber.from(16));
            REFERRAL_REWARD = REWARD.mul(BigNumber.from(4)).div(BigNumber.from(100));
            FEE = REWARD.mul(BigNumber.from(3)).div(BigNumber.from(100));
            REWARD = REWARD.sub(FEE);
            expect(await ULTRA.balanceOf(user1.address)).bignumber.equal(ONE_ETHER.mul(BigNumber.from(75)).add(REWARD));
            expect(await ULTRA.balanceOf(burnAddress.address)).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(REFERRAL_REWARD);

            await STAKING.connect(owner).getReferralRewardFor(ZERO_ADDRESS);
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(REFERRAL_REWARD);
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner.address));

            await STAKING.connect(owner).getFees();
            expect(await STAKING.feesCollected()).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(FEE.div(BigNumber.from(2)));

            await ULTRA.connect(user1).burn(await ULTRA.balanceOf(user1.address));
            await ULTRA.connect(burnAddress).burn(await ULTRA.balanceOf(burnAddress.address));
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner.address));

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(4)))).toNumber()]);

            await STAKING.connect(user3).deposit(0, ONE_ETHER.mul(BigNumber.from(50)));

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(5)))).toNumber()]);

            await STAKING.connect(user3).withdraw(0, ONE_ETHER.mul(BigNumber.from(50)));

            REWARD = ONE_ETHER.mul(DAY);
            REFERRAL_REWARD = REWARD.mul(BigNumber.from(4)).div(BigNumber.from(100));
            FEE = REWARD.mul(BigNumber.from(3)).div(BigNumber.from(100));
            REWARD = REWARD.sub(FEE);
            expect(await ULTRA.balanceOf(user3.address)).bignumber.equal(ONE_ETHER.mul(BigNumber.from(50)).add(REWARD));
            expect(await ULTRA.balanceOf(burnAddress.address)).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.referralDetails(user2.address, 0)).bignumber.equal(REFERRAL_REWARD);

            await expectRevert(STAKING.connect(owner).getReferralRewardFor(user2.address), "Not enough time passed");
            await STAKING.connect(owner).setReferralOwnerWithdrawAwait(0);

            await STAKING.connect(owner).getReferralRewardFor(user2.address);
            expect(await STAKING.referralDetails(user2.address, 0)).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(REFERRAL_REWARD);
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner.address));

            await STAKING.connect(owner).getFees();
            expect(await STAKING.feesCollected()).bignumber.equal(BigNumber.from(0));
            expect(await ULTRA.balanceOf(owner.address)).bignumber.equal(FEE.div(BigNumber.from(2)));

            await ULTRA.connect(user3).burn(await ULTRA.balanceOf(user3.address));
            await ULTRA.connect(burnAddress).burn(await ULTRA.balanceOf(burnAddress.address));
            await ULTRA.connect(owner).burn(await ULTRA.balanceOf(owner.address));
        })

        it('Cross-pool math and workflow test', async () => {

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.div(BigNumber.from(2)))).toNumber()]);

            await STAKING.deposit(0, ONE_ETHER.mul(BigNumber.from(75)), {from: user1});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY)).toNumber()]);

            await STAKING.addPool(TKN.address, BigNumber.from(1), BigNumber.from(200), true, {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(5)).div(BigNumber.from(4)))).toNumber()]);

            await STAKING.deposit(1, ONE_ETHER.mul(BigNumber.from(100)), {from: user2});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(6)).div(BigNumber.from(4)))).toNumber()]);

            await STAKING.setPoolAllocPoint(1, 2, true, {from: owner});
            await STAKING.setPoolFeePercentage(1, BigNumber.from(300), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(2)))).toNumber()]);

            await STAKING.setRewardPerSecond(ONE_ETHER.mul(BigNumber.from(2)), true, {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(9)).div(BigNumber.from(4)))).toNumber()]);

            await STAKING.withdraw(1, ONE_ETHER.mul(BigNumber.from(100)), {from: user2});

            REWARD = ONE_ETHER.mul(DAY).mul(BigNumber.from(7)).div(BigNumber.from(12));
            REFERRAL_REWARD = REWARD.mul(BigNumber.from(4)).div(BigNumber.from(100));
            FEE = REWARD.mul(BigNumber.from(3)).div(BigNumber.from(100));
            REWARD = REWARD.sub(FEE);
            expect(await ULTRA.balanceOf(user2)).bignumber.equal(ONE_ETHER.mul(BigNumber.from(75)).add(REWARD));
            expect(await TKN.balanceOf(user2)).bignumber.equal(ONE_ETHER.mul(BigNumber.from(100)));
            expect(await ULTRA.balanceOf(burnAddress)).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.referralDetails(user1, 0)).bignumber.equal(REFERRAL_REWARD);

            await ULTRA.burn(await ULTRA.balanceOf(burnAddress), {from: burnAddress});
            await STAKING.getFees({from: owner});
            await ULTRA.burn(await ULTRA.balanceOf(owner), {from: owner});

            await network.provider.send("evm_setNextBlockTimestamp", [(START_TIME.add(DAY.mul(BigNumber.from(10)).div(BigNumber.from(4)))).toNumber()]);

            await STAKING.withdraw(0, ONE_ETHER.mul(BigNumber.from(75)), {from: user1});

            REWARD = ONE_ETHER.mul(DAY).mul(BigNumber.from(19)).div(BigNumber.from(12));
            REFERRAL_REWARD = REWARD.mul(BigNumber.from(4)).div(BigNumber.from(100));
            FEE = REWARD.mul(BigNumber.from(3)).div(BigNumber.from(100));
            REWARD = REWARD.sub(FEE);
            expect(await ULTRA.balanceOf(user1)).bignumber.equal(ONE_ETHER.mul(BigNumber.from(75)).add(REWARD));
            expect(await ULTRA.balanceOf(burnAddress)).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.feesCollected()).bignumber.equal(FEE.div(BigNumber.from(2)));
            expect(await STAKING.referralDetails(ZERO_ADDRESS, 0)).bignumber.equal(REFERRAL_REWARD);
        })
    }
)