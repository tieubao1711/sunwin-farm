const CryptoJS = require('crypto-js');

function generateDeviceId(length = 16) {
  const chars = '0123456789abcdef';
  let result = '';

  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * 16)];
  }

  return result;
}

function generateLoginHash(username, password, deviceId, platformId, hsk) {
  return CryptoJS.MD5(`${username}${password}${platformId}${deviceId}${hsk}`).toString();
}

function generateDeviceIdByUser(username) {
  const md5Hash = CryptoJS.MD5(username).toString();
  return md5Hash.substring(8, 24);
}

function generateRegisterHash(username, password, displayName, platformId, os, deviceId, hsk) {
  const rawString = `${username.toLowerCase()}${password}${displayName}${platformId}${os}${deviceId}${hsk}`;
  return CryptoJS.MD5(rawString).toString();
}

module.exports = {
  generateDeviceId,
  generateDeviceIdByUser,
  generateLoginHash,
  generateRegisterHash
};
