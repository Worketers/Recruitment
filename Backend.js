/* Way Finder. Solo api y doGet/doPost son invocables por clientes. */
const DB_ID_ = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const OWNER_ = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL');
const REQ_FIELDS_ = ['nombreSolicitante','empresaCliente','telefonoContacto','celularContacto','emailContacto','nombrePosicion','numeroVacantes','tipoVacante','ubicacion','horarioLaboral','reportaA','edadMinMax','estadoCivil','genero','escolaridad','objetivoPuesto','experienciaRequerida','requisitosIndispensables','requisitosDeseables','conocimientosCualidades','habilidadesTecnologicas','idiomas','competenciasEvaluar','actividadesDesempenar','sueldoBruto','sueldoNeto','prestacionesLey','prestacionesSuperiores','compensacionesVariables','esquemaPago','frecuenciaPago','tipoContrato','periodoPrueba','requisitosAutoTransporte','observacionesExtras'];
const SCHEMA_ = {
  Requisiciones: ['idRequisicion','fecha','estatus'].concat(REQ_FIELDS_, ['actualizadoEn','actualizadoPor','version','activo']),
  Candidatos: ['idPostulacion','idRequisicion','fecha','nombreCandidato','telefono','correo','linkCV','estatusProceso','notasReclutador','puestoDeseado','nivelEstudios','cvFileId','consentimientoEn','actualizadoEn','actualizadoPor','version','solicitudId','activo'],
  Usuarios: ['correo','nombre','rol','activo','creadoEn','actualizadoEn','version','usuario','passwordHash','cambiarPassword'],
  Bitacora: ['id','fecha','actor','accion','entidad','registroId','antes','despues'],
  Sesiones: ['hash','correo','expiraEn','creadaEn','soloPassword'],
  Solicitudes: ['solicitudId','tipo','registroId','fecha']
};
const CAND_STATES_ = ['Pendiente','En revisión','Entrevista','En proceso','Contratado','Descartado'];
const REQ_STATES_ = ['Activa','Pausada','Cerrada'];

function doGet(e) {
  const view = e && e.parameter && e.parameter.vista || 'inicio';
  const template = HtmlService.createTemplateFromFile('App');
  template.supportEmail = OWNER_ || '';
  template.initialView = ['inicio','candidatos','cliente','admin','superadmin'].indexOf(view) >= 0 ? view : 'inicio';
  return template.evaluate().setTitle(BRAND_.brand+' · '+BRAND_.product).addMetaTag('viewport','width=device-width, initial-scale=1');
}
function doPost(e) {
  let response;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length > 7100000) throw new Error('Solicitud inválida.');
    const request = JSON.parse(raw);
    if (!request || typeof request.action !== 'string' || request.action.length > 60) throw new Error('Solicitud inválida.');
    response = api(request.action, request.data, request.token);
  } catch (err) { response = {success:false,error:'Solicitud inválida.'}; }
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
}
function inicializarProyecto() {
  // La identidad activa evita que un visitante ejecute como el propietario.
  if (Session.getActiveUser().getEmail().toLowerCase() !== OWNER_) throw new Error('Solo el propietario puede inicializar desde el editor.');
  return inicializarProyecto_();
}

// Ejecutar una vez desde el editor, nunca desde el navegador público.
function inicializarProyecto_() {
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== OWNER_) throw new Error('Ejecuta con la cuenta propietaria.');
  return locked_(function() {
    const db = SpreadsheetApp.openById(DB_ID_);
    Object.keys(SCHEMA_).forEach(function(name) {
      let s = db.getSheetByName(name);
      if (!s) s = db.insertSheet(name);
      const headers = SCHEMA_[name];
      if (s.getLastRow() === 0) {
        s.getRange(1,1,1,headers.length).setValues([headers]);
      } else {
        const existing = s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
        if (existing.some(function(h,i) { return h !== headers[i]; })) throw new Error('Revisa columnas de '+name+' antes de migrar.');
        if (existing.length < headers.length) s.getRange(1,existing.length+1,1,headers.length-existing.length).setValues([headers.slice(existing.length)]);
      }
      s.setFrozenRows(1);
      s.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#def3f1');
    });
    if (!rows_('Usuarios').some(function(u){return u.correo === OWNER_;})) append_('Usuarios',{correo:OWNER_,nombre:'Administrador',rol:'superadmin',activo:true,creadoEn:now_(),actualizadoEn:now_(),version:1});
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('CV_FOLDER_ID')) props.setProperty('CV_FOLDER_ID',DriveApp.createFolder(BRAND_.brand+' · '+BRAND_.product+' · CV privados').getId());
    props.setProperty('INITIALIZED','1');
    audit_(OWNER_,'inicializar','Sistema','v2',{}, {esquema:2});
    return 'Proyecto inicializado. CV privados; superadmin: '+OWNER_;
  });
}

