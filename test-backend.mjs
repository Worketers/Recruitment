import {readFileSync} from 'node:fs';
import './test-psico.mjs';
import './test-management-ui.mjs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sheets=new Map(),props=new Map([['SPREADSHEET_ID','test-sheet'],['OWNER_EMAIL','owner@example.com']]),cache=new Map(),files=new Map(),mails=[];
class Sheet {
 constructor(){this.rows=[];}
 getLastRow(){return this.rows.length;}
 getLastColumn(){return this.rows[0]?.length||0;}
 getRange(row,col,n=1,m=1){const self=this;return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>self.rows[row-1+i]?.[col-1+j]??'')),setValues(values){values.forEach((r,i)=>{self.rows[row-1+i]??=[];r.forEach((v,j)=>self.rows[row-1+i][col-1+j]=typeof v === "string" && v.startsWith("'") ? v.slice(1) : v);});return this;},setFontWeight(){return this;},setBackground(){return this;}};}
 appendRow(r){this.rows.push(r.map(v=>typeof v === "string" && v.startsWith("'") ? v.slice(1) : v));}
 deleteRow(r){this.rows.splice(r-1,1);}
 setFrozenRows(){}
}
const db={getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=new Sheet();sheets.set(n,s);return s;}};
const ctx={console,Date,JSON,Math,Number,String,Object,Array,Error,Map,Utilities:{getUuid:()=>crypto.randomUUID(),computeDigest:(a,v)=>Array.from(crypto.createHash('sha256').update(v).digest()),DigestAlgorithm:{SHA_256:'sha256'},base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),base64Decode:v=>Array.from(Buffer.from(v,'base64')),base64Encode:v=>Buffer.from(v).toString('base64'),newBlob:(bytes,mime,name)=>({getBytes:()=>bytes,getContentType:()=>mime,name})},SpreadsheetApp:{openById:()=>db},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},Session:{getEffectiveUser:()=>({getEmail:()=> 'owner@example.com'})},MailApp:{sendEmail:(...args)=>mails.push(args)},DriveApp:{createFolder:()=>({getId:()=> 'folder'}),getFolderById:()=>({createFile:blob=>{const id=crypto.randomUUID(),f={getId:()=>id,getUrl:()=>`https://drive.google.com/file/d/${id}`,getName:()=>blob.name,getBlob:()=>blob,setTrashed(){files.delete(id);}};files.set(id,f);return f;}}),getFileById:id=>files.get(id)},ContentService:{createTextOutput:v=>({setMimeType(){return v;}}),MimeType:{JSON:'json'}}};
vm.createContext(ctx);vm.runInContext(readFileSync('Brand.js','utf8'),ctx);vm.runInContext(readFileSync('Bcrypt.js','utf8'),ctx);vm.runInContext(readFileSync('Backend.js','utf8'),ctx);vm.runInContext(readFileSync('Lifecycle.js','utf8'),ctx);
const call=(action,data={},token)=>ctx.api(action,data,token);
const success=(action,data={},token)=>{const r=call(action,data,token);assert.equal(r.success,true,r.error);return r.data;};
ctx.inicializarProyecto_();ctx.inicializarProyecto_();assert.equal(sheets.size,6);assert.equal(ctx.rows_('Usuarios').length,1);
sheets.get('Usuarios').rows=sheets.get('Usuarios').rows.map(r=>r.slice(0,7));sheets.get('Sesiones').rows=sheets.get('Sesiones').rows.map(r=>r.slice(0,4));
assert.equal(call('panel').success,false);assert.equal(sheets.get('Usuarios').rows[0].length,10);assert.equal(sheets.get('Sesiones').rows[0].length,5);assert.equal(ctx.rows_('Usuarios')[0].correo,'owner@example.com');assert.equal(call('usuarios').success,false);assert.equal(call('guardarUsuario',{correo:'evil@example.com'}).success,false);
function login(email){success('solicitarCodigo',{correo:email});const code=mails.at(-1)[2].match(/es (\d{6})/)[1];return success('verificarCodigo',{correo:email,codigo:code}).token;}
const bootstrap=login('owner@example.com');
assert.equal(call('panel',{},bootstrap).success,false);
const owner=success('cambiarPassword',{password:'Owner password 2026!'},bootstrap).token;
assert.equal(call('panel',{},bootstrap).success,false);
assert.equal(call('verificarCodigo',{correo:'owner@example.com',codigo:mails.at(-1)[2].match(/es (\d{6})/)[1]}).success,false);
success('guardarUsuario',{correo:'recruiter@example.com',nombre:'Recruiter',usuario:'recruiter',password:'Temporary password 2026!',rol:'reclutador',activo:true},owner);
const temporary=success('iniciarSesion',{usuario:'recruiter',password:'Temporary password 2026!'});
assert.equal(temporary.perfil.cambiarPassword,true);
ctx.psicoList_=()=>[];ctx.psicoInvite_=()=>({enviado:true});
assert.equal(call('psicoPanel').success,false);assert.equal(call('psicoInvitar',{},temporary.token).success,false);
assert.equal(call('panel',{},temporary.token).success,false);
const recruiter=success('cambiarPassword',{password:'Personal password 2026!'},temporary.token).token;
assert.equal(success('psicoPanel',{},recruiter).candidatos.length,0);assert.equal(success('psicoInvitar',{},recruiter).enviado,true);
assert.equal(call('iniciarSesion',{usuario:'recruiter',password:'Temporary password 2026!'}).success,false);
assert.equal(success('iniciarSesion',{usuario:'recruiter',password:'Personal password 2026!'}).perfil.usuario,'recruiter');
assert.equal(call('usuarios',{},recruiter).success,false);assert.equal(call('bitacora',{},recruiter).success,false);
const req={solicitudId:crypto.randomUUID(),nombreSolicitante:'Persona de prueba',empresaCliente:'Empresa de prueba',emailContacto:'empresa@example.com',nombrePosicion:'Analista',numeroVacantes:2,requisitosIndispensables:'Excel'};
const reqId=success('requisicion',req).id;assert.equal(success('requisicion',req).id,reqId);assert.equal(ctx.rows_('Requisiciones').length,1);assert.equal(success('vacantes').length,0);
success('actualizarRequisicion',{id:reqId,version:1,estatus:'Activa'},recruiter);assert.equal(success('vacantes').length,1);assert.equal('emailContacto' in success('vacantes')[0],false);
const cand={solicitudId:crypto.randomUUID(),nombreCandidato:'Candidato de prueba',telefono:'5555555555',correo:'candidato@example.com',puestoDeseado:'Analista',nivelEstudios:'Universidad',consentimiento:true,idRequisicion:reqId,cv:{nombre:'cv.pdf',base64:Buffer.from('%PDF-1.4 test').toString('base64')}};
const candId=success('postular',cand).id;assert.equal(success('postular',cand).id,candId);assert.equal(files.size,1);assert.equal(ctx.rows_('Candidatos').length,1);
assert.equal(call('postular',{...cand,solicitudId:crypto.randomUUID(),consentimiento:false}).success,false);
assert.equal(call('postular',{...cand,solicitudId:crypto.randomUUID(),cv:{nombre:'cv.pdf',base64:Buffer.from('invalid').toString('base64')}}).success,false);
assert.equal(call('descargarCV',{id:candId}).success,false);assert.equal(success('descargarCV',{id:candId},recruiter).base64,cand.cv.base64);
success('actualizarCandidato',{id:candId,version:1,estatusProceso:'Entrevista',notasReclutador:'Contactar mañana'},recruiter);
assert.equal(call('actualizarCandidato',{id:candId,version:1,estatusProceso:'Descartado'},owner).success,false);
assert.equal(call('actualizarCandidato',{id:candId,version:2,estatusProceso:'Inventado'},owner).success,false);
assert.equal(ctx.rows_('Bitacora').some(l=>l.actor==='recruiter@example.com'&&l.accion==='actualizar'),true);
let user=ctx.rows_('Usuarios').find(u=>u.correo==='recruiter@example.com');
success('guardarUsuario',{...user,activo:false},owner);assert.equal(call('panel',{},recruiter).success,false);
user=ctx.rows_('Usuarios').find(u=>u.correo==='recruiter@example.com');success('guardarUsuario',{...user,activo:true},owner);assert.equal(call('panel',{},recruiter).success,false);
const originalOwner=ctx.rows_('Usuarios').find(u=>u.rol==='superadmin');assert.equal(call('guardarUsuario',{...originalOwner,rol:'reclutador'},owner).success,false);
assert.equal(call('enlaceChecklist',{},recruiter).success,false);
assert.equal(success('enlaceChecklist',{},owner).url,'https://worketers.github.io/Recruitment/cliente.html');
assert.equal(call('guardarUsuario',{correo:'dup@example.com',nombre:'Duplicado',usuario:'recruiter',password:'Another password 2026!',rol:'admin',activo:true},owner).success,false);
assert.equal(call('guardarUsuario',{correo:'weak@example.com',nombre:'Débil',usuario:'weak',password:'123',rol:'admin',activo:true},owner).success,false);
assert.equal(ctx.rows_('Usuarios').every(u=>!JSON.stringify(success('usuarios',{},owner)).includes(u.passwordHash||'not-a-hash')),true);
assert.equal(ctx.rows_('Usuarios').some(u=>u.passwordHash?.startsWith('$2b$12$')),true);
assert.equal(JSON.stringify(ctx.rows_('Bitacora')).includes('Personal password 2026!'),false);
for(let i=0;i<5;i++)assert.equal(call('iniciarSesion',{usuario:'recruiter',password:'wrong'}).success,false);
assert.match(call('iniciarSesion',{usuario:'recruiter',password:'Personal password 2026!'}).error,/15 minutos/);
assert.equal(JSON.parse(ctx.doPost({postData:{contents:JSON.stringify({action:'vacantes'})}})).success,true);
assert.equal(JSON.parse(ctx.doPost({postData:{contents:'bad'}})).success,false);
const app=readFileSync('App.html','utf8');const js=app.match(/<script>([\s\S]*)<\/script>/)[1].replace(/<\?= initialView \?>/g,'inicio');new vm.Script(js);
assert.equal(app.includes('no-cors'),false);assert.equal(app.includes('console.log'),false);
const staticHome=readFileSync('index.html','utf8');assert.equal(staticHome.includes('window.location.replace'),false);assert.equal(staticHome.includes('Soy empresa'),false);assert.equal(staticHome.includes('Solicitar personal'),false);assert.equal(staticHome.includes("fetch(API_URL"),true);assert.equal(staticHome.includes('<?='),false);assert.equal(app.includes('id="checklistLink"'),true);
console.log('PASS: migración sin pérdida, bcrypt, login, roles, cambio obligatorio, contraseñas débiles, duplicados, bloqueo de intentos, revocación, recuperación del propietario, POST, privacidad, CV, idempotencia, concurrencia y pantallas sin redirección.');

