exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { url } = JSON.parse(event.body);

    if (!url || !url.includes('.ics')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Ugyldig kalender-URL' })
      };
    }

    const response = await fetch(url);
    if (!response.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Kunne ikke hente kalender: ${response.status}` })
      };
    }

    const icsText = await response.text();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ icsText })
    };

  } catch (err) {
    console.error('fetch-calendar error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
