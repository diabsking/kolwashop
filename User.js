const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  createdAt: { type: Date, default: Date.now },
  // autres champs ici
});

const User = mongoose.model("User", userSchema);
module.exports = User;