// Gestión: migración de una hoja existente, archivo reversible e historial completo.
ctx.Utilities.formatDate=(d,zone,format)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const managed=(entity,opts={},session=owner)=>success('gestion',{entidad:entity,...opts},session);
for(const name of ['Candidatos','Requisiciones'])sheets.get(name).rows.forEach(r=>r.pop());
props.delete('MANAGEMENT_SCHEMA_1');
const oldCv=ctx.rows_('Candidatos')[0].cvFileId;
assert.equal(managed('candidatos').registros[0].activo,true);
assert.equal(ctx.rows_('Candidatos')[0].cvFileId,oldCv);
assert.equal(sheets.get('Candidatos').rows[0].at(-1),'activo');
assert.equal(managed('requisiciones').registros[0].activo,true);
let original=ctx.rows_('Candidatos').find(c=>c.idPostulacion===candId);
success('actualizarCandidato',{id:candId,version:original.version,estatusProceso:original.estatusProceso,notasReclutador:original.notasReclutador,activo:false},owner);
assert.equal(managed('candidatos').total,0);assert.equal(managed('candidatos',{actividad:'inactivos'}).total,1);
assert.equal(success('descargarCV',{id:candId},owner).base64.length>0,true);
assert.equal(ctx.rows_('Candidatos').length,1);assert.equal(files.size,1);
assert.equal(call('actualizarCandidato',{id:candId,version:original.version,estatusProceso:'Pendiente',activo:true},owner).success,false);
original=ctx.rows_('Candidatos')[0];
assert.equal(call('actualizarCandidato',{id:candId,version:original.version,estatusProceso:'Pendiente',activo:'false'},owner).success,false);
success('actualizarCandidato',{id:candId,version:original.version,estatusProceso:'Entrevista',notasReclutador:'Conservar notas'},owner);
assert.equal(managed('candidatos').total,0,'Un cliente anterior no debe reactivar sin pedirlo');
original=ctx.rows_('Candidatos')[0];
success('actualizarCandidato',{id:candId,version:original.version,estatusProceso:'Entrevista',notasReclutador:original.notasReclutador,activo:true},owner);
let requisition=ctx.rows_('Requisiciones')[0];
success('actualizarRequisicion',{id:reqId,version:requisition.version,estatus:'Activa',activo:false},owner);
assert.equal(success('vacantes').length,0);assert.equal(managed('requisiciones',{actividad:'inactivos'}).total,1);
assert.equal(call('postular',{...cand,solicitudId:crypto.randomUUID()},owner).success,false);
requisition=ctx.rows_('Requisiciones')[0];
success('actualizarRequisicion',{id:reqId,version:requisition.version,estatus:'Activa',activo:true},owner);assert.equal(success('vacantes').length,1);
assert.equal(ctx.rows_('Bitacora').some(l=>l.accion==='inactivar'&&l.registroId===candId&&JSON.parse(l.antes).activo===true&&JSON.parse(l.despues).activo===false),true);
assert.equal(ctx.rows_('Bitacora').some(l=>l.accion==='reactivar'&&l.registroId===candId),true);
for(let i=0;i<67;i++)ctx.append_('Candidatos',{idPostulacion:'PAGE-'+String(i).padStart(3,'0'),nombreCandidato:'Ángela página '+i,correo:'page'+i+'@example.com',fecha:'2026-11-09T04:00:00Z',estatusProceso:i%2?'Entrevista':'Pendiente',activo:i%3!==0,version:1});
const firstPage=managed('candidatos',{buscar:'angela',actividad:'todos',limite:25}),secondPage=managed('candidatos',{buscar:'angela',actividad:'todos',limite:25,pagina:2}),lastPage=managed('candidatos',{buscar:'angela',actividad:'todos',limite:25,pagina:999});
assert.equal(firstPage.total,67);assert.equal(firstPage.registros.length,25);assert.equal(lastPage.pagina,3);assert.equal(lastPage.registros.length,17);
assert.equal(firstPage.registros.some(a=>secondPage.registros.some(b=>a.idPostulacion===b.idPostulacion)),false);
assert.equal(managed('candidatos',{buscar:'angela',actividad:'todos',desde:'2026-11-08',hasta:'2026-11-08'}).total,67,'Fechas en Ciudad de México');
assert.equal(managed('candidatos',{buscar:'angela',actividad:'todos',desde:'2026-11-09'}).total,0);
assert.equal(managed('candidatos',{buscar:'angela',actividad:'inactivos',estatus:'Entrevista'}).registros.every(c=>!c.activo&&c.estatusProceso==='Entrevista'),true);
assert.equal(managed('candidatos',{buscar:'no existe'}).total,0);
for(const opts of [{limite:500},{pagina:0},{orden:'DROP'},{desde:'2026-02-30'},{desde:'2026-11-09',hasta:'2026-11-08'}])assert.equal(call('gestion',{entidad:'candidatos',...opts},owner).success,false);
for(let i=0;i<503;i++)ctx.append_('Bitacora',{id:'HISTORY-'+String(i).padStart(3,'0'),fecha:'2020-01-01T12:00:00Z',actor:'historico',accion:'actualizar',entidad:'Candidatos',registroId:'legacy',antes:'{}',despues:'{}'});
const history=managed('bitacora',{buscar:'historico',limite:10,pagina:51});assert.equal(history.total,503);assert.equal(history.registros.length,3);
assert.equal(JSON.stringify(managed('usuarios',{actividad:'todos'})).includes('passwordHash'),false);
cache.delete('login:'+ctx.hash_('recruiter@example.com'));
assert.equal(call('gestion',{entidad:'bitacora'},success('iniciarSesion',{usuario:'recruiter',password:'Personal password 2026!'}).token).success,false);
assert.equal(call('gestion',{entidad:'Candidatos'}).success,false);
assert.equal(success('panelResumen',{},owner).candidatos.length,0);
ctx.psicoList_=()=>Array.from({length:32},(_,i)=>({id:'PS-'+i,nombre:'Persona '+i,correo:'p'+i+'@example.com',status:i%2?'Completado':'Pendiente',vigencia:i%2?'Completada':'Vencida',creadaEn:'2026-11-01T12:00:00Z'}));
const evalPage=managed('psicometricos',{estatus:'Completada',limite:10,pagina:2});assert.equal(evalPage.total,16);assert.equal(evalPage.registros.length,6);assert.equal(evalPage.resumen.total,32);
assert.match(staticHome,/Way Finder/);assert.match(staticHome,/data:image\/png;base64/);assert.doesNotMatch(staticHome,/últimos 500 eventos/);
console.log('PASS: gestión paginada, filtros combinados, acentos, zona horaria, carreras de versión, archivo reversible, CV intacto, roles, psicométricos y más de 500 eventos conservados.');
