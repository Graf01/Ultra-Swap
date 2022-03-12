// SPDX-License-Identifier: MIT

pragma solidity 0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

contract ReferralProgram is Ownable {

    using SignatureChecker for address;
    
    mapping (address => address) public referrers;

    address public backendAddress;

    bool public signatureCheck;

    constructor(
        address _backendAddress,
        bool _signatureCheck
    ) {
        backendAddress = _backendAddress;
        signatureCheck = _signatureCheck;
    }

    event NewUser(address user, address invitor);

    function setSignatureCheck(bool _status) external onlyOwner {
        signatureCheck = _status;
    }
    function registrate(address _invitor) external {
        require(!signatureCheck, "signature required");
        require(_msgSender() != _invitor, "user cannot be own invitor");
        referrers[_msgSender()] = _invitor;
        emit NewUser(_msgSender(), _invitor);
    }

    function registrate(address _invitor, bytes memory _signature) external {
        require(signatureCheck, "signature not required");
        require(backendAddress.isValidSignatureNow(keccak256(abi.encodePacked(_msgSender(), _invitor)), _signature), "signature is invalid");
        referrers[_msgSender()] = _invitor;
        emit NewUser(_msgSender(), _invitor);
    }


    function registrateUser(address _user, address _invitor) external onlyOwner {
        referrers[_user] = _invitor;
        emit NewUser(_user, _invitor);
    }



}