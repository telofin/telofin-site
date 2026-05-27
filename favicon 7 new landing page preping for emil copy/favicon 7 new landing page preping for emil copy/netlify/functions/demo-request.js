exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  var ML_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiNjcyZTc4MTI0YjJlYTUzYmZiMmQ1ZjZlY2UyMWIyNmNiMGQwODgzNDdmMjYyZjhhMWExZDdhNDAzOTMxOWFlOTJiZjE5ZTQ0OTI5OGUwODkiLCJpYXQiOjE3Nzk4OTQ4NDQuMDgzOTQ5LCJuYmYiOjE3Nzk4OTQ4NDQuMDgzOTUxLCJleHAiOjQ5MzU1Njg0NDQuMDc3MTE3LCJzdWIiOiIyMzkxNDc5Iiwic2NvcGVzIjpbXX0.vt4yXrHnD0sticHjPYdf1MM8M_vr16Hl7A_W1jn4ZjelWtRh4urgdbgylsxWM5QEcqVT-wtkuDVYYT8QXyBRHgrO5fFqjdrYNAWKlXiWJkaV9IEnGi8uvH3_gjbJLDqerKMMJ6uUk6EC0F5Q5oiWT1JPSKOrMwizmw1xpq522gdcJNY-Joi66JSu2TRuaGe0E-JOR7VRmTu4vEeuYeMmFxdy3HeNA4axCtWjB5s-c7_Qj7icZnUh5K94ABwSTBlCixEjTvn5wGYVzcBIpp8uOSrxdndYbupFyIMJ97MOHAwSuo01HYtkCZGOwHWRHX6z3lxBaC5XfdXwb9lfncrisRg-I_ivanIN8rQ43MkwopF7nPiUtJ7QcLWJbv6NY3RX-GWtxciQG_ZdNrNwkYPqMQI6s0EudG6gZh3G7hwSzXFGVT8jWackje6ifgEcXWrr-asTfQs75LcYJqh9phO-7kc1OgWJ1dhIFucaIlagz9AOUzNQo4KunzBuvWSLbgorLwZdw1iOmI74AhmxtDrQrmo6qYoFChkYOhMig1LHwR4Q_igxqbuA6R6BbXak6x63mEKTUBSYpsk69cAnUz_O7WK3tD_T2xUJPEc3OsxO0GgSv3cvVzpnk6nq9-4RE2P3Jf8fISRyGxQxOimT-KWQnGIgBK5nb0pjE6L_COVQIZI';
  var ML_GROUP_ID = '188582809849300470';

  try {
    var body = JSON.parse(event.body);

    // Build fields using only MailerLite standard field names
    var fields = { name: body.name || '' };
    // Store phone, org type and contact preference in the 'last_name' and 'company' standard fields
    if (body.phone)   fields.phone   = body.phone;
    if (body.orgType) fields.company = body.orgType;
    // Store preferred contact method as a note in last_name field
    if (body.contact) fields.last_name = body.contact;

    var payload = {
      email:  body.email,
      fields: fields,
      groups: [ML_GROUP_ID]
    };

    var response = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'Authorization':'Bearer ' + ML_API_KEY
      },
      body: JSON.stringify(payload)
    });

    var responseText = await response.text();
    console.log('[demo-request] status:', response.status, 'body:', responseText);

    if (response.ok || response.status === 409) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: responseText }) };

  } catch(e) {
    console.log('[demo-request] exception:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Server error' }) };
  }
};
