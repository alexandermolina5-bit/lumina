/* Independent LUMINA accounts. All patient data is authorized by PostgreSQL RLS. */
(() => {
  'use strict';
  const cfg=window.LUMINA_CONFIG||{}, ready=!!cfg.supabaseUrl&&!!cfg.publishableKey;
  const root=String(cfg.supabaseUrl||'').replace(/\/$/,'');
  if(ready&&!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(root))throw Error('URL de servicio inválida');
  let session=null, revision=0, dirty=false, saving=false, conflict=false, loaded=false, refreshTask=null;
  let authMode='login';
  const urls=new Map();
  const initial=JSON.parse(JSON.stringify(db));
  const gate=document.getElementById('accountGate');
  const notice=document.getElementById('cloudStatus');
  const setStatus=(message,kind='')=>{notice.textContent=message;notice.dataset.kind=kind;};
  function blank(){return JSON.parse(JSON.stringify(initial));}
  function announce(message){document.getElementById('authMessage').textContent=message;}
  function persistSession(s){session=s;sessionStorage.setItem('lumina.session',JSON.stringify(s));}
  async function refresh(){
    if(!session)throw Error('Inicia sesión de nuevo.');
    if(refreshTask)return refreshTask;
    refreshTask=(async()=>{const r=await fetch(root+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});const data=await r.json();if(!r.ok)throw Error('Tu sesión venció. Exporta los cambios pendientes e inicia sesión de nuevo.');persistSession({...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in});})().finally(()=>refreshTask=null);
    return refreshTask;
  }
  async function request(path,{method='GET',body,headers={},retry=true}={}){
    if(!session)throw Error('Debes iniciar sesión.');
    if((session.expires_at||0)*1000<Date.now()+60000)await refresh();
    const r=await fetch(root+path,{method,headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+session.access_token,...(body&&!(body instanceof Blob)?{'Content-Type':'application/json'}:{}),...headers},body:body instanceof Blob?body:body?JSON.stringify(body):undefined});
    if(r.status===401&&retry){await refresh();return request(path,{method,body,headers,retry:false});}
    const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}
    if(!r.ok){const error=Error(data?.message||data?.msg||'No se pudo completar la operación.');error.code=data?.code;throw error;}
    return data;
  }
  const validID=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
  function validate(payload){
    if(!payload||!Array.isArray(payload.patients)||!Array.isArray(payload.appointments)||!Array.isArray(payload.areas))throw Error('El expediente guardado no tiene un formato válido.');
    for(const key of ['patients','appointments','areas','packages','receipts']){
      payload[key]||=[];
      if(!Array.isArray(payload[key])||payload[key].some(x=>!x||!validID(x.id)))throw Error('Hay identificadores inválidos en el respaldo.');
    }
    for(const p of payload.patients){
      if(typeof p.name!=='string')throw Error('Paciente inválido.');
      for(const ph of p.photos||[]){
        if(ph.path&&!ph.path.startsWith(session.user.id+'/'))throw Error('La fotografía no pertenece a esta cuenta.');
        if(ph.data&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ph.data))throw Error('Fotografía inválida.');
      }
    }
    for(const a of payload.appointments)if(!Array.isArray(a.items)||!Number.isFinite(a.paid)||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!/^\d{2}:\d{2}$/.test(a.time))throw Error('Cita inválida.');
    for(const a of payload.appointments){a.changes||=[];a.treatment||={};a.status||=a.cancelled?'Cancelada':'Programada';}
    if(payload.brand&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(payload.brand))delete payload.brand;
    return payload;
  }
  function releaseURLs(){for(const url of urls.values())if(url.startsWith('blob:'))URL.revokeObjectURL(url);urls.clear();}
  async function loadWorkspace(){
    loaded=false;setStatus('Cargando tus expedientes…');
    const rows=await request('/rest/v1/lumina_workspaces?select=payload,revision&user_id=eq.'+encodeURIComponent(session.user.id));
    const row=rows[0];db=row?validate(row.payload):blank();revision=row?.revision||0;
    db.packages||=[];db.receipts||=[];db.care||='';
    dirty=false;conflict=false;loaded=true;render();
    document.body.removeAttribute('data-locked');gate.hidden=true;
    document.getElementById('accountEmail').textContent=session.user.email;
    setStatus('Tus datos están separados de las demás cuentas.','saved');
    if(!row){dirty=true;await flush();}
    showCover();
  }
  function snapshot(){const p=JSON.parse(JSON.stringify(db));p.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;validate(p);if(JSON.stringify(p).length>5*1024*1024)throw Error('El respaldo supera 5 MB. Guarda las fotos con el cargador de fotografías para no incluirlas en el expediente.');return p;}
  async function flush(){
    if(saving||!dirty||!loaded||conflict)return;
    saving=true;
    try{
      while(dirty){
        const payload=snapshot();dirty=false;setStatus('Guardando en tu cuenta…');
        try{const result=await request('/rest/v1/rpc/lumina_save_workspace',{method:'POST',body:{p_expected_revision:revision,p_payload:payload}});revision=Number(result);setStatus('Cambios guardados en tu cuenta.','saved');}
        catch(e){dirty=true;if(e.code==='40001'){conflict=true;throw Error('Hay una versión más reciente en otro dispositivo. Exporta tu respaldo antes de recargar para no sobrescribir cambios.');}throw e;}
      }
    }catch(e){setStatus(e.message+' Los cambios de esta pantalla aún no están guardados.','error');}
    finally{saving=false;}
  }
  save=function(){if(!loaded||!session)throw Error('Inicia sesión antes de modificar expedientes.');dirty=true;render();flush();};
  window.cloudRetry=()=>{if(conflict){alert('Exporta primero tu respaldo. Después recarga para cargar la versión más reciente.');return}flush();};
  window.cloudAccountMode=mode=>{authMode=mode;authView();};
  function authView(){
    gate.hidden=false;document.body.setAttribute('data-locked','');
    gate.innerHTML=`<div class="account-shell"><div class="account-brand"><div class="logo">LÚMINA ✧</div><div class="sub">DEPILACIÓN LÁSER</div><h1>Tu cuidado.<br>Tu espacio privado.</h1><p>Cada profesional conserva sus propios pacientes, fotografías, citas y pagos.</p></div><div class="account-form"><h2>${authMode==='register'?'Crear mi cuenta':authMode==='recover'?'Recuperar acceso':authMode==='reset'?'Nueva contraseña':'Bienvenido a LÚMINA'}</h2><p>Accede con tu cuenta de LÚMINA. No necesitas ChatGPT.</p>${ready?'':'<div class="setup-note">Versión preparada para revisión. Falta conectar el servicio de cuentas privadas; aún no es posible registrarse ni guardar pacientes.</div>'}<form id="authForm"><label>Correo electrónico</label><input name="email" type="email" autocomplete="email" required ${authMode==='reset'?'disabled':''}><div ${authMode==='recover'?'hidden':''}><label>Contraseña</label><input name="password" type="password" autocomplete="${authMode==='register'||authMode==='reset'?'new-password':'current-password'}" minlength="12" ${authMode==='recover'?'':'required'} placeholder="Mínimo 12 caracteres"></div><button ${ready?'':'disabled'}>${authMode==='register'?'Crear cuenta':authMode==='recover'?'Enviar enlace':authMode==='reset'?'Guardar contraseña':'Entrar'}</button><p id="authMessage" role="status"></p></form><div class="toolbar"><button class="link" onclick="cloudAccountMode('login')">Iniciar sesión</button><button class="link" onclick="cloudAccountMode('register')">Crear cuenta</button><button class="link" onclick="cloudAccountMode('recover')">Olvidé mi contraseña</button></div><small>iPhone · Android · Computadora</small></div></div>`;
    document.getElementById('authForm').addEventListener('submit',submitAuth);
  }
  async function submitAuth(e){
    e.preventDefault();if(!ready)return;const f=new FormData(e.target),email=f.get('email'),password=f.get('password');const button=e.target.querySelector('button');button.disabled=true;announce('Procesando…');
    try{
      if(authMode==='reset'){await request('/auth/v1/user',{method:'PUT',body:{password}});announce('Contraseña actualizada.');await loadWorkspace();return;}
      const path=authMode==='register'?'/auth/v1/signup?redirect_to='+encodeURIComponent(location.href.split('#')[0]):authMode==='recover'?'/auth/v1/recover?redirect_to='+encodeURIComponent(location.href.split('#')[0]):'/auth/v1/token?grant_type=password';
      const r=await fetch(root+path,{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(authMode==='recover'?{email}:{email,password})});const data=await r.json();
      if(!r.ok)throw Error(authMode==='login'?'No se pudo iniciar sesión. Revisa tu correo, contraseña y confirmación del correo.':data.msg||data.message||'No se pudo completar la solicitud.');
      e.target.reset();
      if(authMode==='recover'){announce('Si el correo está registrado, recibirás un enlace de recuperación.');return;}
      if(!data.access_token){announce('Revisa tu correo y confirma tu cuenta antes de entrar.');return;}
      persistSession({...data,expires_at:Math.floor(Date.now()/1000)+data.expires_in});await loadWorkspace();
    }catch(err){announce(err.message)}finally{button.disabled=false}
  }
  window.cloudSignOut=async()=>{
    if((dirty||saving)&&!confirm('Hay cambios pendientes. Exporta un respaldo antes de salir. ¿Salir de todos modos?'))return;
    try{
      // Unsubscribe this browser so another professional cannot receive the previous user's alerts.
      const reg=await navigator.serviceWorker?.getRegistration('./');const sub=await reg?.pushManager?.getSubscription();
      if(sub){await request('/rest/v1/lumina_push_subscriptions?endpoint=eq.'+encodeURIComponent(sub.endpoint),{method:'DELETE'});await sub.unsubscribe();}
    }catch{alert('No se pudo desconectar el dispositivo de los recordatorios. No cambies de cuenta hasta reintentar con conexión.');return;}
    try{await request('/auth/v1/logout?scope=local',{method:'POST'});}catch{}
    sessionStorage.removeItem('lumina.session');session=null;loaded=false;db=blank();releaseURLs();closeModal();render();document.getElementById('cover')?.remove();authMode='login';authView();
  };
  async function photoURL(ph){
    if(!ph.path)return ph.data||'';if(urls.has(ph.path))return urls.get(ph.path);
    if(!ph.path.startsWith(session.user.id+'/'))throw Error('Fotografía no autorizada.');
    const data=await request('/storage/v1/object/sign/lumina-private/'+ph.path.split('/').map(encodeURIComponent).join('/'),{method:'POST',body:{expiresIn:120}});
    const u=root+'/storage/v1'+data.signedURL;urls.set(ph.path,u);setTimeout(()=>urls.delete(ph.path),110000);return u;
  }
  photos=async function(id){
    const p=person(id);p.photos||=[];
    try{
      const blocks=await Promise.all(p.photos.map(async(ph,i)=>`<div><img src="${esc(await photoURL(ph))}" alt="${esc(ph.phase)} ${esc(ph.area)}" style="width:100%;border-radius:9px"><span class="pill">${esc(ph.phase)}</span><p>${esc(ph.date)} · ${esc(ph.area)}<br>${esc(ph.note||'')}</p><button type="button" class="link" onclick="removePhoto('${id}',${i})">Eliminar</button></div>`));
      forms(`<h2>Antes y después · ${esc(p.name)}</h2><p>Fotografías privadas de tu cuenta.</p><button type="button" class="secondary" onclick="comparePhotos('${id}')">Comparar evolución</button><div class="two">${blocks.join('')}</div>${pickArea()}<label>Etapa</label><select name="phase"><option>Antes</option><option>Después</option></select>${field('Fecha','date',today(),'date','required')}${field('Sesión / referencia','group','','text','required')}${field('Observaciones','note')}<label>Fotografía JPG, PNG o WebP (hasta 2 MB)</label><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required><label><input type="checkbox" required style="width:auto"> Tengo autorización del paciente para guardar esta fotografía.</label>`,`savePhoto(event,'${id}')`);
    }catch(e){alert(e.message)}
  };
  savePhoto=async function(e,id){
    e.preventDefault();const f=new FormData(e.target),file=f.get('photo');if(file.size>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('Selecciona JPG, PNG o WebP de hasta 2 MB.');return}
    const path=session.user.id+'/'+id+'/'+crypto.randomUUID()+'.'+({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);
    try{await request('/storage/v1/object/lumina-private/'+path,{method:'POST',body:file,headers:{'Content-Type':file.type,'x-upsert':'false'}});person(id).photos||=[];person(id).photos.push({path,date:f.get('date'),phase:f.get('phase'),group:f.get('group').trim(),note:f.get('note'),area:db.areas.find(a=>a.id===f.get('area')).name,authorizedAt:new Date().toISOString()});save();closeModal();}
    catch(err){alert(err.message)}
  };
  comparePhotos=async function(id){
    const p=person(id),groups=[...new Set((p.photos||[]).map(ph=>ph.area+' / '+ph.group))];
    try{const html=await Promise.all(groups.map(async group=>{const items=p.photos.filter(ph=>ph.area+' / '+ph.group===group);return `<h3>${esc(group)}</h3><div class="two">${(await Promise.all(['Antes','Después'].map(async phase=>`<div><h3>${phase}</h3>${(await Promise.all(items.filter(ph=>ph.phase===phase).map(async ph=>`<img src="${esc(await photoURL(ph))}" alt="${phase}" style="width:100%"><p>${esc(ph.date)} · ${esc(ph.note||'')}</p>`))).join('')||'<p>Falta esta fotografía.</p>'}</div>`))).join('')}</div>`}));open(`<h2>Comparación de evolución</h2>${html.join('')||'<p>Agrega fotografías para compararlas.</p>'}<button class="secondary" onclick="photos('${id}')">Volver</button>`)}catch(e){alert(e.message)}
  };
  removePhoto=function(id,index){if(confirm('¿Retirar esta fotografía del expediente?')){person(id).photos.splice(index,1);save();photos(id)}};
  restoreBackup=function(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const b=JSON.parse(reader.result);if(b.app!=='LUMINA')throw Error('Archivo incorrecto.');const candidate=validate(b.data);if(!confirm('¿Sustituir los registros de TU cuenta por este respaldo? Las demás cuentas no se modificarán.'))return;db=candidate;save();}catch(e){alert(e.message)}};reader.readAsText(file)};
  const oldSettings=settingsView;
  settingsView=function(){oldSettings();$('#view').insertAdjacentHTML('afterbegin','<div class="notice">Tu sesión: '+esc(session.user.email)+'. El respaldo contiene únicamente tus registros. Las fotografías guardadas en la nube se referencian mediante rutas privadas y solo podrán recuperarse dentro de esta misma cuenta.</div>');const headings=[...$('#view').querySelectorAll('h3')];const h=headings.find(h=>h.textContent==='Acceso y sincronización');if(h&&h.nextElementSibling)h.nextElementSibling.textContent='Cuenta individual de LÚMINA. Los cambios se guardan en línea; se requiere conexión para consultar y guardar expedientes.';};
  const oldRender=render;
  render=function(){oldRender();if(page==='Recordatorios')$('#view').innerHTML=`<div class="panel" style="margin-top:24px"><h2>Recordatorios web</h2><p>Los avisos de la APK de Android no se trasladan automáticamente al navegador. El envío web con la aplicación cerrada se activará después de conectar y comprobar el servicio de notificaciones.</p><h3>Disponible mientras tanto</h3><p>Abre una cita y usa «Añadir a mi calendario con recordatorio» para descargarla e importarla en el calendario del teléfono.</p>${list(db.appointments.filter(a=>!a.cancelled&&a.date>=today()))}</div>`;};
  // Keep the existing appointment export, now with all four calendar alarms.
  downloadICS=function(id){const a=db.appointments.find(a=>a.id===id),stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),start=new Date(a.date+'T'+a.time);const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LUMINA//Agenda//ES','BEGIN:VEVENT','UID:'+a.id+'@lumina','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(start),'DTEND:'+stamp(new Date(+start+a.duration*60000)),'SUMMARY:Cita LUMINA'];for(const trigger of ['-P2D','-P1D','-PT1H','PT0S'])lines.push('BEGIN:VALARM','TRIGGER:'+trigger,'ACTION:DISPLAY','DESCRIPTION:Recordatorio de cita','END:VALARM');lines.push('END:VEVENT','END:VCALENDAR');downloadFile('LUMINA_Cita.ics',lines.join('\r\n'),'text/calendar')};
  window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}});
  window.addEventListener('online',()=>{if(dirty&&!conflict)flush();});
  async function boot(){
    authView();if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js').catch(()=>{});if(!ready)return;
    try{
      const hash=new URLSearchParams(location.hash.slice(1));
      if(hash.get('access_token')){persistSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)});history.replaceState(null,'',location.pathname+location.search);session.user=await request('/auth/v1/user');persistSession(session);if(hash.get('type')==='recovery'){authMode='reset';authView();return;}}
      else{const raw=sessionStorage.getItem('lumina.session');if(raw)session=JSON.parse(raw);}
      if(session){session.user=await request('/auth/v1/user');await loadWorkspace();}
    }catch(e){session=null;sessionStorage.removeItem('lumina.session');authView();announce(e.message)}
  }
  boot();
})();
