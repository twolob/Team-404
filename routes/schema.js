// MongoDB Schema Definitions
const applicantSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  traditionalData: {
    income: Number,
    employmentStatus: String,
    existingCreditScore: Number,
  },
  alternativeData: {
    utilityPayments: [{
      provider: String,
      paymentHistory: [Boolean],
      averagePaymentDelay: Number
    }],
    socialMediaMetrics: {
      profileStability: Number,
      networkStrength: Number,
      sentimentScore: Number
    },
    transactionHistory: [{
      category: String,
      amount: Number,
      frequency: Number
    }],
    geoLocationData: {
      residentialStability: Number,
      workplaceStability: Number
    }
  },
  riskScore: Number,
  riskFactors: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Applicant', applicantSchema);