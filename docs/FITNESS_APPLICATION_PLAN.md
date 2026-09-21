# Aplicarea cercetării în GymBroFitness

Data: 20 septembrie 2026. Stare: propuneri fundamentate pe auditul codului; nicio modificare funcțională aplicată în această etapă.

Surse și limite: [baza de cunoștințe](FITNESS_KNOWLEDGE_BASE.md). P0 = corectitudinea afirmațiilor și interpretării; P1 = calitatea recomandărilor; P2 = extindere. Prioritățile nu semnalează automat o vulnerabilitate sau o urgență medicală.

## P0 — corectăm ce pretinde aplicația că știe

### 1. Înlocuirea verdictelor despre creștere și „junk volume”

**Cod:** `src/domain/workouts/volumeLandmarks.ts`, consumatorii din `muscleIntelligence.ts`.

**Observație:** există praguri MV/MEV/MAV/MRV fixe per grupă și texte ca „Maintaining, not growing” și „Excessive — likely junk volume”.

**Propunere:** texte precum „Sub intervalul orientativ”, „În intervalul orientativ” și „Volum ridicat — verifică toleranța”. Explicăm că reperele sunt configurabile și nu confirmă răspunsul individual. Nu substituim un tabel arbitrar cu altul prezentat ca adevăr.

**Acceptare:** sub prag nu apare verdictul „nu crești”; peste prag nu apare concluzia automată că seturile sunt inutile; utilizatorul poate inspecta baza calculului. Orice recomandare de schimbare ține cont de evoluție și completitudinea datelor.

### 2. Eliminarea clasamentului muscular bazat pe kg brute

**Cod:** `src/domain/workouts/muscleIntelligence.ts`, `buildStrengthRankTable`.

**Observație:** grupele sunt ordonate după cea mai mare încărcare a unui exercițiu asociat. O presă pentru picioare și o flexie pentru biceps nu sunt probe comparabile de „forță a mușchiului”.

**Propunere:** progres personal pe exercițiu, cu echipament și variantă identificabile. Eventual clasament al consecvenței sau al variației față de propriul istoric, denumit exact. Fără norme intermusculare inventate.

**Acceptare:** schimbarea aparatului nu îmbunătățește automat rangul grupei; nu există „grupă slabă” dedusă din diferența de kg între mișcări diferite; istoricul rămâne accesibil fără scor nejustificat.

### 3. Separarea încărcării recente de recuperarea fiziologică

**Cod:** `src/domain/workouts/muscleIntelligence.ts`, `fatigueScore`; `src/domain/programs/mesocycle.ts`.

**Observație:** scor 0–100 din volum/MRV, recență și RIR; penultima săptămână devine automat „overreaching”.

**Propunere:** „încărcare recentă estimată”, cu componente vizibile și stare de date insuficiente. Faza calendaristică devine „săptămână planificată cu solicitare crescută”, dacă există această intenție în program. Deloadul planificat și cel sugerat după tendințe se diferențiază.

**Acceptare:** nu se declară recuperare completă sau supraantrenament din calendar; istoricul puțin nu produce certitudine mare; un singur scor nu schimbă automat programul.

### 4. Tratarea RIR lipsă ca informație necunoscută

**Cod:** `src/domain/progression/engine.ts` (`rirOk` acceptă `avgRir == null`), `src/domain/workouts/rir.ts`, `src/domain/programs/config.ts`.

**Propunere:** cale explicită pentru recomandări fără RIR, cu încredere redusă și motiv vizibil. Validăm și realizarea seturilor prescrise înainte de recomandarea creșterii. Adăugăm explicații accesibile și opțiunea „nu știu”.

**Acceptare:** absența RIR nu este descrisă ca dovadă de rezervă; un singur set reușit dintr-un program incomplet nu certifică realizarea întregii prescripții; utilizatorul poate progresa manual fără completarea forțată a RIR.

### 5. Corectarea promisiunilor din analiza video și suplimente

**Cod:** `src/domain/vision/formScoring.ts`, `src/domain/workouts/preRoutine.ts`.

**Observație:** lipsa anumitor informații de simetrie poate produce scor favorabil; fereastra declarată pentru supliment generează o stare „atPeak”.

**Propunere:** „neevaluabil” pentru geometrie insuficientă și delimitarea observațiilor vizuale de eficiență sau siguranță. Pentru suplimente, afișăm înregistrarea consumului și un reminder ales de utilizator, fără pretenție farmacocinetică.

**Acceptare:** datele lipsă nu devin execuție perfectă; aplicația nu promite prevenirea accidentărilor; o fereastră configurată nu este prezentată ca efect biologic măsurat.

## P1 — îmbunătățim programarea și explicațiile

### 6. Volum direct și indirect, fără dublare ascunsă

**Cod:** `src/domain/workouts/analytics.ts`, catalogul exercițiilor, `muscleIntelligence.ts`.

