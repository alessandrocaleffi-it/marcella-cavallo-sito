# Invio richieste: email + CRM Notion

STATO: implementazione preparata e testata con provider simulati; NON attiva nel sito pubblico. Nessuna email di prova inviata e nessun record fittizio creato nel CRM.

## Destinazioni verificate

- Email di Marcella richiesta dall’utente: `marcellacavallo2@gmail.com`. Destinatario fisso sul server, non modificabile dal visitatore.
- CRM Light — Marcella: https://app.notion.com/p/e65efd83a5734cc8acf73ae94b2bf420
- Data source: `08359bc5-5bd7-4290-a3df-e29643992ec9`.
- Ogni invio è una richiesta distinta: Nome, Email, Telefono, Interesse, Canale=Sito, Stato=Nuovo, Tipologia=Prospect, Consenso contatto. Note operative include ID richiesta, sede, data preferita e note. Il campo Ultimo contatto resta invariato: nessuna conversazione è ancora avvenuta.

## Scelta tecnica proposta, ancora da attivare

Il sito rimane nel repository e su GitHub Pages. Un Cloudflare Worker riceve il POST, valida Turnstile e i campi, registra il contenuto in D1, invia l’email con Resend e crea il record Notion. Nessun pacchetto runtime aggiunto al frontend. Cloudflare e Resend sono una proposta di infrastruttura: non sono stati aperti account o attivati abbonamenti.

## Accessi necessari

1. Account Cloudflare con accesso a Workers, D1 e Turnstile. Creare database D1 e binding `DB` in wrangler.jsonc, poi applicare schema.sql. Creare widget Turnstile limitato a `alessandrocaleffi-it.github.io`, action `request`.
2. Chiave Resend con permessi di invio e mittente su un dominio verificato. Il destinatario Gmail non è un mittente: non usare `marcellacavallo2@gmail.com` come FROM tramite Resend. Configurare EMAIL_FROM con indirizzo del dominio verificato. In alternativa adattare il solo provider email a un servizio già disponibile.
3. Integrazione Notion con lettura/inserimento nel solo database CRM Light — Marcella. Condividere quel database con l’integrazione. Il collegamento Notion della chat non fornisce credenziali al server pubblico.
4. Memorizzare con `wrangler secret put` i valori NOTION_TOKEN, RESEND_API_KEY, EMAIL_FROM, TURNSTILE_SECRET. Mai inserirli nel repository, in HTML o in chat.

## Prima di attivare il modulo

- Completare l’informativa per il nuovo flusso: titolare, finalità, base giuridica, destinatari/fornitori, conservazione, diritti e contatto. L’attuale testo dice correttamente che nessun dato viene inviato: va sostituito prima di attivare.
- Le note devono restare commenti generali, senza diagnosi o referti, coerentemente con le regole del CRM Marcella. Definire una procedura se il visitatore inserisce comunque dettagli sanitari.
- Definire durata di conservazione ed eliminazione del contenuto in D1. Il backend non implementa ancora cancellazione automatica né una console di gestione; non attivare senza questa scelta operativa.
- Configurare monitoraggio delle righe `processing`, `email_accepted`, `needs_review`: in caso di errore una richiesta rimane salvata ma va gestita dall’operatore. Il codice non ritenta automaticamente chiamate Notion di esito incerto, per evitare duplicati.
- Resend restituisce accettazione dell’email, non prova della consegna nella casella Gmail. Per monitorare bounce/delivery servono webhook email separati.

## Attivazione frontend

Dopo deploy del Worker, aggiungere a index.html la configurazione pubblica con endpoint HTTPS e site key Turnstile, caricare https://challenges.cloudflare.com/turnstile/v0/api.js con render=explicit e importare form-client.mjs, richiamando installRequestForm(config, document, window.turnstile) quando il widget è caricato. Le due chiavi pubbliche non sono segreti.

Prima del rilascio rimuovere/aggiornare i testi del vecchio flusso “prepara/copia”, il link informativo privacy e le istruzioni di copia nel result, conservando il contatto email di fallback. Il modulo deve mostrare il solo messaggio di esito del server. Aggiornare anche tutti i mailto al nuovo indirizzo su richiesta del titolare (al momento il sito live mantiene il recapito precedente).

Collaudare almeno: invio sintetico autorizzato con note, invio senza note, doppio click, errore provider, esito incerto, verifica umana fallita, mobile e tastiera. Verificare email ricevuta e record Notion creato. Solo dopo unire e pubblicare.

## Comandi di verifica locale

`node --check backend/worker.mjs`
`node --check backend/form-client.mjs`
`node --test backend/worker.test.mjs`

I test non contattano servizi esterni. La bozza non modifica index.html o script.js e non espone un endpoint attivo.