function api(action, data, token) {
  try {
    if (PropertiesService.getScriptProperties().getProperty('INITIALIZED') !== '1') throw new Error('El portal está en preparación. Intenta más tarde.');
    credentialSchema_();
    managementSchema_();
    data = data || {};
    if (action === 'vacantes') return ok_(publicJobs_());
    if (action === 'solicitarCodigo') return ok_(requestCode_(data));
    if (action === 'verificarCodigo') return ok_(verifyCode_(data));
    if (action === 'iniciarSesion') return ok_(passwordLogin_(data));
    if (action === 'postular') return ok_(locked_(function(){return apply_(data);}));
    if (action === 'requisicion') return ok_(locked_(function(){return createReq_(data);}));
    const user = authenticate_(token);
    if (action === 'salir') { removeSession_(token); return ok_({}); }
    if (action === 'miSesion') return ok_({perfil:profile_(user)});
    if (action === 'cambiarPassword') return ok_(locked_(function(){return changePassword_(authenticate_(token),data);}));
    if (profile_(user).cambiarPassword) throw new Error('Cambia tu contraseña para continuar.');
    if(action==='gestion')return ok_(managementPage_(data,user));
    if(action==='panelResumen')return ok_({perfil:profile_(user),resumen:managementSummary_(),candidatos:[],requisiciones:[]});
    if (['psicoPanel','psicoInvitar','psicoPDF'].indexOf(action)>=0) {
      if (['reclutador','admin','superadmin'].indexOf(user.rol)<0) throw new Error('Acceso no autorizado.');
      if(action==='psicoPanel') return ok_({candidatos:psicoList_()});
      if(action==='psicoInvitar') return ok_(locked_(function(){return psicoInvite_(data,authenticate_(token));}));
      const report=psicoPdf_(required_(data.id,'folio',100));
      audit_(user.correo,'consultar_reporte','Psicométricos',data.id,{},{});return ok_(report);
    }
    if (action === 'enlaceChecklist') {
      if (['admin','superadmin'].indexOf(user.rol)<0) throw new Error('Solo los administradores pueden compartir el checklist.');
      audit_(user.correo,'obtener_enlace_checklist','Sistema','checklist',{},{});
      return ok_({url:'https://worketers.github.io/Recruitment/cliente.html'});
    }
    if (action === 'panel') return ok_({perfil:profile_(user),requisiciones:rows_('Requisiciones'),candidatos:rows_('Candidatos')});
    if (action === 'perfil') return ok_(locked_(function(){
      const name = required_(data.nombre,'Nombre',100);
      const fresh = authenticate_(token);
      patch_('Usuarios','correo',fresh.correo,{nombre:name,actualizadoEn:now_(),version:Number(fresh.version)+1});
      audit_(fresh.correo,'actualizar_perfil','Usuarios',fresh.correo,{nombre:fresh.nombre},{nombre:name});
      return profile_(Object.assign({},fresh,{nombre:name}));
    }));
    if (action === 'actualizarCandidato') return ok_(locked_(function(){return updateCandidate_(authenticate_(token),data);}));
    if (action === 'actualizarRequisicion') return ok_(locked_(function(){return updateReq_(authenticate_(token),data);}));
    if (action === 'descargarCV') return ok_(readCv_(user,data));
    if (user.rol !== 'superadmin') throw new Error('Acceso reservado al superadmin.');
    if (action === 'usuarios') return ok_(rows_('Usuarios').map(profile_));
    if (action === 'guardarUsuario') return ok_(locked_(function(){return saveUser_(authenticate_(token),data);}));
    if (action === 'bitacora') return ok_(rows_('Bitacora').slice(-500).reverse());
    throw new Error('Acción desconocida.');
  } catch (err) { return {success:false,error:err.message || 'No se pudo completar la operación.'}; }
}
function ok_(data) { return {success:true,data:data}; }
function now_(){return new Date().toISOString();}
function locked_(fn){const l=LockService.getScriptLock(); l.waitLock(30000); try{return fn();}finally{l.releaseLock();}}
function sheet_(name){const s=SpreadsheetApp.openById(DB_ID_).getSheetByName(name);if(!s)throw new Error('Falta inicializar la base.');return s;}
function rows_(name){const s=sheet_(name);if(s.getLastRow()<2)return [];return s.getRange(2,1,s.getLastRow()-1,SCHEMA_[name].length).getValues().filter(function(r){return r[0]!=='';}).map(function(r){const o={};SCHEMA_[name].forEach(function(h,i){o[h]=r[i] instanceof Date?r[i].toISOString():r[i];});return o;});}
function cell_(v){if(v===undefined||v===null)return '';return typeof v==='string'&&/^[=+@\-\t\r]/.test(v)?"'"+v:v;}
function append_(name,obj){sheet_(name).appendRow(SCHEMA_[name].map(function(k){return cell_(obj[k]);}));}
function patch_(name,key,id,changes){const s=sheet_(name),all=rows_(name),i=all.findIndex(function(r){return r[key]===id;});if(i<0)throw new Error('Registro no encontrado.');const obj=Object.assign({},all[i],changes);s.getRange(i+2,1,1,SCHEMA_[name].length).setValues([SCHEMA_[name].map(function(k){return cell_(obj[k]);})]);return obj;}
function required_(v,label,max){v=String(v||'').trim();if(!v||v.length>(max||200))throw new Error('Revisa '+label+'.');return v;}
function email_(v){v=required_(v,'correo',180).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw new Error('Correo no válido.');return v;}
function text_(v,max){v=String(v||'').trim();if(v.length>(max||5000))throw new Error('Texto demasiado largo.');return v;}
function active_(u){return u && (u.activo===true||u.activo==='TRUE');}
function profile_(u){return {correo:u.correo,nombre:u.nombre,rol:u.rol,activo:active_(u),version:u.version,usuario:u.usuario||u.correo,cambiarPassword:u.cambiarPassword===true||u.cambiarPassword==='TRUE'||!u.passwordHash||u._passwordOnly===true};}
function hash_(v){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,v));}
function random_(){return Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');}
function audit_(actor,action,entity,id,before,after){append_('Bitacora',{id:Utilities.getUuid(),fecha:now_(),actor:actor,accion:action,entidad:entity,registroId:id,antes:JSON.stringify(before),despues:JSON.stringify(after)});}
function requestCode_(d){
  const email=email_(d.correo), cache=CacheService.getScriptCache(), key=hash_(email);
  return locked_(function(){
    if(cache.get('cool:'+key))throw new Error('Espera un minuto antes de pedir otro código.');
    cache.put('cool:'+key,'1',60);
    const user=rows_('Usuarios').find(function(u){return email===OWNER_&&u.correo===email&&active_(u);});
    if(user){
      const total=Number(cache.get('mail-count')||0);
      if(total>=80)throw new Error('Se alcanzó el límite temporal de códigos. Intenta más tarde.');
      const secret=random_();
      const code=String(parseInt(secret.slice(0,10),16)%1000000).padStart(6,'0');
      cache.put('otp:'+key,JSON.stringify({hash:hash_(email+':'+code),attempts:0,expires:Date.now()+600000}),600);
      cache.put('mail-count',String(total+1),3600);
      MailApp.sendEmail(email,'Tu código de acceso · '+BRAND_.brand+' '+BRAND_.product,'Tu código es '+code+'. Caduca en 10 minutos. No lo compartas. Si no lo solicitaste, ignora este correo.');
    }
    return {message:'Si tienes acceso activo, recibirás un código válido por 10 minutos.'};
  });
}
function verifyCode_(d){return locked_(function(){
  const email=email_(d.correo),code=required_(d.codigo,'código',6),cache=CacheService.getScriptCache(),key='otp:'+hash_(email),raw=cache.get(key);
  if(!raw)throw new Error('Código inválido o vencido. Solicita uno nuevo.');
  const record=JSON.parse(raw);if(Date.now()>record.expires){cache.remove(key);throw new Error('Código vencido.');}record.attempts++;
  if(record.attempts>5){cache.remove(key);throw new Error('Demasiados intentos. Solicita un código nuevo.');}
  cache.put(key,JSON.stringify(record),600);
  if(record.hash!==hash_(email+':'+code))throw new Error('Código inválido o vencido.');
  const user=rows_('Usuarios').find(function(u){return email===OWNER_&&u.correo===email&&active_(u);});if(!user)throw new Error('Código inválido o vencido.');
  cache.remove(key);
  const token=random_();
  // Evitar crecimiento indefinido de sesiones vencidas.
  const s=sheet_('Sesiones'),sessions=rows_('Sesiones');
  for(let i=sessions.length-1;i>=0;i--)if(Date.parse(sessions[i].expiraEn)<Date.now())s.deleteRow(i+2);
  append_('Sesiones',{hash:hash_(token),correo:email,expiraEn:new Date(Date.now()+8*3600000).toISOString(),creadaEn:now_(),soloPassword:true});
  audit_(email,'iniciar_sesion','Usuarios',email,{},{});
  return {token:token,perfil:profile_(Object.assign({},user,{_passwordOnly:true}))};
});}
function authenticate_(token){if(typeof token!=='string'||token.length!==64)throw new Error('Inicia sesión para continuar.');const s=rows_('Sesiones').find(function(r){return r.hash===hash_(token)&&Date.parse(r.expiraEn)>Date.now();});if(!s)throw new Error('La sesión venció. Inicia sesión.');const u=rows_('Usuarios').find(function(r){return r.correo===s.correo&&active_(r);});if(!u)throw new Error('Acceso suspendido.');return Object.assign({},u,{_passwordOnly:s.soloPassword===true||s.soloPassword==='TRUE'});}
function removeSession_(token){locked_(function(){const rows=rows_('Sesiones'),i=rows.findIndex(function(s){return s.hash===hash_(token);});if(i>=0)sheet_('Sesiones').deleteRow(i+2);});}
function publicJobs_(){return rows_('Requisiciones').filter(function(r){return recordActive_(r)&&r.estatus==='Activa';}).map(function(r){return {idRequisicion:r.idRequisicion,nombrePosicion:r.nombrePosicion,ubicacion:r.ubicacion,objetivoPuesto:r.objetivoPuesto,experienciaRequerida:r.experienciaRequerida,requisitosIndispensables:r.requisitosIndispensables};});}
function submission_(d,type){const id=required_(d.solicitudId,'identificador de envío',80);if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))throw new Error('Identificador inválido.');const old=rows_('Solicitudes').find(function(r){return r.solicitudId===id;});if(old&&old.tipo!==type)throw new Error('Identificador ya utilizado.');return old;}
function createReq_(d){
  const previous=submission_(d,'requisicion');if(previous)return {id:previous.registroId};
  if(d.website)throw new Error('Solicitud inválida.');
  const recordId='REQ-'+d.solicitudId;
  if(rows_('Requisiciones').some(function(r){return r.idRequisicion===recordId;}))return {id:recordId};
  limitPublic_();
  const obj={idRequisicion:recordId,fecha:now_(),estatus:'Pausada',actualizadoEn:now_(),actualizadoPor:'cliente',version:1};
  REQ_FIELDS_.forEach(function(k){obj[k]=text_(d[k]);});
  ['nombreSolicitante','empresaCliente','nombrePosicion'].forEach(function(k){obj[k]=required_(d[k],k,200);});
  obj.emailContacto=email_(d.emailContacto);
  obj.numeroVacantes=Number(d.numeroVacantes||1);if(!Number.isInteger(obj.numeroVacantes)||obj.numeroVacantes<1||obj.numeroVacantes>1000)throw new Error('Número de vacantes inválido.');
  append_('Requisiciones',obj);append_('Solicitudes',{solicitudId:d.solicitudId,tipo:'requisicion',registroId:obj.idRequisicion,fecha:now_()});
  audit_('cliente','crear','Requisiciones',obj.idRequisicion,{}, {estatus:obj.estatus});
  return {id:obj.idRequisicion,message:'Solicitud recibida. El equipo revisará y publicará la vacante.'};
}
function apply_(d){
  const previous=submission_(d,'candidato');if(previous)return {id:previous.registroId};
  if(d.website)throw new Error('Solicitud inválida.');
  if(d.consentimiento!==true)throw new Error('Autoriza el uso de tu información para este proceso.');
  const recordId='CAND-'+d.solicitudId;
  if(rows_('Candidatos').some(function(r){return r.idPostulacion===recordId;}))return {id:recordId};
  limitPublic_();
  const obj={idPostulacion:recordId,idRequisicion:text_(d.idRequisicion,80)||'ESPONTANEO',fecha:now_(),nombreCandidato:required_(d.nombreCandidato,'nombre',180),telefono:required_(d.telefono,'teléfono',30),correo:email_(d.correo),puestoDeseado:required_(d.puestoDeseado,'puesto',180),nivelEstudios:required_(d.nivelEstudios,'estudios',100),estatusProceso:'Pendiente',notasReclutador:'',consentimientoEn:now_(),actualizadoEn:now_(),actualizadoPor:'candidato',version:1,solicitudId:d.solicitudId};
  if(!/^[+\d\s().-]{7,30}$/.test(obj.telefono))throw new Error('Teléfono inválido.');
  if(obj.idRequisicion!=='ESPONTANEO'&&!publicJobs_().some(function(j){return j.idRequisicion===obj.idRequisicion;}))throw new Error('Esta vacante ya no está disponible.');
  let file=null;
  if(d.cv){
    const name=required_(d.cv.nombre,'nombre de archivo',180),ext=name.split('.').pop().toLowerCase();
    const mimes={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
    if(!mimes[ext])throw new Error('Solo se permite PDF, DOC o DOCX.');
    const encoded=required_(d.cv.base64,'archivo',7000000);if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new Error('Archivo inválido.');
    const bytes=Utilities.base64Decode(encoded);if(!bytes.length||bytes.length>5*1024*1024)throw new Error('El CV debe pesar hasta 5 MB.');
    const b=bytes.slice(0,8).map(function(v){return v&255;});
    if(ext==='pdf'&&!(b[0]===37&&b[1]===80&&b[2]===68&&b[3]===70))throw new Error('El contenido no corresponde a PDF.');
    if(ext==='docx'&&!(b[0]===80&&b[1]===75))throw new Error('El contenido no corresponde a DOCX.');
    if(ext==='doc'&&!(b[0]===208&&b[1]===207&&b[2]===17&&b[3]===224))throw new Error('El contenido no corresponde a DOC.');
    file=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('CV_FOLDER_ID')).createFile(Utilities.newBlob(bytes,mimes[ext],obj.idPostulacion+'.'+ext));
    obj.cvFileId=file.getId();obj.linkCV=file.getUrl();
  }
  try{append_('Candidatos',obj);}catch(e){if(file)file.setTrashed(true);throw e;}
  append_('Solicitudes',{solicitudId:d.solicitudId,tipo:'candidato',registroId:obj.idPostulacion,fecha:now_()});
  audit_('candidato','postular','Candidatos',obj.idPostulacion,{}, {idRequisicion:obj.idRequisicion,cv:!!file});
  return {id:obj.idPostulacion,message:'Tu perfil quedó registrado.'};
}
function version_(old,d){if(Number(old.version)!==Number(d.version))throw new Error('Otra persona modificó este registro. Actualiza el panel antes de guardar.');}
function updateCandidate_(u,d){
  const old=rows_('Candidatos').find(function(r){return r.idPostulacion===d.id;});if(!old)throw new Error('Candidato no encontrado.');version_(old,d);
  if(CAND_STATES_.indexOf(d.estatusProceso)<0)throw new Error('Estatus inválido.');
  const changes={estatusProceso:d.estatusProceso,notasReclutador:text_(d.notasReclutador,10000),actualizadoEn:now_(),actualizadoPor:u.correo,version:Number(old.version)+1};
  if(d.activo!==undefined&&typeof d.activo!=='boolean')throw Error('Actividad inválida.');changes.activo=d.activo===undefined?recordActive_(old):d.activo;
  patch_('Candidatos','idPostulacion',d.id,changes);audit_(u.correo,recordActive_(old)!==changes.activo?(changes.activo?'reactivar':'inactivar'):'actualizar','Candidatos',d.id,{activo:recordActive_(old),estatusProceso:old.estatusProceso,notasReclutador:old.notasReclutador},changes);return {};
}
function updateReq_(u,d){const old=rows_('Requisiciones').find(function(r){return r.idRequisicion===d.id;});if(!old)throw new Error('Requisición no encontrada.');version_(old,d);if(REQ_STATES_.indexOf(d.estatus)<0)throw new Error('Estatus inválido.');if(d.activo!==undefined&&typeof d.activo!=='boolean')throw Error('Actividad inválida.');const changes={estatus:d.estatus,activo:d.activo===undefined?recordActive_(old):d.activo,actualizadoEn:now_(),actualizadoPor:u.correo,version:Number(old.version)+1};patch_('Requisiciones','idRequisicion',d.id,changes);audit_(u.correo,recordActive_(old)!==changes.activo?(changes.activo?'reactivar':'inactivar'):'actualizar','Requisiciones',d.id,{estatus:old.estatus,activo:recordActive_(old)},changes);return {};}
function saveUser_(u,d){
  if(u.rol!=='superadmin')throw new Error('Solo superadmin.');
  const email=email_(d.correo),old=rows_('Usuarios').find(function(r){return r.correo===email;});
  if(email===OWNER_&&(d.rol!=='superadmin'||d.activo!==true))throw new Error('No puedes suspender ni degradar al propietario.');
  if(['superadmin','admin','reclutador'].indexOf(d.rol)<0||typeof d.activo!=='boolean')throw new Error('Perfil inválido.');
  if(old)version_(old,d);
  const changes={correo:email,nombre:required_(d.nombre,'nombre',100),rol:d.rol,activo:d.activo,actualizadoEn:now_(),version:old?Number(old.version)+1:1};
  changes.usuario=username_(d.usuario||(old&&old.usuario)||email);
  if(rows_('Usuarios').some(function(r){return r.correo!==email&&(r.usuario===changes.usuario||r.correo===changes.usuario||r.usuario===email);}))throw new Error('Ese usuario ya está ocupado.');
  if(!old&&!d.password)throw new Error('Define una contraseña inicial para el integrante.');
  if(d.password){changes.passwordHash=passwordHash_(d.password);changes.cambiarPassword=true;}
  if(old)patch_('Usuarios','correo',email,changes);else append_('Usuarios',Object.assign({creadoEn:now_()},changes));
  // Revocar sesiones en cada cambio de permisos, incluida la reactivación.
  const sessions=rows_('Sesiones');for(let i=sessions.length-1;i>=0;i--)if(sessions[i].correo===email)sheet_('Sesiones').deleteRow(i+2);
  audit_(u.correo,old?'editar_acceso':'crear_acceso','Usuarios',email,old?profile_(old):{},profile_(changes));return {};
}
function readCv_(u,d){const c=rows_('Candidatos').find(function(r){return r.idPostulacion===d.id;});if(!c||!c.cvFileId)throw new Error('No hay CV adjunto.');const f=DriveApp.getFileById(c.cvFileId),blob=f.getBlob();audit_(u.correo,'consultar_cv','Candidatos',d.id,{},{});return {nombre:f.getName(),mime:blob.getContentType(),base64:Utilities.base64Encode(blob.getBytes())};}
function limitPublic_(){const c=CacheService.getScriptCache(),key='public:'+Math.floor(Date.now()/60000),n=Number(c.get(key)||0);if(n>=20)throw new Error('Hay muchos registros en este momento. Espera un minuto y reintenta.');c.put(key,String(n+1),120);}

