# GymBroFitness — plan integrat de implementare și retușare

Data: 21 septembrie 2026. Stare: implementare începută; L02–L05 și L07 sunt implementate și verificate automat, iar nucleele L06/L08/L09/L10/L11/L12/L13/L14 sunt funcționale. Maparea manuală a exercițiilor externe necunoscute, validarea pe exporturi personale reale și validarea pe dispozitive din L01/L05/L06/L10/L11/L12/L13/L14 rămân deschise.

## 1. Obiectiv și documente de referință

Livrăm o aplicație local-first în care utilizatorul își construiește sau alege programul, înregistrează rapid antrenamentele, își păstrează datele și primește recomandări explicabile. Identitatea vizuală rămâne negru/albastru; harta musculară rămâne un diferențiator, cu semnificații corecte.

Planul combină:

- [Auditul comparativ, tehnic și de design](AUDIT_2026-09-20.md).
- [Cercetarea despre antrenament](FITNESS_KNOWLEDGE_BASE.md).
- [Maparea cercetării pe cod](FITNESS_APPLICATION_PLAN.md).

Acesta este documentul principal pentru ordinea viitoare a lucrărilor. `PLAN.md` și `RESEARCH_PRODUCT_PLAN.md` rămân context istoric: unele lipsuri descrise acolo au fost deja implementate, iar propunerile despre clasamente musculare, recuperare și praguri de volum sunt revizuite aici.

Nu reluăm construcția ecranelor existente. Păstrăm Expo/React Native/TypeScript, domeniul determinist, SQLite/Drizzle și componentele utile. JSON versionat în SQLite este acceptabil; o normalizare completă sau un backend nou nu sunt condiții pentru beta.

## 2. Decizii de produs

### Regulă de implementare cerută de utilizator: reutilizare înainte de cod nou

- Folosim întâi codul și componentele existente în proiect, apoi dependențele deja instalate.
- Pentru lipsuri căutăm implementări existente pe GitHub. Preferăm descărcarea fișierelor/modulelor relevante și adaptarea lor la arhitectura actuală, când compatibilitatea tehnică și licența permit acest lucru. Nu clonăm o aplicație întreagă pentru o componentă mică.
- Folosim Hevy, Strong și celelalte produse cercetate ca referințe pentru fluxuri, organizare și interacțiuni. Referința vizuală nu implică acces sau drept de reutilizare asupra codului, imaginilor ori identității lor.
- Înainte de import verificăm licența codului și separat a asseturilor/datelor, dependențele, compatibilitatea Expo/React Native, mentenanța și eventualele obligații de distribuție. Un repository public fără licență nu este automat reutilizabil. Nu presupunem că GPL/AGPL interzic utilizarea comercială; evaluăm obligațiile concrete și compatibilitatea cu distribuția proiectului.
- Păstrăm atribuirea și fișierele de licență cerute. Pentru fiecare import consemnăm repository-ul, calea originală, commitul, licența, fișierele preluate și adaptările făcute, astfel încât proveniența să fie verificabilă.
- Codul descărcat este revizuit înainte de integrare sau executare; scripturile de instalare nu se rulează automat doar pentru că vin dintr-un repository.
- Scriem o implementare nouă numai dacă reutilizarea/adaptarea nu rezolvă cerința: de exemplu, soluțiile găsite sunt incompatibile, insuficiente sau nu pot fi reutilizate în condițiile proiectului. Documentăm scurt ce am evaluat și de ce excepția este necesară. Scriem doar partea lipsă, inclusiv integrarea și testele necesare, fără a reconstrui funcționalitatea disponibilă.
- Fiecare lot începe cu identificarea soluției existente de reutilizat și se încheie cu validarea adaptării. Descărcarea unui fișier nu dovedește că problema este rezolvată.

Această regulă se aplică tuturor loturilor de mai jos. Nu sunt necesare importuri speculative în etapa de planificare; sursa exactă se selectează pentru problema concretă la începutul implementării lotului.

