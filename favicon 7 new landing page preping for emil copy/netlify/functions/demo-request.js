exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  var ML_API_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiYTFlNzNiMWNjNWU1OWE4MTczYTk0MjhmZmFmODlhYTFlZTI0YjA0Y2Y0NmRjZWQ1ZTQ1MGFiMWQzNWM2YjRlZTg1N2RkOTA1NjRlNmQ3OGYiLCJpYXQiOjE3Nzk4NDY1MDQuNzM1Mjc1LCJuYmYiOjE3Nzk4NDY1MDQuNzM1Mjc4LCJleHAiOjQ5MzU1MjAxMDQuNzMxMzcsInN1YiI6IjIzOTE0NzkiLCJzY29wZXMiOltdfQ.KBq_VGYHjgI1worhwkm3mKj6xdCm2BYtlaQYkEkARJqddEPcVIcaxT2yTNAGTWasaFfhsKjgjU30idx7UTsbiB7-SAnXO1Bo7XnKqlQht3kphvfaW8dUWbyO9AG6Ldx0KVfGoR-0cuKAk7SyOpRxJ8uqZ6xxJHBxTGBbcXd1oZE8AKGFktDUumU2R2g8nyilHnyZ1TSsgGOSi5pmBacDE_t-84mvCsQHCASZpHnm9BFqAA7lNN0_CWBXRu9o24pTR41CLME2pj2evFXwsR2fwDSDJANZibYg3Ba6tldDSaO7EfRwNMyZY1kSu3d5Gc0Y7UmZcRdiDo2WmfZ_t4Scw05oV2deng8fjUGqTVrShEgDcK-basKyO5c_8WZqMTzc3w1ezj48krT4VFDUacjeTPHoMYT-lwKZqFWz8R-Sv_lHrUthYILxrECMa60aX64bbjvfdLViL6wHpNeLq3YuABJlaxYbwWsCYvkETNtDuZoca0vnL3B3hWYh_Oj7i7a4sc7U33IwsMoBCmgfO8mGZNYSn2BC5r4LCw-QKooxFgxxms9HWIlRgDsBMFMtyoaI0am9MC3MvW2ozDOyyaJIBkZYSegcDItlmEeAXJ0592t8N4Yh-5sb_GXoIb_fAh8GkVmFRakb-vqpUXwDG2N-bNIiGG7Z4c-n8O-ekQ088I';
  var ML_GROUP_ID = '188582809849300470';

  try {
    var body = JSON.parse(event.body);
    var response = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ML_API_KEY
      },
      body: JSON.stringify({
        email: body.email,
        fields: {
          name:       body.name     || '',
          phone:      body.phone    || '',
          company:    body.orgType  || '',
          last_name:  body.contact  || ''
        },
        groups: [ML_GROUP_ID]
      })
    });

    // 200 = created, 409 = already subscribed — both are fine
    if (response.ok || response.status === 409) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    var err = await response.json();
    return { statusCode: 400, body: JSON.stringify({ error: err.message || 'Submission failed' }) };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || 'Server error' }) };
  }
};
