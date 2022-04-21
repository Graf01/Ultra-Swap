const { expect } = require('chai');
const { BN, time } = require('@openzeppelin/test-helpers');
const AutoStaking = artifacts.require('AutoStaking');
const Token = artifacts.require('Token');
const Ultra = artifacts.require('UltraToken');
const Referral = artifacts.require('ReferralProgram');
const Staking = artifacts.require('StakingV2');

const DAY = new BN("86400");
const MINUTE = new BN('60')


const TEN = new BN('10');
const HUN = new BN('100');


const ONE_ETHER = new BN(10).pow(new BN(18));
const rewardPerSecond = ONE_ETHER;
const firstPoolAllocPoint = new BN(2);
const firstPoolFeeBPS = new BN(300);
const referralPercent = new BN(400);
const minReferralReward = ONE_ETHER.mul(new BN("2500"));
const acceptableError = rewardPerSecond.mul(MINUTE);

const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

let now;


let TKN, STAKING, AUTOSTAKING;

contract (
    'AutoStaking',
    ([
        deployer,
        owner,
        user1,
        user2,
        restaker
    ]) => {

        beforeEach(async () => {
            TKN = await Ultra.new("Ultra token", "ULTRA");
            this.token = await Token.new();
            this.referral = await Referral.new(owner, false);
            now = new BN(Math.round(Date.now() / 1000));
            console.log("now = ", now.toString());
            STAKING = await Staking.new(
                TKN.address,
                this.referral.address,
                rewardPerSecond,
                now,
                firstPoolAllocPoint,
                firstPoolFeeBPS,
                owner
            );
            // STAKING = await Staking.new(TKN.address);

            AUTOSTAKING = await AutoStaking.new(TKN.address, STAKING.address);
            await AUTOSTAKING.transferOwnership(owner);

            await TKN.grantRole(MINTER_ROLE, STAKING.address);
            await STAKING.setReferralOwnerWithdrawAwait(DAY);
            await STAKING.setReferralPercent(referralPercent);
            await STAKING.setMinReferralReward(minReferralReward);
        
            await TKN.grantRole(MINTER_ROLE, owner, {from: deployer});
            await TKN.mint(user1, ONE_ETHER.mul(HUN), {from: owner});
            await TKN.mint(user2, ONE_ETHER.mul(HUN), {from: owner});

            await TKN.approve(AUTOSTAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user1});
            await TKN.approve(AUTOSTAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user2});

            await STAKING.excludeFromFee([AUTOSTAKING.address], {from: deployer});
          })

        it('Restaking math and fees test', async () => {

            await AUTOSTAKING.deposit(ONE_ETHER.mul(new BN(100)), {from: user1});

            await time.increaseTo(now.add(new BN(10000)));

            // await STAKING.setPendingReward(ONE_ETHER.mul(new BN(10000)));
            expect((await AUTOSTAKING.calculateRestakeReward()).sub(ONE_ETHER.mul(new BN(25))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.calculateRestakeReward()).bignumber.gt(new BN(0));
            await AUTOSTAKING.restake({from: restaker});
            expect((await TKN.balanceOf(restaker)).sub(ONE_ETHER.mul(new BN(25))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(restaker)).bignumber.gt(new BN(0));

            expect((await TKN.balanceOf(AUTOSTAKING.address)).sub(ONE_ETHER.mul(new BN(200))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(AUTOSTAKING.address)).bignumber.gt(new BN(0));

            // await STAKING.setPendingReward(ONE_ETHER.mul(new BN(10000)));
            await time.increaseTo(now.add(new BN(20000)));
            expect((await AUTOSTAKING.calculateRestakeReward()).sub(ONE_ETHER.mul(new BN(25))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.calculateRestakeReward()).bignumber.gt(new BN(0));

            await AUTOSTAKING.restake({from: restaker});
            expect((await TKN.balanceOf(restaker)).sub(ONE_ETHER.mul(new BN(50))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(restaker)).bignumber.gt(new BN(0));

            expect((await TKN.balanceOf(AUTOSTAKING.address)).sub(ONE_ETHER.mul(new BN(400)))).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(AUTOSTAKING.address)).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.fees()).sub(ONE_ETHER.mul(new BN(400))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.fees()).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.total()).sub(ONE_ETHER.mul(new BN(19650))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.total()).bignumber.gt(new BN(0));

            await AUTOSTAKING.getToken(TKN.address, {from: owner});
            expect(await TKN.balanceOf(AUTOSTAKING.address)).bignumber.equal(new BN(0));
            expect(await AUTOSTAKING.fees()).bignumber.equal(new BN(0));
            expect((await TKN.balanceOf(owner)).sub(ONE_ETHER.mul(new BN(400))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(owner)).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.total()).sub(ONE_ETHER.mul(new BN(19650))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.total()).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.totalShares()).sub(ONE_ETHER.mul(new BN(100))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.totalShares()).bignumber.gt(new BN(0));

            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(100)), {from: user1});
            expect((await TKN.balanceOf(user1)).sub(ONE_ETHER.mul(new BN(19650)).mul(new BN(9990)).div(new BN(10000))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(user1)).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.fees()).sub(ONE_ETHER.mul(new BN(19650)).mul(new BN(10)).div(new BN(10000))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.fees()).bignumber.gt(new BN(0));

        })

        it('Workflow and math test', async () => {

            await AUTOSTAKING.setPerformanceFee(new BN(0), {from: owner});
            await AUTOSTAKING.setRestakeReward(new BN(0), {from: owner});
            await AUTOSTAKING.setWithdrawFee(new BN(0), {from: owner});

            await AUTOSTAKING.deposit(ONE_ETHER.mul(new BN(100)), {from: user1});
            // await STAKING.setPendingReward(ONE_ETHER.mul(new BN(400)));
            await time.increaseTo(now.add(new BN(20400)));

            await AUTOSTAKING.restake();
            expect((await AUTOSTAKING.total()).sub(ONE_ETHER.mul(new BN(500))).abs()).bignumber.lt(acceptableError);
            expect((await AUTOSTAKING.total())).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.totalShares()).sub(ONE_ETHER.mul(new BN(100))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.totalShares()).bignumber.gt(new BN(0));

            await AUTOSTAKING.deposit(ONE_ETHER.mul(new BN(100)), {from: user2});

            expect((await AUTOSTAKING.total()).sub(ONE_ETHER.mul(new BN(600))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.total()).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.totalShares()).sub(ONE_ETHER.mul(new BN(120))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.totalShares()).bignumber.gt(new BN(0));

            await time.increaseTo(now.add(new BN(21000)));
            await AUTOSTAKING.restake();

            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(80)), {from: user1});

            expect((await TKN.balanceOf(user1)).sub(ONE_ETHER.mul(new BN(800))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(user1)).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.total()).sub(ONE_ETHER.mul(new BN(400))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.total()).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.totalShares()).sub(ONE_ETHER.mul(new BN(40)).abs())).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.totalShares()).bignumber.gt(new BN(0));

            //NOTE: AutoStaking still having something on balance or staked with totalShares being "lower" than that amount or zero
            //is normal behaviour, although very unlikely due to restaking happening very often
            //users will miss out on ther rewards if they do not restake before withdrawing
            await time.increaseTo(now.add(new BN(21100)));

            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(20)), {from: user1});

            expect((await TKN.balanceOf(user1)).sub(ONE_ETHER.mul(new BN(1000))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(user1)).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.total()).sub(ONE_ETHER.mul(new BN(300))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.total()).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.totalShares()).sub(ONE_ETHER.mul(new BN(20))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.totalShares()).bignumber.gt(new BN(0));

            await time.increaseTo(now.add(new BN(21150)));
            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(20)), {from: user2});

            expect((await TKN.balanceOf(user2)).sub(ONE_ETHER.mul(new BN(300))).abs()).bignumber.lt(acceptableError);
            expect(await TKN.balanceOf(user2)).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.total()).sub(ONE_ETHER.mul(new BN(50))).abs()).bignumber.lt(acceptableError);
            expect(await AUTOSTAKING.total()).bignumber.gt(new BN(0));

            expect((await AUTOSTAKING.totalShares()).sub(ONE_ETHER.mul(new BN(0))).abs()).bignumber.lt(acceptableError);
        })
    }
)