const axios = require('axios');
const defaultConfig = require('./config');
const { generateDeviceId, generateDeviceIdByUser, generateLoginHash, generateRegisterHash } = require('./crypto');
const { decodeJwtPayload } = require('./jwt');
const { createAxiosProxyConfig, normalizeProxyUrl } = require('./proxy');
const { getWalletInfoFromWS } = require('./ws');
const { getBankNameById } = require('./banks');

class SunwinClient {
  constructor(options = {}) {
    this.config = {
      ...defaultConfig,
      ...(options.config || {})
    };
    this.proxyUrl = normalizeProxyUrl(options.proxyUrl || this.config.defaultProxyUrl || '');
  }

  getAxiosConfig(options = {}) {
    const proxyUrl = normalizeProxyUrl(options.proxyUrl || this.proxyUrl);
    return {
      timeout: options.timeoutMs || this.config.timeoutMs,
      ...createAxiosProxyConfig(proxyUrl)
    };
  }

  buildLoginPayload({ username, password, deviceId = generateDeviceId() }) {
    return {
      command: 'loginHash',
      username,
      password,
      platformId: this.config.platformId,
      advId: '',
      deviceId,
      hash: generateLoginHash(
        username,
        password,
        deviceId,
        this.config.platformId,
        this.config.hsk
      ),
      brand: this.config.brand,
      sessionId: ''
    };
  }

  async login({ username, password, proxyUrl, timeoutMs } = {}) {
    const payload = this.buildLoginPayload({ username, password });
    const res = await axios.post(this.config.loginUrl, payload, this.getAxiosConfig({
      proxyUrl,
      timeoutMs
    }));
    return res.data;
  }

  buildRegisterPayload({
    username,
    password,
    displayName,
    deviceId = generateDeviceIdByUser(username),
    os = this.config.os,
    alsoLogin = true
  } = {}) {
    return {
      command: 'registerHash',
      username: username.toLowerCase(),
      password,
      displayName,
      platformId: this.config.platformId,
      advId: '',
      deviceId,
      os,
      alsoLogin,
      hash: generateRegisterHash(
        username,
        password,
        displayName,
        this.config.platformId,
        os,
        deviceId,
        this.config.hsk
      ),
      bundle: this.config.bundle,
      brand: this.config.brand,
      affId: this.config.affId
    };
  }

  async register({
    username,
    password,
    displayName,
    proxyUrl,
    os,
    deviceId,
    alsoLogin = true,
    timeoutMs
  } = {}) {
    const payload = this.buildRegisterPayload({
      username,
      password,
      displayName,
      deviceId,
      os,
      alsoLogin
    });

    const res = await axios.post(this.config.loginUrl, payload, this.getAxiosConfig({
      proxyUrl,
      timeoutMs
    }));

    const data = res.data;
    const success = data?.status === 0;

    if (success && alsoLogin && data.data) {
      return {
        success: true,
        data,
        account: this.parseAccountInfo(data),
        deviceId: payload.deviceId
      };
    }

    return {
      success,
      data,
      deviceId: payload.deviceId,
      message: data?.data?.message || data?.message
    };
  }

  parseAccountInfo(loginResponse) {
    if (!loginResponse || loginResponse.status !== 0 || !loginResponse.data) {
      throw new Error(loginResponse?.data?.message || 'Login failed');
    }

    const { wsToken, accessToken, info = {}, signature, expireIn } = loginResponse.data;
    const decoded = decodeJwtPayload(wsToken) || {};

    return {
      accessToken,
      wsToken,
      signature,
      expireIn,
      profile: {
        username: info.username || '',
        displayName: decoded.displayName || info.nickname || '',
        phone: decoded.phone || decoded.phoneNumber || '',
        email: decoded.email || '',
        info
      }
    };
  }

  async getBetHistory(accessToken, options = {}) {
    const res = await axios.get(this.config.transactionUrl, {
      ...this.getAxiosConfig(options),
      params: {
        command: 'fetch-user-transaction2',
        limit: options.limit || 5,
        skip: options.skip || 0,
        assetName: options.assetName || 'gold'
      },
      headers: {
        authorization: accessToken
      }
    });
    return res.data;
  }

  async getSlipHistory(accessToken, options = {}) {
    const res = await axios.get(this.config.paygateUrl, {
      ...this.getAxiosConfig(options),
      params: {
        command: 'fetchTransactionSlipHistory',
        slipType: options.slipType || 1,
        limit: options.limit || 5,
        skip: options.skip || 0
      },
      headers: {
        authorization: accessToken
      }
    });
    return res.data;
  }

  getDepositHistory(accessToken, options = {}) {
    return this.getSlipHistory(accessToken, { ...options, slipType: 1 });
  }

  getWithdrawHistory(accessToken, options = {}) {
    return this.getSlipHistory(accessToken, { ...options, slipType: 2 });
  }

  async paygateGet(accessToken, params, options = {}) {
    const res = await axios.get(this.config.paygateUrl, {
      ...this.getAxiosConfig(options),
      params,
      headers: {
        authorization: accessToken
      }
    });
    return res.data;
  }

  async userCreateBankAccount(accessToken, { bankId, accountHolder, accountNo, proxyUrl } = {}) {
    const data = await this.paygateGet(accessToken, {
      command: 'userCreateBankAccount',
      bankId,
      accountHolder,
      accountNo
    }, { proxyUrl });

    return {
      success: data?.status === 0,
      bankName: getBankNameById(bankId),
      data
    };
  }

