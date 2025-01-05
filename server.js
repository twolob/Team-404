// Required dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
// Models imports
const Applicant = require('/routes/schema')

// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Utility Functions
const calculateRiskScore = async (traditionalData, alternativeData) => {
  // Weight factors for different components
  const weights = {
    income: 0.2,
    creditScore: 0.15,
    utilityPayments: 0.15,
    socialMedia: 0.1,
    transactions: 0.2,
    geoLocation: 0.2
  };

  // Calculate component scores
  const incomeScore = Math.min(traditionalData.income / 100000, 1) * 100;
  const creditScore = traditionalData.existingCreditScore || 50;
  
  // Utility payments score
  const utilityScore = alternativeData.utilityPayments.reduce((acc, curr) => {
    const paymentReliability = curr.paymentHistory.filter(Boolean).length / curr.paymentHistory.length;
    return acc + (paymentReliability * 100);
  }, 0) / alternativeData.utilityPayments.length;

  // Social media score
  const socialScore = (
    alternativeData.socialMediaMetrics.profileStability +
    alternativeData.socialMediaMetrics.networkStrength +
    alternativeData.socialMediaMetrics.sentimentScore
  ) / 3;

  // Transaction score
  const transactionScore = alternativeData.transactionHistory.reduce((acc, curr) => {
    return acc + (curr.frequency * (curr.amount > 0 ? 1 : -1));
  }, 0);
  const normalizedTransactionScore = Math.min(Math.max(transactionScore, 0), 100);

  // Geo-location score
  const geoScore = (
    alternativeData.geoLocationData.residentialStability +
    alternativeData.geoLocationData.workplaceStability
  ) / 2;

  // Calculate final weighted score
  const finalScore = (
    weights.income * incomeScore +
    weights.creditScore * creditScore +
    weights.utilityPayments * utilityScore +
    weights.socialMedia * socialScore +
    weights.transactions * normalizedTransactionScore +
    weights.geoLocation * geoScore
  );

  return Math.min(Math.max(finalScore, 0), 100);
};

const generateRiskFactors = (applicant) => {
  const factors = [];
  
  if (applicant.traditionalData.income < 30000) {
    factors.push('Low income level');
  }
  
  const utilityReliability = applicant.alternativeData.utilityPayments.every(
    payment => payment.paymentHistory.filter(Boolean).length / payment.paymentHistory.length > 0.8
  );
  if (!utilityReliability) {
    factors.push('Inconsistent utility payments');
  }

  if (applicant.alternativeData.socialMediaMetrics.sentimentScore < 0.6) {
    factors.push('Negative social media presence');
  }

  return factors;
};

// API Routes
// Submit new application
app.post('/api/applications', async (req, res) => {
  try {
    const applicationData = req.body;
    
    // Calculate risk score
    const riskScore = await calculateRiskScore(
      applicationData.traditionalData,
      applicationData.alternativeData
    );
    
    // Generate risk factors
    const riskFactors = generateRiskFactors(applicationData);
    
    // Create new application
    const applicant = new Applicant({
      ...applicationData,
      riskScore,
      riskFactors
    });
    
    await applicant.save();
    
    res.status(201).json({
      success: true,
      data: {
        applicationId: applicant._id,
        riskScore,
        riskFactors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get application details
app.get('/api/applications/:id', async (req, res) => {
  try {
    const applicant = await Applicant.findById(req.params.id);
    if (!applicant) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: applicant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update application data
app.put('/api/applications/:id', async (req, res) => {
  try {
    const applicationData = req.body;
    const riskScore = await calculateRiskScore(
      applicationData.traditionalData,
      applicationData.alternativeData
    );
    const riskFactors = generateRiskFactors(applicationData);
    
    const applicant = await Applicant.findByIdAndUpdate(
      req.params.id,
      {
        ...applicationData,
        riskScore,
        riskFactors
      },
      { new: true }
    );
    
    if (!applicant) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: applicant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get risk score explanation
app.get('/api/applications/:id/explanation', async (req, res) => {
  try {
    const applicant = await Applicant.findById(req.params.id);
    if (!applicant) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }
    
    const explanation = {
      overallScore: applicant.riskScore,
      factors: applicant.riskFactors,
      components: {
        traditionalMetrics: {
          income: applicant.traditionalData.income,
          creditScore: applicant.traditionalData.existingCreditScore,
          impact: '35% of total score'
        },
        alternativeMetrics: {
          utilityPayments: {
            reliability: applicant.alternativeData.utilityPayments.map(p => ({
              provider: p.provider,
              reliability: (p.paymentHistory.filter(Boolean).length / p.paymentHistory.length * 100).toFixed(2) + '%'
            })),
            impact: '15% of total score'
          },
          socialMediaMetrics: {
            ...applicant.alternativeData.socialMediaMetrics,
            impact: '10% of total score'
          },
          transactionHistory: {
            categories: applicant.alternativeData.transactionHistory.length,
            impact: '20% of total score'
          },
          geoLocation: {
            ...applicant.alternativeData.geoLocationData,
            impact: '20% of total score'
          }
        }
      }
    };
    
    res.status(200).json({
      success: true,
      data: explanation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