**Observație:** distribuția curentă urmărește mușchii primari. Contribuția secundară lipsește din această vedere.

**Propunere:** câmpuri distincte pentru seturi directe, expuneri indirecte și estimare ponderată. Mapare revizuibilă per exercițiu; fără a converti global toate grupele secundare în 0,5 dintr-un set direct. Conservăm și afișăm datele brute.

**Acceptare:** un set fizic rămâne un singur set în totalul sesiunii, chiar dacă expune mai mulți mușchi; încălzirile și seturile sărite nu cresc doza de lucru; formula și versiunea sunt explicabile; rapoartele istorice indică schimbarea metodei.

### 7. Obiectiv și context nutrițional în motor

**Cod:** preferințele programului, `src/domain/programs/config.ts`, `generator.ts`, motorul de progresie.

**Propunere:** hipertrofie/forță/mixt și menținere/surplus/deficit ca dimensiuni distincte. Repere diferite de succes; „menținere reușită” devine posibilă. Nu automatizăm recomandări calorice personalizate din dovezile limitate analizate aici.

**Acceptare:** lipsa unui PR în deficit nu produce automat seturi suplimentare; programul de forță păstrează specificitatea exercițiilor; explicația identifică obiectivul urmărit.

### 8. Progresie bazată pe tendințe comparabile

**Cod:** `src/domain/progression/engine.ts`, `constraints.ts`, analytics.

**Propunere:** separăm „mai multe repetări”, „mai multă încărcare”, „menținere”, „date insuficiente” și „revizuiește contextul”. Verificăm variantă, echipament, seturi, unități și condiții. O schimbare de exercițiu începe o referință nouă. Pragurile de decizie rămân reguli de produs validate separat, nu efecte demonstrate de studii.

**Acceptare:** kg, repetări și secunde nu sunt confundate; nu comparăm direct tonaj între exerciții diferite; recomandarea arată datele relevante; incrementarea respectă echipamentul disponibil.

### 9. Selecția exercițiilor fără complexitate artificială

**Cod:** `src/domain/programs/generator.ts`, seed-urile catalogului.

**Observație:** scorarea poate favoriza dificultatea la avansați și penalizează repetarea exercițiilor în săptămână.

**Propunere:** stabilitate suficientă pentru învățare și comparație; aparatele rămân opțiuni pentru toate nivelurile. Revizuim descrierile despre gambe, ischiogambieri și amplitudine. Variantele mai bine susținute într-un studiu primesc context, nu statut universal de „cel mai bun exercițiu”.

**Acceptare:** avansat nu înseamnă obligatoriu exercițiu dificil; o variantă tolerată nu dispare numai pentru diversitate; înlocuirea explică compromisurile și păstrează obiectivul.

### 10. Timp, pauze și supersets realiste

**Cod:** `src/domain/programs/config.ts`, modelul de timp și generatorul.

**Propunere:** păstrăm pauzele ajustabile, adăugăm perechi opționale pentru economisirea timpului și verificăm accesul la echipament. Modelul include tranzițiile și încălzirile relevante. Extinderea pauzei nu este tratată ca abatere morală sau lipsă de disciplină.

**Acceptare:** bugetul scurt nu generează automat supersets concurente; pauza poate fi prelungită; timpul estimat este marcat ca estimare, iar programul rămâne editabil.

## P2 — educație și întreținerea dovezilor

### 11. Explicații scurte în context

Microlecții despre RIR, diferența dintre forță și hipertrofie, progresie, pauze, volum și rolul nutriției. Un singur concept la momentul relevant, cu sursă și dată. Nu transformăm logarea setului într-un curs obligatoriu.

### 12. Registru de reguli și dovezi

Pentru fiecare regulă: identificator, versiune, surse, populație, limite, tip („rezultat empiric”, „consens”, „euristică de produs”), setări implicite și motivul ultimei modificări. O revizuire viitoare verifică literatura nouă și corecțiile; acest document nu activează o monitorizare automată.

## Ordine recomandată și validare

1. Corectăm afirmațiile și stările de date necunoscute din punctele 1–5.
2. Stabilizăm schema datelor și modul de numărare din punctele 6–8, cu migrare dacă este necesară.
3. Ajustăm generatorul și opțiunile de timp din punctele 9–10.
4. Adăugăm educația și registrul versiunilor.

La implementare, testele de domeniu trebuie să acopere cazurile de acceptare de mai sus. Testele de software pot demonstra că formula este aplicată corect; nu demonstrează că un scor prezice recuperarea sau că un program maximizează hipertrofia. Aceste afirmații ar necesita validare distinctă.

În etapa de cercetare s-au creat numai documente. Nu s-au recalculat antrenamente, schimbat prescripții sau rulat teste funcționale, deoarece codul aplicației nu a fost modificat.
