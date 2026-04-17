const nodemailer = require("nodemailer");
const {
  EMAIL_ENABLED, SMTP_HOST, SMTP_PORT,
  SMTP_USER, SMTP_PASSWORD, ALERT_RECIPIENTS,
} = require("./config");

const MIN_NEW = 5;

async function sendAlert(newCount, articles) {
  if (!EMAIL_ENABLED || newCount < MIN_NEW) return;
  const recipients = ALERT_RECIPIENTS.split(",").map((r) => r.trim()).filter(Boolean);
  if (!recipients.length) return;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  const rows = articles.slice(0, 20).map(
    (a) => `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;color:#555">${a.category}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">
        <a href="${a.url}" style="color:#0066cc;text-decoration:none">${a.title}</a>
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;font-size:12px;color:#888">${a.source_name}</td>
    </tr>`
  ).join("");

  const html = `
    <html><body style="font-family:sans-serif;max-width:700px;margin:auto">
      <h2 style="color:#1a1a2e;border-bottom:2px solid #0066cc;padding-bottom:8px">
        📈 경제 뉴스 브리핑
      </h2>
      <table width="100%" cellspacing="0" cellpadding="0"
             style="border-collapse:collapse;border:1px solid #ddd">
        <thead>
          <tr style="background:#0066cc;color:white">
            <th style="padding:10px;text-align:left;width:140px">카테고리</th>
            <th style="padding:10px;text-align:left">제목</th>
            <th style="padding:10px;text-align:left;width:100px">출처</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;

  await transporter.sendMail({
    from: SMTP_USER,
    to: recipients.join(", "),
    subject: `[경제 뉴스 알림] 새 기사 ${newCount}건 업데이트`,
    html,
  });
  console.log("[Email] 발송 완료:", recipients);
}

module.exports = { sendAlert };
