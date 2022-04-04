// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IRWRD.sol";

contract MockStaking is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 enteredAt;
    }

    IRWRD public immutable REWARD_TOKEN;

    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    uint256 private _pendingReward;

    constructor(IRWRD _rewardToken) {
        REWARD_TOKEN = _rewardToken;
    }

    function pendingReward(uint256 _pid, address _user) external view returns(uint256) {
        return _pendingReward;
    }

    function setPendingReward(uint256 pendingReward_) external {
        _pendingReward = pendingReward_;
    }

    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        IERC20(REWARD_TOKEN).safeTransferFrom(msg.sender, address(this), _amount);
        userInfo[_pid][msg.sender].amount += _amount;
    }

    function harvest(uint256 _pid) external nonReentrant {
        REWARD_TOKEN.mint(msg.sender, _pendingReward);
        _pendingReward = 0;
    }

    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        IERC20(REWARD_TOKEN).safeTransfer(msg.sender, _amount);
        userInfo[_pid][msg.sender].amount -= _amount;
    }

    function emergencyWithdraw(uint256 _pid) external nonReentrant {

    }
}
