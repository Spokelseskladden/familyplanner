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

    // Calculate weekday dates in Norwegian time (UTC+1/UTC+2) to avoid off-by-one errors
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Oslo' }));
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
    const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const weekDates = {};
    const dayNames = ['mandag','tirsdag','onsdag','torsdag','fredag','lordag','sondag'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      weekDates[dayNames[i]] = `${yyyy}-${mm}-${dd}`;
    }

    const weekContext = `Inneværende uke (norsk tid):
- Mandag: ${weekDates['mandag']}
- Tirsdag: ${weekDates['tirsdag']}
- Onsdag: ${weekDates['onsdag']}
- Torsdag: ${weekDates['torsdag']}
- Fredag: ${weekDates['fredag']}
- Lørdag: ${weekDates['lordag']}
- Søndag: ${weekDates['sondag']}`;

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

${weekContext}

VIKTIG om datoer - følg disse reglene nøye:
- Når teksten nevner en ukedag (mandag, tirsdag, onsdag, torsdag, fredag, lørdag), bruk ALLTID den tilsvarende datoen fra listen ovenfor
- "svømming på fredag" → date skal være ${weekDates['fredag']}
- "leksebøker tilbake på torsdag" → date skal være ${weekDates['torsdag']}
- Hvis dokumentet har eksplisitte datoer (f.eks. "14. mars 2025"), bruk de i stedet for ukens datoer
- Sett date til null KUN hvis det er umulig å fastslå hvilken dag

TIMEPLANER og TABELLER:
- Hvis dokumentet inneholder en ukeplan/timeplan med fag per dag, se etter aktiviteter som skiller seg ut
- Svømming i timeplan → ekstraher som sport-hendelse på riktig dag
- Vanlige skolefag (norsk, matte, engelsk osv.) trenger ikke egne hendelser med mindre de er spesielle

REGLER for hva som skal ekstraheres:
Ja: aktiviteter med ukedag/dato, arrangementer, frister, svømming, utflukter, fridager, foreldremøter, innleveringer
Nei: generelle leksebeskrivelser uten dato, rutiner uten spesifikk dag denne uken

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
