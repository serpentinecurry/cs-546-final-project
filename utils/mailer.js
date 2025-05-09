import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "sairithikkomuravelly100@gmail.com",
    pass: "hqglcunrwicpioxa",
  },
});

const sendApprovalEmail = async (toEmail, firstName, role) => {
  const mailOptions = {
    from: '"Scholario Admin" <no-reply@scholario.edu>',
    to: toEmail,
    subject: "Scholario - Account Approved 🎉",
    html: `<h2>Hi ${firstName},</h2>
           <p>Your Scholario account has been approved! Your account has the privileges of the role: ${role}. You can now log in and get started!</p>
           <br><p>Welcome aboard! 🚀</p>
           <br><h4>Scholario: The final project for CS546: Web Programming I (Group_32)</h4>`,
  };

  await transporter.sendMail(mailOptions);
};

const sendChangeApprovalEmail = async (toEmail, fullName, field, newValue) => {
  const mailOptions = {
    from: '"Scholario Admin" <no-reply@scholario.edu>',
    to: toEmail,
    subject: `✅ Your ${field} change has been approved!`,
    html: `<h2>Hi ${fullName},</h2>
           <p>Your request to change your <strong>${field}</strong> has been <span style="color: green;"><strong>approved</strong></span>.</p>
           <p><strong>New ${field}:</strong> ${newValue}</p>
           <br><p>You can now see the changes reflected in your Scholario profile.</p>
           <p>Thank you for keeping your info up to date!</p>
           <br><h3>– Scholario Admin Team</h3>
           <br><h4>The final project for CS546: Web Programming I (Group_32)</h4>`,
  };
  await transporter.sendMail(mailOptions);
};

const sendCredentialsEmail = async (toEmail, fullName, role, password) => {
  const mailOptions = {
    from: '"Scholario Admin" <no-reply@scholario.edu>',
    to: toEmail,
    subject: `Your Scholario account has been created`,
    html: `
      <h2>Welcome to Scholario, ${fullName}!</h2>
      <p>An account has been created for you with the following credentials:</p>
      <ul>
        <li><strong>Email:</strong> ${toEmail}</li>
        <li><strong>Password:</strong> ${password}</li>
        <li><strong>Role:</strong> ${role}</li>
      </ul>
      <p>Please log in and change your password as soon as possible.</p>
      <br>
      <p>– Scholario Admin Team</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export { sendApprovalEmail, sendChangeApprovalEmail, sendCredentialsEmail };