1. **Prima țintă este o beta mobilă locală solidă.** Android și iOS se validează separat. Web este suprafață secundară; înainte de a-l declara suportat rezolvăm explicit SQLite/WASM și fallbackurile native.
2. **Profil local fără parolă.** Autentificarea apare odată cu un beneficiu funcțional, precum sincronizarea, după stabilizarea datelor locale.
3. **Două niveluri de detaliu în aceleași fluxuri.** Logging simplu implicit; RIR, explicațiile progresiei și analiza volumului disponibile contextual. Nu construim două aplicații sau motoare divergente.
4. **Sugestii cu control manual.** Recomandarea arată motivul, datele folosite și poate fi refuzată. Nu rescrie retroactiv antrenamentele finalizate.
5. **Date, estimări și necunoscut sunt stări distincte.** Fără scoruri demo prezentate ca personale, recuperare „măsurată” sau certitudine derivată din date lipsă.
6. **Calitatea vizuală însoțește fiecare flux.** Contrastul, tastatura, erorile și stările goale se rezolvă în etapa respectivă; polishul final se ocupă de consistență și detalii.

## 3. Succesiune și dependențe

| Etapă | Rezultat                                       | Dependențe             | Prag de trecere                                 |
| ----- | ---------------------------------------------- | ---------------------- | ----------------------------------------------- |
| E0    | Bază verificabilă și matrice de platforme      | Niciuna                | Știm ce rulează și avem scenarii reproductibile |
| E1    | Date păstrate și salvare sigură                | E0                     | Erorile/restartul nu pierd sesiuni              |
| E2    | Logger rapid, unități și timer corecte         | E1                     | Antrenament complet verificat pe mobil          |
| E3    | Motor și indicatori cu afirmații corecte       | E1; integrare după E2  | Recomandări explicabile, fără certitudine falsă |
| E4    | Navigare, onboarding și Home coerente          | E2–E3                  | Parcursul nou și cel de revenire sunt clare     |
| E5    | Program, Atlas și Progres conectate            | E3–E4                  | Aceleași date și identități în toate ecranele   |
| E6    | Backup, import și pregătire pentru distribuție | E1; finalizare după E5 | Restaurare verificată și builduri testate       |
| E7    | Verificare finală și beta                      | E0–E6                  | Criteriile de beta îndeplinite                  |

La începutul E0 putem pregăti specificațiile vizuale și textele, fără a modifica fluxuri bazate pe date încă instabile. Nu se condiționează backupul minimal din E1 de finalizarea exportului pentru utilizator din E6.

### Progres verificat — 21 septembrie 2026

