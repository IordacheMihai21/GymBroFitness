# GymBroFitness - Research, Product Plan si Roadmap

Data: 2026-09-15  
Scope: starea actuala a aplicatiei, research pe aplicatii similare, repo-uri GitHub, widget-uri/librarii utile, principii de hypertrophy/strength training, apoi plan concret de creat, imbunatatit, rutat si conectat.

## 1. Snapshot actual al aplicatiei

GymBroFitness este deja mai mult decat un mockup. In acest moment are un schelet solid de aplicatie Expo/React Native, cu un domain layer destul de serios pentru un tracker de sala.

### Stack

- Mobile: Expo 57, React Native 0.86, React 19, Expo Router.
- UI/componente: React Native Paper, Gorhom Bottom Sheet, Moti/Reanimated, Skia, Gifted Charts, Circular Progress, Body Highlighter.
- Persistenta: Expo SQLite + Drizzle ORM.
- State/data helpers: React Query, Zustand, AsyncStorage, SecureStore.
- Cloud pregatit dar inca neconectat complet: Supabase client este instalat.
- Teste: Jest + teste pe domain logic si DB.

### Rute si ecrane existente

- `/(tabs)/index.tsx`: Home premium cu workout-ul zilei, readiness/pre-fuel, overload target, PR watch, week log, mesocycle si recovery cards.
- `/(tabs)/workout.tsx`: ecran de antrenament activ cu set logging, rest timer, RIR sheet, autosave local, PR celebration, pause/resume/discard.
- `/(tabs)/analytics.tsx`: analytics cu strength trend, weekly volume landmarks, heatmap, streak/level, PR-uri si decision queue.
- `/(tabs)/body.tsx`: ecran body intelligence nou, cu corp interactiv front/back, selectie grupa, heatmap pe volum/fatigue si rank-uri.
- `/(tabs)/library.tsx`: Atlas/exercise library cu search, filtre, exercitii, body map si exercitiu detaliat.
- `/(tabs)/profile.tsx`: profil cu streak, level, tier, program/equipment, history/settings links.
- `/history.tsx`: istoric.
- `/exercise/[id].tsx`: pagina de exercitiu.
- `/settings.tsx`: setari.

### Domain layer existent

Exista deja bucati importante care trebuie pastrate si consolidate:

- Exercise catalog cu seed-uri pe piept, spate, brate, picioare, umeri, calves/core.
- Program generator determinist pe preferinte, split, echipament, timp, target muscles.
- Progression engine pe double progression: reps/load/RIR, deload, maintain, add set, increase load, pain/discomfort guardrails.
- Volume landmarks pe muschi, inspirat din modelul MV/MEV/MAV/MRV.
- Workout history, last performance, target to beat, set autofill, superset navigation, plate math, RIR helpers.
- Muscle intelligence si gamification helpers.

### Persistenta curenta

DB local are deja `workout_sessions` si `workout_templates`, cu payload JSON plus campuri indexate pentru lookup rapid. Asta e bun pentru MVP local-first, dar pentru analytics serioase si sync pe Supabase va trebui un strat relational mai clar.

### Verdict actual

Aplicatia are deja o directie buna: nu e doar "gym notes", ci un tracker inteligent pentru progres. Ce lipseste acum este lipirea tuturor pieselor intr-un produs coerent:

- date reale in loc de demo preferences;
- program editor;
- onboarding/profile real;
- sync/cloud;
- routing complet intre Home, Workout, Body, Atlas, Analytics, History;
- reguli de training prezentate in doua moduri: simplu pentru userul care vrea doar sa ridice, detaliat pentru userul care vrea stiinta.

## 2. Research piata: ce fac aplicatiile bune

### Hevy

