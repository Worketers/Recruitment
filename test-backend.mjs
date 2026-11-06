import {readFileSync} from 'node:fs';
import './test-psico.mjs';
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
vm.createContext(ctx);vm.runInContext(readFileSync('Brand.js','utf8'),ctx);vm.runInContext(readFileSync('Bcrypt.js','utf8'),ctx);vm.runInContext(readFileSync('Backend.js','utf8'),ctx);
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