- Baseline local după nucleul L14: typecheck și lint trec; 58 suite / 337 teste trec.
- Retenția distructivă la 100 de sesiuni a fost eliminată. Citirea acceptă paginare limit/offset și folosește un index compus pentru status și ordonare stabilă.
- Importul legacy rulează într-o singură tranzacție, este idempotent după ID și păstrează cheia AsyncStorage până când întregul lot a fost confirmat în SQLite.
- JSON-ul corupt, loturile parțial invalide și eșecurile de import nu șterg originalul. Un eșec tranzitoriu poate fi reîncercat în același proces fără duplicate.
- Testele acoperă peste 100 de sesiuni, paginarea, rollback la al doilea insert, retry după eșecul ștergerii cheii și păstrarea datelor nerecuperabile automat.
- SQLite folosește acum migrări incrementale prin `PRAGMA user_version`. Migrarea v1 copiază payloadurile existente în `data_recovery` înainte de schimbarea invariantelor.
- `in_progress` și `paused` folosesc un singur index unic; eventualele drafturi legacy suplimentare sunt păstrate în recovery, iar înlocuirea draftului este atomică.
- Sesiunile și template-urile noi folosesc envelope `schemaVersion: 1`. Payloadurile legacy valide sunt promovate la citire; versiunile necunoscute și ID-urile discordante rămân în sursă și primesc o copie de recuperare.
- Profilul și programul invalid/necunoscut nu mai sunt șterse la fallback; octeții originali sunt păstrați sub cheia deterministă `/recovery`. Migrarea template-urilor este tranzacțională și reluabilă după modelul istoricului.
- Autosave, discard și finish trec printr-un controller serializat. Finish este idempotent, blochează autosave-urile stale și rămâne ultima scriere chiar dacă o salvare anterioară era deja în curs.
- Rezumatul și celebrarea apar numai după commit. La eroare, sesiunea rămâne deschisă, încearcă să-și păstreze draftul curent și afișează o acțiune explicită de retry.
- Loggerul folosește `trackingType`: greutate + repetări, bodyweight, încărcare suplimentară și secunde au câmpuri și reguli distincte. Repetările/secundele trebuie să fie întregi pozitive, iar RIR rămâne opțional.
- Intrările lb sunt convertite la kg canonic înainte de autosave; afișarea, precedentele, autofill-ul, drop-seturile și plate math respectă unitatea profilului.
- Conversia este propagată și în ținte/review, Program, Home, History, Exercise Detail, Analytics și Body. Testele de regresie acoperă 135 lb → kg → 135 lb, formatarea volumului și plank de 60 secunde.
- Timerul de pauză folosește un deadline absolut păstrat în draft, astfel încât backgroundul și restartul nu îngheață countdownul. Extensia de 30 secunde actualizează același snapshot persistent.
- Pauza întregii sesiuni păstrează `pausedAt`, oprește timerul de repaus și adaugă durata reală la `totalPausedSeconds` la resume, inclusiv după restaurarea draftului.
- Notificarea nativă când aplicația este suspendată și comportamentul cu permisiunea refuzată necesită încă validare pe Android/iOS; testele Node nu închid această parte din L06.
- Loggerul are acum rând compact cu număr, precedent, țintă, inputuri și bifă; copierea și tehnicile avansate sunt mutate în meniul contextual. Submit avansează greutate → repetări → următorul set, iar scrollul păstrează interacțiunile cu tastatura.
- RIR poate fi lăsat explicit necunoscut. Mutațiile de set și calculul navigării după completare sunt extrase în `sessionEditing`, validate înainte de commit și testate pe sesiunea actualizată.
- Home nu mai generează readiness 68–96/100 și nu mai prezintă cofeina ori mesociclul demo drept date personale. Afișează numai potrivirea RIR din istoric și sesiunile finalizate.
- Body separă încărcarea săptămânală observată de recuperare: nu mai afișează „fatigue %” și nu mai clasifică mușchii după kg brute. Recordurile rămân per exercițiu, iar reperele de volum sunt etichetate ca intervale generale, nu limite personalizate.
- Analytics nu mai folosește calendarul demo pentru săptămâna blocului sau un deload fictiv. Scorul intern al sugestiilor de înlocuire rămâne doar pentru ordonare și nu mai este expus utilizatorului.
- Motorul de progresie tratează separat prescripția incompletă, RIR lipsă și durerea auto-raportată. Deciziile au cod de motiv, versiune de regulă, intrări explicite și limitări documentate; readiness este transmis din sesiunea care a produs performanța.
- Onboardingul și setările acceptă obiective de hipertrofie, forță și mixt. Generatorul și exercițiile adăugate manual folosesc aceleași intervale de repetări și pauze specifice obiectivului, iar profilurile vechi cu hipertrofie rămân valide.
- Contextul nutrițional este opțional și poate rămâne necunoscut. Un deficit declarat blochează conservator doar adăugarea automată de volum; nu sunt generate ținte calorice sau afirmații despre recuperare. Schimbarea este înregistrată în versiunea 2 a regulilor de progresie.
- Catalogul rezolvă ID-ul stabil, slugul, numele și aliasurile neambigue către aceeași identitate canonică. Agregările istorice relevante și recordurile personale folosesc această identitate, iar recordurile noi păstrează ID-ul canonic.
- Body separă seturile directe, expunerile indirecte brute și estimarea ponderată. Modelul de contribuții secundare este versionat; doar mapările explicite primesc pondere, iar expunerile nemapate rămân vizibile fără multiplicator global implicit.
- Onboardingul local are trei pași și nu mai cere email sau parolă: nume și unități, constrângeri de antrenament, apoi previewul planului. Prioritățile și contextul avansat rămân editabile ulterior în Settings.
- Navigarea principală este redusă la Today, Plan, Progress și Exercises. Profile și Settings se deschid contextual din Today, iar Body rămâne accesibil din Progress.
- Home pune draftul activ înaintea următorului antrenament. O bară persistentă permite reluarea din taburile principale, respectă safe-area și se ascunde pe ecranul de workout sau când tastatura este vizibilă.
- `DESIGN.md` documentează rolurile semantice, ierarhia, componentele, motion și regulile de accesibilitate. Controalele compacte din onboarding/Settings au ținte minime de 44 pt, iconurile critice au etichete, iar `Reveal` respectă Reduce Motion.
- Program Library ordonează opțiunile și după obiectivul profilului, explică potrivirea, arată volumul și substituțiile de echipament, apoi cere confirmare înainte de activare. Dialogul precizează că planul activ se schimbă numai pentru antrenamentele viitoare; istoricul finalizat, recordurile, template-urile și draftul activ se păstrează.
- Ecranul Plan afișează obiectivul, echipamentul și accentul planului activ. Selecția generatorului favorizează compatibilitatea și comparabilitatea; nivelul avansat nu mai forțează dificultatea, iar varietatea săptămânală este doar un criteriu secundar slab.
- Exercises separă explicit intrările de referință de exercițiile logabile. Mapările revizuite deschid istoricul canonic și permit adăugarea într-un workout rapid; intrările nemapate nu promit istoric și nu sunt convertite automat.
- Favoritele și exercițiile recente sunt persistente, filtrabile și limitate la ID-uri de referință valide. Payloadurile locale corupte sunt copiate în cheia de recovery înainte de fallback, iar stările goale și erorile de persistență sunt explicite.
- Body și Analytics folosesc același total de seturi directe finalizate în săptămâna curentă; un test de contract previne divergența. Lipsa datelor nu mai este înlocuită cu volum programat, iar lipsa RIR este separată de un rezultat real de 0%.
- Graficele e1RM și de volum își iau lățimea din container, nu dintr-o constantă de 300 px. Punctele e1RM, sesiunile din Exercise Detail și ultima sesiune din Body deschid istoricul sursă, care evidențiază sesiunea selectată.
- Backupul JSON are manifest și versiune explicită, validează integral profilul, planul, sesiunile, draftul și template-urile înainte de import și respinge versiunile necunoscute sau ID-urile duplicate. Previewul separă elementele noi de duplicate și arată dacă draftul poate fi restaurat.
- Restaurarea păstrează o copie JSON a datelor curente înainte de prima mutație, combină istoricul și template-urile idempotent după ID, înlocuiește explicit profilul și planul și nu suprascrie un draft activ existent. Settings oferă export JSON, export CSV în kg canonic și selectarea unui backup prin modulele oficiale Expo.
- Importatorul detectează exporturile CSV Hevy și Strong din antet, citește CSV RFC4180, convertește încărcarea în kg canonic, păstrează tipul setului și transformă RPE în RIR când există. Pentru Strong, utilizatorul declară explicit unitatea deoarece exportul nu o conține.
- Sesiunile importate primesc ID-uri deterministe, astfel încât reimportul este idempotent. Previewul arată sesiunile noi/duplicate și rândurile importabile; exercițiile fără mapare canonică sunt enumerate și omise, nu create automat cu metadate inventate. Contractul adaptat din referința MIT este consemnat în `docs/THIRD_PARTY_ADAPTATIONS.md`.
- Validarea Android/iOS, buildurile native, fixture-urile de dispozitiv și CI din L01 nu sunt încă închise; nu declarăm L01 finalizat pe baza testelor Node.

