const { ethers, waffle } = require('hardhat');
const { BigNumber } = require('ethers');
const { expect } = require('chai');
const chai = require('chai');
const { time, BN } = require('@openzeppelin/test-helpers');

const MINUTE = new BN('60')
const DAY = new BN("86400");
const WEEK = DAY.mul(new BN("7"));

const ZERO = new BN('0');
const ONE = new BN('1');
const TWO = new BN('2');
const THREE = new BN('3');
const FOUR = new BN('4');
const FIVE = new BN('5');
const SIX = new BN('6');
const SEVEN = new BN('7');
const NINE = new BN('9');
const TEN = new BN('10');
const HUN = new BN('100');

const BPS_BASE = new BN('10000');

const MINTER_ROLE = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

const MULTIPLIER = new BN('1000000000000');
const ONE_ETHER = new BN(10).pow(new BN(18));
const rewardPerSecond = ONE_ETHER;
const firstPoolAllocPoint = new BN(2);
const firstPoolFeeBPS = new BN(300);
const referralPercent = new BN(400);
const minReferralReward = ONE_ETHER.mul(new BN("2500"));
let now;
const acceptableError = rewardPerSecond.mul(MINUTE);

const Token = artifacts.require('Token');
const Ultra = artifacts.require('UltraToken');
const Referral = artifacts.require('ReferralProgram');
const Staking = artifacts.require('StakingV2');



