const { mongoose } = require('../db')

const gameAccountSchema = new mongoose.Schema({
  accountHolder: { type: String, required: true, index: true },
  holderPassword: { type: String, default: '' },
  bankId: { type: String, default: '' },
  bankName: { type: String, default: 'Vietcombank' },
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, default: '' },
  accountNo: { type: String, default: '', index: true },
  bankRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankRecord', default: null },
  usageStatus: {
    type: String,
    enum: ['unused', 'used'],
    default: 'unused',
    index: true
  },
  note: { type: String, default: '' },
  displayName: { type: String, default: '' },
  proxyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProxyGateway', default: null },
  status: {
    type: String,
    enum: ['pending', 'registered', 'bank_pending', 'bank_verified', 'deposited', 'error'],
    default: 'pending',
    index: true
  },
  assignedTo: { type: String, default: '', index: true },
  verifiedBankAccounts: { type: Array, default: [] },
  verifiedAccountHolder: { type: Array, default: [] },
  depositInfo: { type: mongoose.Schema.Types.Mixed, default: null },
  lastWallet: { type: mongoose.Schema.Types.Mixed, default: null },
  lastWalletAt: { type: Date, default: null },
  lastError: { type: String, default: '' },
  lastCheckAt: { type: Date, default: null },
  updatedBy: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.models.GameAccount || mongoose.model('GameAccount', gameAccountSchema)
