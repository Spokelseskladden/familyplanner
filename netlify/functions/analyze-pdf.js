exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `Du er en assistent som hjelper familier med å planlegge uken. 
Analyser dokumentet og ekstraher alle hendelser, aktiviteter, møter, frister eller arrangementer.
Svar KUN med et JSON-array, ingen forklaring eller markdown-kodeblokker.
Format: [{"title":"tittel","date":"YYYY-MM-DD","from":"HH:MM","to":"HH:MM","category":"school|sport|family|other","who":"hvem dette gjelder","notes":"kort notat"}]
Hvis dato ikke er spesifisert, bruk null. Bruk dagens år (${new Date().getFullYear()}).
category-regler: skole/lekser/fagdag=school, sport/trening/kamp=sport, familieaktivitet=family, alt annet=other.`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: body.mediaType || 'application/pdf',
                data: body.fileData
              }
            },
            { type: 'text', text: 'Ekstraher alle hendelser fra dette dokumentet.' }
          ]
        }]
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