## E0 — bază de lucru și validare

**Pachete**

- E0.1: reconfirmăm constatările auditului în checkoutul de implementare și inventariem modificările locale. Rezultatul anterior de 268 de teste este istoric, nu dovada că un viitor checkout trece.
- E0.2: executăm typecheck, lint și testele existente; stabilim un build de dezvoltare Android și unul iOS. Înregistrăm exact platformele verificate și blocajele externe.
- E0.3: reproducem blocajul web SQLite; reparăm configurarea sau delimităm explicit web ca nesuportat pentru beta mobilă. Camera are intrare separată pe platforme.
- E0.4: definim fixture-uri pentru profil nou, istoric lung, draft activ, date legacy, RIR lipsă și erori DB. Folosim copii de test, nu ștergem datele personale pentru a valida migrarea.
- E0.5: stabilim CI pentru typecheck/lint/test, plus build smoke disponibil în infrastructură. Documentăm pașii nativi care necesită dispozitiv sau semnare.

**Livrabil:** checklist reproductibil, baseline și capturi ale fluxurilor care rulează. Auditul vizual anterior nu a confirmat UI funcțională în preview; deciziile de layout se verifică în aplicația rulată.

## E1 — integritatea datelor și ciclul sesiunii

**Fișiere principale:** `src/domain/workouts/historyRepository.ts`, `historyStore.ts`, `src/db/schema.ts`, `src/app/(tabs)/workout.tsx`, repository-urile de template-uri și store-urile profil/program.

