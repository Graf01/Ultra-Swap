// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IStaking.sol";
import "hardhat/console.sol";

contract AutoStaking is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 shares;
        uint256 lastDepositedTime;
    }

    mapping(address => UserInfo) public userInfo;

    IERC20 public immutable TOKEN;
    IStaking public immutable STAKING;

    uint256 public fees;

    uint256 public totalShares;

    uint256 public performanceFee = 200;
    uint256 public restakeReward = 25;
    uint256 public withdrawFee = 10;
    uint256 public withdrawFeePeriod = 72 hours;

    event Deposit(address indexed sender, uint256 amount, uint256 shares, uint256 lastDepositedTime);
    event Withdraw(address indexed sender, uint256 amount, uint256 shares);
    event Restake(address indexed sender, uint256 performanceFee, uint256 restakeReward);

    constructor(IERC20 _token, IStaking _staking) {
        TOKEN = _token;
        STAKING = _staking;
        _token.safeApprove(address(_staking), type(uint256).max);
    }

    modifier notContract() {
        require(!Address.isContract(_msgSender()), "Contract not allowed");
        require(_msgSender() == tx.origin, "Contract not allowed");
        _;
    }

    function calculateRestakeReward() external view returns(uint256) {
        return ((STAKING.pendingReward(0, address(this)) + _balance()) * restakeReward) / 10000;
    }

    function deposit(uint256 _amount) external whenNotPaused nonReentrant notContract {
        require(_amount > 0, "Nothing to deposit");

        uint256 pool = total();
        TOKEN.safeTransferFrom(_msgSender(), address(this), _amount);

        uint256 currentShares;
        if (totalShares != 0) {
            currentShares = _amount * totalShares / pool;
        } else {
            currentShares = _amount;
        }
        require(currentShares > 0, "Too low amount to deposit");
        UserInfo storage user = userInfo[_msgSender()];
        user.shares += currentShares;
        user.lastDepositedTime = block.timestamp;
        totalShares += currentShares;

        _deposit();

        emit Deposit(_msgSender(), _amount, currentShares, block.timestamp);
    }

    function restake() external whenNotPaused nonReentrant notContract {
        STAKING.harvest(0, address(this));

        uint256 bal = _balance();
        uint256 currentPerformanceFee = bal * performanceFee / 10000;
        fees += currentPerformanceFee;

        uint256 currentRestakeReward = bal * restakeReward / 10000;
        TOKEN.safeTransfer(_msgSender(), currentRestakeReward);

        _deposit();

        emit Restake(_msgSender(), currentPerformanceFee, currentRestakeReward);
    }

    function withdraw(uint256 _shares) public nonReentrant notContract {
        UserInfo storage user = userInfo[_msgSender()];
        require(_shares > 0, "Nothing to withdraw");
        require(_shares <= user.shares, "Withdraw amount exceeds balance");

        uint256 currentAmount = total() * _shares / totalShares;
        user.shares -= _shares;
        totalShares -= _shares;

        _getAmountNeeded(currentAmount);

        if (block.timestamp < user.lastDepositedTime + withdrawFeePeriod) {
            uint256 currentWithdrawFee = currentAmount * withdrawFee / 10000;
            fees += currentWithdrawFee;
            currentAmount -= currentWithdrawFee;
        }
        console.log("currentAmount = ", currentAmount);
        // console.log("needed     = ", needed);


        TOKEN.safeTransfer(_msgSender(), currentAmount);



        emit Withdraw(_msgSender(), currentAmount, _shares);
    }

    function doApprove() external {
        TOKEN.safeApprove(address(STAKING), type(uint256).max);
    }

    function setPerformanceFee(uint256 _performanceFee) external onlyOwner {
        performanceFee = _performanceFee;
    }

    function setRestakeReward(uint256 _restakeReward) external onlyOwner {
        restakeReward = _restakeReward;
    }

    function setWithdrawFee(uint256 _withdrawFee) external onlyOwner {
        withdrawFee = _withdrawFee;
    }

    function setWithdrawFeePeriod(uint256 _withdrawFeePeriod) external onlyOwner {
        withdrawFeePeriod = _withdrawFeePeriod;
    }

    function emergencyWithdraw() external onlyOwner {
        STAKING.emergencyWithdraw(0);
    }

    function getToken(IERC20 _token) external onlyOwner {
        if (_token == TOKEN) {
            _token.safeTransfer(_msgSender(), fees);
            fees = 0;
        }
        else {
            _token.safeTransfer(_msgSender(), _token.balanceOf(address(this)));
        }
    }

    function pause() external onlyOwner whenNotPaused {
        _pause();
    }

    function unpause() external onlyOwner whenPaused {
        _unpause();
    }

    function total() public view returns(uint256) {
        (uint256 amount, , ) = STAKING.userInfo(0, address(this));
        console.log("AutoStaking: total(): amount  = ", amount);
        console.log("AutoStaking: total(): fees    = ", fees);
        console.log("AutoStaking: total(): balance = ", TOKEN.balanceOf(address(this)));
        return _balance() + amount;
    }

    function _getAmountNeeded(uint256 amount) private {
        if (_balance() >= amount) {
            return;
        }
        uint256 needed = amount - _balance();
        if (STAKING.pendingReward(0, address(this)) > 0) {
            STAKING.harvest(0, address(this));
            if (_balance() >= amount) {
                return;
            }
            needed = amount - _balance();
        }

        STAKING.withdraw(0, needed, address(this));
    }

    function _balance() private view returns(uint256) {
        return TOKEN.balanceOf(address(this)) - fees;
    }

    function _deposit() private {
        uint256 balance = _balance();
        if (balance > 0) {
            STAKING.deposit(0, balance, address(this));
        }
    }
}