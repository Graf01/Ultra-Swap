// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IRWRD.sol";
import "./interfaces/IReferral.sol";

contract Staking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 enteredAt;
    }

    struct PoolInfo {
        IERC20 token;
        uint256 allocPoint;
        uint256 lastRewardTime;
        uint256 accRewardPerShare;
        uint256 totalStaked;
        uint16 feePercentage;
    }

    uint16 public constant PERCENT_BASE = 10000;
    uint24 public constant DAY = 86400;

    IRWRD public immutable REWARD_TOKEN;
    IReferral public referralProgram;

    uint256 public rewardPerSecond;
    uint256 public totalAllocPoint;
    uint256 public startTime;

    uint256 public referralPercent;
    uint256 public minReferralReward;
    uint256 public referralOwnerWithdrawAwait;

    uint256 public feesCollected;
    address public burnAddress;

    PoolInfo[] public poolInfo;
    mapping(address => bool) public excludedFromFee;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    mapping(address => uint256) public exists;
    mapping(address => uint256[2]) public referralDetails;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(IRWRD _rewardToken, IReferral _referralProgram, uint256 _rewardPerSecond, uint256 _startTime, uint256 _firstPoolAllocPoint, uint16 _firstPoolFeePercentage, address _burnAddress) {
        require(_firstPoolFeePercentage <= PERCENT_BASE, "Cannot set fee higher than 100%");
        require(_burnAddress != address(0), "Cannot set zero address");
        REWARD_TOKEN = _rewardToken;
        referralProgram = _referralProgram;
        rewardPerSecond = _rewardPerSecond;
        startTime = _startTime;
        totalAllocPoint = _firstPoolAllocPoint;
        poolInfo.push(
            PoolInfo({
                token: _rewardToken,
                allocPoint: _firstPoolAllocPoint,
                lastRewardTime: _startTime,
                accRewardPerShare: 0,
                totalStaked: 0,
                feePercentage: _firstPoolFeePercentage
            })
        );
        burnAddress = _burnAddress;
    }

    /**
    @notice function to know length of poolInfo
    */
    function poolLength() external view returns(uint256) {
        return poolInfo.length;
    }

    /**
    @notice function to know pending reward of a given user in a given pool
    @param _pid pool ID
    @param _user given user address
    */
    function pendingReward(uint256 _pid, address _user) external view returns(uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 supply = pool.totalStaked;
        if (block.timestamp > pool.lastRewardTime && supply != 0) {
            uint256 multiplier = block.timestamp - pool.lastRewardTime;
            uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / supply;
        }
        return ((user.amount * accRewardPerShare) / 1e12) - user.rewardDebt;
    }

    /**
    @notice function to create a new pool
    @param _token staked token address
    @param _allocPoint allocation points
    @param _feePercentage fee percentage
    @param _withUpdate should always be 'true'
    */
    function addPool(address _token, uint256 _allocPoint, uint16 _feePercentage, bool _withUpdate) external onlyOwner {
        require(_token != address(REWARD_TOKEN) && exists[_token] == 0, "Pool already exists");
        require(_feePercentage <= PERCENT_BASE, "Cannot set fee higher than 100%");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        exists[_token] = poolInfo.length;
        poolInfo.push(
            PoolInfo({
                token: IERC20(_token),
                allocPoint: _allocPoint,
                lastRewardTime: lastRewardTime,
                accRewardPerShare: 0,
                totalStaked: 0,
                feePercentage: _feePercentage
            })
        );
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
        poolInfo[_pid].allocPoint = _allocPoint;
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
        REWARD_TOKEN.mint(_msgSender(), referralDetails[account][0]);
        referralDetails[account][0] = 0;
        if (account != address(0)) {
            referralDetails[account][1] = block.timestamp;
        }
    }

    /**
    @notice function to get owner fees
    */
    function getFees() external onlyOwner {
        REWARD_TOKEN.mint(_msgSender(), feesCollected);
        feesCollected = 0;
    }

    /**
    @notice function to deposit a given token amount to a given pool
    @param _pid pool ID
    @param _amount token amount
    */
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot deposit zero");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = ((user.amount * pool.accRewardPerShare) / 1e12) - user.rewardDebt;
            _giveRewards(pending, pool.feePercentage);
        }
        pool.token.safeTransferFrom(_msgSender(), address(this), _amount);
        user.enteredAt = block.timestamp > startTime ? block.timestamp : startTime;
        user.amount += (_amount);
        pool.totalStaked += _amount;
        user.rewardDebt = user.amount * (pool.accRewardPerShare) / (1e12);
        emit Deposit(_msgSender(), _pid, _amount);
    }

    /**
    @notice function to withdraw a given token amount from a given pool
    @param _pid pool ID
    @param _amount token amount, should be zero for only getting rewards
    */
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        require(user.amount >= _amount, "Cannot withdraw this much");
        require(excludedFromFee[_msgSender()] || user.enteredAt + DAY <= block.timestamp, "Cannot withdraw yet");
        updatePool(_pid);
        uint256 pending = ((user.amount * pool.accRewardPerShare) / (1e12)) - user.rewardDebt;
        _giveRewards(pending, pool.feePercentage);
        user.enteredAt = block.timestamp > startTime ? block.timestamp : startTime;
        user.amount -= _amount;
        pool.totalStaked -= _amount;
        user.rewardDebt = (user.amount * (pool.accRewardPerShare)) / 1e12;
        pool.token.safeTransfer(_msgSender(), _amount);
        emit Withdraw(_msgSender(), _pid, _amount);
    }

    /**
    @notice function to withdraw all token amount from a given pool, doesn't transfer rewards, should be called in emergency scenario
    @param _pid pool ID
    */
    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        pool.token.safeTransfer(_msgSender(), user.amount);
        pool.totalStaked -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        emit EmergencyWithdraw(_msgSender(), _pid, user.amount);
    }

    /**
    @notice function to get referral program reward for caller
    */
    function getReferralReward() external nonReentrant {
        require(referralDetails[_msgSender()][0] >= minReferralReward, "Not enough referral reward collected");
        REWARD_TOKEN.mint(_msgSender(), referralDetails[_msgSender()][0]);
        referralDetails[_msgSender()][0] = 0;
        referralDetails[_msgSender()][1] = block.timestamp;
    }

    /**
    @notice function to manually update all existing pools
    */
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /**
    @notice function to manually update a given pool
    @param _pid pool ID
    */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.timestamp <= pool.lastRewardTime) {
            return;
        }
        uint256 supply = pool.totalStaked;
        if (supply == 0) {
            pool.lastRewardTime = block.timestamp;
            return;
        }
        uint256 multiplier = block.timestamp - pool.lastRewardTime;
        uint256 reward = (multiplier * rewardPerSecond * pool.allocPoint) / totalAllocPoint;
        pool.accRewardPerShare += (reward * 1e12) / supply;
        pool.lastRewardTime = block.timestamp;
    }

    function _giveRewards(uint256 rewardAmount, uint256 feePercentage) private {
        if (excludedFromFee[_msgSender()]) {
            REWARD_TOKEN.mint(_msgSender(), rewardAmount);
            return;
        }
        uint256 fees = rewardAmount - ((rewardAmount * (PERCENT_BASE - feePercentage)) / PERCENT_BASE);
        uint256 half = fees / 2;
        if (half > 0) {
            REWARD_TOKEN.mint(burnAddress, half);
        }
        feesCollected += fees - half;
        address referrer = referralProgram.referrers(_msgSender());
        referralDetails[referrer][0] += (rewardAmount * referralPercent) / PERCENT_BASE;
        if (referralDetails[referrer][1] == 0 && referrer != address(0)) {
            referralDetails[referrer][1] = block.timestamp > startTime ? block.timestamp : startTime;
        }
        rewardAmount -= fees;
        if (rewardAmount > 0) {
            REWARD_TOKEN.mint(_msgSender(), rewardAmount);
        }
    }
}