- E1.1: eliminăm ștergerea automată peste 100 de sesiuni; introducem paginare pentru citire și indexare unde măsurătorile o cer.
- E1.2: migrare legacy tranzacțională și reluabilă. Originalul se păstrează până la confirmarea importului; eșecurile nu șterg cheia veche. Retry nu produce duplicate.
- E1.3: introducem versiuni explicite de payload și migrații DB incrementale. Validare runtime la citire; datele nerecunoscute se păstrează pentru recuperare, fără reset silențios.
- E1.4: un singur draft reluabil indiferent dacă este activ sau pus pe pauză; operațiile aferente se fac atomic.
- E1.5: controller pentru salvare/finalizare cu operații serializate și finish idempotent. Autosave este coordonat cu finalizarea; feedbackul haptic nu decide succesul persistenței.
- E1.6: copie de recuperare înaintea migrațiilor și protecție pentru salvarea profilului/programului în mai mulți pași. Stabilim mecanismul de recuperare înainte de a migra date reale.

**UX livrat:** „Se salvează”, „Salvat”, „Salvarea a eșuat — Reîncearcă”. Draftul rămâne accesibil după eroare; celebrarea are loc după confirmarea salvării.

**Acceptare:** peste 100 de sesiuni păstrate; eșec la al doilea insert urmat de restart fără pierdere/duplicare; finish în fereastra de debounce; apăsare repetată pe finish; eroare DB; un singur draft; versiune necunoscută păstrată recuperabil.

## E2 — experiența de antrenament

**Fișiere principale:** `src/components/workout/SetRow.tsx`, `RestTimer.tsx`, ecranul workout, utilitarele de unități și tipurile sesiunii.

- E2.1: formulare adaptate la greutate/repetări, bodyweight, încărcare suplimentară și secunde. Validăm valori finite, câmpuri obligatorii și repetări întregi, fără a invalida seturi bodyweight legitime.
- E2.2: stocare canonică kg și conversie la intrare/afișare pentru toate suprafețele, inclusiv ținte, drop-seturi, calculatorul de discuri și sumar. Formatul zecimal și unitatea sunt vizibile.
- E2.3: timer cu termen absolut persistent, pauză și durată activă corecte. Revenirea din background recalculează timpul. Notificarea nativă se verifică separat, inclusiv când permisiunea este refuzată.
- E2.4: rând compact: număr set, precedent, țintă, input și bifă. Cifre aliniate; informația necesară nu depinde de microtext. Tehnicile avansate sunt în meniu contextual.
- E2.5: tastatură și focus predictibile; următorul set rămâne accesibil. RIR este opțional și are „nu știu”; precedentele sunt precompletate fără a marca setul realizat.
- E2.6: extragem controllerul sesiunii și logica de persistență din ecran pe măsură ce corectăm fluxul. Evităm o rescriere structurală separată fără rezultat observabil.

**Acceptare:** 135 lb se salvează și revine corect; plank de 60 secunde este logabil; timer corect după blocarea ecranului/restart; aceeași sesiune se restaurează; setul invalid nu poate fi confirmat; antrenament manual complet fără RIR.

## E3 — motor de antrenament și afirmații bazate pe dovezi

**Fișiere principale:** `src/domain/progression/engine.ts`, `constraints.ts`, `src/domain/programs/config.ts`, `generator.ts`, `mesocycle.ts`, `programProgression.ts`, `src/domain/workouts/analytics.ts`, `volumeLandmarks.ts`, `muscleIntelligence.ts`.

