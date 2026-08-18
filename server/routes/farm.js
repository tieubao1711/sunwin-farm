const express = require('express')
const BankRecord = require('../models/BankRecord')
const GameAccount = require('../models/GameAccount')
const ProxyGateway = require('../models/ProxyGateway')
const ActivityLog = require('../models/ActivityLog')
const { parseAccountBlocks } = require('./accountImport')
const { SUNWIN_BANKS } = require('./farmHelpers')
const DEFAULT_BANK = SUNWIN_BANKS[0] || { id: '', name: 'Vietcombank' }
const {
  toId,
  parseBankLines,
  getAccountStats,
  logActivity,
  getSettings,
  generateUsername
} = require('./farmHelpers')

const router = express.Router()

function getEmployee(req) {
  return (req.headers['x-employee-name'] || '').trim() || 'system'
}

function mapProxy(doc) {
  const item = toId(doc)
  return {
    id: item.id,
    raw: item.raw,
    type: item.type,
    maxSlots: item.maxSlots,
    note: item.note || '',
    createdAt: item.createdAt
  }
}

function mapAccount(doc) {
  const item = toId(doc)
  return {
    id: item.id,
    accountHolder: item.accountHolder || '',
    holderPassword: item.holderPassword || '',
    username: item.username,
    password: item.password || item.holderPassword || '',
    displayName: item.displayName || `${item.username}d`,
    proxyId: item.proxyId ? String(item.proxyId) : null,
    bankId: item.bankId || '',
    bankName: item.bankName || '',
    accountNo: item.accountNo || '',
    bankRecordId: item.bankRecordId ? String(item.bankRecordId) : null,
    usageStatus: item.usageStatus || 'unused',
    status: item.status || 'pending',
    assignedTo: item.assignedTo || '',
    note: item.note || '',
    verifiedBankAccounts: item.verifiedBankAccounts || [],
    verifiedAccountHolder: item.verifiedAccountHolder || [],
    depositInfo: item.depositInfo,
    lastWallet: item.lastWallet || null,
    lastWalletAt: item.lastWalletAt || null,
    lastError: item.lastError || '',
    lastCheckAt: item.lastCheckAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

function mapBank(doc) {
  const item = toId(doc)
  return {
    id: item.id,
    bankId: item.bankId,
    bankName: item.bankName,
    accountHolder: item.accountHolder,
    accountNo: item.accountNo,
    username: item.username || '',
    password: item.password || '',
    usageStatus: item.usageStatus,
    reservedBy: item.reservedBy || '',
    reservedAt: item.reservedAt,
    gameAccountId: item.gameAccountId ? String(item.gameAccountId) : null,
    note: item.note || '',
    createdBy: item.createdBy || '',
    updatedBy: item.updatedBy || '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }
}

async function loadFarmState() {
  const [proxies, accounts, settingsDoc, bankRecords] = await Promise.all([
    ProxyGateway.find().sort({ createdAt: -1 }),
    GameAccount.find().sort({ accountHolder: 1, createdAt: 1 }),
    getSettings(),
    BankRecord.find({}, 'usageStatus')
  ])

  const proxyDocs = proxies.map(mapProxy)
  const accountDocs = accounts.map(mapAccount)

  return {
    proxies: proxyDocs,
    accounts: accountDocs,
    settings: {
      autoCheckBank: settingsDoc.autoCheckBank,
      defaultPassword: settingsDoc.defaultPassword,
      depositAmount: settingsDoc.depositAmount
    },
    stats: {
      ...getAccountStats(accounts, proxies),
      accountUnused: accounts.filter((a) => a.usageStatus === 'unused').length,
      accountUsed: accounts.filter((a) => a.usageStatus === 'used').length,
      bankAvailable: bankRecords.filter((b) => b.usageStatus === 'available').length,
      bankReserved: bankRecords.filter((b) => b.usageStatus === 'reserved').length,
      bankUsed: bankRecords.filter((b) => b.usageStatus === 'used').length,
      banksTotal: bankRecords.length
    }
  }
}

router.get('/state', async (_req, res) => {
  try {
    const data = await loadFarmState()
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.patch('/settings', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const settingsDoc = await getSettings()
    Object.assign(settingsDoc, req.body || {})
    await settingsDoc.save()
    await logActivity(employee, 'update_settings', 'settings', settingsDoc._id, JSON.stringify(req.body))
    res.json({ success: true, data: settingsDoc })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/proxies/import', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const lines = String(req.body.text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const existing = new Set((await ProxyGateway.find({}, 'raw')).map((p) => p.raw))
    const added = []

    for (const raw of lines) {
      if (existing.has(raw)) continue
      existing.add(raw)
      const doc = await ProxyGateway.create({
        raw,
        maxSlots: req.body.maxSlots != null ? Number(req.body.maxSlots) : 0,
        createdBy: employee
      })
      added.push(mapProxy(doc))
    }

    await logActivity(employee, 'import_proxies', 'proxy', '', `${added.length} proxy`)
    res.json({ success: true, data: { added: added.length, proxies: added } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.patch('/proxies/:id', async (req, res) => {
  try {
    const doc = await ProxyGateway.findByIdAndUpdate(req.params.id, req.body || {}, { new: true })
    if (!doc) return res.status(404).json({ success: false, message: 'Proxy not found' })
    res.json({ success: true, data: mapProxy(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.delete('/proxies/:id', async (req, res) => {
  try {
    const usage = await GameAccount.countDocuments({ proxyId: req.params.id })
    if (usage > 0) {
      return res.status(400).json({ success: false, message: `Proxy đang phục vụ ${usage} tài khoản` })
    }
    await ProxyGateway.findByIdAndDelete(req.params.id)
    await logActivity(getEmployee(req), 'delete_proxy', 'proxy', req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/accounts', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const doc = await GameAccount.create({ ...req.body, updatedBy: employee })
    await logActivity(employee, 'create_account', 'account', doc._id, doc.username)
    res.json({ success: true, data: mapAccount(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/accounts/extra-with-bank', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const settingsDoc = await getSettings()
    const password = req.body.password || settingsDoc.defaultPassword || 'abc123'
    const count = Math.min(20, Math.max(1, Number(req.body.count) || 1))

    let bank = {
      bankId: req.body.bankId || '',
      bankName: req.body.bankName || '',
      accountHolder: (req.body.accountHolder || '').trim(),
      accountNo: (req.body.accountNo || '').trim(),
      bankRecordId: req.body.bankRecordId || null
    }

    if (req.body.sourceAccountId) {
      const source = await GameAccount.findById(req.body.sourceAccountId)
      if (!source) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy acc nguồn để copy bank' })
      }
      bank = {
        bankId: source.bankId,
        bankName: source.bankName,
        accountHolder: source.accountHolder,
        accountNo: source.accountNo,
        bankRecordId: source.bankRecordId
      }
    }

    if (!bank.accountHolder || !bank.accountNo) {
      return res.status(400).json({ success: false, message: 'Thiếu chủ khoản hoặc STK để trùng bank' })
    }

    const existingUsernames = new Set(
      (await GameAccount.find({}, 'username')).map((doc) => doc.username.toLowerCase())
    )

    const created = []
    for (let i = 0; i < count; i += 1) {
      const username = generateUsername(existingUsernames)
      existingUsernames.add(username.toLowerCase())
      const doc = await GameAccount.create({
        accountHolder: bank.accountHolder,
        holderPassword: password,
        password,
        bankId: bank.bankId,
        bankName: bank.bankName,
        accountNo: bank.accountNo,
        bankRecordId: bank.bankRecordId,
        username,
        displayName: `${username}d`,
        status: 'pending',
        usageStatus: 'unused',
        assignedTo: employee,
        note: `acc thêm · trùng STK ${bank.accountNo}`,
        updatedBy: employee
      })
      created.push(mapAccount(doc))
    }

    await logActivity(
      employee,
      'extra_accounts',
      'account',
      '',
      `${created.length} acc random trùng STK ${bank.accountNo}`
    )

    res.json({
      success: true,
      data: { created: created.length, accounts: created }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/accounts/from-bank-holder', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const holder = (req.body.accountHolder || '').trim()
    const bankId = (req.body.bankId || '').trim()
    const allowReuse = req.body.allowReuse !== false
    const settingsDoc = await getSettings()
    const password = req.body.password || settingsDoc.defaultPassword || 'abc123'

    if (!holder) {
      return res.status(400).json({ success: false, message: 'Thiếu chủ khoản' })
    }

    const bankFilter = {
      accountHolder: new RegExp(`^${holder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      gameAccountId: null,
      $or: [
        { usageStatus: 'available' },
        { usageStatus: 'reserved', reservedBy: employee }
      ]
    }
    if (bankId) bankFilter.bankId = bankId

    let banks = await BankRecord.find(bankFilter).sort({ accountNo: 1 })
    let reuseMode = false

    if (banks.length === 0 && allowReuse) {
      const reuseFilter = {
        accountHolder: new RegExp(`^${holder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      }
      if (bankId) reuseFilter.bankId = bankId
      banks = await BankRecord.find(reuseFilter).sort({ accountNo: 1 })
      reuseMode = banks.length > 0
    }

    if (banks.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có STK nào cho chủ khoản này' })
    }

    const existingUsernames = new Set(
      (await GameAccount.find({}, 'username')).map((doc) => doc.username.toLowerCase())
    )

    const created = []
    const skipped = []

    for (const bank of banks) {
      try {
        const username = generateUsername(existingUsernames)
        const doc = await GameAccount.create({
          accountHolder: bank.accountHolder,
          holderPassword: password,
          password,
          bankId: bank.bankId,
          bankName: bank.bankName,
          accountNo: bank.accountNo,
          bankRecordId: bank._id,
          username,
          displayName: `${username}d`,
          status: 'pending',
          usageStatus: 'unused',
          assignedTo: employee,
          updatedBy: employee
        })

        if (!reuseMode) {
          await BankRecord.findByIdAndUpdate(bank._id, {
            usageStatus: 'reserved',
            reservedBy: employee,
            reservedAt: new Date(),
            gameAccountId: doc._id,
            username: doc.username,
            password,
            updatedBy: employee
          })
        }

        created.push(mapAccount(doc))
      } catch (err) {
        skipped.push({ accountNo: bank.accountNo, reason: err.message })
      }
    }

    await logActivity(
      employee,
      'create_from_bank',
      'account',
      '',
      `${created.length} acc từ ${holder}${reuseMode ? ' (reuse STK)' : ''}`
    )

    res.json({
      success: true,
      data: { created: created.length, skipped, accounts: created, reuseMode }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/accounts/recreate', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(Boolean) : []
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Chưa chọn account' })
    }

    const existingUsernames = new Set(
      (await GameAccount.find({}, 'username')).map((doc) => doc.username.toLowerCase())
    )

    const recreated = []
    const skipped = []

    for (const id of ids) {
      const account = await GameAccount.findById(id)
      if (!account) {
        skipped.push({ id, reason: 'not_found' })
        continue
      }
      if (account.status === 'bank_verified') {
        skipped.push({ id, username: account.username, reason: 'bank_ok' })
        continue
      }

      const oldUsername = account.username
      const username = generateUsername(existingUsernames)
      existingUsernames.add(username.toLowerCase())

      const doc = await GameAccount.findByIdAndUpdate(id, {
        username,
        displayName: `${username}d`,
        status: 'pending',
        usageStatus: 'unused',
        proxyId: null,
        lastError: '',
        depositInfo: null,
        verifiedBankAccounts: [],
        verifiedAccountHolder: [],
        note: [account.note, `recreate từ ${oldUsername}`].filter(Boolean).join(' · '),
        updatedBy: employee
      }, { new: true })

      if (account.bankRecordId) {
        await BankRecord.findByIdAndUpdate(account.bankRecordId, {
          username,
          usageStatus: 'reserved',
          reservedBy: employee,
          reservedAt: new Date(),
          gameAccountId: account._id,
          updatedBy: employee
        })
      }

      recreated.push(mapAccount(doc))
    }

    await logActivity(
      employee,
      'recreate_accounts',
      'account',
      '',
      `${recreated.length} acc mới từ STK cũ`
    )

    res.json({
      success: true,
      data: { created: recreated.length, skipped, accounts: recreated }
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.patch('/accounts/:id', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const doc = await GameAccount.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: employee },
      { new: true }
    )
    if (!doc) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, data: mapAccount(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.delete('/accounts/:id', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const account = await GameAccount.findById(req.params.id)
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })

    await GameAccount.findByIdAndDelete(req.params.id)
    await logActivity(employee, 'delete_account', 'account', req.params.id, account.username)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/accounts/grouped', async (_req, res) => {
  try {
    const accounts = await GameAccount.find().sort({ accountHolder: 1, createdAt: 1 })
    const map = new Map()

    for (const doc of accounts) {
      const holder = doc.accountHolder || 'CHUA CO TEN'
      if (!map.has(holder)) {
        map.set(holder, {
          accountHolder: holder,
          bankId: doc.bankId || DEFAULT_BANK.id,
          bankName: doc.bankName || DEFAULT_BANK.name,
          holderPassword: doc.holderPassword || doc.password || '',
          rows: [],
          total: 0,
          unused: 0,
          used: 0
        })
      }
      const group = map.get(holder)
      const row = mapAccount(doc)
      if (!group.bankName && row.bankName) group.bankName = row.bankName
      if (!group.bankId && row.bankId) group.bankId = row.bankId
      group.rows.push(row)
      group.total += 1
      if (row.usageStatus === 'used') group.used += 1
      else group.unused += 1
      if (doc.holderPassword) group.holderPassword = doc.holderPassword
    }

    res.json({ success: true, data: [...map.values()] })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/accounts/import-sheet', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const { groups, accounts } = parseAccountBlocks(req.body.text, {
      bankId: req.body.bankId || DEFAULT_BANK.id,
      bankName: req.body.bankName || DEFAULT_BANK.name
    })

    const created = []
    const skipped = []

    for (const row of accounts) {
      try {
        const doc = await GameAccount.create({
          ...row,
          displayName: `${row.username}d`,
          status: 'pending',
          updatedBy: employee
        })
        created.push(mapAccount(doc))
      } catch (err) {
        skipped.push({ username: row.username, reason: err.message })
      }
    }

    await logActivity(employee, 'import_sheet', 'account', '', `${created.length} acc / ${groups.length} chủ`)
    res.json({ success: true, data: { groups: groups.length, created: created.length, skipped, accounts: created } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/banks/select-groups', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const docs = await BankRecord.find({}).sort({ bankName: 1, accountHolder: 1, accountNo: 1 })

    const map = new Map()
    for (const doc of docs) {
      const key = `${doc.bankId}|${doc.accountHolder}`
      if (!map.has(key)) {
        map.set(key, {
          bankId: doc.bankId,
          bankName: doc.bankName,
          accountHolder: doc.accountHolder,
          stkCount: 0,
          freeCount: 0,
          usedCount: 0
        })
      }
      const group = map.get(key)
      group.stkCount += 1
      if (
        !doc.gameAccountId &&
        (doc.usageStatus === 'available' || (doc.usageStatus === 'reserved' && doc.reservedBy === employee))
      ) {
        group.freeCount += 1
      } else {
        group.usedCount += 1
      }
    }

    res.json({ success: true, data: [...map.values()] })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/banks', async (req, res) => {
  try {
    const filter = {}
    if (req.query.holder) filter.accountHolder = new RegExp(req.query.holder, 'i')
    if (req.query.status) filter.usageStatus = req.query.status

    const docs = await BankRecord.find(filter).sort({ accountHolder: 1, accountNo: 1 })
    res.json({ success: true, data: docs.map(mapBank) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/banks/grouped', async (req, res) => {
  try {
    const filter = {}
    if (req.query.status) filter.usageStatus = req.query.status

    const rows = await BankRecord.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$accountHolder',
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$usageStatus', 'available'] }, 1, 0] } },
          reserved: { $sum: { $cond: [{ $eq: ['$usageStatus', 'reserved'] }, 1, 0] } },
          used: { $sum: { $cond: [{ $eq: ['$usageStatus', 'used'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ])

    res.json({ success: true, data: rows.map((row) => ({
      accountHolder: row._id,
      total: row.total,
      available: row.available,
      reserved: row.reserved,
      used: row.used
    })) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/banks', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const doc = await BankRecord.create({ ...req.body, createdBy: employee, updatedBy: employee })
    await logActivity(employee, 'create_bank', 'bank', doc._id, `${doc.accountHolder} · ${doc.accountNo}`)
    res.json({ success: true, data: mapBank(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/banks/import', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const lines = parseBankLines(req.body.text)
    const created = []
    const skipped = []

    for (const line of lines) {
      if (!line.valid) {
        skipped.push({ raw: line.raw, reason: 'invalid_format' })
        continue
      }

      try {
        const doc = await BankRecord.create({
          bankId: line.bankId,
          bankName: line.bankName,
          accountHolder: line.accountHolder,
          accountNo: line.accountNo,
          note: line.note,
          createdBy: employee,
          updatedBy: employee
        })
        created.push(mapBank(doc))
      } catch (err) {
        skipped.push({ raw: line.raw, reason: err.message })
      }
    }

    await logActivity(employee, 'import_banks', 'bank', '', `${created.length} bank`)
    res.json({ success: true, data: { created: created.length, skipped, banks: created } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.patch('/banks/:id', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const doc = await BankRecord.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: employee },
      { new: true }
    )
    if (!doc) return res.status(404).json({ success: false, message: 'Bank not found' })
    res.json({ success: true, data: mapBank(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.delete('/banks/:id', async (req, res) => {
  try {
    const doc = await BankRecord.findById(req.params.id)
    if (!doc) return res.status(404).json({ success: false, message: 'Bank not found' })
    if (doc.usageStatus === 'used') {
      return res.status(400).json({ success: false, message: 'Bank đã sử dụng, không thể xóa' })
    }
    await BankRecord.findByIdAndDelete(req.params.id)
    await logActivity(getEmployee(req), 'delete_bank', 'bank', req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/banks/:id/reserve', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const doc = await BankRecord.findOneAndUpdate(
      { _id: req.params.id, usageStatus: 'available' },
      { usageStatus: 'reserved', reservedBy: employee, reservedAt: new Date(), updatedBy: employee },
      { new: true }
    )
    if (!doc) {
      return res.status(409).json({ success: false, message: 'Bank không còn trống hoặc đã bị giữ' })
    }
    await logActivity(employee, 'reserve_bank', 'bank', doc._id, `${doc.accountHolder} · ${doc.accountNo}`)
    res.json({ success: true, data: mapBank(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/banks/:id/release', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const doc = await BankRecord.findOneAndUpdate(
      { _id: req.params.id, usageStatus: 'reserved' },
      { usageStatus: 'available', reservedBy: '', reservedAt: null, updatedBy: employee },
      { new: true }
    )
    if (!doc) {
      return res.status(409).json({ success: false, message: 'Chỉ bank đang giữ mới được trả' })
    }
    await logActivity(employee, 'release_bank', 'bank', doc._id)
    res.json({ success: true, data: mapBank(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/banks/assign-accounts', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const accountIds = req.body.accountIds || []
    const holder = (req.body.accountHolder || '').trim()
    const onlyMine = Boolean(req.body.onlyMine)

    const accounts = await GameAccount.find({
      _id: { $in: accountIds },
      status: 'registered'
    }).sort({ createdAt: -1 })

    if (accounts.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có tài khoản phù hợp' })
    }

    const bankFilter = { usageStatus: { $in: ['available', 'reserved'] } }
    if (holder) bankFilter.accountHolder = new RegExp(`^${holder}$`, 'i')
    if (onlyMine) bankFilter.$or = [{ usageStatus: 'available' }, { reservedBy: employee }]

    const banks = await BankRecord.find(bankFilter).sort({ usageStatus: -1, accountHolder: 1, accountNo: 1 })
    const pairs = []
    const count = Math.min(accounts.length, banks.length)

    for (let i = 0; i < count; i += 1) {
      const account = accounts[i]
      const bank = banks[i]

      await GameAccount.findByIdAndUpdate(account._id, {
        bankRecordId: bank._id,
        bankId: bank.bankId,
        bankName: bank.bankName,
        accountHolder: bank.accountHolder,
        accountNo: bank.accountNo,
        assignedTo: employee,
        updatedBy: employee
      })

      await BankRecord.findByIdAndUpdate(bank._id, {
        usageStatus: 'reserved',
        reservedBy: employee,
        reservedAt: new Date(),
        username: account.username,
        password: account.password,
        gameAccountId: account._id,
        updatedBy: employee
      })

      pairs.push({ accountId: String(account._id), bankId: String(bank._id) })
    }

    await logActivity(employee, 'assign_banks', 'bank', '', `${pairs.length} cặp`)
    res.json({ success: true, data: { matched: pairs.length, pairs } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.post('/banks/mark-used/:id', async (req, res) => {
  try {
    const employee = getEmployee(req)
    const doc = await BankRecord.findByIdAndUpdate(
      req.params.id,
      { usageStatus: 'used', updatedBy: employee },
      { new: true }
    )
    if (!doc) return res.status(404).json({ success: false, message: 'Bank not found' })
    await logActivity(employee, 'mark_bank_used', 'bank', doc._id)
    res.json({ success: true, data: mapBank(doc) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const docs = await ActivityLog.find().sort({ createdAt: -1 }).limit(limit)
    res.json({
      success: true,
      data: docs.map((doc) => ({
        id: String(doc._id),
        employeeName: doc.employeeName,
        action: doc.action,
        entityType: doc.entityType,
        entityId: doc.entityId,
        detail: doc.detail,
        createdAt: doc.createdAt
      }))
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

router.get('/employees', async (_req, res) => {
  try {
    const names = await ActivityLog.distinct('employeeName')
    res.json({ success: true, data: names.filter(Boolean).sort() })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
