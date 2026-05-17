const RESEND_API_URL = "https://api.resend.com/emails";

async function sendViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return false;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${text}`);
  }

  return true;
}

export async function sendEmailCode({
  email,
  subject,
  heading,
  intro,
  code,
  expiryMinutes,
}) {
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>${heading}</h2>
      <p>${intro}</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:6px;margin:20px 0">${code}</div>
      <p>This code expires in ${expiryMinutes} minutes.</p>
    </div>
  `;

  const delivered = await sendViaResend({
    to: email,
    subject,
    html,
  }).catch((error) => {
    console.error("[email] resend delivery failed:", error.message);
    return false;
  });

  if (!delivered) {
    console.log(`[email:fallback] ${subject} for ${email}: ${code}`);
  }

  return {
    delivery: delivered ? "resend" : "console",
  };
}
