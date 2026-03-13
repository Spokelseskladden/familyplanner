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

    // Fallback week dates sent from client (used only if doc has no explicit dates)
    const wd = body.weekDates || {};
    const fallbackWeek = wd.mandag ? `
Hvis dokumentet IKKE inneholder eksplisitte datoer, bruk disse datoene som fallback:
- Mandag: ${wd.mandag}
- Tirsdag: ${wd.tirsdag}
- Onsdag: ${wd.onsdag}
- Torsdag: ${wd.torsdag}
- Fredag: ${wd.fredag}
- Lørdag: ${wd.lordag}
- Søndag: ${wd.sondag}` : '';

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
        system: `Du er en kalenderassistent som hjelper familier med å ekstrahere hendelser fra skolebrev, nyhetsbrev, timeplaner og informasjonsskriv.

DATOER - følg denne prioriteringen:
1. Hvis dokumentet inneholder eksplisitte datoer eller ukenummer med datoer (f.eks. "Uke 12 (16.-20. mars 2026)" eller "mandag 16. mars"), bruk disse til å beregne datoer for alle ukedager i den uken.
2. Hvis dokumentet kun nevner ukedager uten datoer (f.eks. "svømming på fredag"):${fallbackWeek || ' sett date til null.'}

Eksempel: Hvis dokumentet sier "Uke 12 (16.-20. mars 2026)" og nevner "svømming på fredag", skal date være 2026-03-20.
Eksempel: "4. juni er det sommeravslutning" → date: 2026-06-04.

TIMEPLANER og TABELLER:
- Svømming i timeplan → ekstraher som sport-hendelse på riktig dag
- Vanlige skolefag (norsk, matte, engelsk osv.) trenger ikke egne hendelser

REGLER for hva som skal ekstraheres:
Ja: aktiviteter med ukedag/dato, arrangementer, frister, svømming, utflukter, fridager, foreldremøter, innleveringer, sommeravslutninger
Nei: generelle leksebeskrivelser, faglige mål, rutinebeskrivelser uten spesifikk dato

Svar KUN med et JSON-array, ingen forklaring eller markdown. Tom liste [] hvis ingenting.
Format: [{"title":"tittel","date":"YYYY-MM-DD","from":"HH:MM","to":"HH:MM","category":"school|sport|family|other","who":"hvem","notes":"notat"}]
category: skole/fagdag/prøve/foreldremøte=school, svømming/sport/trening=sport, familie=family, annet=other`,
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
            { type: 'text', text: 'Ekstraher alle hendelser og aktiviteter fra dette dokumentet.' }
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
