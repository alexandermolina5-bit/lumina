(() => {
  'use strict';
  const DB_NAME='lumina-device',STORE='workspace',KEY='current';
  const state=document.getElementById('localStatus'),loading=document.getElementById('loadingLocal');
  const baseRender=render;
  let database=null,loaded=false,revision=0,saving=false,dirty=false,conflict=false,backupAt='';
  try{backupAt=localStorage.getItem('lumina.lastBackup')||''}catch{}
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('lumina-device-updates'):null;
  function status(text,kind=''){state.textContent=text;state.dataset.kind=kind;}
  const allowedID=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
  function imageData(value){return typeof value==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);}
  function validate(payload){
    if(!payload||typeof payload!=='object')throw Error('Respaldo inválido.');
    for(const key of ['patients','appointments','areas'])if(!Array.isArray(payload[key]))throw Error('El respaldo no contiene los registros esperados.');
    for(const key of ['packages','receipts'])payload[key]||=[];
    for(const key of ['patients','appointments','areas','packages','receipts'])if(!Array.isArray(payload[key])||payload[key].some(x=>!x||!allowedID(x.id)))throw Error('Hay registros con identificadores inválidos.');
    for(const p of payload.patients){
      if(typeof p.name!=='string'||(p.photos&&!Array.isArray(p.photos)))throw Error('Paciente inválido.');
      for(const ph of p.photos||[]){if(ph.path&&!ph.data)throw Error('Este respaldo referencia fotos en la nube sin incluirlas. Usa un respaldo completo de la versión local.');if(!imageData(ph.data))throw Error('Una fotografía no tiene un formato válido.');}
      if(p.consent?.signature&&!imageData(p.consent.signature))throw Error('Firma inválida.');
    }
    for(const a of payload.appointments){if(!Array.isArray(a.items)||!Number.isFinite(a.paid)||a.paid<0||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!/^\d{2}:\d{2}$/.test(a.time)||a.items.some(i=>!Number.isFinite(i.price)||i.price<0))throw Error('Cita inválida.');a.changes||=[];a.treatment||={};a.status||=a.cancelled?'Cancelada':'Programada';}
    for(const p of payload.packages)if(!Number.isFinite(p.price)||!Number.isFinite(p.paid)||!Number.isFinite(p.sessions)||p.price<0||p.paid<0||p.paid>p.price||p.sessions<1||!Array.isArray(p.payments))throw Error('Paquete inválido.');
    if(payload.brand&&!imageData(payload.brand))throw Error('La imagen de portada no es válida.');
    return payload;
  }
  function openStore(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Cierra las otras pestañas de LÚMINA para abrir la agenda.'));});}
  function read(){return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readonly'),req=tx.objectStore(STORE).get(KEY);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});}
  function write(payload){return new Promise((resolve,reject)=>{const tx=database.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);let versionError=false;const get=store.get(KEY);get.onsuccess=()=>{if((get.result?.revision||0)!==revision){versionError=true;tx.abort();return}store.put({payload,revision:revision+1,updatedAt:new Date().toISOString()},KEY)};tx.oncomplete=()=>resolve(revision+1);tx.onerror=()=>reject(tx.error||Error('No se pudo guardar.'));tx.onabort=()=>{const err=Error(versionError?'Hay cambios más recientes en otra pestaña. Exporta un respaldo y recarga para revisarlos.':'No se pudo guardar.');err.conflict=versionError;reject(err)};});}
  async function flush(){
    if(!loaded||saving||!dirty||conflict)return;
    saving=true;
    try{while(dirty){const snapshot=JSON.parse(JSON.stringify(db));validate(snapshot);dirty=false;status('Guardando en este navegador…');try{revision=await write(snapshot);status('Guardado en este navegador · Tus registros no se envían a otras personas.');channel?.postMessage({revision});}catch(e){dirty=true;conflict=!!e.conflict;throw e}}}
    catch(e){status(e.message+' Los cambios de esta pantalla aún no están guardados. Exporta un respaldo antes de cerrar.','error')}
    finally{saving=false}
  }
  save=function(){if(!loaded)throw Error('Espera a que termine la carga del almacenamiento.');dirty=true;render();flush()};
  window.retryLocalSave=()=>{if(conflict){alert('Exporta tu respaldo antes de recargar y comparar los cambios.');return}flush()};
  window.exportLocalBackup=()=>{try{const payload=JSON.parse(JSON.stringify(db));validate(payload);downloadFile('LUMINA_Respaldo_Completo_'+today()+'.json',JSON.stringify({app:'LUMINA',version:3,exportedAt:new Date().toISOString(),data:payload},null,2));backupAt=new Date().toISOString();try{localStorage.setItem('lumina.lastBackup',backupAt)}catch{}if(page==='Respaldo y acceso')render();}catch(e){alert(e.message)}};
  restoreBackup=function(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const backup=JSON.parse(reader.result);if(backup.app!=='LUMINA')throw Error('Este archivo no es un respaldo de LÚMINA.');const next=validate(backup.data);if(!confirm('¿Reemplazar los registros guardados en ESTE navegador? Exporta primero tu respaldo actual. Los demás teléfonos no se modificarán.'))return;db=next;save()}catch(e){alert(e.message)}};reader.onerror=()=>alert('No se pudo leer el respaldo.');reader.readAsText(file)};
  window.keepLocalStorage=async()=>{const allowed=await navigator.storage?.persist?.();alert(allowed?'El navegador concedió almacenamiento persistente. Conserva también tus respaldos.':'El navegador no concedió almacenamiento persistente. Exporta respaldos con frecuencia.');};
  function settings(){
    $('#view').innerHTML=`<div class="panel" style="margin-top:24px"><h2>Respaldo de tus pacientes</h2><div class="local-help">Esta agenda guarda la información únicamente en este navegador y dispositivo. No hay cuentas ni sincronización. Quien utilice este mismo navegador podrá abrir estos registros. Borrar los datos del navegador puede borrar la agenda.</div><div class="local-buttons"><button onclick="exportLocalBackup()">Descargar respaldo completo</button><button class="secondary" onclick="retryLocalSave()">Reintentar guardado</button></div><p>Incluye pacientes, citas, pagos, paquetes, firmas y las fotografías guardadas aquí. Última exportación iniciada: ${backupAt?esc(new Date(backupAt).toLocaleString('es-CR')):'Aún no has exportado un respaldo.'}</p><h3>Restaurar o trasladar tus datos</h3><p>Selecciona tu respaldo JSON para recuperarlo en este navegador. Los pacientes de otros teléfonos no se mezclarán automáticamente.</p><input type="file" accept=".json,application/json" onchange="restoreBackup(this.files[0])"><h3>Conservar el almacenamiento</h3><button class="secondary" onclick="keepLocalStorage()">Solicitar almacenamiento persistente</button><p>Usa siempre el mismo navegador y evita el modo privado para conservar tus registros. Guarda el respaldo fuera del navegador, por ejemplo en Archivos.</p><h3>Imagen de portada</h3><input type="file" accept="image/jpeg,image/png,image/webp" onchange="loadBrand(this.files[0])"></div>`;
  }
  downloadICS=function(id){const a=db.appointments.find(a=>a.id===id),stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),start=new Date(a.date+'T'+a.time),rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LUMINA//Agenda//ES','BEGIN:VEVENT','UID:'+a.id+'@lumina','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(start),'DTEND:'+stamp(new Date(+start+a.duration*60000)),'SUMMARY:Cita LUMINA'];for(const trigger of ['-P2D','-P1D','-PT1H','PT0S'])rows.push('BEGIN:VALARM','TRIGGER:'+trigger,'ACTION:DISPLAY','DESCRIPTION:Recordatorio de cita','END:VALARM');rows.push('END:VEVENT','END:VCALENDAR');downloadFile('LUMINA_Cita.ics',rows.join('\r\n'),'text/calendar')};
  render=function(){baseRender();if(page==='Respaldo y acceso')settings();if(page==='Recordatorios')$('#view').innerHTML=`<div class="panel" style="margin-top:24px"><h2>Recordatorios en el calendario</h2><p>Esta versión local no envía notificaciones automáticas con la web cerrada. Abre una cita y pulsa «Añadir a mi calendario con recordatorio» para importarla en el calendario del teléfono.</p><div class="local-help">El archivo incluye avisos a 48 horas, 24 horas, una hora y al comenzar. Al importarlo, revisa los avisos que admite y conserva tu calendario. Si cambias o cancelas una cita aquí, actualízala también en el calendario externo.</div>${list(db.appointments.filter(a=>!a.cancelled&&a.date>=today()))}</div>`;};
  loadBrand=function(file){if(!file)return;if(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('Selecciona JPG, PNG o WebP de hasta 2 MB.');return}const reader=new FileReader();reader.onload=()=>{db.brand=reader.result;save();showCover()};reader.readAsDataURL(file)};
  channel&&(channel.onmessage=async event=>{if(!loaded||event.data.revision<=revision)return;if(dirty||saving){conflict=true;status('Otra pestaña modificó la agenda. Exporta un respaldo de esta pantalla antes de recargar.','error');return}const current=await read();if(current){db=validate(current.payload);revision=current.revision;render();status('Agenda actualizada desde la otra pestaña de este navegador.')}});
  window.addEventListener('beforeunload',event=>{if(dirty||saving){event.preventDefault();event.returnValue='';}});
  async function boot(){
    try{
      database=await openStore();database.onversionchange=()=>{database.close();loaded=false;status('La agenda se actualizó. Recarga la página.','error')};
      const stored=await read();if(stored){db=validate(stored.payload);revision=stored.revision;}
      else{let old;try{old=localStorage.getItem('lumina-v1')}catch{}if(old){db=validate(JSON.parse(old));dirty=true;}}
      loaded=true;render();showCover();loading.remove();
      status('Tus datos se guardan solo en este navegador. Exporta un respaldo para conservar una copia.');
      const note=document.querySelector('.notice');if(note)note.textContent='Versión local · No requiere cuentas ni ChatGPT. Cada navegador conserva sus propios datos. Los recordatorios de calendario se importan desde cada cita.';
      if(dirty)await flush();
      if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>status('La agenda funciona en línea. No se pudo activar la copia sin conexión.'));
    }catch(e){loading.textContent='No se pudo abrir el almacenamiento de este navegador. Prueba Safari o Chrome fuera del modo privado. '+e.message;status('Almacenamiento no disponible. No se han guardado cambios.','error')}
  }
  const paymentRender=render;
  render=function(){paymentRender();if(page==='Pagos'){
    const bar=document.createElement('div');bar.className='toolbar';
    bar.innerHTML='<button onclick="openPayment()">＋ Registrar pago</button><p>Selecciona una cita pendiente para registrar un abono o cancelar su saldo.</p>';
    $('#view').prepend(bar);
  }};
  window.openPayment=function(id){
    const pending=db.appointments.filter(a=>!a.cancelled&&balance(a)>0);
    if(!pending.length){open('<h2>Registrar pago</h2><p>No hay citas con saldo pendiente. Para cobrar, crea una cita y asigna un precio a sus áreas.</p><button type="button" onclick="closeModal();appointment()">Crear cita</button>');return;}
    const selected=pending.find(a=>a.id===id)||pending[0];
    open(`<h2>Registrar pago</h2><form onsubmit="recordLocalPayment(event)"><label>Cita y paciente</label><select name="appointment" onchange="openPayment(this.value)">${pending.map(a=>`<option value="${esc(a.id)}" ${a.id===selected.id?'selected':''}>${esc(person(a.patient).name)} · ${esc(a.date)} ${esc(a.time)} · ${money(balance(a))} pendiente</option>`).join('')}</select><p>Pendiente: <strong>${money(balance(selected))}</strong></p><label>Monto del pago (₡)</label><input name="amount" type="number" min="0.01" step="0.01" max="${balance(selected)}" value="${balance(selected)}" required><label>Método de pago</label><select name="method"><option>Efectivo</option><option>SINPE</option><option>Tarjeta</option><option>Transferencia</option></select><div class="actions"><button type="button" class="secondary" onclick="closeModal()">Cerrar</button><button type="submit">Registrar pago</button></div></form>`);
  };
  window.recordLocalPayment=function(event){
    event.preventDefault();if(!loaded||conflict){alert('Recarga la agenda después de guardar un respaldo para registrar el pago.');return;}
    const form=new FormData(event.target),a=db.appointments.find(a=>a.id===form.get('appointment')),amount=Number(form.get('amount'));
    if(!a||a.cancelled||!Number.isFinite(amount)||amount<=0||amount>balance(a)){alert('Ingresa un monto mayor que cero que no supere el saldo pendiente.');return;}
    db.receipts||=[];
    const r={id:crypto.randomUUID(),appointment:a.id,patient:a.patient,amount,method:form.get('method')||'Efectivo',date:new Date().toISOString(),number:'LUM-'+String(db.receipts.length+1).padStart(5,'0')};
    a.paid=Math.round((a.paid+amount)*100)/100;db.receipts.push(r);closeModal();save();
    open(`<h2>Pago registrado</h2><p>Paciente: ${esc(person(a.patient).name)}</p><p>Recibido: <strong>${money(amount)}</strong><br>Pendiente: <strong>${money(balance(a))}</strong></p><p>Comprueba el estado de guardado de la agenda antes de cerrar.</p><button type="button" onclick="receipt('${r.id}')">Descargar comprobante</button><button type="button" class="secondary" onclick="closeModal()">Cerrar</button>`);
  };
  boot();
})();
