const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 1000,
    min: 0
  },
  totalWagered: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWon: {
    type: Number,
    default: 0,
    min: 0
  },
  totalLost: {
    type: Number,
    default: 0,
    min: 0
  },
  bets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bet'
  }]
}, {
  timestamps: true
});

// Virtual for net profit
userSchema.virtual('netProfit').get(function() {
  return this.totalWon - this.totalLost;
});

// Virtual for win rate
userSchema.virtual('winRate').get(function() {
  const completedBets = this.bets.filter(bet => bet.status === 'won' || bet.status === 'lost');
  if (completedBets.length === 0) return 0;
  const wonBets = completedBets.filter(bet => bet.status === 'won').length;
  return Math.round((wonBets / completedBets.length) * 100);
});

module.exports = mongoose.model('User', userSchema);
