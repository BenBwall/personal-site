<script lang="ts">
  import { asset } from '$app/paths';
  import ArcadaMap from '$lib/components/ArcadaMap.svelte';
  import { Heading, Text } from '$lib/components/typography';

  const galleryPhotos = [
    { alt: 'Jag i kavaj och slips inför en sitz.', id: 'portrait', label: 'Kavaj och slips' },
    { alt: 'Mina byxor och bruna skor inför sitzen.', id: 'outfit', label: 'Byxor och skor' },
    {
      alt: 'Jag uppklädd med solglasögon inför sitzen.',
      id: 'sunglasses',
      label: 'Solglasögon',
    },
  ] as const;

  const titles = {
    ai: ['Användning av generativ AI', 7],
    media: ['Media, animationer, innehåll och script', 3],
    minesweeper: ['Minesweeper', 6],
    planering: ['Planering, specifikation och omfattning', 1],
    struktur: ['Struktur, stil och responsivitet', 2],
    validering: ['Validering', 4],
    webbrapport: ['Webbrapport', 5],
  } as const;

  const titleKeys = [
    'planering',
    'struktur',
    'media',
    'validering',
    'webbrapport',
    'minesweeper',
    'ai',
  ] as const;

  const getTitle = (key: (typeof titleKeys)[number]) => `${titles[key][1]}. ${titles[key][0]}`;
</script>

<svelte:head>
  <title>Rapport | Ben Bergenwall</title>
  <meta
    name="description"
    content="Webbrapport för kursprojektet i Webbutveckling: planering, design, teknik, validering och reflektion kring min personliga webbplats."
  />
</svelte:head>

