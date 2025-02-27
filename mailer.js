// config/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail", // Vous pouvez utiliser un autre service
  auth: {
    user: "kolwaz@gmail.com",  // Remplacez par votre email
    pass: "Dele1234@"           // Remplacez par votre mot de passe ou un mot de passe d'application
  }
});

module.exports = transporter;