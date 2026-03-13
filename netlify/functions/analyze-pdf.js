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

    // Always compute week dates on the server using the client-provided offset
    // Client sends weekDates already computed in local Norwegian time
    const wd = body.weekDates || {};
    const hasWeekDates = !!(wd.mandag && wd.tirsdag && wd.onsdag && wd.torsdag && wd.fredag);

    const weekContext = hasWeekDates ? `
Datoer for uken dokumentet gjelder:
- Mandag = ${wd.mandag}
- Tirsdag = ${wd.tirsdag}
- Onsdag = ${wd.onsdag}
- Torsdag = ${wd.torsdag}
- Fredag = ${wd.fredag}
- Lørdag = ${wd.lordag || ''}
- Søndag = ${wd.sondag || ''}

Bruk ALLTID disse datoene når du oversetter ukedager til datoer. Ikke beregn datoer selv fra ukenummer – bruk kun tabellen ovenfor.` : `Sett date til null hvis du ikke finner eksplisitt dato i dokumentet.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `Du er en kalenderassistent som hjelper familier med å ekstrahere konkrete hendelser fra skolebrev og ukeplaner.

${weekContext}

KRITISK REGEL – rutiner vs. hendelser:
Setninger med flertallsform av ukedag ("mandager", "tirsdager", "torsdager" osv.) beskriver faste ukentlige rutiner og skal IKKE opprettes som hendelser.
- "Leksebøkene sendes hjem på mandager og må være med tilbake på torsdager" → IGNORER HELT
- "Vi har gym hver tirsdag" → IGNORER
Entallsform som konkret påminnelse → opprett hendelse:
- "Husk at det er svømming på fredag" → opprett, date = fredag fra tabellen ovenfor
- "4. juni er det sommeravslutning" → opprett med eksplisitt dato

TIMEPLANER: Svømming i timeplan → sport-hendelse på riktig dag. Vanlige skolefag trenger ikke egne hendelser.

Svar KUN med JSON-array, ingen forklaring eller markdown.
Format: [{"title":"tittel","date":"YYYY-MM-DD","from":"HH:MM","to":"HH:MM","category":"school|sport|family|other","who":"hvem","notes":"notat"}]
category: skole/fagdag/prøve=school, svømming/sport/trening=sport, familie=family, annet=other`,
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
            { type: 'text', text: 'Ekstraher konkrete hendelser. Bruk datotabellen for å oversette ukedager. Ignorer faste rutiner med flertallsform.' }
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