function credentialSchema_(){
  const props=PropertiesService.getScriptProperties();if(props.getProperty('CREDENTIAL_SCHEMA_3')==='1')return;
  locked_(function(){
    ['Usuarios','Sesiones'].forEach(function(name){
      const s=sheet_(name),old=s.getRange(1,1,1,s.getLastColumn()).getValues()[0],headers=SCHEMA_[name];
      if(old.some(function(h,i){return h!==headers[i];}))throw new Error('Encabezados incompatibles en '+name+'.');
      if(old.length<headers.length)s.getRange(1,old.length+1,1,headers.length-old.length).setValues([headers.slice(old.length)]);
    });
    // Los perfiles existentes conservan su correo como usuario inicial.
    rows_('Usuarios').forEach(function(u){if(!u.usuario)patch_('Usuarios','correo',u.correo,{usuario:u.correo,cambiarPassword:!u.passwordHash});});
    props.setProperty('CREDENTIAL_SCHEMA_3','1');
  });
}
function username_(value){const s=required_(value,'usuario',180).toLowerCase();if(!/^[a-z0-9][a-z0-9._@+-]{2,179}$/.test(s))throw new Error('El usuario debe tener al menos 3 caracteres, sin espacios.');return s;}
function password_(value){if(typeof value!=='string'||value.length<12||value.length>64||bcrypt.truncates(value))throw new Error('Usa una contraseña de 12 a 64 caracteres y hasta 72 bytes.');return value;}
function passwordHash_(value){const p=password_(value),bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,random_()).slice(0,16).map(function(b){return b&255;});return bcrypt.hashSync(p,'$2b$12$'+bcrypt.encodeBase64(bytes,16));}
function newSession_(user){const records=rows_('Sesiones');for(let i=records.length-1;i>=0;i--)if(Date.parse(records[i].expiraEn)<Date.now())sheet_('Sesiones').deleteRow(i+2);const token=random_();append_('Sesiones',{hash:hash_(token),correo:user.correo,expiraEn:new Date(Date.now()+8*3600000).toISOString(),creadaEn:now_(),soloPassword:false});return {token:token,perfil:profile_(user)};}
function revokeSessions_(email){const sessions=rows_('Sesiones');for(let i=sessions.length-1;i>=0;i--)if(sessions[i].correo===email)sheet_('Sesiones').deleteRow(i+2);}
function passwordLogin_(d){return locked_(function(){
  const name=username_(d.usuario),password=typeof d.password==='string'&&d.password.length<=64?d.password:'',cache=CacheService.getScriptCache();
  const user=rows_('Usuarios').find(function(u){return (u.usuario||u.correo)===name||u.correo===name;}),key='login:'+hash_(user?user.correo:name);
  const bucket='login-global:'+Math.floor(Date.now()/60000),total=Number(cache.get(bucket)||0);if(total>=60)throw new Error('Demasiados intentos. Intenta en unos minutos.');cache.put(bucket,String(total+1),120);
  let tries=JSON.parse(cache.get(key)||'{"n":0,"until":0}');if(Date.now()>tries.until)tries={n:0,until:Date.now()+900000};
  if(tries.n>=5)throw new Error('Demasiados intentos. Espera 15 minutos.');
  tries.n++;cache.put(key,JSON.stringify(tries),900);
  const dummy='$2b$12$abcdefghijklmnopqrstuu3E7QGy25KjUvVEmML5fYE3Rfw9GUyJu';
  const matches=bcrypt.compareSync(password,user&&user.passwordHash?user.passwordHash:dummy);
  if(!matches||!active_(user)||!user.passwordHash)throw new Error('Usuario o contraseña incorrectos.');
  cache.remove(key);
  const result=newSession_(user);audit_(user.correo,'iniciar_sesion','Usuarios',user.correo,{}, {metodo:'password'});return result;
});}
function changePassword_(u,d){
  if(!profile_(u).cambiarPassword&&(!u.passwordHash||!bcrypt.compareSync(String(d.actual||''),u.passwordHash)))throw new Error('La contraseña actual no es correcta.');
  const next=password_(d.password);if(u.passwordHash&&bcrypt.compareSync(next,u.passwordHash))throw new Error('Elige una contraseña diferente.');
  const changes={passwordHash:passwordHash_(next),cambiarPassword:false,actualizadoEn:now_(),version:Number(u.version)+1};
  const updated=patch_('Usuarios','correo',u.correo,changes);revokeSessions_(u.correo);
  audit_(u.correo,'cambiar_password','Usuarios',u.correo,{}, {passwordActualizada:true});return newSession_(updated);
}