describe('Staking V2', async () => {
  const accounts = waffle.provider.getWallets();
  const owner = accounts[0];
  const alice = accounts[1];
  const bob = accounts[2];
  const charlie = accounts[3];
  const invitor = accounts[4];

  beforeEach('deployment', async() => {

    this.ultra = await Ultra.new("Ultra token", "ULTRA");
    this.token = await Token.new();
    this.referral = await Referral.new(owner.address, false);
    now = new BN(Math.round(Date.now() / 1000));
    console.log("now = ", now.toString());
    this.staking = await Staking.new(
        this.ultra.address,
        this.referral.address,
        rewardPerSecond,
        now,
        firstPoolAllocPoint,
        firstPoolFeeBPS,
        owner.address
    );
    await this.ultra.grantRole(MINTER_ROLE, this.staking.address);
    await this.staking.setReferralOwnerWithdrawAwait(DAY);
    await this.staking.setReferralPercent(referralPercent);
    await this.staking.setMinReferralReward(minReferralReward);

    await this.ultra.grantRole(MINTER_ROLE, owner.address);
    await this.ultra.mint(alice.address, ONE_ETHER.mul(TEN));
    await this.ultra.mint(bob.address, ONE_ETHER.mul(TEN));
    await this.ultra.mint(charlie.address, ONE_ETHER.mul(TEN));

    await this.referral.register(invitor.address, {from: charlie.address});

  });

  describe('Staking tests', async () => {
    it('should correct set initial values', async() => {
        expect(await this.staking.rewardToken()).to.be.equal(this.ultra.address);
        expect(await this.staking.referralProgram()).to.be.equal(this.referral.address);
        expect(await this.staking.rewardPerSecond()).to.be.bignumber.equal(rewardPerSecond);
        expect(await this.staking.referralPercent()).to.be.bignumber.equal(referralPercent);
        expect(await this.staking.referralOwnerWithdrawAwait()).to.be.bignumber.equal(DAY);
        expect(await this.staking.feesCollected()).to.be.bignumber.equal(ZERO);
        expect(await this.staking.burnAddress()).to.be.equal(owner.address);
        expect(await this.staking.poolLength()).to.be.bignumber.equal(ONE);
        const poolInfo = await this.staking.poolInfo(0);
        expect(poolInfo.allocPoint).to.be.bignumber.equal(firstPoolAllocPoint);
        expect(poolInfo.lastRewardTime).to.be.bignumber.equal(now);
        expect(poolInfo.totalStaked).to.be.bignumber.equal(ZERO);
        expect(poolInfo.feePercentage).to.be.bignumber.equal(firstPoolFeeBPS);
        expect(await this.staking.stakeToken(0)).to.be.equal(this.ultra.address);
        expect(await this.staking.totalAllocPoint()).to.be.bignumber.equal(firstPoolAllocPoint);

    });    
    // xit('should correct give reward for one user', async() => {
        // await this.ultra.approve(this.staking.address, ONE_ETHER, {from: alice.address});
        // await this.staking.deposit(0, ONE_ETHER, alice.address, {from: alice.address});
        // await time.increaseTo(now.add(DAY.div(TWO)));

        // expect(await this.staking.pendingReward(0, alice.address)).to.be.bignumber.equal(ZERO);

        // await time.increaseTo(now.add(DAY));

        // console.log("real reward: ", (await this.staking.pendingReward(0, alice.address)).toString());
        // expect(ONE_ETHER.mul(DAY).sub(await this.staking.pendingReward(0, alice.address)).abs()).to.be.bignumber.lte(acceptableError);
        // expect(await this.staking.pendingReward(0, alice.address)).to.be.bignumber.gt(ZERO);

        // await this.staking.harvest(0, alice.address, {from: alice.address});
        // console.log("real balance: ", (await this.ultra.balanceOf(alice.address)).toString())
        // expect((await this.ultra.balanceOf(alice.address)).sub(ONE_ETHER.mul(DAY).sub(ONE_ETHER.mul(DAY).mul(firstPoolFeeBPS).div(BPS_BASE))).abs()).to.be.bignumber.lt(acceptableError);

        // now = now.add(DAY);
        
    // });

    it('should correct distribute reward for the users', async() => {
        // Alice deposits 1 token on the 0th day
        await this.ultra.approve(this.staking.address, ONE_ETHER, {from: alice.address});
        await this.staking.deposit(0, ONE_ETHER, alice.address, {from: alice.address});

        // Bob deposits 2 tokens on the 0.5th day
        await time.increaseTo(now.add(DAY.div(TWO)));
        await this.ultra.approve(this.staking.address, ONE_ETHER.mul(TWO), {from: bob.address});
        await this.staking.deposit(0, ONE_ETHER.mul(TWO), bob.address, {from: bob.address});

        // Charlie deposits 3 tokens on the 1st day
        await time.increaseTo(now.add(DAY));
        await this.ultra.approve(this.staking.address, ONE_ETHER.mul(THREE), {from: charlie.address});
        await this.staking.deposit(0, ONE_ETHER.mul(THREE), charlie.address, {from: charlie.address});

        console.log("real reward alice: ", (await this.staking.pendingReward(0, alice.address)).toString())
        const aliceCalcReward1 = ONE_ETHER.mul(DAY.div(TWO)).add(ONE_ETHER.mul(DAY.div(TWO)).div(THREE));
        console.log("calc reward alice: ", aliceCalcReward1.toString());
        expect(aliceCalcReward1.sub(await this.staking.pendingReward(0, alice.address)).abs()).to.be.bignumber.lte(acceptableError);
        expect(await this.staking.pendingReward(0, alice.address)).to.be.bignumber.gt(ZERO);

        expect(await this.staking.pendingReward(0, bob.address)).to.be.bignumber.equal(ZERO);

        expect(await this.staking.pendingReward(0, charlie.address)).to.be.bignumber.equal(ZERO);

        await expect(this.staking.harvest(0, bob.address, {from: bob.address})).to.be.revertedWith("Cannot harvest yet")

        await this.staking.harvest(0, alice.address, {from: alice.address});
        console.log("real balance: ", (await this.ultra.balanceOf(alice.address)).toString());
        console.log("calc balance: ", aliceCalcReward1.sub(aliceCalcReward1.mul(firstPoolFeeBPS).div(BPS_BASE)).toString());
        expect((await this.ultra.balanceOf(alice.address)).sub(aliceCalcReward1.sub(aliceCalcReward1.mul(firstPoolFeeBPS).div(BPS_BASE))).abs()).to.be.bignumber.lt(acceptableError);
        expect((await this.staking.feesCollected()).sub(aliceCalcReward1.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE))).to.be.bignumber.lt(acceptableError);
        expect(await this.staking.feesCollected()).to.be.bignumber.gt(ZERO);
        expect((await this.ultra.balanceOf(owner.address)).sub(aliceCalcReward1.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE)).abs()).to.be.bignumber.lt(acceptableError);
        expect(await this.ultra.balanceOf(owner.address)).to.be.bignumber.gt(ZERO);
        let ownerBalance = await this.ultra.balanceOf(owner.address);
        let feesCollected = await this.staking.feesCollected();

        expect(await this.staking.pendingReward(0, alice.address)).to.be.bignumber.equal(ZERO);

        await time.increaseTo(now.add(DAY.mul(THREE).div(TWO)).add(TWO));

        const bobCalcReward1 = ONE_ETHER.mul(DAY).div(TWO).mul(TWO).div(THREE).add(ONE_ETHER.mul(DAY).div(TWO).mul(TWO).div(SIX))
        console.log("real reward bob: ", (await this.staking.pendingReward(0, bob.address)).toString())
        console.log("calc reward bob: ", bobCalcReward1.toString());

        expect(bobCalcReward1.sub(await this.staking.pendingReward(0, bob.address)).abs()).to.be.bignumber.lt(acceptableError);

        await this.staking.harvest(0, bob.address, {from: bob.address});
        expect((await this.ultra.balanceOf(bob.address)).sub(bobCalcReward1.sub(bobCalcReward1.mul(firstPoolFeeBPS).div(BPS_BASE))).abs()).to.be.bignumber.lt(acceptableError);
        expect((await this.staking.feesCollected()).sub(feesCollected.add(bobCalcReward1.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE)))).to.be.bignumber.lt(acceptableError);
        expect(await this.staking.feesCollected()).to.be.bignumber.gt(ZERO);
        expect((await this.ultra.balanceOf(owner.address)).sub(ownerBalance.add(bobCalcReward1.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE))).abs()).to.be.bignumber.lt(acceptableError);
        expect(await this.ultra.balanceOf(owner.address)).to.be.bignumber.gt(ZERO);

        ownerBalance = await this.ultra.balanceOf(owner.address);
        feesCollected = await this.staking.feesCollected();

        expect(await this.staking.pendingReward(0, charlie.address)).to.be.bignumber.equal(ZERO);
        expect(await this.staking.pendingReward(0, alice.address)).to.be.bignumber.equal(ZERO);

        await expect(this.staking.harvest(0, alice.address, {from: alice.address})).to.be.revertedWith("Cannot harvest yet");

        await time.increaseTo(now.add(DAY.mul(TWO)).add(FIVE));

        const charlieCalcReward1 = ONE_ETHER.mul(DAY).mul(THREE).div(SIX);
        console.log("real reward charlie: ", (await this.staking.pendingReward(0, charlie.address)).toString())
        console.log("calc reward charlie: ", charlieCalcReward1.toString());
        expect(charlieCalcReward1.sub(await this.staking.pendingReward(0, charlie.address)).abs()).to.be.bignumber.lt(acceptableError);

        expect(await this.staking.referralDetails(invitor.address, 0)).to.be.bignumber.equal(ZERO);

        await this.staking.harvest(0, charlie.address, {from: charlie.address});
        console.log("referral: ", (await this.staking.referralDetails(invitor.address, 0)).toString());
        console.log("referral calc: ", charlieCalcReward1.mul(referralPercent).div(BPS_BASE).toString());
        expect((await this.staking.referralDetails(invitor.address, 0)).sub(charlieCalcReward1.mul(referralPercent).div(BPS_BASE)).abs()).to.be.bignumber.lt(acceptableError);
        await expect(this.staking.getReferralReward({from: invitor.address})).to.be.revertedWith("Not enough referral reward collected");
        await this.staking.setMinReferralReward(ZERO);
        await this.staking.getReferralReward({from: invitor.address});
        expect(await this.staking.referralDetails(invitor.address, 0)).to.be.bignumber.equal(ZERO);
        expect((await this.ultra.balanceOf(invitor.address)).sub(charlieCalcReward1.mul(referralPercent).div(BPS_BASE)).abs()).to.be.bignumber.lt(acceptableError);

        expect((await this.ultra.balanceOf(charlie.address)).sub(charlieCalcReward1.sub(charlieCalcReward1.mul(firstPoolFeeBPS).div(BPS_BASE))).abs()).to.be.bignumber.lt(acceptableError);
        expect((await this.staking.feesCollected()).sub(feesCollected.add(charlieCalcReward1.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE)))).to.be.bignumber.lt(acceptableError);
        expect(await this.staking.feesCollected()).to.be.bignumber.gt(ZERO);
        expect((await this.ultra.balanceOf(owner.address)).sub(ownerBalance.add(charlieCalcReward1.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE))).abs()).to.be.bignumber.lt(acceptableError);
        expect(await this.ultra.balanceOf(owner.address)).to.be.bignumber.gt(ZERO);

        ownerBalance = await this.ultra.balanceOf(owner.address);
        feesCollected = await this.staking.feesCollected();

        // await time.increaseTo(now.add(DAY.mul(FIVE).div(TWO)));
        const aliceCalcReward2 = ONE_ETHER.mul(DAY).div(SIX);
        console.log("real reward alice: ", (await this.staking.pendingReward(0, alice.address)).toString());
        console.log("calc reward alice: ", aliceCalcReward2.toString());
        expect(aliceCalcReward2.sub(await this.staking.pendingReward(0, alice.address)).abs()).to.be.bignumber.lt(acceptableError);

        await this.staking.harvest(0, alice.address, {from: alice.address});
        expect((await this.staking.feesCollected()).sub(feesCollected.add(aliceCalcReward2.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE)))).to.be.bignumber.lt(acceptableError);
        expect(await this.staking.feesCollected()).to.be.bignumber.gt(ZERO);
        expect((await this.ultra.balanceOf(owner.address)).sub(ownerBalance.add(aliceCalcReward2.mul(firstPoolFeeBPS).div(TWO).div(BPS_BASE))).abs()).to.be.bignumber.lt(acceptableError);
        expect(await this.ultra.balanceOf(owner.address)).to.be.bignumber.gt(ZERO);

        const newRewardPerSecond = ONE_ETHER.div(TWO);
        
        await this.staking.setRewardPerSecond(newRewardPerSecond, true);

        await time.increaseTo(now.add(DAY.mul(THREE)).add(TEN));

        const aliceCalcReward3 = newRewardPerSecond.mul(DAY).div(SIX);
        const bobCalcReward2 = newRewardPerSecond.mul(DAY).div(THREE).add(ONE_ETHER.mul(DAY).div(TWO).div(THREE));

        console.log("real reward alice: ", (await this.staking.pendingReward(0, alice.address)).toString());
        console.log("calc reward alice: ", aliceCalcReward3.toString());

        console.log("real reward bob: ", (await this.staking.pendingReward(0, bob.address)).toString());
        console.log("calc reward bob: ", bobCalcReward2.toString());


        expect((await this.staking.pendingReward(0, alice.address)).sub(aliceCalcReward3).abs()).to.be.bignumber.lt(acceptableError);
        expect((await this.staking.pendingReward(0, bob.address)).sub(bobCalcReward2).abs()).to.be.bignumber.lt(acceptableError);

        await this.staking.addPool(this.token.address, 100, 200, true);

        const aliceBalanceBefore = await this.ultra.balanceOf(alice.address);

        await this.staking.withdraw(0, ONE_ETHER, alice.address, {from: alice.address});
    
        const aliceInfo = await this.staking.userInfo(0, alice.address);
        expect(aliceInfo.amount).to.be.bignumber.equal(ZERO);
        expect((await this.ultra.balanceOf(alice.address)).sub(aliceBalanceBefore)).to.be.bignumber.equal(ONE_ETHER);

        const bobBalanceBefore = await this.ultra.balanceOf(bob.address);
        
        await this.staking.withdraw(0, ONE_ETHER.mul(TWO), bob.address, {from: bob.address});
    
        const bobInfo = await this.staking.userInfo(0, bob.address);
        expect(bobInfo.amount).to.be.bignumber.equal(ZERO);
        expect((await this.ultra.balanceOf(bob.address)).sub(bobBalanceBefore)).to.be.bignumber.equal(ONE_ETHER.mul(TWO));



        

    });

    

  });

});