- E3.1: înlocuim „nu crești”, „junk volume” și pragurile prezentate ca verdicte cu repere orientative și explicații. Eliminăm clasamentul intermuscular după kg brute.
- E3.2: separăm încărcarea recentă estimată de recuperare. Calendarul arată faza planificată, nu confirmă overreaching. Fără scor readiness generat artificial.
- E3.3: RIR lipsă și istoric insuficient au ramuri explicite. Verificăm realizarea prescripției, comparabilitatea exercițiului și fezabilitatea incrementului înainte de progresie.
- E3.4: constrângeri distincte pentru secunde/repetări/greutate; corectăm plafonarea și rotunjirea la echipamentul disponibil. Menținerea este o decizie validă, nu o eroare.
- E3.5: obiectiv forță/hipertrofie/mixt și context menținere/surplus/deficit, inițial cu reguli conservatoare și explicabile. Nu introducem prescripții calorice automate în această etapă.
- E3.6: seturi directe și contribuții indirecte afișate separat; ponderea estimată are proveniență și versiune. Nu aplicăm mecanic 0,5 tuturor mușchilor secundari și nu dublăm numărul fizic de seturi al sesiunii.
- E3.7: registru de reguli: ID, versiune, intrări, sursă, limită, motivul deciziei și override. Snapshotul prescripției originale se păstrează în sesiune; schimbarea motorului nu rescrie istoricul.
- E3.8: check-in real și opțional pentru context relevant, transmis până în motor. Datele lipsă nu sunt înlocuite cu demo. Evităm adăugarea automată de volum doar pentru lipsa unui PR.

**Acceptare:** o sesiune incompletă nu este tratată ca prescripție realizată; un utilizator care progresează sub reperul de volum nu primește verdictul „nu crești”; două exerciții cu aparate diferite nu produc un clasament muscular; aceeași intrare și versiune produc aceeași explicație; overrideul nu se pierde.

**Important:** testele validează implementarea regulii, nu demonstrează că aceasta măsoară recuperarea sau maximizează hipertrofia. Detaliile și limitele științifice rămân în baza de cunoștințe.

## E4 — onboarding, navigare și Home

**Suprafețe:** onboarding, `src/app/(tabs)/_layout.tsx`, Home, `HomePreflightRail.tsx`, profil/setări și componentele comune.

- E4.1: onboarding local scurt: obiectiv, experiență, zile, timp, echipament, unități; preferințele avansate se editează ulterior. Fără parolă sau promisiune de cont cloud.
- E4.2: propunere de navigare de validat în prototip funcțional: **Azi, Plan, Progres, Exerciții**. Profil/setări în avatar; Body în Progres; traseele existente rămân accesibile.
- E4.3: Home pune prima dată reluarea sesiunii sau următorul antrenament, apoi rezumatul util. Detaliile de volum/mesociclu sunt accesibile fără a ocupa toate primul ecran.
- E4.4: bară persistentă pentru sesiunea activă, compatibilă cu safe area și tastatura. Acțiunile Start/Resume duc la sesiunea corectă, fără drafturi duplicate.
- E4.5: documentăm `DESIGN.md`: culori semantice, text, spațiere, butoane, inputuri, sheets și stări. Albastru pentru acțiuni, semnale distincte pentru succes și avertizare, însoțite de text.
- E4.6: contrastul textului critic, etichete pentru iconuri, ținte tactile adecvate, text mărit și reduced motion în componentele comune. Heatmapul primește și o alternativă accesibilă.

**Acceptare:** utilizatorul nou ajunge la un plan și primul set fără cont; utilizatorul care revine găsește imediat draftul; lipsa datelor este explicită; navigarea păstrează accesul la funcțiile existente; fluxurile sunt utilizabile cu screen reader și text mărit.

## E5 — Plan, Atlas, Body și Progres

