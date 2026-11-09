/* Gestión sin borrado: columnas nuevas al final; registros antiguos activos por defecto. */
function recordActive_(r){return r.activo!==false&&String(r.activo).toUpperCase()!=='FALSE';}
function managementSchema_(){
 const props=PropertiesService.getScriptProperties();if(props.getProperty('MANAGEMENT_SCHEMA_1')==='1')return;
 locked_(function(){
  ['Candidatos','Requisiciones'].forEach(function(name){
   const s=sheet_(name),old=s.getRange(1,1,1,s.getLastColumn()).getValues()[0],headers=SCHEMA_[name];
   if(old.some(function(h,i){return h!==headers[i];}))throw Error('Encabezados incompatibles en '+name+'. No se modificaron los registros.');
   if(old.length<headers.length)s.getRange(1,old.length+1,1,headers.length-old.length).setValues([headers.slice(old.length)]);
  });props.setProperty('MANAGEMENT_SCHEMA_1','1');
 });
}
function normalizeSearch_(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function managementSummary_(){
 const c=rows_('Candidatos'),r=rows_('Requisiciones');
 return {candidatos:c.filter(recordActive_).length,inactivos:c.filter(x=>!recordActive_(x)).length,vacantes:r.filter(x=>recordActive_(x)&&x.estatus==='Activa').length,pendientes:c.filter(x=>recordActive_(x)&&x.estatusProceso==='Pendiente').length};
}
function managementPage_(d,u){
 const type=d.entidad;if(['candidatos','requisiciones','usuarios','bitacora','psicometricos'].indexOf(type)<0)throw Error('Vista inválida.');
 if(['reclutador','admin','superadmin'].indexOf(u.rol)<0)throw Error('Acceso no autorizado.');
 if(['usuarios','bitacora'].indexOf(type)>=0&&u.rol!=='superadmin')throw Error('Acceso reservado al superadmin.');
 const page=d.pagina==null?1:Number(d.pagina),size=d.limite==null?25:Number(d.limite);
 if(!Number.isInteger(page)||page<1||!Number.isInteger(size)||[10,25,50,100].indexOf(size)<0)throw Error('Página inválida.');
 const query=normalizeSearch_(text_(d.buscar,200)),activity=d.actividad||'activos',status=text_(d.estatus,60),role=text_(d.rol,30),entity=text_(d.tipoEntidad,80);
 if(['activos','inactivos','todos'].indexOf(activity)<0)throw Error('Filtro de actividad inválido.');
 const order=d.orden||'fecha_desc';if(['fecha_desc','fecha_asc','nombre_asc','nombre_desc','actualizado_desc'].indexOf(order)<0)throw Error('Orden inválido.');
 function boundary(value){if(!value)return '';value=String(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Fecha inválida.');return value;}
 const from=boundary(d.desde),to=boundary(d.hasta);if(from&&to&&from>to)throw Error('La fecha inicial debe ser anterior a la final.');
 let all,fields,key,name,dateKey,summary=null;
 if(type==='candidatos'){
  const reqs={};rows_('Requisiciones').forEach(r=>reqs[r.idRequisicion]=r.nombrePosicion);
  all=rows_('Candidatos').map(c=>Object.assign({},c,{activo:recordActive_(c),nombreRequisicion:reqs[c.idRequisicion]||'Registro general'}));
  fields=['nombreCandidato','correo','telefono','puestoDeseado','idPostulacion','idRequisicion','nombreRequisicion','notasReclutador'];key='idPostulacion';name='nombreCandidato';dateKey='fecha';
 }else if(type==='requisiciones'){
  all=rows_('Requisiciones').map(r=>Object.assign({},r,{activo:recordActive_(r)}));fields=['nombrePosicion','empresaCliente','ubicacion','nombreSolicitante','emailContacto','idRequisicion'];key='idRequisicion';name='nombrePosicion';dateKey='fecha';
 }else if(type==='usuarios'){
  all=rows_('Usuarios').map(r=>Object.assign(profile_(r),{creadoEn:r.creadoEn,actualizadoEn:r.actualizadoEn}));fields=['nombre','correo','usuario','rol'];key='correo';name='nombre';dateKey='creadoEn';
 }else if(type==='bitacora'){
  all=rows_('Bitacora');fields=['actor','accion','entidad','registroId','antes','despues'];key='id';name='actor';dateKey='fecha';
 }else{
  all=psicoList_();fields=['nombre','correo','id','tipo'];key='id';name='nombre';dateKey='creadaEn';
  const done=all.filter(c=>c.status==='Completado').length,expired=all.filter(c=>c.vigencia==='Vencida').length;
  summary={total:all.length,completadas:done,vencidas:expired,pendientes:all.length-done-expired};
 }
 const canArchive=['candidatos','requisiciones','usuarios'].indexOf(type)>=0;
 const matches=all.filter(function(r){
  if(canArchive&&activity!=='todos'&&(r.activo!==(activity==='activos')))return false;
  if(status&&(type==='candidatos'?r.estatusProceso:type==='requisiciones'?r.estatus:type==='psicometricos'?r.vigencia:r.accion)!==status)return false;
  if(role&&r.rol!==role)return false;if(entity&&r.entidad!==entity)return false;
  const value=r[dateKey],day=value&&Number.isFinite(Date.parse(value))?Utilities.formatDate(new Date(value),'America/Mexico_City','yyyy-MM-dd'):'';
  if(from&&day<from||to&&(!day||day>to))return false;
  return !query||fields.some(k=>normalizeSearch_(r[k]).indexOf(query)>=0);
 });
 matches.sort(function(a,b){
  let result;if(order.indexOf('nombre_')===0)result=normalizeSearch_(a[name]).localeCompare(normalizeSearch_(b[name]));
  else result=String(a[order==='actualizado_desc'?'actualizadoEn':dateKey]||'').localeCompare(String(b[order==='actualizado_desc'?'actualizadoEn':dateKey]||''));
  if(order==='fecha_desc'||order==='actualizado_desc'||order==='nombre_desc')result=-result;
  return result||String(a[key]).localeCompare(String(b[key]));
 });
 const pages=Math.max(1,Math.ceil(matches.length/size)),current=Math.min(page,pages);
 return {registros:matches.slice((current-1)*size,current*size),total:matches.length,pagina:current,paginas:pages,limite:size,resumen:summary};
}
