// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IMintableERC20.sol";
import "./interfaces/IReferralProgram.sol";

contract StakingV2 is Ownable {
    using SafeERC20 for IMintableERC20;
    using SafeERC20 for IERC20;
    // Info of each user.
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;    
    }
    // Info of each pool.
    struct PoolInfo {
        uint128 accRewardPerShare; // Accumulated reward per share, times 1e12. See below.
        uint64 lastRewardPeriod; // Last block number that reward distribution occurs.
        uint64 allocPoint; // How many allocation points assigned to this pool. Reward to distribute per block.
    }
    // The reward token!
    IMintableERC20 public rewardToken;
    // Block number when bonus reward period ends.
    uint256 public bonusEndBlock;

    IReferralProgram public referralProgram;
    // Reward tokens created per block.
    uint256 public rewardPerPeriod;
    uint256 public periodDuration = 24 * 3600;
    uint256 public startTime;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Addresses of stake token contract.
    IERC20[] stakeToken; 
    // Info of each user that stakes stake tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when reward mining starts.

    uint256 private constant ACC_SUSHI_PRECISION = 1e12;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    event TokenChanged(uint256 pid, address oldTokenAddress, address newTokenAddress);
    event LogPoolAddition(uint256 indexed pid, uint256 allocPoint, IERC20 indexed stakeToken);
    event LogSetPool(uint256 indexed pid, uint256 allocPoint);
    event LogUpdatePool(uint256 indexed pid, uint64 lastRewardPeriod, uint256 stakedSupply, uint256 accSushiPerShare);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IMintableERC20 _rewardToken,
        uint256 _rewardPerPeriod,
        uint256 _bonusEndBlock//,
        // IReferralProgram _referralProgram
    ) {
        rewardToken = _rewardToken;
        rewardPerPeriod = _rewardPerPeriod;
        bonusEndBlock = _bonusEndBlock;
        startTime = block.timestamp;
        // referralProgram = _referralProgram;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new stake token to the pool. Can only be called by the owner.
    // XXX DO NOT add the same stake token more than once. Rewards will be messed up if you do.
    function add(
        uint256 _allocPoint,
        IERC20 _stakeToken,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastPeriod = (block.timestamp - startTime) / periodDuration;
            // block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(
            PoolInfo({
                accRewardPerShare: 0,
                lastRewardPeriod: uint64(lastPeriod),
                allocPoint: uint64(_allocPoint)
            })
        );
        stakeToken.push(_stakeToken);
        emit LogPoolAddition(stakeToken.length - 1, _allocPoint, _stakeToken);
    }

    // Update the given pool's reward allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint64 _allocPoint,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        emit LogSetPool(_pid, _allocPoint);
    }

    function changeStakeToken(uint256 _pid, IERC20 _newToken) public onlyOwner {
        require(address(_newToken) != address(0), "newTokenAddress is zero");
        uint256 bal = stakeToken[_pid].balanceOf(address(this));
        _newToken.transferFrom(_msgSender(), address(this), bal);
        require(_newToken.balanceOf(address(this)) == bal, "migrate: bad");
        emit TokenChanged(
            _pid, 
            address(stakeToken[_pid]), 
            address(_newToken)
        );
        stakeToken[_pid] = _newToken;
    }

    // View function to see pending reward on frontend.
    function pendingReward(uint256 _pid, address _user) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accSushiPerShare = pool.accRewardPerShare;
        uint256 lpSupply = stakeToken[_pid].balanceOf(address(this));
        uint256 numberOfPeriodsPassed = (block.timestamp - startTime) / periodDuration - pool.lastRewardPeriod;
        if (numberOfPeriodsPassed > 0 && lpSupply != 0) {
            uint256 sushiReward = numberOfPeriodsPassed * rewardPerPeriod * pool.allocPoint / totalAllocPoint;
            accSushiPerShare += sushiReward * ACC_SUSHI_PRECISION / lpSupply;
        }
        pending = uint256(int256(user.amount * accSushiPerShare / ACC_SUSHI_PRECISION) - user.rewardDebt);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    function updatePool(uint256 pid) public returns (PoolInfo memory pool) {
        pool = poolInfo[pid];
        uint256 numberOfPeriodsPassed = (block.timestamp - startTime) / periodDuration - pool.lastRewardPeriod;
        if (numberOfPeriodsPassed > 0) {
            uint256 lpSupply = stakeToken[pid].balanceOf(address(this));
            if (lpSupply > 0) {
                uint256 sushiReward = numberOfPeriodsPassed * rewardPerPeriod * pool.allocPoint / totalAllocPoint;
                rewardToken.mint(address(this), sushiReward);
                pool.accRewardPerShare += uint128(sushiReward * ACC_SUSHI_PRECISION / lpSupply);
            }
            pool.lastRewardPeriod = uint64(block.number);
            poolInfo[pid] = pool;
            emit LogUpdatePool(pid, pool.lastRewardPeriod, lpSupply, pool.accRewardPerShare);
        }
    }

    function deposit(uint256 pid, uint256 amount/* , address to */) public {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender/* to */];

        // Effects
        user.amount += amount;
        user.rewardDebt += int256(amount * pool.accRewardPerShare / ACC_SUSHI_PRECISION);

        // Interaction

        stakeToken[pid].safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, pid, amount/* , to */);
    }

    function withdraw(uint256 pid, uint256 amount/* , address to */) public {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];

        // Effects
        user.rewardDebt += int256(amount * pool.accRewardPerShare / ACC_SUSHI_PRECISION);
        user.amount -= amount;

        // Interactions
        
        stakeToken[pid].safeTransfer(msg.sender/* to */, amount);

        emit Withdraw(msg.sender, pid, amount/* , to */);
    }

    function getReward(uint256 pid, address to) public {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        int256 accumulatedSushi = int256(user.amount * pool.accRewardPerShare / ACC_SUSHI_PRECISION);
        uint256 _pendingSushi = uint256(accumulatedSushi - user.rewardDebt);

        // Effects
        user.rewardDebt = accumulatedSushi;

        // Interactions
        if (_pendingSushi != 0) {
            rewardToken.safeTransfer(to, _pendingSushi);
        }

        emit Harvest(msg.sender, pid, _pendingSushi);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        stakeToken[_pid].safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe reward transfer function, just in case if rounding error causes pool to not have enough reward tokens.
    function safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 rewardBal = rewardToken.balanceOf(address(this));
        if (_amount > rewardBal) {
            rewardToken.transfer(_to, rewardBal);
        } else {
            rewardToken.transfer(_to, _amount);
        }
    }

}
