const { mongoose } = require('../db')

const farmSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global' },
  autoCheckBank: { type: Boolean, default: false },
  defaultPassword: { type: String, default: 'abc123' },
  depositAmount: { type: Number, default: 100000 },
  defaultProxyId: { type: String, default: null }
}, { timestamps: true })

module.exports = mongoose.models.FarmSettings || mongoose.model('FarmSettings', farmSettingsSchema)
