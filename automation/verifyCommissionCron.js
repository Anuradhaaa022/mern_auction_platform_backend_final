import { User } from "../models/userSchema.js";
import { PaymentProof } from "../models/commissionProofSchema.js";
import { Commission } from "../models/commissionSchema.js";
import cron from "node-cron";
import { sendEmail } from "../utils/sendEmail.js";

export const verifyCommissionCron = () => {
  cron.schedule("*/1 * * * *", async () => {
    console.log("Running Verify Commission Cron...");

    const approvedProofs = await PaymentProof.find({ status: "Approved" });

    for (const proof of approvedProofs) {
      try {
        const user = await User.findById(proof.userId);
        let updatedUserData = {};

        if (user) {
          if (user.unpaidCommission >= proof.amount) {
            updatedUserData = await User.findByIdAndUpdate(
              user._id,
              {
                $inc: { unpaidCommission: -proof.amount },
              },
              { new: true }
            );
          } else {
            updatedUserData = await User.findByIdAndUpdate(
              user._id,
              { unpaidCommission: 0 },
              { new: true }
            );
          }

          await PaymentProof.findByIdAndUpdate(proof._id, {
            status: "Settled",
          });

          await Commission.create({
            amount: proof.amount,
            user: user._id,
          });

          const settlementDate = new Date().toDateString();

          const subject = `✅ Your Payment Has Been Successfully Verified and Settled`;

          const html = `
            <p>Dear ${user.userName},</p>
            <p>We are pleased to inform you that your recent commission payment has been <strong>successfully verified</strong> and marked as <strong>settled</strong>.</p>
            <h3>💳 Payment Details:</h3>
            <ul>
              <li><strong>Amount Settled:</strong> ₹${proof.amount}</li>
              <li><strong>Remaining Unpaid Commission:</strong> ₹${updatedUserData.unpaidCommission}</li>
              <li><strong>Settlement Date:</strong> ${settlementDate}</li>
            </ul>
            <p>Thank you for your prompt payment. Your account is now in good standing.</p>
            <p>For any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>PrimeBidz Auction Team</p>
          `;

          await sendEmail({
            email: user.email,
            subject,
            html,
          });

          console.log(`✅ Email sent: User ${user._id} paid ₹${proof.amount}`);
        }
      } catch (error) {
        console.error(
          `❌ Error processing commission proof for user ${proof.userId}: ${error.message}`
        );
      }
    }
  });
};