Hevy pozitioneaza produsul pe trei axe clare: logging, progress tracking, social. Feature set-ul include routine planner, warmup/drop/failure sets, rest timers, exercise notes, advanced charts, PR-uri, 1RM si history complet. Sursa: [Hevy features](https://www.hevyapp.com/).

Ce luam:

- logging-ul trebuie sa fie rapid si fara frictiune;
- note per exercitiu/set;
- warmup/drop/failure set types;
- PR-uri vizibile imediat;
- exercise history la un tap distanta.

Ce nu copiem orbeste:

- social feed-ul nu pare esential pentru viziunea noastra initiala;
- pentru $10k premium, mai bine mergem pe "private performance cockpit" decat feed generic.

### Strong

Strong vinde promisiunea "Think less. Lift more." si ramane aproape de ideea de notebook reinvented. Se concentreaza pe simplitate, progres, best sets, 1RM, body fat si data export/control. Sursa: [Strong app](https://www.strong.app/).

Ce luam:

- app-ul trebuie sa iasa din calea userului in timpul seturilor;
- copy simplu, fara jargon in mod default;
- export data si control pe date trebuie sa existe;
- "simple but powerful" e benchmark-ul pentru ecranul Workout.

### Boostcamp

Boostcamp combina tracker + program library + auto-progression + analytics. Are RPE/RIR logging, PR-uri, custom program builder, rest timer, plate calculator, exercise demos si 11,000+ programe. Sursa: [Boostcamp features](https://www.boostcamp.app/).

Ce luam:

- programul trebuie sa fie first-class, nu doar o lista de exercitii;
- auto-progression trebuie explicata usor;
- plate calculator si rest timer sunt must-have in workout;
- library/coaches/program templates sunt o oportunitate mare, dar dupa ce program editor-ul nostru e solid.

### Alpha Progression

Alpha Progression este foarte aproape de directia noastra stiintifica: program personalizat, recomandari exacte de greutate/reps, warm-up sets automate, plate calculator, RIR, statistici, periodizare/deloads si volum per grupa. Sursa: [Alpha Progression Google Play](https://play.google.com/store/apps/details?hl=en&id=com.alphaprogression.alphaprogression).

Ce luam:

- "exact weight/reps next set" trebuie sa fie un obiectiv principal;
- warm-up generator automat;
- periodizare si deload ca feature vizibil;
- seturi/muschi pe ultimele 3 luni;
- multiple gyms/equipment profiles.

### Fitbod

Fitbod merge pe planuri personalizate generate/adaptate cu AI, in functie de obiective, echipament, nivel si performanta trecuta. Sursa: [Fitbod Google Play](https://play.google.com/store/apps/details?hl=en&id=com.fitbod.fitbod).

Ce luam:

- equipment profile trebuie sa influenteze exercitiile;
- userul poate edita recomandarea, iar sistemul invata din asta;
- pentru pauze lungi, app-ul trebuie sa scaleze greutatile/reps in jos, nu sa presupuna ca userul e la acelasi nivel.

Ce evitam:

- AI opac. Pentru publicul nostru avansat, regulile trebuie sa fie inspectabile.

### Slate

Slate are pozitionare foarte buna pentru frictionless logging: home-ul iti spune ce urmeaza, ce e recuperat si cum merge saptamana; logging one-tap cu greutatea/reps pre-filled; offline; imports din Strong/Hevy/CSV; Apple Health; Live Activity. Sursa: [Slate Fitness](https://slatefitness.app/).

Ce luam:

- Home = "open app, know what to do";
- setul urmator pre-filled;
- import Strong/Hevy/CSV;
- offline-first;
- lock-screen/rest timer notifications mai tarziu.

### Legend

Legend pune accent pe previous reps/weight, sugestii pentru progres, rest reminders, muscle fatigue si plate calculator in timp ce editezi setul. Sursa: [Legend Tracker](https://legend-tracker.com/).

Ce luam:

- "what did I do last time?" trebuie sa fie mereu langa input;
- target suggestion in set row;
- fatigue vizibila pe Home/Body;
- plate calculator integrat direct in workflow, nu ascuns.

### MuscleMap

MuscleMap e foarte relevant pentru Body screen: no-fluff logging, anatomical recovery map, states fresh/ready/recovering/fatigued/overreached, XP/ranks, PR badges, exercise database tagged primary/secondary/stabilizer, tap muscle pentru recovery si recent volume. Sursa: [MuscleMap Google Play](https://play.google.com/store/apps/details?hl=en&id=com.anthonyjomarq.musclemap).

Ce luam:

- corpul interactiv trebuie sa fie un produs in sine, nu decor;
- fiecare set alimenteaza body map-ul;
- tap pe muschi => exercitii, records, last sets, fatigue, rank;
- cloud backup optional si offline fara cont.

### GymLevels

GymLevels foloseste XP per set, rank pe 17 grupe musculare, smart workouts pe recovery/equipment/schedule, streaks, PR detection, weekly reports si dark glass design. Sursa: [GymLevels Google Play](https://play.google.com/store/apps/details?hl=en&id=com.gymstreaklabs.GymLevels).

Ce luam:

- muscle ranks sunt motivante daca sunt legate de date reale;
- weekly report shareable poate deveni premium;
- atentie: review-urile arata ca userii avansati nu vor sa li se forteze generated workouts. Trebuie toggle clar: "I know my program" vs "coach me".

## 3. Research GitHub / open-source

Important juridic: repo-urile AGPL/GPL trebuie folosite cu grija. Putem invata pattern-uri si arhitectura, dar nu copiem cod in app fara sa acceptam obligatiile licentei. Pentru cod reutilizabil, preferam MIT/Apache/BSD sau librarii npm cu licenta compatibila.

### Liftosaur

Liftosaur este un PWA open-source pentru weightlifting, cu programe custom, progresie/deload definite prin Liftoscript, offline mode, plate calculator, rest timer, graphs, muscle map, substitutions, warmups, body measurements. Sursa: [Liftosaur GitHub](https://github.com/astashov/liftosaur).

Ce luam:

- ideea de progression rules ca obiecte configurabile;
- program editor avansat pentru userii power;
- offline-first + web/editor eventual;
- substitutions bazate pe muschi activati.

Atentie licenta: AGPL, inspiratie/benchmark mai degraba decat copy code.

### wger

wger este un fitness manager self-hosted cu routine builder, automatic weight progression, nutrition, bodyweight/measurements, exercise wiki, Docker, REST API, multi-user. Sursa: [wger GitHub](https://github.com/wger-project/wger).

Ce luam:

- exercitiile, nutrition/body measurements si API thinking;
- self-host/control data ca inspiratie pentru export/import;
- modelul de exercise wiki.

Atentie licenta: AGPL.

### Lyftr

Lyftr este mobile-first, self-hosted, cu workout logging, program builder, guided gym session, rest timer, nutrition/bodyweight, PR-uri, progression charts, muscle diagrams, dashboard si SQLite. Sursa: [Lyftr GitHub](https://github.com/Cawlumm/lyftr).

Ce luam:

- local/server SQLite mindset;
- gym mode fullscreen;
- dashboard + muscle diagrams;
- ownership/export story.

Licenta: MIT, deci e mai prietenos pentru inspiratie/reutilizare cu atribuire.

### MyFit

MyFit este inspirat de RP Hypertrophy, cu log reps/load/RIR si progressive overload automat bazat pe performante trecute. Sursa: [MyFit GitHub](https://github.com/WhyAsh5114/MyFit).

Ce luam:

- RIR ca variabila centrala;
- progressive overload explicat in app;
- formulas testabile in domain layer.

Atentie licenta: AGPL.

### FitnessTrack

FitnessTrack documenteaza foarte clar dynamic double progression: fiecare set are target propriu, top of range => add weight, sub ceiling => +rep, miss => hold/deload dupa repetare, increments capped/rounded, rep ranges pe movement type. Sursa: [FitnessTrack GitHub](https://github.com/Gman0909/FitnessTrack).

Ce luam:

- per-set progression tracks;
- target hint dupa fiecare set;
- feedback glyph beat/met/missed;
- rep ranges default pe movement pattern.

## 4. Widget-uri si librarii potrivite

### Deja instalate si potrivite

- `react-native-body-highlighter`: are `onBodyPartPress`, front/back side, gender, scale, per-part colors/styles si lista de body parts. Perfect pentru Body screen. Sursa: [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter).
- `react-native-gifted-charts`: line, bar, area, donut, radar, animations, gradients, scroll/click. Bun pentru analytics premium. Sursa: [react-native-gifted-charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts).
- `@gorhom/bottom-sheet`: sheets pentru RIR, exercise swap, plate calculator, muscle details.
- `react-native-circular-progress`: readiness, fatigue, mesocycle progress, rank progress.
- `moti` + `react-native-reanimated`: micro-interactions native, mai potrivite decat anime.js pentru React Native.
- `react-native-fast-confetti`: PR celebrations.
- `@quidone/react-native-wheel-picker`: RIR, rest duration, bodyweight, target reps, caffeine grams/mg.

### Ce merita adaugat mai tarziu

- `expo-notifications`: rest timer pe lock screen/notifications.
- Health integrations:
  - iOS: HealthKit printr-un modul Expo dev client / native config.
  - Android: Health Connect.
- CSV import parsers pentru Strong/Hevy export.
- RevenueCat daca ajungem la subscription/premium.
- Sentry/Crashlytics pentru release.
- Supabase Edge Functions pentru sync jobs, backups si AI/rule processing daca depaseste clientul.

### Ce nu e ideal in React Native

- `anime.js`: foarte bun pe web/DOM, dar nu e alegerea naturala pentru RN. Pentru mobile native, Reanimated/Moti/Skia dau performanta si integrare mai buna.
- componente web-only de pe 21st.dev: pot inspira vizual, dar nu se copiaza direct in RN daca sunt DOM/CSS-only.

## 5. Ce conteaza stiintific pentru muscle growth

Aplicatia trebuie sa stie stiinta, dar sa nu o arunce mereu in fata userului. Principiul de produs: complexitatea sta in engine, simplitatea sta in UI.

### Volum saptamanal

Meta-analiza Schoenfeld/Ogborn/Krieger arata o relatie doza-raspuns intre weekly resistance training volume si hypertrophy: mai multe seturi saptamanale tind sa produca mai multa crestere pana la limita recuperarii. Sursa: [PubMed - Dose-response weekly volume](https://pubmed.ncbi.nlm.nih.gov/27433992/).

Traducere in app:

- track pe hard sets per muscle, nu doar tonaj total;
- primary/secondary/stabilizer weighting;
- zone MV/MEV/MAV/MRV pe fiecare muschi;
- warning cand un muschi e sub-stimulat sau in exces;
- set recommendations care tin cont de muschi, nu doar exercitiu.

### Proximity to failure / RIR

Seturile trebuie sa fie suficient de aproape de failure pentru stimul, dar failure absolut nu trebuie fortat mereu. Meta-analizele despre failure vs non-failure arata ca failure nu este obligatoriu pentru hypertrophy/strength, mai ales cand volumul e echilibrat; poate avea rol punctual, dar aduce fatigue mai mare. Sursa: [PubMed - Failure vs non-failure](https://pubmed.ncbi.nlm.nih.gov/33497853/).

Traducere in app:

- default targets: RIR 1-3 pentru majoritatea seturilor de lucru;
- failure set ca tag special, nu default;
- detectie de "grinding" prin drop in reps/load/RIR;
- deload/recovery prompt cand performanta cade repetat.

### Rest intervals

Studiul Schoenfeld et al. pe lifteri antrenati a comparat 1 minut vs 3 minute rest si a gasit rezultate mai bune la strength si unele masuri de hypertrophy cu pauze mai lungi. Sursa: [PubMed - Longer interset rest periods](https://pubmed.ncbi.nlm.nih.gov/26605807/).

Traducere in app:

- compounds: 2-4 min rest default;
- isolation: 60-120 sec default;
- timer inteligent in functie de RIR/performance;
- daca setul urmator cade rau, app-ul poate sugera rest mai lung.

### Loads si rep ranges

Hypertrophy poate fi obtinuta pe range larg de reps daca seturile sunt suficient de aproape de failure, dar greutatile mari raman superioare pentru strength specific. Sursa de directie: [PubMed - Low vs high load meta-analysis](https://pubmed.ncbi.nlm.nih.gov/28834797/).

Traducere in app:

- compounds grele: 4-8 sau 5-10;
- moderate compounds: 6-12;
- isolation: 10-20;
- calves/delts/abs pot tolera reps mai mari;
- progresia trebuie sa fie pe rep range, nu "add weight every session" orbeste.

### Frequency

Frecventa este mai ales un instrument de distributie a volumului. Pentru multi useri, fiecare grupa de 2x/saptamana este practic mai usor de recuperat si de executat calitativ decat un volum urias intr-o singura zi, dar volumul total ramane variabila mare.

Traducere in app:

- Home arata "what to train next" pe baza programului + recovery;
- daca o grupa e in urma, app-ul o introduce ca accessory/weak point;
- daca o grupa e overreached, app-ul recomanda swap sau volum redus.

### Progressive overload

Overload-ul real nu inseamna doar sa pui mai multe kg. Poate insemna:

- mai multe reps la aceeasi greutate si acelasi RIR;
- mai multa greutate in acelasi rep range;
- mai multe seturi daca recovery permite;
- tehnica/ROM mai bune la acelasi load;
- mai multa densitate doar cand nu sacrifica performanta.

Traducere in app:

- target to beat per exercise/set;
- compare cu last session si best comparable set;
- progression recommendation cu explicatie scurta;
- user override mereu disponibil.

### Exercise selection

Pentru hypertrophy, exercitiile bune au:

- stabilitate suficienta;
- ROM potrivit;
- tensiune buna pe muschiul tinta;
- progresie masurabila;
- discomfort/joint pain minim;
- potrivire cu echipamentul si corpul userului.

Traducere in app:

- Atlas cu score pe "hypertrophy potential", "joint cost", "setup cost";
- substitutions pe acelasi muschi si pattern;
- injury/discomfort profile per user;
- custom exercises usor de adaugat.

### Nutrition si recovery

ISSN recomanda, pentru cei care se antreneaza, aproximativ 1.4-2.0 g protein/kg/zi pentru majoritatea indivizilor care vor masa musculara sau mentinere, iar doze mai mari pot avea rol in deficit caloric. Sursa: [PubMed - ISSN protein position stand](https://pubmed.ncbi.nlm.nih.gov/28642676/).

Creatina monohidrat este unul dintre cele mai bine sustinute suplimente pentru performanta de intensitate mare si adaptari la antrenament. Sursa: [ISSN creatine position stand search/PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=International+Society+of+Sports+Nutrition+position+stand+safety+and+efficacy+of+creatine+supplementation+in+exercise+sport+medicine).

Traducere in app:

- macro/pre-fuel poate fi simplu: protein target, calories context, carbs before training, caffeine timing, creatine consistency;
- recovery score din sleep/stress/soreness/performance daca userul vrea;
- pentru userul simplu: "Eat enough protein. Sleep. Beat the target."

## 6. Cele doua moduri de produs

### Modul "Just Lift"

Pentru omul care vine la sala, trage de fiare si nu vrea termeni.

UI:

- Start workout mare.
- Greutate/reps pre-filled.
- "Beat this: 42.5 kg x 8".
- "Rest 2:30".
- "Chest still tired. Swap to Pull?"
- "Nice PR."

Nu vede:

- MAV/MRV;
- dose-response;
- fatigue models;
- RIR explanations lungi.

### Modul "Science Mode"

Pentru omul care se pricepe deja si vrea control.

UI:

- RIR/RPE per set.
- Weekly sets per muscle vs landmarks.
- e1RM trends.
- Recovery/fatigue confidence.
- Progression rationale.
- Mesocycle phase, deload readiness.
- Exercise substitution logic.

Vede explicatii precum:

- "Chest is at 18 direct-equivalent sets this week, near upper growth zone."
- "Load held because last two sessions missed rep floor at RIR <=1."
- "Add one lateral delt set: priority muscle, recovery green, below MAV."

## 7. Gap analysis: ce trebuie creat sau imbunatatit

### Creat

- Profile/preferences real store:
  - goal, experience, days/week, equipment, injuries, weak points, units, time budget.
- Program screen:
  - current mesocycle;
  - day list;
  - edit exercises/sets/reps/RIR/rest;
  - duplicate/share/import template.
- Exercise swap flow:
  - alternatives pe muschi, equipment, pattern, fatigue/joint constraints.
- Session detail route:
  - dupa workout si din history.
- Auth/onboarding mai tarziu:
  - login/register;
  - account setup;
  - import/export;
  - cloud backup.
- Data import:
  - Strong/Hevy CSV;
  - poate JSON export pentru noi.
- Native notifications:
  - rest timer;
  - workout reminder.

### Imbunatatit

- Home:
  - sa nu mai depinda de demo prefs;
  - sa aleaga workout real din program;
  - resume active session;
  - recovery/readiness din date reale.
- Workout:
  - warm-up generator;
  - plate calculator inline;
  - previous set drawer;
  - exercise notes;
  - advanced set types: drop, rest-pause, myo-reps, cluster, top/backoff;
  - mid-workout swap;
  - background-safe rest timer.
- Body:
  - tap pe muschi => exercitii facute, records, last sets, fatigue, rank;
  - swipe front/back deja exista, dar trebuie finisat vizual;
  - culori per grupa in functie de workload/recovery/rank;
  - shared logic cu analytics pentru volume/fatigue.
- Analytics:
  - muscle volume over time;
  - e1RM pe exercitii principale;
  - adherence, deload readiness, weak point detection;
  - science explanations toggled.
- Atlas:
  - exercise pages mai bogate;
  - video/image assets;
  - activation details primary/secondary/stabilizer;
  - substitutions and "why this exercise".
- Profile:
  - bodyweight/measurements;
  - equipment profiles/multiple gyms;
  - preferences and privacy/export.

### Rutare/conectare

- Home Start -> Workout cu program day real.
- Home PR watch -> Exercise detail sau Analytics filtered.
- Body muscle tap -> Muscle detail sheet/route.
- Muscle detail -> Atlas filtered by muscle.
- Muscle detail -> History filtered by muscle.
- Workout exercise name -> Exercise detail.
- Workout swap -> Atlas replacement picker -> back to active session.
- Analytics chart point -> session detail.
- Profile history -> History -> Session detail.
- Settings -> Units/equipment/export/account.

## 8. Data model recomandat

Pe termen scurt, putem pastra payload JSON pentru viteza, dar pentru produs serios si sync trebuie un model mai relational.

### Tabele locale/Supabase propuse

- `users`
- `user_preferences`
- `equipment_profiles`
- `programs`
- `program_days`
- `program_exercises`
- `program_sets`
- `workout_sessions`
- `performed_exercises`
- `performed_sets`
- `exercise_catalog`
- `custom_exercises`
- `exercise_muscle_map`
- `muscle_training_events` sau cache derivat
- `body_measurements`
- `readiness_logs`
- `injury_discomfort_logs`
- `supplement_logs`
- `pr_events`
- `achievements`
- `sync_state`

### Domain caches utile

- weekly hard sets per muscle;
- muscle fatigue/recovery state;
- exercise last performance;
- e1RM trend;
- per-muscle rank;
- mesocycle load/fatigue;
- "decision queue" pentru Home.

## 9. Roadmap de implementare

### Phase 1 - Data foundation si real preferences

Scop: aplicatia sa nu mai fie demo-driven.

- creeaza `profile/preferences` repository local;
- muta `DEMO_PREFERENCES` in fallback;
- Home/Program generator folosesc date reale;
- adauga equipment profile;
- adauga units si time budget editabil.

### Phase 2 - Program screen si program lifecycle

Scop: userul isi vede si modifica programul, nu doar workout-ul zilei.

- ruta `/program`;
- current mesocycle overview;
- edit day;
- swap exercise;
- save template;
- clone template;
- schedule rest days/training days.

### Phase 3 - Workout premium tools

Scop: ecranul de sala sa fie impecabil.

- warm-up set generator;
- plate calculator inline;
- last performance drawer;
- exercise notes;
- advanced set tags;
- rest timer notifications;
- finish summary route.

### Phase 4 - Body Intelligence 2.0

Scop: corpul interactiv sa devina diferentiatorul aplicatiei.

- shared muscle mapping engine;
- rank per muscle;
- fatigue state per muscle;
- last session sets per muscle;
- records per muscle;
- exercise recommendations per muscle;
- front/back polish si gestures finale.

### Phase 5 - Analytics pentru lifter avansat

Scop: science mode real.

- e1RM trends per lift;
- volume landmarks pe perioade;
- adherence si consistency;
- deload readiness;
- weak point detection;
- export charts/data.

### Phase 6 - Onboarding, auth si cloud

Scop: cont, personalizare si backup.

- onboarding goal/equipment/experience;
- login/register;
- Supabase sync;
- manual/auto backup;
- import Strong/Hevy/CSV;
- export JSON/CSV.

### Phase 7 - Native integrations

Scop: aplicatie care se simte instalata, nu demo Expo.

- Apple Health/Health Connect;
- rest timer lock screen / notifications;
- maybe Watch later;
- crash reporting;
- subscription entitlement daca monetizam.

### Phase 8 - QA, release si polish

Scop: produs premium, nu app experiment.

- test matrix iOS/Android;
- offline/background scenarios;
- migration tests;
- import/export tests;
- performance profiling;
- accessibility pass;
- design consistency pass.

## 10. Ce facem imediat dupa acest document

Recomand urmatorul pas de development:

1. Creez `src/domain/muscles/` ca sursa unica pentru muscle groups, body-highlighter slugs, colors, rank tiers si fatigue labels.
2. Leg `Body` si `Analytics` la aceeasi logica de volume/fatigue/rank, ca sa nu avem doua adevaruri vizuale.
3. Adaug local preferences store, astfel incat Home sa nu mai fie legat de demo preferences.
4. Adaug un Program route minim, conectat la Home si Workout.
5. Dupa aceea atac Workout premium tools: warmups + plate calculator inline + last performance drawer.

## 11. Limbaje si tehnologie recomandate

- TypeScript ramane baza pentru client si domain logic. Avem deja teste si tipuri bune.
- SQL/Drizzle pentru date serioase, migrations si queries.
- Python este util pentru scripturi offline:
  - import/curatare exercise databases;
  - analizat CSV din Hevy/Strong;
  - generat fixtures;
  - eventual calcule/experimente ML.
- Supabase Edge Functions in TypeScript/Deno pentru sync/backup/AI later.
- Swift/Kotlin doar daca ajungem la HealthKit/Health Connect/Watch intr-un mod pe care Expo config plugins nu il acopera suficient.

## 12. Surse principale

- [Hevy - features](https://www.hevyapp.com/)
- [Strong](https://www.strong.app/)
- [Boostcamp](https://www.boostcamp.app/)
- [Slate Fitness](https://slatefitness.app/)
- [Legend Tracker](https://legend-tracker.com/)
- [Alpha Progression Google Play](https://play.google.com/store/apps/details?hl=en&id=com.alphaprogression.alphaprogression)
- [Fitbod Google Play](https://play.google.com/store/apps/details?hl=en&id=com.fitbod.fitbod)
- [MuscleMap Google Play](https://play.google.com/store/apps/details?hl=en&id=com.anthonyjomarq.musclemap)
- [GymLevels Google Play](https://play.google.com/store/apps/details?hl=en&id=com.gymstreaklabs.GymLevels)
- [Liftosaur GitHub](https://github.com/astashov/liftosaur)
- [wger GitHub](https://github.com/wger-project/wger)
- [Lyftr GitHub](https://github.com/Cawlumm/lyftr)
- [MyFit GitHub](https://github.com/WhyAsh5114/MyFit)
- [FitnessTrack GitHub](https://github.com/Gman0909/FitnessTrack)
- [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter)
- [react-native-gifted-charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts)
- [Schoenfeld et al. - weekly volume dose-response](https://pubmed.ncbi.nlm.nih.gov/27433992/)
- [Schoenfeld et al. - longer rest intervals](https://pubmed.ncbi.nlm.nih.gov/26605807/)
- [Failure vs non-failure meta-analysis](https://pubmed.ncbi.nlm.nih.gov/33497853/)
- [Low vs high load meta-analysis](https://pubmed.ncbi.nlm.nih.gov/28834797/)
- [ISSN protein position stand](https://pubmed.ncbi.nlm.nih.gov/28642676/)
- [ISSN creatine position stand search/PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=International+Society+of+Sports+Nutrition+position+stand+safety+and+efficacy+of+creatine+supplementation+in+exercise+sport+medicine)
