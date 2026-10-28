const app = document.querySelector('#app');
const sections = ['Hoje', 'Roteiro', 'Hospedagem', 'Transportes', 'Ingressos', 'Documentos', 'Talk', 'Notas', 'Essenciais'];
let tripPackage;

const esc = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const date = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : '';
const datetime = (value) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '';
const value = (label, item) => item ? `<div><strong>${esc(label)}:</strong> ${esc(item)}</div>` : '';
const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));
function card(title, body, subtitle = '') { return `<article class="card">${title ? `<h2>${esc(title)}</h2>` : ''}${subtitle ? `<p class="meta">${esc(subtitle)}</p>` : ''}${body}</article>`; }
function noData(text) { return `<p class="empty">${esc(text)}</p>`; }
function fileList(entityType, entityId) {
  const files = tripPackage.files.filter((file) => file.entityType === entityType && (!entityId || file.entityId === entityId));
  return files.length ? `<div class="row">${files.map((file) => `<div class="file"><span>${esc(file.displayName)}</span><a href="${esc(file.cachePath)}" target="_blank" rel="noopener">Abrir</a></div>`).join('')}</div>` : '';
}
async function importPackage(file) {
  const bundle = JSON.parse(await file.text());
  if (bundle?.version !== 1 || !bundle?.trip || !Array.isArray(bundle?.days)) throw new Error('Este arquivo não é um pacote offline JoiTrip compatível.');
  const portableFiles = bundle.portableFiles || {};
  delete bundle.portableFiles;
  if ('caches' in window) {
    const cache = await caches.open('joitrip-offline-v1');
    await Promise.all(bundle.files.map(async (item) => {
      const content = portableFiles[item.id];
      if (!content) return;
      const response = await fetch(content);
      await cache.put(item.cachePath, response);
    }));
    await cache.put('./data.json', new Response(JSON.stringify(bundle), { headers: { 'Content-Type': 'application/json' } }));
    await cache.put('./metadata.json', new Response(JSON.stringify({ generatedAt: bundle.generatedAt, title: bundle.trip.title }), { headers: { 'Content-Type': 'application/json' } }));
  }
  localStorage.setItem('joitrip.offline.data.v1', JSON.stringify(bundle));
  localStorage.setItem('joitrip.offline.metadata.v1', JSON.stringify({ generatedAt: bundle.generatedAt, title: bundle.trip.title }));
  tripPackage = bundle;
  render();
}
function itinerary() {
  const days = tripPackage.days;
  const destinations = byId(tripPackage.destinations);
  const items = tripPackage.itinerary;
  if (!days.length) return noData('Nenhum dia de roteiro salvo.');
  return days.map((day) => {
    const places = (day.destinationIds || []).map((id) => destinations[id]?.name).filter(Boolean).join(' · ');
    const entries = items.filter((item) => item.dayId === day.id);
    return card(day.title || date(day.date), `${entries.length ? entries.map((item) => `<div class="row"><div class="time">${esc(item.startTime || '—')}${item.endTime ? ` → ${esc(item.endTime)}` : ''}</div><h3>${esc(item.title)}</h3><div class="details">${value('Local', item.location || item.localName)}${value('Endereço', item.address || item.localAddress)}${value('Como chegar', item.howToGo || item.howToGoDetail)}${value('Detalhes', item.complementaryInfo || item.operationalDetail)}${value('Plano B', item.contingencyPlan)}</div></div>`).join('') : noData('Nenhum compromisso para este dia.')}`, places || date(day.date));
  }).join('');
}
function today() {
  const key = new Date().toISOString().slice(0, 10);
  const day = tripPackage.days.find((candidate) => candidate.date === key);
  if (!day) return card('Hoje', noData('Não há itens de roteiro para a data atual. Consulte o roteiro completo.'), date(key));
  const places = byId(tripPackage.destinations);
  const locations = (day.destinationIds || []).map((id) => places[id]?.name).filter(Boolean).join(' · ');
  const entries = tripPackage.itinerary.filter((item) => item.dayId === day.id);
  return card('Hoje', entries.length ? entries.map((item) => `<div class="row"><span class="time">${esc(item.startTime || '—')}</span><h3>${esc(item.title)}</h3><div class="meta">${esc(item.location || item.localName || item.complementaryInfo || '')}</div></div>`).join('') : noData('Nenhum compromisso salvo para hoje.'), locations || date(day.date));
}
function lodging() {
  return tripPackage.accommodations.length ? tripPackage.accommodations.map((item) => card(item.name, `<div class="details">${value('Check-in', `${date(item.checkInDate)}${item.checkInTime ? ` · ${item.checkInTime}` : ''}`)}${value('Check-out', `${date(item.checkOutDate)}${item.checkOutTime ? ` · ${item.checkOutTime}` : ''}`)}${value('Endereço', item.address || item.localAddress)}${value('Telefone', item.phone)}${value('Reserva', item.reservationCode)}${value('Observações', item.notes)}</div>${fileList('accommodation', item.id)}`)).join('') : noData('Nenhuma hospedagem salva.');
}
function transports() {
  const travelers = byId(tripPackage.travelers);
  return tripPackage.transports.length ? tripPackage.transports.map((item) => card(`${item.origin} → ${item.destination}`, `<div class="details">${value('Saída', `${date(item.departureDate)}${item.departureTime ? ` · ${item.departureTime}` : ''}`)}${value('Chegada', `${date(item.arrivalDate)}${item.arrivalTime ? ` · ${item.arrivalTime}` : ''}`)}${value('Operadora', item.carrier)}${value('Voo / número', item.numberCode)}${value('Reserva', item.bookingReference)}${value('Assento', item.seat)}${value('Embarque', item.departureTerminal || item.boardingGate || item.platform)}${value('Observações', item.notes)}</div>${fileList('transport', item.id)}`, item.type)).join('') : noData('Nenhum transporte salvo.');
}
function tickets() {
  return tripPackage.tickets.length ? tripPackage.tickets.map((item) => card(item.title, `<div class="details">${value('Data', `${date(item.date)}${item.time ? ` · ${item.time}` : ''}`)}${value('Reserva', item.bookingReference)}${value('Titular', item.holder || item.travelerNames)}${value('Fornecedor', item.provider)}${value('Entrada', item.entrance || item.gate)}${value('Observações', item.notes)}</div>${fileList('ticket', item.id)}`)).join('') : noData('Nenhum ingresso ou reserva salvo.');
}
function documents() {
  return `${tripPackage.documents.length ? tripPackage.documents.map((item) => card(item.title, `<div class="details">${value('Titular', item.holder)}${value('Número', item.documentNumber)}${value('Validade', date(item.validUntil))}${value('Seguradora', item.insurer)}${value('Assistência', item.assistancePhone)}${value('Detalhes', item.description)}</div>${fileList('document', item.id)}`, item.type)).join('') : noData('Nenhum documento salvo.')}${tripPackage.files.filter((file) => file.entityType === 'trip').length ? card('Arquivos da viagem', fileList('trip')) : ''}`;
}
function talk() {
  const grouped = tripPackage.talk.reduce((groups, phrase) => {
    const category = phrase.category || 'Outras';
    (groups[category] ||= []).push(phrase);
    return groups;
  }, {});
  return Object.entries(grouped).map(([category, phrases]) => card(category, phrases.map((phrase) => `<div class="row"><h3>${esc(phrase.portuguese)}</h3><div class="details">${value('English', phrase.english)}${value('中文', phrase.chinese)}${value('Pronúncia', phrase.pronunciation)}</div>${phrase.favorite ? '<span class="tag">Favorita</span>' : ''}${phrase.pinned ? '<span class="tag">Fixada</span>' : ''}</div>`).join(''))).join('') || noData('Nenhuma frase salva.');
}
function notes() { return tripPackage.notes.length ? tripPackage.notes.map((note) => card(note.title, `<div class="details">${esc(note.content || 'Sem conteúdo.')}</div>`, note.pinned ? 'Fixada' : '')).join('') : noData('Nenhuma nota salva.'); }
function essentials() {
  const travelers = tripPackage.travelers.length ? tripPackage.travelers.map((person) => `<div class="row">${esc(person.name)}</div>`).join('') : noData('Nenhum viajante salvo.');
  const emergency = tripPackage.documents.filter((doc) => doc.assistancePhone).map((doc) => `<div class="row"><strong>${esc(doc.title)}</strong><div class="meta">${esc(doc.assistancePhone)}</div></div>`).join('');
  return `${card('Viajantes', travelers)}${emergency ? card('Contatos de assistência', emergency) : ''}`;
}
const views = { Hoje: today, Roteiro: itinerary, Hospedagem: lodging, Transportes: transports, Ingressos: tickets, Documentos: documents, Talk: talk, Notas: notes, Essenciais: essentials };
function render(active = 'Hoje') {
  app.innerHTML = `<div class="app"><section class="hero"><h1>${esc(tripPackage.trip.title)}</h1><p>${esc(tripPackage.trip.subtitle || `${date(tripPackage.trip.startDate)} → ${date(tripPackage.trip.endDate)}`)}</p></section><p class="notice">Atualizado em ${esc(datetime(tripPackage.generatedAt))}. Esta cópia é somente leitura e funciona com os dados e arquivos já salvos.</p><label class="notice">Atualizar pacote <input id="package-file" type="file" accept="application/json,.json"></label><nav class="tabs" aria-label="Seções">${sections.map((name) => `<button type="button" data-section="${name}" aria-selected="${name === active}">${name}</button>`).join('')}</nav><section class="section">${views[active]()}</section><p class="privacy">Os dados desta versão ficam somente no armazenamento deste navegador. Não compartilhe o arquivo do pacote: ele pode conter documentos pessoais. Ao apagar os dados do Safari ou deste site, importe o pacote novamente.</p></div>`;
  document.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', () => render(button.dataset.section)));
  document.querySelector('#package-file').addEventListener('change', async (event) => { try { const file = event.target.files?.[0]; if (file) await importPackage(file); } catch (error) { alert(error instanceof Error ? error.message : 'Não foi possível importar o pacote.'); } });
}
async function start() {
  try {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' });
    const response = await fetch('./data.json');
    if (response.ok) tripPackage = await response.json();
    else throw new Error('Pacote não encontrado');
    render();
  } catch {
    try {
      tripPackage = JSON.parse(localStorage.getItem('joitrip.offline.data.v1') || 'null');
      if (!tripPackage) throw new Error('Pacote não encontrado');
      render();
    } catch {
      app.innerHTML = '<div class="app">' + card('Importe sua viagem', '<p class="empty">No JoiTrip Web, abra Mais → Offline, crie a versão e escolha “Exportar pacote para a PWA HTTPS”. Em seguida, selecione o arquivo abaixo. Ele não é enviado para este site.</p><input id="package-file" type="file" accept="application/json,.json">') + '</div>';
      document.querySelector('#package-file').addEventListener('change', async (event) => { try { const file = event.target.files?.[0]; if (file) await importPackage(file); } catch (error) { alert(error instanceof Error ? error.message : 'Não foi possível importar o pacote.'); } });
    }
  }
}
start();
