#!/usr/bin/env python3
"""Builds the Hiku homepage in its six languages from tools/site_template.html.

    python3 tools/build_site.py

Norwegian is the root page, index.html, and keeps the #personvern and #support anchors the App Store links to.
The others go to en/, sv/, da/, fi/ and de/. The game description, the rule and the story of the name come from the
App Store texts in the app's repository, so the site and the store say the same.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP_REPO = ROOT.parent / "clean-jump"
DOMAIN = "https://hikupuzzle.com/"
LANGS = ["nb", "en", "sv", "da", "fi", "de"]
NATIVE = {"nb": "Norsk", "en": "English", "sv": "Svenska", "da": "Dansk", "fi": "Suomi", "de": "Deutsch"}
GUIDE = {l: ("embed.html" if l == "nb" else f"embed-{l}.html") for l in LANGS}
APP = "https://apps.apple.com/app/apple-store/id6816387508?pt=121709952&amp;ct=web-home-{lang}&amp;mt=8"

TITLE = {"nb": "et rolig tallspill", "en": "a calm number puzzle", "sv": "ett lugnt sifferspel", "da": "et roligt talspil",
         "fi": "rauhallinen numeropeli", "de": "ein ruhiges Zahlenrätsel"}

UI = {
"nb": dict(
  theme_auto="Automatisk", theme_light="Lys", theme_dark="Mørk", theme_label="Lys eller mørk",
  description="Hiku er et rolig tallspill: tallet sier hvor langt det hopper. Fire nye brett hver dag, i nettleseren og i appen for iPhone.",
  nav_play="Spill", nav_app="Appen", nav_news="For aviser", nav_math="Matematikken",
  play_cta="Spill dagens brett", app_cta="Last ned for iPhone", today="Dagens Hiku", today_note="Fire nye brett hver dag, fra lett til ekspert. Nye ved midnatt.",
  app_title="Appen for iPhone", app_extra="I appen er det 50 brett i tillegg til Dagens Hiku, og de første lærer deg knepene ett for ett.",
  shots=["Startsiden med Dagens Hiku", "Et brett med buene som viser hvor tallet kan hoppe", "Mørk modus"],
  news_title="For aviser og nettsteder", news_text="Dagens Hiku kan bygges inn gratis på en nettavis eller nettside med to linjer kode. Ingen informasjonskapsler, ingen sporing, og spillet er på seks språk.",
  news_link="Slik bygger du det inn", news_try="Prøv innstillingene",
  math_title="Matematikken bak Hiku", math_text="Hvorfor går noen brett ikke opp, og hvor langt fram må du se på et ekspertbrett? Artikkelen viser at summen alltid beholder sin paritet, at brettet deler seg i grupper som aldri møtes igjen, og at tallene i hver gruppe må kunne deles i to hauger med lik sum. Om spillet er NP-komplett, er fortsatt åpent.",
  math_link="Les artikkelen (engelsk, PDF)",
  privacy_title="Personvern",
  privacy=["<strong>Hiku samler ingen personopplysninger.</strong> Appen har ingen konto og ingen reklame, og den sporer deg ikke på tvers av apper eller nettsteder.",
           "Hvilke brett du har løst, stjernene dine og Dagens Hiku lagres bare på din egen telefon. Widgeten leser de samme tallene der. Alt slettes hvis du sletter appen.",
           "Fra versjon 1.2 sender appen noen få anonyme milepæler, slik at vi kan se hvor langt spillerne kommer: når du har løst 1, 9, 10, 20, 30, 40 eller 50 brett (og 100, 150 og 200), når du løser et brett i Dagens Hiku og på hvilket nivå, og når rekken din med Dagens Hiku når 3, 7, 14, 30 dager eller mer. Milepælene sendes til <a href=\"https://telemetrydeck.com/privacy\">TelemetryDeck</a>, en europeisk analysetjeneste laget for personvern. De inneholder ingen navn, e-post, posisjon eller annet som kan knyttes til deg; installasjonen får et tilfeldig nummer som gjøres om til en enveis-kode før det sendes. Vi bruker tallene bare til å gjøre spillet bedre.",
           "Dagens Hiku i nettleseren setter ingen informasjonskapsler og sender ingen spilldata. Resultatene dine lagres bare i nettleseren din. Nettsiden teller besøk med Cloudflare Web Analytics, som ikke bruker informasjonskapsler og ikke følger deg mellom nettsider: vi ser hvor mange som kom og fra hvilket nettsted, ikke hvem."],
  support_title="Support", support_text="Har du spørsmål, har du funnet en feil, eller sitter du fast på et brett? Send en e-post til <a href=\"mailto:es@rubberduck.no\">es@rubberduck.no</a>.",
  language="Språk", made="Laget i Norge av Espen Schulstad."),
"en": dict(
  theme_auto="Automatic", theme_light="Light", theme_dark="Dark", theme_label="Light or dark",
  description="Hiku is a calm number puzzle: the number says how far it jumps. Four new boards every day, in the browser and in the iPhone app.",
  nav_play="Play", nav_app="The app", nav_news="For publishers", nav_math="The maths",
  play_cta="Play today's boards", app_cta="Get it for iPhone", today="Daily Hiku", today_note="Four new boards every day, from easy to expert. New ones at midnight.",
  app_title="The iPhone app", app_extra="The app has 50 levels on top of Daily Hiku, and the first ones teach you the tricks one at a time.",
  shots=["The home screen with Daily Hiku", "A board with the arcs showing where a number can jump", "Dark mode"],
  news_title="For news sites and publishers", news_text="Daily Hiku can be embedded for free on a news site or any web page with two lines of code. No cookies, no tracking, and the game speaks six languages.",
  news_link="How to embed it", news_try="Try the settings",
  math_title="The mathematics of Hiku", math_text="Why do some boards go wrong, and how far ahead must you look on an expert board? The paper shows that the sum always keeps its parity, that a board splits into groups that never meet again, and that the numbers of each group must split into two piles with equal sums. Whether the game is NP-complete is still open.",
  math_link="Read the paper (PDF)",
  privacy_title="Privacy",
  privacy=["<strong>Hiku collects no personal data.</strong> There is no account and no advertising, and it does not track you across apps or websites.",
           "Your solved levels, your stars and your Daily Hiku results stay on your phone; the widget reads them there. Everything is deleted if you delete the app.",
           "From version 1.2 the app sends a few anonymous milestones so we can see how far players get: reaching 1, 9, 10, 20, 30, 40 or 50 cleared levels (and 100, 150, 200), solving a Daily Hiku board and its difficulty, and a Daily Hiku streak of 3, 7, 14, 30 days or more. They go to <a href=\"https://telemetrydeck.com/privacy\">TelemetryDeck</a>, a privacy-focused European analytics service, and contain nothing that identifies you: the install gets a random number that is hashed one way before it is sent. We use the numbers only to improve the game.",
           "Daily Hiku in the browser sets no cookies and sends no game data. Your results stay in your browser. The site counts visits with Cloudflare Web Analytics, which uses no cookies and does not follow you between sites: we see how many came and from which site, not who."],
  support_title="Support", support_text="Questions, found a bug, or stuck on a board? Email <a href=\"mailto:es@rubberduck.no\">es@rubberduck.no</a>.",
  language="Language", made="Made in Norway by Espen Schulstad."),
"sv": dict(
  theme_auto="Automatiskt", theme_light="Ljust", theme_dark="Mörkt", theme_label="Ljust eller mörkt",
  description="Hiku är ett lugnt sifferspel: talet säger hur långt det hoppar. Fyra nya bräden varje dag, i webbläsaren och i appen för iPhone.",
  nav_play="Spela", nav_app="Appen", nav_news="För tidningar", nav_math="Matematiken",
  play_cta="Spela dagens bräden", app_cta="Hämta för iPhone", today="Dagens Hiku", today_note="Fyra nya bräden varje dag, från lätt till expert. Nya vid midnatt.",
  app_title="Appen för iPhone", app_extra="I appen finns 50 banor utöver Dagens Hiku, och de första lär dig knepen ett i taget.",
  shots=["Startsidan med Dagens Hiku", "Ett bräde med bågarna som visar vart talet kan hoppa", "Mörkt läge"],
  news_title="För tidningar och webbplatser", news_text="Dagens Hiku kan bäddas in gratis på en nyhetssajt eller webbplats med två rader kod. Inga kakor, ingen spårning, och spelet finns på sex språk.",
  news_link="Så bäddar du in det", news_try="Prova inställningarna",
  math_title="Matematiken bakom Hiku", math_text="Varför går vissa bräden inte att lösa, och hur långt fram måste du se på ett expertbräde? Artikeln visar att summans paritet aldrig ändras, att brädet delar sig i grupper som aldrig möts igen, och att talen i varje grupp måste kunna delas i två högar med lika summa. Om spelet är NP-fullständigt är fortfarande en öppen fråga.",
  math_link="Läs artikeln (engelska, PDF)",
  privacy_title="Integritet",
  privacy=["<strong>Hiku samlar inga personuppgifter.</strong> Appen har inget konto och ingen reklam, och den spårar dig inte mellan appar eller webbplatser.",
           "Vilka banor du har löst, dina stjärnor och Dagens Hiku sparas bara på din egen telefon. Widgeten läser samma siffror där. Allt raderas om du tar bort appen.",
           "Från version 1.2 skickar appen några få anonyma milstolpar så att vi kan se hur långt spelarna kommer: när du har löst 1, 9, 10, 20, 30, 40 eller 50 banor (och 100, 150 och 200), när du löser ett bräde i Dagens Hiku och på vilken nivå, och när din svit med Dagens Hiku når 3, 7, 14, 30 dagar eller mer. Milstolparna skickas till <a href=\"https://telemetrydeck.com/privacy\">TelemetryDeck</a>, en europeisk analystjänst byggd för integritet. De innehåller inget namn, ingen e-post, ingen plats eller annat som kan kopplas till dig; installationen får ett slumpat nummer som görs om till en envägskod innan det skickas. Vi använder siffrorna bara för att göra spelet bättre.",
           "Dagens Hiku i webbläsaren sätter inga kakor och skickar inga speldata. Dina resultat sparas bara i din webbläsare. Webbplatsen räknar besök med Cloudflare Web Analytics, som inte använder kakor och inte följer dig mellan webbplatser: vi ser hur många som kom och från vilken webbplats, inte vem."],
  support_title="Support", support_text="Har du frågor, har du hittat ett fel, eller sitter du fast på ett bräde? Skicka e-post till <a href=\"mailto:es@rubberduck.no\">es@rubberduck.no</a>.",
  language="Språk", made="Gjort i Norge av Espen Schulstad."),
"da": dict(
  theme_auto="Automatisk", theme_light="Lyst", theme_dark="Mørkt", theme_label="Lyst eller mørkt",
  description="Hiku er et roligt talspil: tallet siger, hvor langt det springer. Fire nye brætter hver dag, i browseren og i appen til iPhone.",
  nav_play="Spil", nav_app="Appen", nav_news="For medier", nav_math="Matematikken",
  play_cta="Spil dagens brætter", app_cta="Hent til iPhone", today="Dagens Hiku", today_note="Fire nye brætter hver dag, fra let til ekspert. Nye ved midnat.",
  app_title="Appen til iPhone", app_extra="I appen er der 50 baner ud over Dagens Hiku, og de første lærer dig tricksene ét ad gangen.",
  shots=["Forsiden med Dagens Hiku", "Et bræt med buerne, der viser, hvor tallet kan springe", "Mørk tilstand"],
  news_title="For medier og websites", news_text="Dagens Hiku kan indlejres gratis på et netmedie eller website med to linjer kode. Ingen cookies, ingen sporing, og spillet findes på seks sprog.",
  news_link="Sådan indlejrer du det", news_try="Prøv indstillingerne",
  math_title="Matematikken bag Hiku", math_text="Hvorfor kan nogle brætter ikke løses, og hvor langt frem skal du se på et ekspertbræt? Artiklen viser, at summens paritet aldrig ændrer sig, at brættet deler sig i grupper, der aldrig mødes igen, og at tallene i hver gruppe skal kunne deles i to bunker med samme sum. Om spillet er NP-komplet, er stadig et åbent spørgsmål.",
  math_link="Læs artiklen (engelsk, PDF)",
  privacy_title="Privatliv",
  privacy=["<strong>Hiku indsamler ingen personoplysninger.</strong> Appen har ingen konto og ingen reklamer, og den sporer dig ikke på tværs af apps eller websites.",
           "Hvilke baner du har løst, dine stjerner og Dagens Hiku gemmes kun på din egen telefon. Widgetten læser de samme tal der. Alt slettes, hvis du sletter appen.",
           "Fra version 1.2 sender appen nogle få anonyme milepæle, så vi kan se, hvor langt spillerne når: når du har løst 1, 9, 10, 20, 30, 40 eller 50 baner (og 100, 150 og 200), når du løser et bræt i Dagens Hiku og på hvilket niveau, og når din stime med Dagens Hiku når 3, 7, 14, 30 dage eller mere. Milepælene sendes til <a href=\"https://telemetrydeck.com/privacy\">TelemetryDeck</a>, en europæisk analysetjeneste bygget til privatliv. De indeholder intet navn, ingen e-mail, ingen placering eller andet, der kan kobles til dig; installationen får et tilfældigt nummer, der laves om til en envejskode, før det sendes. Vi bruger kun tallene til at gøre spillet bedre.",
           "Dagens Hiku i browseren sætter ingen cookies og sender ingen spildata. Dine resultater gemmes kun i din browser. Websitet tæller besøg med Cloudflare Web Analytics, som ikke bruger cookies og ikke følger dig mellem websites: vi ser, hvor mange der kom og fra hvilket website, ikke hvem."],
  support_title="Support", support_text="Har du spørgsmål, har du fundet en fejl, eller sidder du fast på et bræt? Skriv til <a href=\"mailto:es@rubberduck.no\">es@rubberduck.no</a>.",
  language="Sprog", made="Lavet i Norge af Espen Schulstad."),
"fi": dict(
  theme_auto="Automaattinen", theme_light="Vaalea", theme_dark="Tumma", theme_label="Vaalea vai tumma",
  description="Hiku on rauhallinen numeropeli: luku kertoo, kuinka pitkälle se hyppää. Neljä uutta lautaa joka päivä selaimessa ja iPhone-sovelluksessa.",
  nav_play="Pelaa", nav_app="Sovellus", nav_news="Medioille", nav_math="Matematiikka",
  play_cta="Pelaa päivän lautoja", app_cta="Lataa iPhonelle", today="Päivän Hiku", today_note="Neljä uutta lautaa joka päivä, helposta asiantuntijaan. Uudet keskiyöllä.",
  app_title="Sovellus iPhonelle", app_extra="Sovelluksessa on Päivän Hikun lisäksi 50 tasoa, ja ensimmäiset opettavat niksit yksi kerrallaan.",
  shots=["Etusivu ja Päivän Hiku", "Lauta, jonka kaaret näyttävät, minne luku voi hypätä", "Tumma tila"],
  news_title="Uutissivustoille ja julkaisijoille", news_text="Päivän Hikun voi upottaa maksutta uutissivustolle tai verkkosivulle kahdella rivillä koodia. Ei evästeitä, ei seurantaa, ja peli toimii kuudella kielellä.",
  news_link="Näin upotat sen", news_try="Kokeile asetuksia",
  math_title="Hikun matematiikka", math_text="Miksi osaa laudoista ei voi ratkaista, ja kuinka pitkälle eteenpäin asiantuntijalaudalla pitää nähdä? Artikkeli näyttää, että summan pariteetti ei koskaan muutu, että lauta jakautuu ryhmiin, jotka eivät enää kohtaa, ja että jokaisen ryhmän luvut on voitava jakaa kahteen kasaan, joiden summat ovat samat. Onko peli NP-täydellinen, on yhä avoin kysymys.",
  math_link="Lue artikkeli (englanniksi, PDF)",
  privacy_title="Tietosuoja",
  privacy=["<strong>Hiku ei kerää henkilötietoja.</strong> Sovelluksessa ei ole tiliä eikä mainoksia, eikä se seuraa sinua sovellusten tai verkkosivustojen välillä.",
           "Ratkaisemasi tasot, tähtesi ja Päivän Hikun tulokset tallentuvat vain omaan puhelimeesi. Widget lukee samat tiedot sieltä. Kaikki poistuu, jos poistat sovelluksen.",
           "Versiosta 1.2 alkaen sovellus lähettää muutaman nimettömän virstanpylvään, jotta näemme, kuinka pitkälle pelaajat etenevät: kun olet ratkaissut 1, 9, 10, 20, 30, 40 tai 50 tasoa (sekä 100, 150 ja 200), kun ratkaiset Päivän Hikun laudan ja millä tasolla, ja kun Päivän Hiku -putkesi saavuttaa 3, 7, 14, 30 päivää tai enemmän. Ne lähetetään <a href=\"https://telemetrydeck.com/privacy\">TelemetryDeckille</a>, tietosuojaa varten tehdylle eurooppalaiselle analytiikkapalvelulle. Niissä ei ole nimeä, sähköpostia, sijaintia tai muuta, joka voitaisiin yhdistää sinuun; asennus saa satunnaisen numeron, josta tehdään yksisuuntainen tiiviste ennen lähettämistä. Käytämme lukuja vain pelin parantamiseen.",
           "Selaimen Päivän Hiku ei aseta evästeitä eikä lähetä pelitietoja. Tuloksesi tallentuvat vain selaimeesi. Sivusto laskee käynnit Cloudflare Web Analyticsilla, joka ei käytä evästeitä eikä seuraa sinua sivustolta toiselle: näemme, kuinka moni tuli ja miltä sivustolta, emme sitä, kuka."],
  support_title="Tuki", support_text="Kysyttävää, löysitkö virheen, vai oletko jumissa laudalla? Lähetä sähköpostia osoitteeseen <a href=\"mailto:es@rubberduck.no\">es@rubberduck.no</a>.",
  language="Kieli", made="Tehty Norjassa, tekijänä Espen Schulstad."),
"de": dict(
  theme_auto="Automatisch", theme_light="Hell", theme_dark="Dunkel", theme_label="Hell oder dunkel",
  description="Hiku ist ein ruhiges Zahlenrätsel: Die Zahl sagt, wie weit sie springt. Jeden Tag vier neue Bretter, im Browser und in der App für iPhone.",
  nav_play="Spielen", nav_app="Die App", nav_news="Für Verlage", nav_math="Die Mathematik",
  play_cta="Die Bretter von heute spielen", app_cta="Für iPhone laden", today="Hiku des Tages", today_note="Vier neue Bretter jeden Tag, von leicht bis Experte. Neue um Mitternacht.",
  app_title="Die App für iPhone", app_extra="Die App hat 50 Level zusätzlich zu Hiku des Tages, und die ersten zeigen dir die Kniffe einen nach dem anderen.",
  shots=["Die Startseite mit Hiku des Tages", "Ein Brett mit den Bögen, die zeigen, wohin eine Zahl springen kann", "Dunkler Modus"],
  news_title="Für Nachrichtenseiten und Verlage", news_text="Hiku des Tages lässt sich kostenlos mit zwei Zeilen Code in eine Nachrichtenseite oder Website einbinden. Keine Cookies, kein Tracking, und das Spiel spricht sechs Sprachen.",
  news_link="So binden Sie es ein", news_try="Einstellungen ausprobieren",
  math_title="Die Mathematik hinter Hiku", math_text="Warum lassen sich manche Bretter nicht lösen, und wie weit muss man auf einem Expertenbrett vorausdenken? Der Artikel zeigt, dass die Parität der Summe erhalten bleibt, dass ein Brett in Gruppen zerfällt, die sich nie wieder treffen, und dass sich die Zahlen jeder Gruppe in zwei Haufen mit gleicher Summe teilen lassen müssen. Ob das Spiel NP-vollständig ist, ist noch offen.",
  math_link="Artikel lesen (Englisch, PDF)",
  privacy_title="Datenschutz",
  privacy=["<strong>Hiku erhebt keine personenbezogenen Daten.</strong> Die App hat kein Konto und keine Werbung und verfolgt dich nicht über Apps oder Websites hinweg.",
           "Welche Level du gelöst hast, deine Sterne und Hiku des Tages werden nur auf deinem Telefon gespeichert. Das Widget liest dieselben Daten dort. Alles wird gelöscht, wenn du die App löschst.",
           "Ab Version 1.2 sendet die App einige anonyme Meilensteine, damit wir sehen, wie weit Spieler kommen: wenn du 1, 9, 10, 20, 30, 40 oder 50 Level gelöst hast (und 100, 150 und 200), wenn du ein Brett von Hiku des Tages löst und auf welchem Level, und wenn deine Serie bei Hiku des Tages 3, 7, 14, 30 Tage oder mehr erreicht. Sie gehen an <a href=\"https://telemetrydeck.com/privacy\">TelemetryDeck</a>, einen europäischen, auf Datenschutz ausgelegten Analysedienst. Sie enthalten keinen Namen, keine E-Mail, keinen Standort und nichts, was sich dir zuordnen lässt; die Installation erhält eine Zufallsnummer, die vor dem Senden einweg-gehasht wird. Wir nutzen die Zahlen nur, um das Spiel zu verbessern.",
           "Hiku des Tages im Browser setzt keine Cookies und sendet keine Spieldaten. Deine Ergebnisse bleiben in deinem Browser. Die Website zählt Besuche mit Cloudflare Web Analytics, das keine Cookies nutzt und dich nicht über Websites hinweg verfolgt: Wir sehen, wie viele kamen und von welcher Website, nicht wer."],
  support_title="Support", support_text="Fragen, einen Fehler gefunden oder bei einem Brett festgesteckt? Schreib an <a href=\"mailto:es@rubberduck.no\">es@rubberduck.no</a>.",
  language="Sprache", made="Gemacht in Norwegen von Espen Schulstad."),
}


def store_text(lang):
    """The App Store description and promotional text, split into the parts the page uses."""
    file = "en" if lang == "en" else lang
    s = (APP_REPO / f"AppStore/1.3/metadata/{file}.md").read_text(encoding="utf-8")
    promo = re.search(r"\*\*Reklametekst\*\*[^\n]*\n(.*?)\n\n", s, re.S).group(1).strip()
    desc = re.search(r"\*\*Beskrivelse\*\*[^\n]*\n(.*?)\n\n\*\*Nøkkelord", s, re.S).group(1)
    blocks = desc.split("\n\n")
    bullets = [b[2:] for b in blocks[2].split("\n") if b.startswith("• ")]
    bullets[0] = bullets[0].split(" – ")[0]
    how_title, how_first = blocks[3].split("\n", 1)
    name_title, name_first = blocks[7].split("\n", 1)
    return dict(tagline=blocks[0], rule=blocks[1], bullets=bullets, promo=promo,
                how_title=how_title, how=[how_first] + blocks[4:7], name_title=name_title, name=[name_first, blocks[8]])


def build(lang, template):
    t = UI[lang]
    st = store_text(lang)
    root = "" if lang == "nb" else "../"
    here = DOMAIN + ("" if lang == "nb" else f"{lang}/")
    v = dict(t)
    v.update(
        lang=lang, root=root, canonical=here, title="Hiku – " + TITLE[lang],
        tagline=st["tagline"], rule=st["rule"], promo=st["promo"], how_title=st["how_title"], name_title=st["name_title"],
        bullets="".join(f"<li>{b}</li>" for b in st["bullets"]),
        how="".join(f"<p>{p}</p>" for p in st["how"]),
        name="".join(f"<p>{p}</p>" for p in st["name"]),
        privacy="".join(f"<p>{p}</p>" for p in t["privacy"]),
        shots="".join(f'<img src="{root}img/{lang}/{f}.jpg" alt="{a}" width="480" height="1043" loading="lazy">'
                      for f, a in zip(["0-hjem", "1-regel", "5-morkt"], t["shots"])),
        app=APP.format(lang=lang), guide=f"{root}daily/{GUIDE[lang]}",
        switcher=" · ".join(f'<a href="{root}{"" if l == "nb" else l + "/"}" hreflang="{l}" lang="{l}"'
                            + (' aria-current="page"' if l == lang else "") + f">{NATIVE[l]}</a>" for l in LANGS),
        alternates="\n".join(f'<link rel="alternate" hreflang="{l}" href="{DOMAIN}{"" if l == "nb" else l + "/"}">' for l in LANGS),
        english_privacy="" if lang != "nb" else
            '<section class="en" lang="en" id="privacy"><h3>Privacy (English)</h3>' + "".join(f"<p>{p}</p>" for p in UI["en"]["privacy"]) +
            f'<h3>Support</h3><p>{UI["en"]["support_text"]}</p></section>',
    )
    out = template
    for key, value in v.items():
        if isinstance(value, str):
            out = out.replace("{{" + key + "}}", value)
    assert "{{" not in out, out[out.index("{{"):out.index("{{") + 40]
    return out


if __name__ == "__main__":
    template = (ROOT / "tools/site_template.html").read_text(encoding="utf-8")
    for lang in LANGS:
        path = ROOT / ("index.html" if lang == "nb" else f"{lang}/index.html")
        path.parent.mkdir(exist_ok=True)
        path.write_text(build(lang, template), encoding="utf-8")
        print("wrote", path.relative_to(ROOT))
