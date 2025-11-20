# Hoe vind je de werkende stream URL voor Joe?

De radio player probeert nu automatisch meerdere stream URLs voor Joe. Als geen van deze werkt, kun je de juiste stream URL zelf vinden met deze stappen:

## Methode 1: Via Browser Developer Tools

1. **Open radio.nl/radio/joe in je browser**
   - Ga naar https://radio.nl/radio/joe

2. **Open Developer Tools**
   - Chrome/Edge: Druk op `F12` of `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Druk op `F12` of `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)

3. **Ga naar de Network tab**
   - Klik op het "Network" tabblad bovenaan de Developer Tools

4. **Filter op media bestanden**
   - Klik op "Media" of typ in de filter: `m3u8` of `mp3`

5. **Start de radio**
   - Klik op de play knop op de radio.nl website

6. **Zoek de stream URL**
   - Je ziet nu network requests verschijnen
   - Zoek naar entries die eindigen op `.mp3`, `.m3u8`, of bevatten woorden als "stream", "live", "joe"
   - Klik op een request om details te zien
   - Kopieer de volledige URL uit het "Request URL" veld

## Methode 2: Via de Browser Console

1. **Open radio.nl/radio/joe**

2. **Open Console**
   - Druk op `F12` → ga naar "Console" tab

3. **Injecteer script**
   - Plak deze code in de console en druk op Enter:
   ```javascript
   document.querySelectorAll('audio, video').forEach(el => {
     console.log('Media element gevonden:', el.src || el.currentSrc);
   });
   ```

4. **Start de radio**
   - Als de radio afspeelt, zou je de stream URL moeten zien in de console

## Methode 3: Via Radio Browser API

1. **Zoek Joe in de database**
   - Ga naar: https://www.radio-browser.info/
   - Zoek naar "Joe"
   - Klik op het juiste station (Joe Nederland of Joe België)
   - Kopieer de stream URL

2. **Of gebruik de API direct**
   ```
   https://de1.api.radio-browser.info/json/stations/byname/joe
   ```

## De stream URL toevoegen aan de applicatie

Zodra je de werkende stream URL hebt:

1. **Open het bestand:** `src/components/AudioPlayer.jsx`

2. **Vind de RADIO_STATIONS configuratie** (regel ~7-29)

3. **Pas de Joe URLs aan:**
   ```javascript
   {
     id: "joe",
     name: "Joe",
     urls: [
       "JOUW_GEVONDEN_URL_HIER",  // Voeg je URL hier toe als eerste
       "https://icecast-qmusicnl-cdp.triple-it.nl/Joe_nl_live.mp3",
       "https://21223.live.streamtheworld.com/JOE.mp3",
       // ... rest van de URLs
     ],
   },
   ```

4. **Sla op en test**
   - De player zal nu jouw URL als eerste proberen

## Veelvoorkomende stream URL patronen

Joe streams kunnen er zo uitzien:
- `https://icecast-qmusicnl-cdp.triple-it.nl/Joe_nl_live.mp3`
- `https://playerservices.streamtheworld.com/api/livestream-redirect/JOE.mp3`
- `https://streams.lazernet.be:8014/Joe.mp3`
- `https://*/joe*.mp3` (variaties hierop)

## Tips

- **Meerdere URLs**: Voeg meerdere URLs toe aan het `urls` array - de player probeert ze allemaal
- **Console logs**: Check de browser console voor gedetailleerde logs over welke URLs geprobeerd worden
- **CORS errors**: Als je een URL vindt maar krijgt CORS errors, moet je mogelijk een proxy gebruiken
- **Streamtheworld**: Veel radiostations gebruiken StreamTheWorld - probeer URLs met dit domein

## Alternatief: Andere Radiostations

Als Joe echt niet werkt, zijn deze alternatieven al geconfigureerd:
- **Qmusic** (vergelijkbare muziek als Joe)
- **NPO Radio 2** (Nederlandse publieke omroep)
- **NPO 3FM** (Nederlandse publieke omroep)

Veel succes!

