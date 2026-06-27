// netlify/functions/demo-request.js
//
// Receives the homepage demo-request form submission and forwards it to
// MailerLite: looks up "Telofin Demo Group" by name (no hardcoded group ID,
// so this keeps working even if the group is renamed/recreated), then
// creates or updates the subscriber and adds them to that group. MailerLite's
// existing automation on that group sends the YouTube demo link + Calendly
// link from there — this function's only job is to get the subscriber in.

const MAILERLITE_API_BASE = 'https://connect.mailerlite.com/api';
const GROUP_NAME = 'Telofin Demo Group';

// Locks the CORS policy to telofin.com instead of '*'. With a wildcard,
// any site on the internet could call this endpoint directly from a
// visitor's browser — not a data-exposure risk (no secrets are returned),
// but it makes the endpoint trivially easy to script against from anywhere,
// which combined with no rate limiting (see config export below) could run
// up MailerLite subscriber-count/API costs or get the MailerLite account
// flagged for abuse from spam submissions.
const ALLOWED_ORIGIN = 'https://telofin.com';

// Netlify code-based rate limiting (supported on all plans, including
// free) — caps this function to 5 requests per 60 seconds per visitor,
// returning 429 beyond that. A real visitor submits this form once;
// 5/minute comfortably covers retries from a flaky connection while
// making scripted spam runs expensive to sustain.
exports.config = {
  rateLimit: {
    windowLimit: 5,
    windowSize: 60,
    aggregateBy: ['ip'],
  },
};

exports.handler = async function (event) {
  // CORS preflight (harmless to keep even if the form is same-origin)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.error('MAILERLITE_API_KEY is not set in the environment.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured.' }) };
  }

  // ── Parse and validate the incoming form payload ──────────────────────
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const email = (payload.email || '').trim();
  const name = (payload.name || '').trim();
  const phone = (payload.phone || '').trim();
  const orgType = (payload.orgType || '').trim();
  const contact = (payload.contact || '').trim();

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'A valid email is required.' }) };
  }
  if (!name) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Name is required.' }) };
  }

  const authHeaders = {
    Authorization: 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    // ── 1. Look up the group by name (no hardcoded ID) ──────────────────
    const groupSearchUrl =
      MAILERLITE_API_BASE + '/groups?filter[name]=' + encodeURIComponent(GROUP_NAME);
    const groupRes = await fetch(groupSearchUrl, { headers: authHeaders });

    if (!groupRes.ok) {
      const errText = await groupRes.text();
      console.error('MailerLite group lookup failed:', groupRes.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not reach MailerLite (group lookup).' }) };
    }

    const groupData = await groupRes.json();
    const group = (groupData.data || []).find(function (g) {
      return g.name === GROUP_NAME;
    });

    if (!group) {
      console.error('MailerLite group "' + GROUP_NAME + '" not found.');
      return { statusCode: 502, body: JSON.stringify({ error: 'Demo group not found in MailerLite.' }) };
    }

    // ── 2. Create or update the subscriber, adding them to that group ──
    // Per MailerLite docs: if the subscriber already exists, they are
    // updated with the newest field values rather than erroring.
    const subscriberRes = await fetch(MAILERLITE_API_BASE + '/subscribers', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        email: email,
        fields: {
          name: name,
          phone: phone,
          // Custom fields — these must already exist in MailerLite's
          // subscriber field settings (Settings > Fields) with these exact
          // keys, or MailerLite will ignore unrecognized ones.
          org_type: orgType,
          preferred_contact: contact,
        },
        groups: [group.id],
      }),
    });

    if (!subscriberRes.ok) {
      const errText = await subscriberRes.text();
      console.error('MailerLite subscriber create failed:', subscriberRes.status, errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not reach MailerLite (subscriber create).' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('demo-request function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected server error.' }) };
  }
};
