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

    uint256 public referralPercent = 400;
    uint256 public minReferralReward;
    uint256 public referralOwnerWithdrawAwait;

    uint256 public feesCollected;
    address public burnAddress;

    PoolInfo[] public poolInfo;
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

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function pendingReward(uint256 _pid, address _user) external view returns(uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 supply = pool.totalStaked;
        if (block.timestamp > pool.lastRewardTime && supply != 0) {
            uint256 multiplier = block.timestamp - pool.lastRewardTime;
            uint256 reward = (multiplier * (rewardPerSecond) * (pool.allocPoint)) / (totalAllocPoint);
            accRewardPerShare += (reward * (1e12) / (supply));
        }
        return (user.amount * (accRewardPerShare) / (1e12)) - (user.rewardDebt);
    }

    function addPool(address _token, uint256 _allocPoint, uint16 _feePercentage, bool _withUpdate) external onlyOwner {
        require(_token != address(REWARD_TOKEN) && exists[_token] == 0, "Pool already exists");
        require(_feePercentage <= PERCENT_BASE, "Cannot set fee higher than 100%");
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint + (_allocPoint);
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

    function setRewardPerSecond(uint256 _rewardPerSecond, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        rewardPerSecond = _rewardPerSecond;
    }

    function setPoolAllocPoint(uint256 _pid, uint256 _allocPoint, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = (totalAllocPoint - (poolInfo[_pid].allocPoint)) + (_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function setPoolFeePercentage(uint256 _pid, uint16 _feePercentage) external onlyOwner {
        require(_feePercentage <= PERCENT_BASE, "Cannot set fee higher than 100%");
        poolInfo[_pid].feePercentage = _feePercentage;
    }

    function setBurnAddress(address _burnAddress) external onlyOwner {
        require(_burnAddress != address(0), "Cannot set zero address");
        burnAddress = _burnAddress;
    }

    function setReferralProgram(IReferral _referralProgram) external onlyOwner {
        referralProgram = _referralProgram;
    }

    function setMinReferralReward(uint256 _minReferralReward) external onlyOwner {
        minReferralReward = _minReferralReward;
    }

    function setReferralOwnerWithdrawAwait(uint256 _referralOwnerWithdrawAwait) external onlyOwner {
        referralOwnerWithdrawAwait = _referralOwnerWithdrawAwait;
    }

    function setReferralPercent(uint256 _referralPercent) external onlyOwner {
        referralPercent = _referralPercent;
    }

    function getReferralRewardFor(address account) external onlyOwner {
        require(referralDetails[account][1] + referralOwnerWithdrawAwait <= block.timestamp, "Not enough time passed");
        REWARD_TOKEN.mint(_msgSender(), referralDetails[account][0]);
        referralDetails[account][0] = 0;
        referralDetails[account][1] = block.timestamp;
    }

    function getFees() external onlyOwner {
        REWARD_TOKEN.mint(_msgSender(), feesCollected);
        feesCollected = 0;
    }

    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot deposit zero");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = (user.amount * (pool.accRewardPerShare) / (1e12)) - (user.rewardDebt);
            _giveRewards(pending, pool.feePercentage);
        }
        pool.token.safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
        user.enteredAt = block.timestamp;
        user.amount += (_amount);
        pool.totalStaked += _amount;
        user.rewardDebt = user.amount * (pool.accRewardPerShare) / (1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "Cannot withdraw this much");
        require(_amount > 0 || user.enteredAt + DAY >= block.timestamp, "Cannot get rewards yet");
        updatePool(_pid);
        uint256 pending = (user.amount * (pool.accRewardPerShare) / (1e12)) - (user.rewardDebt);
        _giveRewards(pending, pool.feePercentage);
        user.enteredAt = block.timestamp;
        user.amount -= (_amount);
        pool.totalStaked -= _amount;
        user.rewardDebt = user.amount * (pool.accRewardPerShare) / (1e12);
        pool.token.safeTransfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.token.safeTransfer(address(msg.sender), user.amount);
        pool.totalStaked -= user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
    }

    function getReferralReward() external nonReentrant {
        require(referralDetails[_msgSender()][0] >= minReferralReward, "Not enough referral reward collected");
        REWARD_TOKEN.mint(_msgSender(), referralDetails[_msgSender()][0]);
        referralDetails[_msgSender()][0] = 0;
        referralDetails[_msgSender()][1] = block.timestamp;
    }

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

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
        uint256 reward = multiplier * (rewardPerSecond) * (pool.allocPoint) / (totalAllocPoint);
        pool.accRewardPerShare += (reward * (1e12) / (supply));
        pool.lastRewardTime = block.timestamp;
    }

    function _giveRewards(uint256 rewardAmount, uint256 feePercentage) private {
        uint256 fees = rewardAmount - ((rewardAmount * (PERCENT_BASE - feePercentage)) / PERCENT_BASE);
        uint256 half = fees / 2;
        if (half > 0) {
            REWARD_TOKEN.mint(burnAddress, half);
        }
        feesCollected += fees - half;
        address referrer = referralProgram.referrers(_msgSender());
        referralDetails[referrer][0] += (rewardAmount * referralPercent) / PERCENT_BASE;
        if (referralDetails[referrer][1] == 0) {
            referralDetails[referrer][1] = startTime;
        }
        rewardAmount -= fees;
        if (rewardAmount > 0) {
            REWARD_TOKEN.mint(_msgSender(), rewardAmount - fees);
        }
    }
}