  async createCodePay(accessToken, { bankAccountId, amount, bankId, proxyUrl } = {}) {
    const channelId = bankId || bankAccountId
    const data = await this.paygateGet(accessToken, {
      command: 'createCodePay',
      bankAccountId,
      amount,
      bankId: channelId
    }, { proxyUrl });

    const inner = data?.data || {}
    const pick = (...values) => {
      for (const value of values) {
        if (value != null && String(value).trim()) return String(value).trim()
      }
      return ''
    }

    const normalized = {
      ...inner,
      codepay: pick(inner.codepay, inner.code, inner.codePay),
      qrcode: pick(inner.qrcode, inner.qrCode, inner.qr_code),
      amount: inner.amount ?? amount ?? null,
      bankName: pick(inner.bankName, inner.bank_name, inner.bank, getBankNameById(channelId)),
      accountName: pick(
        inner.accountName,
        inner.account_name,
        inner.accountHolder,
        inner.holderName,
        inner.name,
        inner.receiverName
      ),
      bankAccount: pick(
        inner.bankAccount,
        inner.bank_account,
        inner.accountNo,
        inner.accountNumber,
        inner.stk,
        inner.receiverAccount
      ),
      content: pick(
        inner.content,
        inner.transferContent,
        inner.transfer_content,
        inner.description,
        inner.note,
        inner.noidung,
        inner.memo,
        inner.message,
        inner.transferMessage
      ),
      expiresAt: inner.expiresAt
        ?? inner.expireAt
        ?? inner.expiredAt
        ?? inner.expireTime
        ?? inner.expiredTime
        ?? inner.validTo
        ?? inner.validUntil
        ?? inner.endTime
        ?? inner.timeExpired
        ?? (typeof inner.expired === 'number' ? inner.expired : null),
      expireIn: inner.expireIn ?? inner.expireInSeconds ?? inner.ttl ?? null,
      createdAt: inner.createdAt ?? inner.createTime ?? inner.createdTime ?? null
    }

    return {
      success: data?.status === 0,
      data: {
        ...data,
        data: normalized
      }
    };
  }

  async fetchBankAccounts(accessToken, options = {}) {
    const data = await this.paygateGet(accessToken, {
      command: 'fetchBankAccounts'
    }, options);

    const inner = data?.data || {};

    return {
      success: data?.status === 0,
      data: {
        needVerifyBankAccount: inner.needVerifyBankAccount,
        verifiedAccountHolder: inner.verifiedAccountHolder || [],
        verifiedBankAccounts: (inner.verifiedBankAccounts || []).map((acc) => ({
          ...acc,
          bankName: getBankNameById(acc.bankId)
        }))
      }
    };
  }

  async getBankAccounts({ username, password, proxyUrl } = {}) {
    const loginResponse = await this.login({ username, password, proxyUrl });
    const info = this.parseAccountInfo(loginResponse);
    return this.fetchBankAccounts(info.accessToken, { proxyUrl });
  }

  async verifyBankAccount({ username, password, bankId, accountHolder, accountNo, proxyUrl } = {}) {
    const loginResponse = await this.login({ username, password, proxyUrl });
    const info = this.parseAccountInfo(loginResponse);
    return this.userCreateBankAccount(info.accessToken, {
      bankId,
      accountHolder,
      accountNo,
      proxyUrl
    });
  }

  async depositCodePay({ username, password, bankAccountId, amount, bankId, proxyUrl } = {}) {
    const loginResponse = await this.login({ username, password, proxyUrl });
    const info = this.parseAccountInfo(loginResponse);
    return this.createCodePay(info.accessToken, {
      bankAccountId,
      amount,
      bankId,
      proxyUrl
    });
  }

  async getWalletInfo({ wsToken, loginData, password, proxyUrl } = {}) {
    return getWalletInfoFromWS({
      token: wsToken,
      loginData,
      password,
      config: this.config,
      axiosConfig: this.getAxiosConfig({ proxyUrl })
    });
  }

  async getFullInfo({ username, password, proxyUrl, limit = 5 } = {}) {
    const loginResponse = await this.login({ username, password, proxyUrl });
    const info = this.parseAccountInfo(loginResponse);

    const [transactions, depositHistory, withdrawHistory, walletInfo] = await Promise.all([
      this.getBetHistory(info.accessToken, { limit, proxyUrl }).catch((err) => ({
        success: false,
        message: err.message
      })),
      this.getDepositHistory(info.accessToken, { limit, proxyUrl }).catch((err) => ({
        success: false,
        message: err.message
      })),
      this.getWithdrawHistory(info.accessToken, { limit, proxyUrl }).catch((err) => ({
        success: false,
        message: err.message
      })),
      this.getWalletInfo({
        wsToken: info.wsToken,
        loginData: loginResponse.data,
        password,
        proxyUrl
      })
    ]);

    return {
      success: true,
      data: {
        ...info,
        walletInfo,
        transactions,
        slipHistory: {
          deposit: depositHistory,
          withdraw: withdrawHistory
        }
      },
      loginResponse
    };
  }

  async changePassword({ username, password, newPassword, proxyUrl } = {}) {
    const loginResponse = await this.login({ username, password, proxyUrl });
    const info = this.parseAccountInfo(loginResponse);

    const res = await axios.get(this.config.loginUrl, {
      ...this.getAxiosConfig({ proxyUrl }),
      params: {
        command: 'changePass',
        oldPassword: password,
        newPassword
      },
      headers: {
        Authorization: info.accessToken,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
        Host: 'api.azhkthg1.net'
      }
    });

    return {
      success: res.data?.status === 0,
      data: res.data
    };
  }
}

module.exports = {
  SunwinClient
};
