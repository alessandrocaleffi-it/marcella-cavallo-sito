'use strict';
const menu = document.getElementById('menuBtn');
const nav = document.getElementById('navLinks');
function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Apri menu'); menu.textContent = '☰'; }
menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu'); menu.textContent = open ? '×' : '☰'; });
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menu.focus(); } });
document.querySelectorAll('[data-choice]').forEach(a => a.addEventListener('click', () => { document.getElementById('service').value = a.dataset.choice; clearRequest(); }));
document.getElementById('year').textContent = new Date().getFullYear();
const date = document.getElementById('date');
const today = new Date();
date.min = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const form = document.getElementById('bookingForm');
const result = document.getElementById('requestResult');
function clearRequest() { result.hidden = true; document.getElementById('requestText').value = ''; document.getElementById('copyRequest').textContent = 'Copia il testo'; }
form.addEventListener('input', clearRequest);
form.addEventListener('change', clearRequest);
form.addEventListener('submit', e => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const val = id => document.getElementById(id).value.trim();
  if (!val('name')) { document.getElementById('name').focus(); return; }
  const service = document.getElementById('service').selectedOptions[0].textContent;
  const preferred = new Date(`${date.value}T12:00:00`).toLocaleDateString('it-IT');
  document.getElementById('requestText').value = `Ciao Marcella, sono ${val('name')}.\nVorrei richiedere un incontro.\n\nPercorso: ${service}\nSede: ${val('location')}\nData preferita: ${preferred}\nEmail: ${val('email')}${val('phone') ? '\nTelefono: '+val('phone') : ''}${val('notes') ? '\n\nNote: '+val('notes') : ''}\n\nAttendo un tuo riscontro per concordare disponibilità, orario e dettagli. Grazie!`;
  document.getElementById('requestStatus').textContent = 'La richiesta è pronta da copiare. Non è stata inviata e l’appuntamento non è confermato.';
  result.hidden = false;
});
document.getElementById('copyRequest').addEventListener('click', async () => {
  const text = document.getElementById('requestText');
  try { await navigator.clipboard.writeText(text.value); document.getElementById('copyRequest').textContent = 'Testo copiato'; }
  catch { text.focus(); text.select(); document.getElementById('requestStatus').textContent = 'Seleziona e copia il testo della richiesta, poi incollalo nella tua email.'; }
});
