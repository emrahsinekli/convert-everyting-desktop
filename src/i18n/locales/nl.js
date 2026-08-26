// Nederlands (Dutch). Keys must mirror en.js exactly - run scripts/check-locales.js.
export default {
  common: {
    cancel: 'Annuleren',
    close: 'Sluiten',
    save: 'Opslaan',
    remove: 'Verwijderen',
    back: 'Terug',
    next: 'Volgende',
    done: 'Klaar',
    retry: 'Opnieuw proberen',
    copy: 'Kopiëren',
    copied: 'Gekopieerd',
    loading: 'Laden…',
    settings: 'Instellingen',
    language: 'Taal',
    file: 'Bestand',
    files: 'bestanden',
    output: 'Uitvoer',
    quality: 'Kwaliteit',
    format: 'Formaat',
    success: 'Gelukt',
    failed: 'Mislukt'
  },

  header: {
    tagline: 'Offline • Snel • Privé • Onbeperkt',
    upgrade: 'Upgraden',
    upgradeTitle: 'Upgraden naar Pro',
    trialDays: 'Proef · {days}d',
    pro: 'PRO',
    help: 'Help',
    helpTitle: 'Gebruikershandleiding openen',
    languageTitle: 'Taal wijzigen'
  },

  sidebar: {
    convert: 'Converteren',
    tools: 'Gereedschap',
    utilities: 'Hulpmiddelen',
    history: 'Geschiedenis',
    settings: 'Instellingen',
    convertVideo: 'Videoconverter',
    convertAudio: 'Audioconverter',
    convertImage: 'Afbeeldingsconverter',
    convertDocument: 'Documentconverter',
    convertEbook: 'E-bookconverter',
    convertArchive: 'Archiefconverter',
    toolsVideo: 'Videogereedschap',
    toolsImage: 'Afbeeldingsgereedschap',
    toolsAudio: 'Audiogereedschap',
    toolsGif: 'GIF-gereedschap',
    toolsPdf: 'PDF-gereedschap',
    toolsTts: 'Tekst naar spraak',
    toolsWatch: 'Automatisering',
    utilUnit: 'Eenhedenconverter',
    utilColor: 'Kleurconverter',
    utilText: 'Tekstconverter',
    utilEncoding: 'Coderingsgereedschap',
    utilNumber: 'Talstelsel',
    utilTimestamp: 'Tijdstempel',
    utilData: 'Dataconverter',
    utilSubtitle: 'Ondertitelconverter',
    utilIcon: 'Pictogramconverter',
    utilMarkdown: 'Markdown-converter',
    utilFont: 'Lettertypeconverter',
    utilHtml: 'HTML-opmaker'
  },

  dropzone: {
    dragFilesHere: 'Sleep bestanden hierheen',
    orClickToSelect: 'of klik om te selecteren',
    filesSelected: 'bestanden geselecteerd',
    dragToReorder: 'Sleep om de volgorde te wijzigen',
    addMore: 'Meer toevoegen',
    addFile: 'Bestand toevoegen',
    dropFilesHere: 'Laat bestanden hier los',
    removeFile: 'Bestand verwijderen'
  },

  conversion: {
    title: 'Kies het uitvoerformaat',
    subtitle: 'Kies het formaat waarnaar u wilt converteren',
    videoFormats: 'Videoformaten',
    audioFormats: 'Audioformaten',
    imageFormats: 'Afbeeldingsformaten',
    documentFormats: 'Documentformaten',
    transcription: 'AI-transcriptie',
    transcriptionHint: 'Zet spraak om in tekst met AI (Whisper)',
    convertNow: 'Nu converteren',
    convertAll: 'Alles converteren ({count} bestanden)',
    converting: 'Bezig met converteren {progress}%…',
    mergeIntoSinglePdf: 'Samenvoegen tot één PDF',
    createSeparatePdfs: 'Aparte PDF-bestanden maken',
    mergeHint: '{count} afbeeldingen worden samengevoegd tot één PDF-bestand (op volgorde)',
    separateHint: 'Elke afbeelding wordt als apart PDF-bestand opgeslagen',
    mergeBadge: 'Samenvoegen'
  },

  bitrate: {
    title: 'Audiokwaliteit',
    unit: 'kbps',
    hintHighest: 'Hoogste kwaliteit, grootste bestand.',
    hintHigh: 'Hoge kwaliteit, gemiddelde bestandsgrootte.',
    hintStandard: 'Standaardkwaliteit — een goede balans.',
    hintLow: 'Kleinste bestand, hoorbaar kwaliteitsverlies.',
    losslessNote: 'Het doelformaat is verliesvrij, dus een bitrate is niet van toepassing.'
  },

  history: {
    title: 'Conversiegeschiedenis',
    clear: 'Geschiedenis wissen',
    emptyTitle: 'Nog geen conversiegeschiedenis',
    emptyHint: 'Uw geconverteerde bestanden verschijnen hier'
  },

  license: {
    continueTrial: 'Proefversie voortzetten',
    haveKey: 'Ik heb al een licentiesleutel',
    activate: 'Activeren',
    keyPlaceholder: 'Uw licentiesleutel'
  },

  help: {
    title: 'Gebruikershandleiding',
    subtitle: 'Alles wat Convert Everything kan, en hoe u het gewenste resultaat krijgt.',
    searchPlaceholder: 'Zoek in de handleiding…',
    noResults: 'Geen enkel onderdeel komt overeen met uw zoekopdracht.',

    gettingStartedTitle: 'Aan de slag',
    gettingStartedBody: 'Convert Everything werkt volledig op uw eigen computer. Er wordt niets geüpload, u hebt geen account nodig en er is geen limiet op de bestandsgrootte.\n\n1. Kies links in de zijbalk een categorie, bijvoorbeeld Audioconverter.\n2. Sleep uw bestanden naar het venster of klik op het sleepvlak om ze te zoeken.\n3. Kies het uitvoerformaat.\n4. Stel de kwaliteitsopties in die voor dat formaat verschijnen.\n5. Klik op Nu converteren.\n\nHet geconverteerde bestand wordt naast het origineel opgeslagen, met "_converted" achter de naam. Elk resultaat vindt u later terug onder Geschiedenis.',

    batchTitle: 'Meerdere bestanden tegelijk converteren',
    batchBody: 'Sleep zoveel bestanden als u wilt naar het venster. Zodra er meer dan één bestand is geselecteerd, verandert de knop in Alles converteren en wordt elk bestand met dezelfde instellingen geconverteerd.\n\nSleep de bestandskaarten om de volgorde te wijzigen. Die volgorde is van belang wanneer u afbeeldingen samenvoegt tot één PDF, omdat de pagina\'s de volgorde op het scherm volgen.',

    audioTitle: 'Audiokwaliteit en bitrate',
    audioBody: 'Wanneer u naar een verliesgevend formaat converteert (MP3, AAC, M4A, OGG, Opus, WMA, AC3, MP2) verschijnt er een kwaliteitskeuze met 128, 192, 256 en 320 kbps.\n\n320 kbps is de hoogste bitrate die MP3 ondersteunt en is de juiste keuze wanneer u vanaf een verliesvrije bron zoals FLAC of WAV converteert. De instelling wordt toegepast als een constante bitrate, zodat het uiteindelijke bestand ook werkelijk de gekozen bitrate heeft.\n\nVerliesvrije doelformaten — FLAC, WAV, AIFF, AU, CAF — hebben geen bitratekeuze, omdat hun kwaliteit door het formaat zelf wordt bepaald en niet door een bitrate.\n\nGoed om te weten: een verliesgevend bestand naar een hogere bitrate converteren herstelt geen kwaliteit die al verloren is gegaan. Van een MP3 van 128 kbps naar 320 kbps gaan maakt het bestand alleen groter. Begin dus altijd bij het verliesvrije origineel als u dat hebt.',

    videoTitle: 'Videoconversie en gereedschap',
    videoBody: 'De Videoconverter wijzigt de container en de codec, bijvoorbeeld van MKV naar MP4. Videogereedschap voegt daar comprimeren, inkorten, bijsnijden, de audiosporen losmaken en een watermerk toevoegen aan toe.\n\nAudio losmaken: selecteer een videobestand en kies een audioformaat als uitvoer. Het audiospoor wordt eruit gehaald en gecodeerd met de bitrate die u kiest.',

    imageTitle: 'Afbeeldingen en PDF',
    imageBody: 'De Afbeeldingsconverter werkt met PNG, JPG, WebP, GIF, BMP, TIFF en meer. Afbeeldingsgereedschap voegt formaat wijzigen, comprimeren, achtergrond verwijderen en de ingebouwde editor toe.\n\nOm afbeeldingen naar PDF om te zetten, selecteert u de afbeeldingen, kiest u PDF als uitvoer en bepaalt u of u één samengevoegd document wilt of een aparte PDF per afbeelding. PDF-gereedschap dekt samenvoegen, splitsen, pagina\'s verwijderen en extraheren, en annoteren.',

    transcriptionTitle: 'AI-transcriptie',
    transcriptionBody: 'Selecteer een audio- of videobestand en kies TXT, SRT of VTT als uitvoerformaat om spraak met Whisper naar tekst om te zetten. Het model draait op uw eigen computer: de eerste keer wordt het eenmalig gedownload, daarna werkt alles offline.',

    automationTitle: 'Automatisering en mappen bewaken',
    automationBody: 'Onder Automatisering kunt u de app naar een map laten kijken. Elk bestand dat u in die map plaatst, wordt automatisch geconverteerd volgens de regel die u instelt. Handig voor opnames of scans die altijd dezelfde behandeling nodig hebben.',

    dependenciesTitle: 'Ontbrekende programma\'s',
    dependenciesBody: 'Een paar conversies maken gebruik van externe programma\'s die niet zijn meegeleverd. Ontbreekt er een, dan vertelt de app welk programma het is en hoe u het installeert. Alles rond audio, video en afbeeldingen werkt zonder extra installatie.',

    troubleshootingTitle: 'Als er iets misgaat',
    troubleshootingBody: 'Het bestand heeft niet de kwaliteit die ik verwachtte — controleer de kwaliteitskeuze vóór het converteren; de app onthoudt de laatste waarde die u gebruikte.\n\nDe conversie is mislukt — open Geschiedenis en klik op het item om de foutmelding te zien. De meest voorkomende oorzaken zijn een beschadigd bronbestand of een formaat waarnaar de broncodec niet geschreven kan worden.\n\nIk kan het resultaat niet vinden — het staat in dezelfde map als het bronbestand. Klik op een item in Geschiedenis om het te openen.\n\nDe app vraagt om een programma dat ik niet heb — zie Ontbrekende programma\'s hierboven.',

    privacyTitle: 'Privacy',
    privacyBody: 'Alle conversies draaien lokaal. Uw bestanden verlaten uw computer nooit, de app heeft geen internetverbinding nodig om te converteren en er worden geen gebruiksgegevens over uw bestanden verzameld.'
  }
};
