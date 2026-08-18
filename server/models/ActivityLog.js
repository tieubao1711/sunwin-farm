const { mongoose } = require('../db')

const activityLogSchema = new mongoose.Schema({
  employeeName: { type: String, required: true, index: true },
  action: { type: String, required: true },
  entityType: { type: String, default: '' },
  entityId: { type: String, default: '' },
  detail: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema)