- E5.1: identitate canonică pentru exercițiile logabile, aliasuri și mapare explicită spre biblioteca de referință. Nu convertim automat toate cele 847 de intrări în exerciții programabile fără metadate suficiente. ID-urile istorice rămân rezolvabile.
- E5.2: Atlas cu căutare/filtre, favorite/recente și pagină care conectează instrucțiuni, istoric, „Adaugă” și „Înlocuiește”. Diferența dintre referință și exercițiu logabil este vizibilă.
- E5.3: programul prezintă zile, durată estimată, echipament, accent și obiectiv. Preview înainte de activare; avertizare exactă despre ce se schimbă; antrenamentele finalizate rămân intacte.
- E5.4: selecția exercițiilor favorizează potrivirea și progresia comparabilă. Nu impune varietate sau dificultate numai pentru că utilizatorul este avansat. Revizuim descrierile pentru gambe, ischiogambieri și amplitudine conform surselor.
- E5.5: Body și Analytics folosesc aceeași logică derivată. Culori pentru date explicit numite, legendă și detalii la atingere: seturi, exerciții, perioadă, ultima expunere și limitele estimării.
- E5.6: grafice cu unitate/perioadă, număr de sesiuni și acces la antrenamentul sursă. Separăm seturi, tonaj și e1RM; zero și lipsă de date au aspecte distincte. Lățime din container, nu fixă.
- E5.7: progres personal per exercițiu, consecvență și istoric comparabil. Explicații RIR/e1RM/deload la nevoie. Datele estimate nu primesc ranguri care sugerează evaluare fiziologică validată.
- E5.8: pauze editabile și supersets opționale pentru economie de timp, cu perechi și echipament compatibile. Nu adăugăm tehnici avansate doar pentru a extinde lista de funcții.

**Acceptare:** același exercițiu duce la același istoric din toate intrările; schimbarea planului nu schimbă istoricul; totalurile Body/Analytics coincid pentru aceeași metodă și perioadă; graficele funcționează pe ecrane înguste și cu date puține.

## E6 — portabilitate și limitele funcțiilor experimentale

- E6.1: export JSON versionat și restaurare cu preview, verificare, deduplicare și copie a datelor existente. Export CSV pentru utilizator, cu unități și date explicite.
- E6.2: import Strong/Hevy pe baza unor fișiere de probă reale și sanitizate la implementare. Mapăm exercițiile și unitățile; rândurile ambigue se prezintă utilizatorului. Reimportul aceluiași fișier nu dublează sesiunile. Importatoarele sunt extensii ale aceluiași contract de date.
- E6.3: Form AI rămâne experimental. Eligibilitate pe exercițiu/variantă și unghi, stare neevaluabilă pentru date insuficiente, feedback unic prioritar, fallback manual. Camera se oprește la pierderea focusului; măsurăm latența/FPS/consumul pe dispozitiv. Fără validare suficientă, analiza rămâne dezactivată implicit în beta.
- E6.4: suplimentele rămân jurnal/reminder, fără „vârf de efect” presupus măsurat. Conținutul educativ despre nutriție/somn rămâne opțional.
- E6.5: actualizăm README/PRODUCT, configurația de development/release și lista de platforme suportate. Verificăm dependențele înainte de eliminare; nu facem upgradeuri largi fără motiv.

**Acceptare:** export → instalare curată → import reproduce datele relevante; import invalid nu distruge istoricul; refuzul camerei/notificărilor nu blochează loggingul; camera nu rulează în fundal; documentația reflectă buildul livrat.

## E7 — verificare și beta

**Scenariu principal:** profil local → plan → start → log în kg/lb/secunde → pauză/background → restart → resume → finish → istoric → progres → export/restaurare.

**Scenarii de eroare:** DB indisponibilă, migrare parțială, payload necunoscut, input invalid, RIR absent, sesiune incompletă, dublu finish, import duplicat, permisiuni refuzate și lipsă de internet.

**Matrice vizuală:** ecrane înguste și mari, portret, safe areas, tastatură, text mărit, VoiceOver/TalkBack, reduced motion, empty/loading/error/success. Verificăm tema dark; activarea light este separată și necesită propriul audit.

**Performanță:** istoric lung, căutare în catalog, deschiderea loggerului și inputul între seturi. Stabilim baseline pe dispozitivele alese în E0 și măsurăm regresiile; nu inventăm praguri universale fără măsurare.

**Criterii obligatorii pentru beta:**

- Nicio problemă cunoscută de pierdere de date în scenariile definite.
- Fluxul principal trece pe fiecare platformă declarată suportată.
- Backupul propriu poate fi restaurat; exporturile nu depind de cloud.
- Unitățile, tipurile de exerciții, timerul și durata sunt consistente.
- UI nu afirmă salvare înainte de commit și nu prezintă demo ca date personale.
- Recomandările au motiv și control manual; datele necunoscute rămân explicite.
- Accesibilitatea fluxurilor principale a fost verificată pe dispozitiv.
- Typecheck/lint/test și buildurile relevante trec; limitările rămase sunt documentate.

