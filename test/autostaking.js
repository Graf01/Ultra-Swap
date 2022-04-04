const { expect } = require('chai');
const { BN } = require('@openzeppelin/test-helpers');
const Token = artifacts.require('Token');
const Staking = artifacts.require('MockStaking');
const AutoStaking = artifacts.require('AutoStaking');

const ONE_ETHER = new BN(10).pow(new BN(18));

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
            TKN = await Token.new();
            await TKN.mint(user1, ONE_ETHER.mul(new BN(100)));
            await TKN.mint(user2, ONE_ETHER.mul(new BN(100)));

            STAKING = await Staking.new(TKN.address);

            AUTOSTAKING = await AutoStaking.new(TKN.address, STAKING.address);
            await AUTOSTAKING.transferOwnership(owner);

            await TKN.approve(AUTOSTAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user1});
            await TKN.approve(AUTOSTAKING.address, ONE_ETHER.mul(new BN(1000)), {from: user2});
          })

        it('Restaking math and fees test', async () => {

            await AUTOSTAKING.deposit(ONE_ETHER.mul(new BN(100)), {from: user1});

            await STAKING.setPendingReward(ONE_ETHER.mul(new BN(10000)));
            expect(await AUTOSTAKING.calculateRestakeReward()).bignumber.equal(ONE_ETHER.mul(new BN(25)));
            await AUTOSTAKING.restake({from: restaker});
            expect(await TKN.balanceOf(restaker)).bignumber.equal(ONE_ETHER.mul(new BN(25)));
            expect(await TKN.balanceOf(AUTOSTAKING.address)).bignumber.equal(ONE_ETHER.mul(new BN(200)));
            await STAKING.setPendingReward(ONE_ETHER.mul(new BN(10000)));
            expect(await AUTOSTAKING.calculateRestakeReward()).bignumber.equal(ONE_ETHER.mul(new BN(25)));
            await AUTOSTAKING.restake({from: restaker});
            expect(await TKN.balanceOf(restaker)).bignumber.equal(ONE_ETHER.mul(new BN(50)));
            expect(await TKN.balanceOf(AUTOSTAKING.address)).bignumber.equal(ONE_ETHER.mul(new BN(400)));
            expect(await AUTOSTAKING.fees()).bignumber.equal(ONE_ETHER.mul(new BN(400)));
            expect(await AUTOSTAKING.total()).bignumber.equal(ONE_ETHER.mul(new BN(19650)));

            await AUTOSTAKING.getToken(TKN.address, {from: owner});
            expect(await TKN.balanceOf(AUTOSTAKING.address)).bignumber.equal(new BN(0));
            expect(await AUTOSTAKING.fees()).bignumber.equal(new BN(0));
            expect(await TKN.balanceOf(owner)).bignumber.equal(ONE_ETHER.mul(new BN(400)));
            expect(await AUTOSTAKING.total()).bignumber.equal(ONE_ETHER.mul(new BN(19650)));

            expect(await AUTOSTAKING.totalShares()).bignumber.equal(ONE_ETHER.mul(new BN(100)));
            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(100)), {from: user1});
            expect(await TKN.balanceOf(user1)).bignumber.equal(ONE_ETHER.mul(new BN(19650)).mul(new BN(9990)).div(new BN(10000)));
            expect(await AUTOSTAKING.fees()).bignumber.equal(ONE_ETHER.mul(new BN(19650)).mul(new BN(10)).div(new BN(10000)));
            expect(await AUTOSTAKING.total()).bignumber.equal(new BN(0));
            await TKN.burn(await TKN.balanceOf(owner), {from: owner});
            await AUTOSTAKING.getToken(TKN.address, {from: owner});
            expect(await TKN.balanceOf(owner)).bignumber.equal(ONE_ETHER.mul(new BN(19650)).mul(new BN(10)).div(new BN(10000)));
            expect(await AUTOSTAKING.fees()).bignumber.equal(new BN(0));
            expect(await TKN.balanceOf(AUTOSTAKING.address)).bignumber.equal(new BN(0));
        })

        it('Workflow and math test', async () => {

            await AUTOSTAKING.setPerformanceFee(new BN(0), {from: owner});
            await AUTOSTAKING.setRestakeReward(new BN(0), {from: owner});
            await AUTOSTAKING.setWithdrawFee(new BN(0), {from: owner});

            await AUTOSTAKING.deposit(ONE_ETHER.mul(new BN(100)), {from: user1});
            await STAKING.setPendingReward(ONE_ETHER.mul(new BN(400)));
            await AUTOSTAKING.restake();
            expect(await AUTOSTAKING.total()).bignumber.equal(ONE_ETHER.mul(new BN(500)));
            expect(await AUTOSTAKING.totalShares()).bignumber.equal(ONE_ETHER.mul(new BN(100)));
            await AUTOSTAKING.deposit(ONE_ETHER.mul(new BN(100)), {from: user2});
            expect(await AUTOSTAKING.total()).bignumber.equal(ONE_ETHER.mul(new BN(600)));
            expect(await AUTOSTAKING.totalShares()).bignumber.equal(ONE_ETHER.mul(new BN(120)));
            await STAKING.setPendingReward(ONE_ETHER.mul(new BN(600)));
            await AUTOSTAKING.restake();

            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(80)), {from: user1});
            expect(await TKN.balanceOf(user1)).bignumber.equal(ONE_ETHER.mul(new BN(800)));
            expect(await AUTOSTAKING.total()).bignumber.equal(ONE_ETHER.mul(new BN(400)));
            expect(await AUTOSTAKING.totalShares()).bignumber.equal(ONE_ETHER.mul(new BN(40)));

            //NOTE: AutoStaking still having something on balance or staked with totalShares being "lower" than that amount or zero
            //is normal behaviour, although very unlikely due to restaking happening very often
            //users will miss out on ther rewards if they do not restake before withdrawing
            await STAKING.setPendingReward(ONE_ETHER.mul(new BN(100)));
            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(20)), {from: user1});
            expect(await TKN.balanceOf(user1)).bignumber.equal(ONE_ETHER.mul(new BN(1000)));
            expect(await AUTOSTAKING.total()).bignumber.equal(ONE_ETHER.mul(new BN(300)));
            expect(await AUTOSTAKING.totalShares()).bignumber.equal(ONE_ETHER.mul(new BN(20)));

            await STAKING.setPendingReward(ONE_ETHER.mul(new BN(50)));
            await AUTOSTAKING.withdraw(ONE_ETHER.mul(new BN(20)), {from: user2});
            expect(await TKN.balanceOf(user2)).bignumber.equal(ONE_ETHER.mul(new BN(300)));
            expect(await AUTOSTAKING.total()).bignumber.equal(ONE_ETHER.mul(new BN(50)));
            expect(await AUTOSTAKING.totalShares()).bignumber.equal(ONE_ETHER.mul(new BN(0)));
        })
    }
)