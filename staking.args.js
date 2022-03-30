const {
    tokenAddress,
    referralAddress,
    rewardPerSecond,
    startTime,
    firstPoolAllocPoint,
    firstPoolFeePercentage,
    burnAddress
} = require("./scripts/deploy.js");

module.exports = [
    "0xbCb249bE67615e8B181E5e9C3d18C6bA35974015", // rewardToken address
    "0xe5Bb2B356975B3B2c1cA28A07B1b129675833c73", //referralAddress
    rewardPerSecond,
    startTime,
    firstPoolAllocPoint,
    firstPoolFeePercentage,
    burnAddress
]