## 4. Împărțirea lucrărilor în livrări revizuibile

Fiecare livrare include comportamentul modificat, teste relevante, dovadă vizuală dacă schimbă UI și nota de migrare dacă schimbă datele. Nu amestecăm rescrieri generale cu repararea salvării.

| Lot | Conținut                                            | Depinde de                |
| --- | --------------------------------------------------- | ------------------------- |
| L01 | Baseline, fixture-uri, CI și matrice platforme      | —                         |
| L02 | Retenție istoric și migrare legacy sigură           | L01                       |
| L03 | Versiuni/migrări, draft unic și recuperare          | L02                       |
| L04 | Autosave/finish și UI de salvare                    | L03                       |
| L05 | Inputuri, unități și constrângeri pe tip            | L04                       |
| L06 | Timer, pauză, notificări și lifecycle               | L04                       |
| L07 | Eliminarea verdictelor/scorurilor nejustificate     | L01                       |
| L08 | Date reale, obiective, RIR și progresie explicabilă | L03, L05, L07             |
| L09 | Identitate exerciții și volum direct/indirect       | L03, L08                  |
| L10 | Logger compact și componente accesibile             | L05, L06                  |
| L11 | Onboarding, navigare și Home                        | L08, L10                  |
| L12 | Plan/Atlas și selecția exercițiilor                 | L09, L11                  |
| L13 | Body/Progres și explicații                          | L09, L11                  |
| L14 | Backup/restaurare și importatoare                   | L03, L09                  |
| L15 | Funcții experimentale, documentație, release        | L12, L13, L14             |
| L16 | Verificare completă și corecții de beta             | Toate loturile anterioare |

Loturile independente pot fi lucrate separat în viitoarea implementare. Această tabelă exprimă dependențe, nu solicită lansarea unor agenți sau taskuri acum. Durata se estimează după E0 și primele loturi, când avem timpi reali; numărul loturilor nu reprezintă un număr de zile.

## 5. Ce păstrăm pentru după beta

- Autentificare și cloud sync cu izolare între utilizatori, migrare guest, operații idempotente și politică explicită pentru conflicte.
- Apple Health/Health Connect, ceas și funcții sociale.
- Monetizare și abonamente.
- Extinderea validată a analizei video și feedback automat mai complex.
- Nutriție avansată, coaching clinic, bodybuilding competițional și haltere olimpice specializate.
- Scripting de progresii și o rescriere complet relațională a stocării, doar dacă apar cerințe care le justifică.

## 6. Trasabilitatea celor două cercetări

| Constatare                                                               | Etape care o rezolvă |
| ------------------------------------------------------------------------ | -------------------- |
| Audit tehnic 1–3, 9–10: retenție/migrare/salvare/schema                  | E1                   |
| Audit tehnic 4–6, 13–14: unități/tipuri/timer/progresie/controller       | E2–E3                |
| Audit tehnic 7–8: demo și identitate locală                              | E3–E4                |
| Audit tehnic 11–12, 18: platforme/CI/documentație                        | E0, E6–E7            |
| Audit tehnic 15–17: portabilitate/catalog/cameră                         | E5–E6                |
| Audit design 1–8: Home/navigare/logger/salvare/onboarding/accesibilitate | E1–E4                |
| Audit design 9–15: grafice/responsive/Atlas/plan/limbaj/cameră/motion    | E4–E7                |
| Cercetare fitness 1–5: afirmații, clasament, oboseală, RIR, scoruri      | E3, E6               |
| Cercetare fitness 6–10: volum/obiective/progresie/exerciții/timp         | E2–E5                |
| Cercetare fitness 11–12: educație și registru de dovezi                  | E3, E5–E6            |

Referințele la produse și repository-uri sunt documentate în audit; sursele științifice și limitele lor sunt în baza de cunoștințe. Adoptăm principii precum logging rapid, restaurare și reguli explicabile. Orice reutilizare efectivă de cod sau date externe necesită verificarea licenței acelui material la implementare.

**Primul pas executabil:** L01, apoi L02 — reproducem baza de verificare și eliminăm retenția distructivă/migrarea nesigură înainte de a modifica structura ecranelor.
