// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IRWRD.sol";
import "./interfaces/IReferral.sol";
import "./interfaces/IRWRD.sol";


contract StakingV2 is Ownable {
    using SafeERC20 for IRWRD;
    using SafeERC20 for IERC20;
    // Info of each user.
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;   
        uint256 enteredAt; 
    }

    // Info of each pool.
    struct PoolInfo {
        uint64 allocPoint; // How many allocation points assigned to this pool. Reward to distribute per block.
        uint64 lastRewardTime;
        uint128 accRewardPerShare; // Accumulated reward per share, times 1e12. See below.
        uint256 totalStaked;
        uint16 feePercentage;
    }

    uint16 public constant PERCENT_BASE = 10000;
    uint24 public constant DAY = 86400;

    // The reward token!
    IRWRD public rewardToken;

    IReferral public referralProgram;
    // Reward tokens created per block.
    uint256 public rewardPerSecond;
    uint256 public periodDuration = 24 * 3600;
    uint256 public startTime;
    uint256 public referralPercent;
    uint256 public minReferralReward;
    uint256 public referralOwnerWithdrawAwait;

    uint256 public feesCollected;
    address public burnAddress;

    uint256 public lastBalance;
    uint256 public payedRewardForPeriod;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Addresses of stake token contract.
    IERC20[] public stakeToken; 
    // Info of each user that stakes stake tokens.
    mapping(address => bool) public excludedFromFee;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(address => uint256) public exists;
    mapping(address => uint256[2]) public referralDetails;

    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when reward mining starts.

    uint256 private constant ACC_SUSHI_PRECISION = 1e12;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount, address to);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, address to);
    event Harvest(address indexed user, uint256 indexed pid, uint256 amount, address to);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IRWRD _rewardToken, 
        IReferral _referralProgram,
        uint256 _rewardPerSecond,
        uint256 _startTime, 
        uint256 _firstPoolAllocPoint, 
        uint16 _firstPoolFeePercentage, 
        address _burnAddress
    ) {
        require(_firstPoolFeePercentage <= PERCENT_BASE, "Cannot set fee higher than 100%");
        require(_burnAddress != address(0), "Cannot set zero address");
        rewardToken = _rewardToken;
        referralProgram = _referralProgram;
        rewardPerSecond = _rewardPerSecond;
        startTime = _startTime;
        totalAllocPoint = _firstPoolAllocPoint;
        poolInfo.push(
            PoolInfo({
                allocPoint: uint64(_firstPoolAllocPoint),
                lastRewardTime: uint64(_startTime),
                accRewardPerShare: 0,
                totalStaked: 0,
                feePercentage: _firstPoolFeePercentage
            })
        );
        stakeToken.push(_rewardToken);
        burnAddress = _burnAddress;

    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // View function to see pending reward on frontend.
    function pendingReward(uint256 _pid, address _user) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        if (!excludedFromFee[_msgSender()] && block.timestamp < user.enteredAt + DAY) return 0;
        uint256 accSushiPerShare = pool.accRewardPerShare;
        uint256 supply = pool.totalStaked;
        if (block.timestamp > pool.lastRewardTime && supply != 0) {
            uint256 multiplier = block.timestamp - pool.lastRewardTime;
            uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
            pool.accRewardPerShare += uint128((reward * ACC_SUSHI_PRECISION) / supply);
        }
        pending = uint256(int256(user.amount * pool.accRewardPerShare / ACC_SUSHI_PRECISION) - user.rewardDebt);
    }

    // Add a new stake token to the pool. Can only be called by the owner.
    // XXX DO NOT add the same stake token more than once. Rewards will be messed up if you do.
    function addPool(address _token, uint256 _allocPoint, uint16 _feePercentage, bool _withUpdate) external onlyOwner {
        require(_token != address(rewardToken) && exists[_token] == 0, "Pool already exists");
        require(_feePercentage <= PERCENT_BASE, "Cannot set fee higher than 100%");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        exists[_token] = poolInfo.length;
        poolInfo.push(
            PoolInfo({
                allocPoint: uint64(_allocPoint),
                lastRewardTime: uint64(lastRewardTime),
                accRewardPerShare: 0,
                totalStaked: 0,
                feePercentage: _feePercentage
            })
        );
        stakeToken.push(IERC20(_token));
    }

     /**
    @notice function to set reward per second
    @param _rewardPerSecond new reward per second
    @param _withUpdate should always be 'true'
    */
    function setRewardPerSecond(uint256 _rewardPerSecond, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        rewardPerSecond = _rewardPerSecond;
    }

    function excludeFromFee(address[] calldata accounts) external onlyOwner {
        for (uint256 i; i < accounts.length; i++) {
            excludedFromFee[accounts[i]] = true;
        }
    }

    function includeInFee(address[] calldata accounts) external onlyOwner {
        for (uint256 i; i < accounts.length; i++) {
            excludedFromFee[accounts[i]] = false;
        }
    }    

    /**
    @notice function to set pool allocation points
    @param _pid pool ID
    @param _allocPoint new allocation points
    @param _withUpdate should always be 'true'
    */
    function setPoolAllocPoint(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = (totalAllocPoint - poolInfo[_pid].allocPoint) + _allocPoint;
        poolInfo[_pid].allocPoint = uint64(_allocPoint);
    }

    /**
    @notice function to set pool fee percentage
    @param _pid pool ID
    @param _feePercentage new fee percentage
    */
    function setPoolFeePercentage(uint256 _pid, uint16 _feePercentage) external onlyOwner {
        require(_feePercentage <= PERCENT_BASE, "Cannot set fee higher than 100%");
        poolInfo[_pid].feePercentage = _feePercentage;
    }

    /**
    @notice function to set burn address
    @param _burnAddress new burn address
    */
    function setBurnAddress(address _burnAddress) external onlyOwner {
        require(_burnAddress != address(0), "Cannot set zero address");
        burnAddress = _burnAddress;
    }

    /**
    @notice function to set referral program
    @param _referralProgram new referral program address
    */
    function setReferralProgram(IReferral _referralProgram) external onlyOwner {
        referralProgram = _referralProgram;
    }

    /**
    @notice function to set owner withdrawal await time for referral program
    @param _referralOwnerWithdrawAwait new owner withdrawal await time for referral program
    */
    function setReferralOwnerWithdrawAwait(uint256 _referralOwnerWithdrawAwait) external onlyOwner {
        referralOwnerWithdrawAwait = _referralOwnerWithdrawAwait;
    }

    /**
    @notice function to set referral program percentage
    @param _referralPercent new referral program percentage
    */
    function setReferralPercent(uint256 _referralPercent) external onlyOwner {
        referralPercent = _referralPercent;
    }

    /**
    @notice function to set a minimum required referral reward
    @param _minReferralReward new minimum required referral reward
    */
    function setMinReferralReward(uint256 _minReferralReward) external onlyOwner {
        minReferralReward = _minReferralReward;
    }

    /**
    @notice function to get a referral reward for a given user
    @param account given user address
    */
    function getReferralRewardFor(address account) external onlyOwner {
        require(referralDetails[account][1] + referralOwnerWithdrawAwait <= block.timestamp, "Not enough time passed");
        rewardToken.mint(_msgSender(), referralDetails[account][0]);
        referralDetails[account][0] = 0;
        if (account != address(0)) {
            referralDetails[account][1] = block.timestamp;
        }
    }

    /**
    @notice function to get owner fees
    */
    function getFees() external onlyOwner {
        rewardToken.safeTransfer(_msgSender(), feesCollected);
        feesCollected = 0;
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
        if (block.timestamp <= pool.lastRewardTime) {
            return pool;
        }
        uint256 numberOfPeriodsPassed = block.timestamp - pool.lastRewardTime;
        if (numberOfPeriodsPassed > 0) {
            uint256 lpSupply = pool.totalStaked;
            if (lpSupply > 0) {
                uint256 sushiReward = numberOfPeriodsPassed * rewardPerSecond * pool.allocPoint / totalAllocPoint;
                rewardToken.mint(address(this), sushiReward);
                pool.accRewardPerShare += uint128(sushiReward * ACC_SUSHI_PRECISION / lpSupply);
            }
            pool.lastRewardTime = uint64(block.timestamp);
            poolInfo[pid] = pool;
        }
    }

    function deposit(uint256 pid, uint256 amount, address to) public {
        require(amount > 0, "Cannot deposit zero");
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];

        // Effects
        user.amount += amount;
        user.rewardDebt += int256(amount * pool.accRewardPerShare / ACC_SUSHI_PRECISION);
        user.enteredAt = block.timestamp > startTime ? block.timestamp : startTime;
        poolInfo[pid].totalStaked += amount;

        // Interaction

        stakeToken[pid].safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, pid, amount, to);
    }

    function withdraw(uint256 pid, uint256 amount, address to) public {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][to];

        // Effects
        user.rewardDebt -= int256(amount * pool.accRewardPerShare / ACC_SUSHI_PRECISION);
        user.amount -= amount;
        poolInfo[pid].totalStaked -= amount;

        // Interactions
        
        stakeToken[pid].safeTransfer(to, amount);

        emit Withdraw(msg.sender, pid, amount, to);
    }

    function harvest(uint256 pid, address to) public {
        PoolInfo memory pool = updatePool(pid);
        UserInfo storage user = userInfo[pid][msg.sender];
        int256 accumulatedReward = int256(user.amount * pool.accRewardPerShare / ACC_SUSHI_PRECISION);
        uint256 _pendingReward = uint256(accumulatedReward - user.rewardDebt);

        require(excludedFromFee[_msgSender()] || user.enteredAt + DAY <= block.timestamp, "Cannot harvest yet");
        if (_pendingReward > 0) {
            _giveRewards(_pendingReward, pool.feePercentage);
        }

        user.rewardDebt = accumulatedReward; 
        user.enteredAt = block.timestamp > startTime ? block.timestamp : startTime;

        // Effects

        emit Harvest(msg.sender, pid, _pendingReward, to);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        stakeToken[_pid].safeTransfer(address(msg.sender), user.amount);
        // emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
        pool.totalStaked -= user.amount;

    }

    /**
    @notice function to get referral program reward for caller
    */
    function getReferralReward() external {
        require(referralDetails[_msgSender()][0] >= minReferralReward, "Not enough referral reward collected");
        rewardToken.mint(_msgSender(), referralDetails[_msgSender()][0]);
        referralDetails[_msgSender()][0] = 0;
        referralDetails[_msgSender()][1] = block.timestamp;
    }

    function _giveRewards(uint256 rewardAmount, uint256 feePercentage) private {
        if (excludedFromFee[_msgSender()]) {
            rewardToken.safeTransfer(_msgSender(), rewardAmount);
            return;
        }
        uint256 fees = rewardAmount - ((rewardAmount * (PERCENT_BASE - feePercentage)) / PERCENT_BASE);
        uint256 half = fees / 2;
        if (half > 0) {
            rewardToken.safeTransfer(burnAddress, half);
        }
        feesCollected += fees - half;
        address referrer = referralProgram.referrers(_msgSender());
        referralDetails[referrer][0] += (rewardAmount * referralPercent) / PERCENT_BASE;
        if (referralDetails[referrer][1] == 0 && referrer != address(0)) {
            referralDetails[referrer][1] = block.timestamp > startTime ? block.timestamp : startTime;
        }
        rewardAmount -= fees;
        if (rewardAmount > 0) {
            rewardToken.safeTransfer(_msgSender(), rewardAmount);
        }
    }

}

//TODO Reentrancy guard
