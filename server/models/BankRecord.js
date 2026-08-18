const { mongoose } = require('../db')

const bankRecordSchema = new mongoose.Schema({
  bankId: { type: String, required: true },
  bankName: { type: String, required: true },
  accountHolder: { type: String, required: true, index: true },
  accountNo: { type: String, required: true },
  username: { type: String, default: '' },
  password: { type: String, default: '' },
  usageStatus: {
    type: String,
    enum: ['available', 'reserved', 'used'],
    default: 'available',
    index: true
  },
  reservedBy: { type: String, default: '' },
  reservedAt: { type: Date, default: null },
  gameAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameAccount', default: null },
  note: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  updatedBy: { type: String, default: '' }
}, { timestamps: true })

bankRecordSchema.index({ accountHolder: 1, accountNo: 1 }, { unique: true })

module.exports = mongoose.models.BankRecord || mongoose.model('BankRecord', bankRecordSchema)
