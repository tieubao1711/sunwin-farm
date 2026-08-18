const { mongoose } = require('../db')

const proxyGatewaySchema = new mongoose.Schema({
  raw: { type: String, required: true, unique: true },
  type: { type: String, enum: ['rotating'], default: 'rotating' },
  maxSlots: { type: Number, default: 0 },
  note: { type: String, default: '' },
  createdBy: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.models.ProxyGateway || mongoose.model('ProxyGateway', proxyGatewaySchema)