<article class="rapport" lang="sv-FI" aria-labelledby="rapport-title">
  <header class="rapport-intro">
    <Heading level={1} id="rapport-title">Rapport</Heading>
  </header>

  <nav class="contents" aria-label="Rapportens innehåll">
    <ol>
      {#each titleKeys as section (section)}
        <li><a href={`#${section}`}>{titles[section][0]}</a></li>
      {/each}
    </ol>
  </nav>

  <section id="planering" aria-labelledby="planering-title">
    <Heading level={2} size={3} id="planering-title">{getTitle('planering')}</Heading>
    <Text>
      Jag visste från början att jag ville göra en personlig portfoliosajt. Jag hade inget centralt
      ställe för att samla information om mig och mina projekt, och det är också bra att ha mitt CV
      online.
    </Text>
    <Text>
      Min plan var från början att ha fyra sidor på sajten: en startsida med ett kort intro om mig,
      en CV-sida, en projektsida och en blogg. Jag valde att vänta med bloggen eftersom jag inte har
      något innehåll att lägga upp ännu.
    </Text>
    <Text>
      Jag hade en ganska vag plan när jag började bygga sajten. Tanken var att jag skulle lista ut
      vad jag ville ha medan jag jobbade på den.
    </Text>
    <Text>
      Sajten är byggd med SvelteKit. Jag började med vanilla JS, men blev trött på att inte ha
      tillgång till bland annat TypeScript, scoped CSS och återanvändbara komponenter. Efter ett par
      dagar med Svelte bytte jag till Lit, eftersom jag ville att koden som syns i webbläsarens
      utvecklarverktyg skulle vara läsbar. Men sedan blev jag irriterad på att sajten inte syntes
      direkt när man öppnade den. Webbkomponenterna som Lit skapade började inte laddas ner förrän
      efter sidans första rendering. Jag gillade också Svelte bättre och skulle ändå ha skrivit om
      sajten efter kursen, även utan det problemet. Så jag bytte tillbaka till Svelte.
    </Text>
    <Text>
      Målgruppen är potentiella arbetsgivare, folk som vill veta mera om mig, de som vill läsa min
      blogg (om jag någonsin gör en) och de som vill spela Minesweeper eller andra spel.
    </Text>

    <Heading level={3} size={4}>Sidkarta och navigation</Heading>
    <div class="diagram-content">
      <img
        class="diagram"
        src={asset('/images/site-map.svg')}
        alt="Sidkarta med länkar mellan Home, Resume och Projects."
        width="554"
        height="244"
        loading="lazy"
      />
    </div>

    <Heading level={3} size={4}>Layout, färger, typsnitt och bildval</Heading>
    <div class="diagram-content">
      <img
        class="diagram"
        src={asset('/images/layout-diagram.svg')}
        alt="Layoutskiss med en navbar överst, titel och brödtext till vänster, bilder till höger och Minesweeper nedanför."
        width="474"
        height="234"
        loading="lazy"
      />
      <Text>
        Sajten har en ganska klassisk layout, med en navbar högst upp och länkar till de olika
        sidorna. Där finns också en temameny där man kan ändra sajtens utseende. Temafärgen anges i
        OKLCH, och tema-CSS-filen skapar en färgpalett utifrån den huvudfärg man har valt. Man kan
        också slå på ett regnbågsläge för färgens olika komponenter, så att de ändras automatiskt
        med en CSS-animation.
      </Text>
      <div class="palette" role="group" aria-label="Exempel från det aktuella färgtemat">
        <div><span class="swatch surface"></span>Bakgrund</div>
        <div><span class="swatch primary"></span>Text</div>
        <div><span class="swatch accent"></span>Rubrik</div>
      </div>
      <Text>
        Under navbaren kommer sidans innehåll. Jag gjorde ingen gemensam footer eftersom jag inte
        tyckte att den behövdes. Jag har hållit sajten ganska minimalistisk. Eftersom man kan ändra
        färgerna på allting behöver innehållet också fungera med olika färgteman. Som typsnitt har
        jag valt system-ui, eftersom det gör att sajten ser naturlig ut och är lätt att läsa.
        Sans-serif används som reserv om system-ui inte stöds.
      </Text>
    </div>
  </section>

  <section id="struktur" aria-labelledby="struktur-title">
    <Heading level={2} size={3} id="struktur-title">{getTitle('struktur')}</Heading>
    <Text>
      Jag använder SvelteKit, TypeScript och Bun för att bygga sajten. Varje sida blir en färdig
      HTML-fil med egen titel, beskrivning och h1 när sajten byggs. Alla sidor använder samma
      grundlayout.
    </Text>
    <Text>
      Jag använder också float för diagrammen i rapporten. På större skärmar ligger de till höger,
      så att texten kan flyta runt layoutdiagrammet. På mindre skärmar stängs float av och
      diagrammen visas ovanför texten.
    </Text>
    <Text>
      Sajten är gjord enligt desktop-first, eftersom jag tänker att de flesta kommer att besöka den
      på en stationär eller bärbar dator. Jag har också testat den på min telefon (iPhone 13). Den
      fungerar bra på telefonen, men layouten känns lite trång ibland.
    </Text>
    <Text>Faviconen är en egen SVG med bokstaven b och transparenta hörn.</Text>
  </section>

  <section id="media" aria-labelledby="media-title">
    <Heading level={2} size={3} id="media-title">{getTitle('media')}</Heading>
    <Text>
      På startsidan använder jag picture, srcset och sizes för de två porträtten. När sajten byggs
      skapas AVIF- och WebP-versioner i flera storlekar. Webbläsaren kan då välja en bild som passar
      skärmen och dess pixeltäthet. Originalbilderna ligger separat och används inte direkt på
      sajten.
    </Text>
    <Text>
      I temamenyn kan man animera färgton, ljushet och färgstyrka med CSS-keyframes. Man kan stänga
      av animationerna om man vill, och de tar också hänsyn till enhetens inställning för minskad
      rörelse.
    </Text>

    <Heading level={3} size={4} id="bildgalleri">Bildgalleri inför sitz</Heading>
    <Text>
      Bilderna är från när jag klädde upp mig inför TLKs sitcom sitz. En större bild visas direkt i
      en iframe. Miniatyrbilderna är mindre filer och länkar till de större bilderna, som öppnas i
      samma namngivna iframe.
    </Text>
    <iframe
      class="gallery-viewer"
      name="en_bildram"
      title="Bildgalleri med bilder från när jag klädde upp mig inför en sitz"
      src={asset('/images/generated/gallery/portrait-full.webp')}
      loading="lazy"
    ></iframe>
    <nav aria-label="Välj en bild från sitzen">
      <ul class="gallery-thumbnails">
        {#each galleryPhotos as photo (photo.id)}
          <li>
            <a href={asset(`/images/generated/gallery/${photo.id}-full.webp`)} target="en_bildram">
              <img
                src={asset(`/images/generated/gallery/${photo.id}-thumbnail.webp`)}
                width="80"
                height="107"
                alt={photo.alt}
              />
              <span>{photo.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>
    <Heading level={3} size={4} id="arcada-karta">Arcada på kartan</Heading>
    <div
      class="arcada-map"
      role="region"
      aria-label="OpenStreetMap-karta över Arcada i Helsingfors"
    >
      <ArcadaMap />
    </div>

    <Heading level={3} size={4} id="demo-video">Demo av Myvm</Heading>
    <video
      class="demo-video"
      aria-label="Demo av Myvm"
      controls
      playsinline
      preload="none"
      poster={asset('/media/report/myvm-demo-poster.webp')}
      width="1920"
      height="1080"
    >
      <source src={asset('/media/report/myvm-demo.mp4')} type="video/mp4" />
      <track
        kind="captions"
        src={asset('/media/report/myvm-demo.vtt')}
        srclang="sv"
        label="Svenska (automatiska)"
        default
      />
    </video>

    <Heading level={3} size={4} id="demo-audio">Ljudspår från demon</Heading>
    <audio class="demo-audio" aria-label="Ljudspår från Myvm-demon" controls preload="none">
      <source src={asset('/media/report/myvm-demo.m4a')} type="audio/mp4" />
    </audio>
    <details class="demo-transcript">
      <summary>Automatisk transkription</summary>
      <Text>
        Här är en virtuell maskin jag byggde för några år sedan, typ fem år sedan. Den innehåller...
        Den är baserad på ett spel som heter Turing Complete.
      </Text>
      <Text>
        Den implementerar en simpel virtuell maskin med olika aritmetiska och hoppinstruktioner och
        move-instruktioner.
      </Text>
      <Text>
        Här är ett exempel på ett testprogram som printar ut en emoji genom att skriva fyra olika
        bytes till output-registret, som sen printar ut det.
      </Text>
    </details>
  </section>

  <section id="validering" aria-labelledby="validering-title">
    <Heading level={2} size={3} id="validering-title">{getTitle('validering')}</Heading>
    <Text>
      Jag har lagt till kontroller för lint, Svelte och TypeScript. Bygget kontrollerar också att
      alla sidor går att förgenerera. Jag använder Lighthouse för att kontrollera prestanda,
      tillgänglighet, bästa praxis och SEO på alla fyra sidor. Men de automatiska kontrollerna
      räcker inte för allt, så jag behöver också testa layouten och navigationen i webbläsaren.
    </Text>
    <Text>
      Jag har också kört
      <a href="https://validator.w3.org/">W3C:s HTML-validator</a> och
      <a href="https://jigsaw.w3.org/css-validator/">W3C:s CSS-validator</a> lokalt. I GitHub
      Actions finns en kontroll som kör dem på alla byggda HTML- och CSS-filer, inklusive rapporten.
      CSS-validatorn ger fortfarande fel för vissa moderna CSS-funktioner i temat, till exempel
      <code>@property</code> och <code>light-dark()</code>, som den inte har fullständigt stöd för.
    </Text>
  </section>

  <section id="webbrapport" aria-labelledby="webbrapport-title">
    <Heading level={2} size={3} id="webbrapport-title">{getTitle('webbrapport')}</Heading>
    <Text>
      Jag uppskattar att jag lade ungefär 70 timmar på projektet. Det svåraste var att bestämma vad
      jag ville bygga och vilket ramverk jag skulle använda. Till slut blev det en personlig
      portfolio med SvelteKit. Jag tyckte att projektet var kul och är nöjd med hur det gick.
    </Text>
    <Text>
      Jag hade inte använt Svelte förut, så det var kul att testa. Tidigare har jag mest använt
      React och Solid. Det var också kul att bygga Minesweeper. Algoritmen för att ge ledtrådar och
      skapa spelplaner som går att lösa utan gissningar var en intressant utmaning.
    </Text>
  </section>

  <section id="minesweeper" aria-labelledby="minesweeper-title">
    <Heading level={2} size={3} id="minesweeper-title">{getTitle('minesweeper')}</Heading>
    <Text>
      På startsidan finns ett eget Minesweeper-spel. Förutom de vanliga spelreglerna har jag lagt
      till ledtrådar med förklaringar, kontroll av flaggor och ett läge där spelplanen ska gå att
      lösa utan gissningar. Samma logiska regler används både för att hjälpa spelaren och för att
      kontrollera spelplanerna innan de visas.
    </Text>
    <Text>
      Som grund för algoritmerna använder jag Benedikt Simon Kunz examensarbete från 2024,
      <a href="https://doc.neuro.tu-berlin.de/bachelor/2024-BA-BenediktKunz.pdf">
        Approaches to creating solvable Minesweeper instances and providing assistance during game
        playing using constraint programming
      </a>. Där beskrivs hur Minesweeper kan lösas med hjälp av Constraint Solving. Min
      implementation är skriven i TypeScript och har också egna förklaringar som visar varför ett
      visst drag är säkert.
    </Text>

    <Heading level={3} size={4}>Spelregler och kontroller</Heading>
    <Text>
      Målet är att öppna alla rutor som inte innehåller en mina. Siffran i en öppnad ruta anger hur
      många av dess grannar som innehåller minor. En ruta kan ha upp till åtta grannar, eftersom
      diagonalerna också räknas. Om man öppnar en mina förlorar man. Man vinner så fort alla säkra
      rutor är öppna, och då flaggar spelet de återstående minorna automatiskt.
    </Text>
    <Text>
      Ett vanligt klick eller en tryckning öppnar en ruta. Högerklick lägger till eller tar bort en
      flagga. På telefonen gör man samma sak genom att hålla fingret på rutan i ungefär en halv
      sekund. Om man börjar scrolla avbryts ditt tryck. Flaggade rutor öppnas inte av ett vanligt
      klick. Spelet visar hur många minor som återstår att flagga genom att dra antalet flaggor från
      antalet minor. Den siffran säger alltså inget om hur många flaggor som faktiskt är rätt.
    </Text>
    <Text>
      Man kan också klicka på en redan öppnad siffra. Om antalet flaggor runt den stämmer med
      siffran öppnas alla grannar som inte är flaggade. Det gör spelet snabbare att spela, men
      flaggorna måste vara rätt placerade. Om man har flaggat fel rutor kan det här draget öppna en
      mina och avsluta spelet.
    </Text>

    <Heading level={3} size={4}>Hur spelplanen lagras och skapas</Heading>
    <Text>
      I menyn finns spelplaner med 8 × 8, 12 × 12 och 16 × 16 rutor. Svårighetsgraderna använder
      ungefär 15, 20 eller 25 procent minor. Man kan också ange egna mått och ett eget antal minor.
      Antalet rader och kolumner måste vara minst fem. Maxantalet minor är antalet rutor minus nio,
      så att det finns utrymme för en säker start även när första rutan har åtta grannar.
    </Text>
    <Text>
      I koden lagras spelplanen som en enda array. Varje ruta håller reda på om den har en mina, är
      öppnad eller flaggad och hur många minor som finns intill den. Rutans rad och kolumn räknas ut
      från dess index och spelplanens bredd. Spelet håller också reda på antalet öppnade rutor och
      flaggor, och om spelet väntar på första draget, pågår, är vunnet eller är förlorat.
    </Text>
    <Text>
      Minorna placeras först när spelaren öppnar sin första ruta. Den rutan och alla dess grannar
      undantas från placeringen, så att första draget alltid är säkert och ger en öppning utan
      intilliggande minor. För en vanlig slumpad spelplan blandas listan över tillåtna positioner
      med Fisher–Yates, och de första positionerna i listan får minor. Sedan räknas siffrorna för
      alla rutor ut.
    </Text>
    <Text>
      När en ruta med noll intilliggande minor öppnas, öppnas grannarna också. Det fortsätter genom
      det tomma området tills spelet når rutorna med siffror. Jag använder en stack med rutor som
      ska behandlas, i stället för att låta funktionen anropa sig själv för varje granne. Då
      fungerar det också för stora tomma områden utan en lång kedja av funktionsanrop.
    </Text>

    <Heading level={3} size={4}>Constraint Solving - Trivala fall</Heading>
    <Text>
      Ledtrådarna utgår från de öppnade rutornas siffror och det totala antalet minor. De tittar
      inte på var de dolda minorna faktiskt ligger. Spelarens flaggor räknas inte heller som bevis,
      eftersom en flagga kan vara fel. Algoritmen håller i stället en egen lista över rutor som den
      har bevisat är säkra eller innehåller minor.
    </Text>
    <Text>
      Först används de enkla reglerna. Om en etta bara har en oöppnad granne måste den grannen vara
      en mina. Om en mina redan är bevisad intill ettan, måste alla andra grannar vara säkra. Mera
      allmänt dras de bevisade minorna bort från siffran. Om det då inte finns några minor kvar att
      hitta är resten av grannarna säkra. Om lika många minor återstår som det finns okända grannar
      måste alla de grannarna innehålla minor.
    </Text>
    <Text>
      Det totala antalet minor kan också hjälpa. När alla minor har bevisats är alla återstående
      okända rutor säkra. Om antalet återstående minor är lika stort som antalet okända rutor, måste
      de rutorna vara minor. Algoritmen upprepar reglerna, eftersom en ny slutsats kan göra att det
      går att dra flera slutsatser runt en annan siffra.
    </Text>

    <Heading level={3} size={4}>Constraint Solving</Heading>
    <Text>
      Ibland måste flera siffror kombineras. Då behandlas varje okänd ruta som en variabel med
      värdet 0 för säker eller 1 för mina. En öppnad siffra blir ett villkor för summan av de okända
      grannarna, efter att bevisade minor har räknats bort. Om en siffra till exempel ger
      <code>A + B = 1</code> och en annan ger <code>A + B + C = 1</code>, måste C vara säker. Vi
      behöver inte veta om minan ligger i A eller B för att kunna öppna C.
    </Text>
    <Text>
      Algoritmen delar upp villkoren i grupper som delar okända rutor med varandra. Grupper som inte
      hänger ihop kan undersökas separat. Inom varje grupp prövas möjliga kombinationer av minor och
      säkra rutor med backtracking. Om en kombination redan har för många minor för en siffra, eller
      för få platser kvar för att nå rätt antal, avbryts den grenen direkt. Rutor som ingår i många
      villkor undersöks först, så att felaktiga kombinationer kan upptäckas tidigt.
    </Text>
    <Text>
      En ruta får bara bli en ledtråd om den har samma värde i alla giltiga kombinationer. Om den
      kan vara både säker och en mina så går det inte att dra säkra slutsatser. Algoritmen räknar
      alltså inte ut vilken ruta som verkar mest sannolik att vara säker. För att förhindra sökandet
      från att ta alltför länge så används en gräns på 50 000 söknoder per sådan delberäkning. Denna
      gräns valdes arbiträrt baserat på vad som verkar fungera bra på min dator. Om gränsen nås
      lämnas den beräkningen utan resultat. Därför kan algoritmen missa ett möjligt drag, men den
      använder inte en ofullständig sökning som bevis för att en ruta är säker.
    </Text>

    <Heading level={3} size={4}>Förklaringar och kontroll av flaggor</Heading>
    <Text>
      En ledtråd innehåller både ett föreslaget drag och en förklaring. De siffror och rutor som
      används i förklaringen markeras på spelplanen. För mera komplicerade drag försöker spelet
      hitta en mindre grupp villkor som räcker för att visa slutsatsen, så att spelaren inte behöver
      gå igenom hela området. Om ett bevis bygger på tidigare slutsatser sparas också de stegen. Man
      kan bläddra mellan ledtrådarna och låta spelet utföra det valda draget. Efter ett drag tas de
      gamla ledtrådarna bort, eftersom spelplanen har ändrats.
    </Text>
    <Text>
      Flaggkontrollen har två lägen. Det ena jämför flaggorna direkt med de verkliga minorna och kan
      därför säga om de är rätt eller fel. Det andra använder bara det som går att bevisa från de
      öppnade siffrorna. Där kan en flagga vara bevisat rätt, bevisat fel eller fortfarande okänd. I
      gränssnittet finns ett val för att bara rapportera flaggor som ledtrådarna bevisar är fel. Att
      inga fel hittas i det läget betyder alltså inte att alla flaggor är rätt.
    </Text>
    <Text>
      När en flagga går att bevisa är fel kan spelet visa stegen som leder till den slutsatsen. En
      säker ruta kan också få en ledtråd trots att spelaren har flaggat den. Om man låter spelet
      utföra den ledtråden tas flaggan bort innan rutan öppnas.
    </Text>

    <Heading level={3} size={4}>Spelplaner som går att lösa utan gissningar</Heading>
    <Text>
      I läget utan gissningar räcker det inte att första draget är säkert. Varje föreslagen spelplan
      testas genom att algoritmen spelar igenom den från just den ruta spelaren har valt. Den öppnar
      det första området, hittar bevisade minor och säkra rutor och fortsätter med nya slutsatser.
      Spelplanen godkänns bara om alla säkra rutor till slut går att öppna. Om algoritmen fastnar
      förkastas den, även om en annan eller mera avancerad metod kanske hade kunnat lösa den.
    </Text>
    <Text>
      Sökningen börjar med slumpade spelplaner. Standardinställningen är högst 1 000 försök och
      ungefär 400 millisekunder för den fasen. Tiden kontrolleras mellan försöken, så en enskild
      kontroll kan göra att den tar längre tid. Gränserna går att ändra i menyn, och om någon av dem
      sätts till noll hoppas slumpfasen över.
    </Text>
    <Text>
      Om ingen spelplan hittas går sökningen vidare till en metod som lägger till en mina åt gången.
      Efter varje tillägg kontrolleras att spelplanen fortfarande går att lösa. En mina som gör att
      algoritmen fastnar tas bort, och en annan position prövas. Tidigare förkastade positioner kan
      prövas igen efter ett lyckat tillägg, eftersom de nya siffrorna kan ge mera information. Om
      inga positioner återstår börjar metoden om med en tom spelplan. Det här fortsätter tills rätt
      antal minor har placerats eller spelaren avbryter sökningen.
    </Text>

    <Heading level={3} size={4}>Sökning i bakgrunden</Heading>
    <Text>
      Att testa många spelplaner kan ta tid, särskilt om det finns många rutor eller minor. Därför
      körs genereringen i en Web Worker, separat från gränssnittet. Webbläsaren kan fortsätta
      uppdatera sidan och reagera på spelarens knappar medan sökningen arbetar. Om den tar mer än en
      halv sekund visas en sökruta med förfluten tid, aktuell fas och antalet kontrollerade
      spelplaner. Under den stegvisa placeringen visas också hur många minor som har lagts till.
    </Text>
    <Text>
      Det finns ingen tidsgräns för hela sökningen. Inställningarna för tid och antal försök gäller
      bara den första slumpfasen, och en svår spelplan kan ta länge att hitta. Med
      <code>Play random board</code> kan spelaren avbryta och direkt spela en vanlig slumpad
      spelplan, där första draget fortfarande är säkert men gissningar kan behövas senare.
      <code>Back to main menu</code> avbryter också sökningen, så att man kan ändra inställningarna. När
      sökningen avslutas eller avbryts stängs workern och dess händelselyssnare tas bort.
    </Text>

    <Heading level={3} size={4}>Gränssnitt och sparat spelläge</Heading>
    <Text>
      Spelreglerna och algoritmerna ligger i separata TypeScript-filer. Svelte-komponenterna sköter
      spelplanen, menyn, tidtagningen, antalet återstående minor, ledtrådarna och meddelandena.
      Rutorna är vanliga HTML-knappar i ett CSS Grid, med etiketter som beskriver positionen och
      rutans tillstånd för skärmläsare. På en liten skärm går en stor spelplan att scrolla inom sitt
      eget område. Spelet använder sajtens färgtema, och konfettin vid en vinst tar hänsyn till
      inställningen för minskad rörelse.
    </Text>
    <Text>
      Spelet sparas automatiskt i webbläsarens localStorage. Sparningen innehåller spelplanen,
      inställningarna, flaggorna, tiden och scrollpositionen. När sidan öppnas igen kontrolleras
      sparningen med Zod, bland annat att måtten, antalet rutor och minor samt uppgifterna om
      öppnade och flaggade rutor stämmer med varandra. En ogiltig sparning, eller en som inte har
      uppdaterats på 48 timmar, används inte.
    </Text>
    <Text>
      Tidtagningen börjar när den första rutan har öppnats, så tiden som går åt till att hitta en
      spelplan räknas inte med. Om man återkommer till ett sparat pågående spel fortsätter
      tidtagningen från den sparade tiden.
    </Text>
  </section>

  <section id="ai" aria-labelledby="ai-title">
    <Heading level={2} size={3} id="ai-title">{getTitle('ai')}</Heading>
    <Text>
      Jag har använt Codex som stöd för att utveckla sajten. Codex skrev ganska mycket av koden till
      sajten. Jag har själv fattat alla beslut kring hur sajten ska se ut, vilka funktioner den ska
      ha och hur den ska fungera. Jag har läst igenom och förstår koden som Codex skrev.
    </Text>
  </section>

  <footer class="rapport-footer">
    <a href="#rapport-title">Till början av rapporten ↑</a>
  </footer>
</article>

<style>
  .rapport {
    max-width: 52rem;
    padding-block: clamp(1rem, 4vw, 3rem);
    font-family: system-ui, sans-serif;
  }

  .rapport-intro {
    max-width: 62ch;
  }

  .contents {
    margin-block: 2rem 3rem;
  }

  .contents ol {
    display: grid;
    gap: 0.75rem;
    padding-inline-start: 1.5rem;
  }

  section {
    margin-block-start: 3rem;
    scroll-margin-top: 1.5rem;
  }

  section :global(h3) {
    margin-block-start: 2rem;
  }

  .diagram-content {
    display: flow-root;
  }

  .diagram {
    display: block;
    max-width: 100%;
    height: auto;
    margin-block-end: 1rem;
  }

  @media (min-width: 48rem) {
    .diagram {
      float: inline-end;
      width: 50%;
      margin-inline-start: 1.5rem;
    }
  }

  a {
    color: light-dark(var(--color-700), var(--color-300));
    text-underline-offset: 0.25em;
    overflow-wrap: anywhere;
  }

  a:hover {
    color: light-dark(var(--color-950), var(--color-50));
  }

  a:focus-visible {
    outline: 2px solid light-dark(var(--color-600), var(--color-300));
    outline-offset: 4px;
  }

  .palette {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    padding: 1rem;
    font-size: var(--type-size-small);
  }

  .gallery-viewer {
    display: block;
    width: 272px;
    max-width: 100%;
    height: 362px;
    margin: 1.5rem auto 0;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    box-sizing: border-box;
  }

  .arcada-map {
    display: block;
    width: 100%;
    height: clamp(18rem, 45vw, 26rem);
    margin-block: 1.5rem 1rem;
    isolation: isolate;
    overflow: hidden;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.5rem;
    box-sizing: border-box;
  }

  .demo-video {
    display: block;
    width: 100%;
    height: auto;
    margin-block: 1.5rem 1rem;
    background: #000;
    border-radius: 0.5rem;
  }

  .demo-video::cue {
    font-family: system-ui, sans-serif;
    font-size: clamp(0.875rem, 2vw, 1.25rem);
  }

  .demo-audio {
    display: block;
    width: 100%;
    margin-block: 1.5rem 1rem;
  }

  .demo-transcript {
    max-width: 62ch;
    margin-block: 1rem;
  }

  .demo-transcript summary {
    cursor: pointer;
    margin-block-end: 1rem;
  }

  .gallery-thumbnails {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    max-width: 17rem;
    margin: 1rem auto 0;
    padding: 0;
    list-style: none;
  }

  .gallery-thumbnails a {
    display: grid;
    gap: 0.5rem;
    text-align: center;
  }

  .gallery-thumbnails img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.375rem;
    box-sizing: border-box;
  }

  .swatch {
    display: block;
    height: 2.75rem;
    margin-block-end: 0.5rem;
    border: 1px solid var(--theme-border-color);
    border-radius: 0.375rem;
  }

  .surface {
    background: light-dark(var(--color-complement-50), var(--color-complement-950));
  }

  .primary {
    background: light-dark(var(--color-700), var(--color-300));
  }

  .accent {
    background: var(--theme-accent-color);
  }

  .rapport-footer {
    margin-block-start: 3rem;
  }
</style>
