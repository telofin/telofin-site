// netlify/functions/send-invite.js
// Sends a Teams invite email via Resend. Called by sendInvite() in js/auth.js
// AFTER the client_access share row(s) are created — so the email is a
// best-effort notification; the share exists regardless of delivery.
// Secret lives in the RESEND_API_KEY Netlify env var (same pattern as MailerLite).
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  var RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('[send-invite] missing RESEND_API_KEY env var');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured' }) };
  }

  // Must be an address on the Resend-verified sending domain (mail.telofin.com).
  var FROM = process.env.RESEND_FROM || 'Clarity by Telofin <invites@mail.telofin.com>';

  var esc = function(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(ch){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch];
    });
  };

  try {
    var body = JSON.parse(event.body || '{}');
    var to = (body.to || '').trim();
    if (!to || to.indexOf('@') < 1) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid recipient email' }) };
    }
    var inviter = (body.inviterName || '').trim();
    var clients = Array.isArray(body.clients) ? body.clients.filter(Boolean) : [];
    var note = (body.note || '').trim();
    var appUrl = (body.appUrl || 'https://www.telofin.com').trim();

    var whoLine = inviter ? (esc(inviter) + ' has invited you') : 'You’ve been invited';
    var clientLine = clients.length
      ? ' to collaborate on <strong>' + clients.map(esc).join(', ') + '</strong>'
      : '';
    var noteHtml = note
      ? '<p style="margin:16px 0;padding:12px 14px;background:#f4f6f5;border-radius:8px;color:#333;font-style:italic">“' + esc(note) + '”</p>'
      : '';

    var subject = 'You’ve been invited to Clarity by Telofin';
    var html =
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">' +
        '<h2 style="color:#0f6e56;margin-bottom:8px">Clarity by Telofin</h2>' +
        '<p style="font-size:15px;line-height:1.6">' + whoLine + clientLine +
          ' in Clarity, a bookkeeping app for nonprofits and small businesses.</p>' +
        noteHtml +
        '<p style="font-size:15px;line-height:1.6">To accept, sign in with <strong>this email address</strong> (' +
          esc(to) + ') and you’ll have access:</p>' +
        // #signin makes the app auto-open the login modal on load (handled in features.js)
        '<p style="margin:24px 0"><a href="' + esc(appUrl) + '#signin' +
          '" style="background:#0f6e56;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:15px;font-weight:600">Sign in to Clarity</a></p>' +
        '<p style="font-size:12px;color:#888;line-height:1.6">If you weren’t expecting this, you can ignore this email.</p>' +
      '</div>';

    var response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + RESEND_API_KEY
      },
      body: JSON.stringify({ from: FROM, to: [to], subject: subject, html: html })
    });

    var responseText = await response.text();
    console.log('[send-invite] status:', response.status, 'body:', responseText);

    if (response.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 400, body: JSON.stringify({ error: responseText }) };

  } catch (e) {
    console.log('[send-invite] exception:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Server error' }) };
  }
};
