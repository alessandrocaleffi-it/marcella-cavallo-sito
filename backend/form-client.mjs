// Import this module from index.html only after completing backend/SETUP.md.
// Set window.MARCELLA_REQUEST_CONFIG to {endpoint, turnstileSiteKey} before importing.
export function installRequestForm(config,document,turnstile) {
  if(!config?.endpoint || !config?.turnstileSiteKey)throw Error('Configuration required');
  const endpoint=new URL(config.endpoint);if(endpoint.protocol!=='https:')throw Error('HTTPS required');
  const form=document.getElementById('bookingForm');
  const button=form.querySelector('button[type="submit"]');
  const hint=document.getElementById('requestStatus');
  const result=document.getElementById('requestResult');
  const consent=document.createElement('label');consent.className='field';
  consent.innerHTML='<input type="checkbox" name="contactConsent" required> Ho letto l’informativa privacy e chiedo di essere ricontattato/a per questa richiesta.';
  const captcha=document.createElement('div');captcha.id='request-verification';
  form.insertBefore(consent,button);form.insertBefore(captcha,button);
  const honey=document.createElement('input');honey.type='text';honey.name='website';honey.hidden=true;honey.tabIndex=-1;honey.autocomplete='off';form.append(honey);
  const widget=turnstile.render(captcha,{sitekey:config.turnstileSiteKey,action:'request'});
  let requestId=crypto.randomUUID(),busy=false,received=false;
  button.textContent='Invia la richiesta';
  form.addEventListener('submit',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(busy||received||!form.reportValidity())return;
    const get=id=>document.getElementById(id).value.trim();
    const token=turnstile.getResponse(widget);
    if(!token){captcha.scrollIntoView({block:'center'});return;}
    busy=true;button.disabled=true;button.textContent='Invio in corso…';
    // Prevent the existing local-text helper from overwriting the server result.
    const show=message=>{result.hidden=false;document.getElementById('requestText').hidden=true;document.getElementById('copyRequest').hidden=true;hint.textContent=message;};
    try{
      const r=await fetch(endpoint.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:get('name'),email:get('email'),phone:get('phone'),notes:get('notes'),service:get('service'),location:get('location'),date:get('date'),consent:consent.querySelector('input').checked,website:honey.value,requestId,turnstileToken:token}),signal:AbortSignal.timeout(45000)});
      const data=await r.json();
      if(r.ok && data.status==='success'){
        received=true;show('Richiesta inviata a Marcella e registrata. Ti risponderò per concordare i dettagli: l’appuntamento non è ancora confermato.');
      }else if(r.status===202 && data.status==='received'){
        received=true;show('Richiesta ricevuta e in gestione. Non inviarla di nuovo. Ti risponderò per concordare i dettagli.');
      }else throw Error('request_failed');
    }catch{show('Non riesco a verificare l’esito dell’invio. Conserva questo riferimento: '+requestId+'. Prima di riprovare puoi contattare Marcella via email.');}
    finally{busy=false;button.disabled=received;button.textContent=received?'Richiesta ricevuta':'Riprova invio';turnstile.reset(widget);}
  },true);
}
// Intentionally no auto-install: the public site keeps its current working behavior until activation.
