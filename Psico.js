/* Administración de psicométricos, autorizada exclusivamente por la sesión de Recruitment. */
function psicoDb_(){const id=PropertiesService.getScriptProperties().getProperty('PSICO_SPREADSHEET_ID');if(!id)throw Error('Psicométricos está en preparación.');return SpreadsheetApp.openById(id);}
function psicoExterno_(id){return /^(KBSPS_|WPS_)/i.test(String(id));}
function psicoEscape_(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function psicoHeaders_(){
 const s=psicoDb_().getSheetByName('Candidatos');if(!s)throw Error('Falta la pestaña Candidatos.');
 const headers=['Creada_En','Expira_En','Invitada_Por','Estado_Correo','Enviado_En','Solicitud_ID','Id_Postulacion'];
 const existing=s.getRange(1,8,1,7).getValues()[0];
 if(existing.some((h,i)=>h!==''&&h!==headers[i]))throw Error('Revisa las columnas de vigencia antes de continuar.');
 s.getRange(1,8,1,7).setValues([headers]);return s;
}
function psicoList_(){
 const rows=psicoDb_().getSheetByName('Candidatos').getDataRange().getValues();
 const extra={};rows.slice(1).forEach(r=>extra[String(r[0]).trim()]=r);
 return psicoCandidates_().map(c=>{const r=extra[c.id]||[],expires=r[8]?new Date(r[8]).toISOString():'';return Object.assign(c,{correo:String(r[2]||''),creadaEn:r[7]?new Date(r[7]).toISOString():'',expiraEn:expires,estadoCorreo:String(r[10]||''),vigencia:c.status==='Completado'?'Completada':!expires?'Sin vigencia':Date.parse(expires)<=Date.now()?'Vencida':'Vigente',idPostulacion:String(r[13]||'')});});
}
function psicoInvite_(d,u){
 const name=required_(d.nombre,'nombre',150),email=email_(d.correo),internal=d.tipo==='Empleado';
 const age=internal?'Empleado':String(d.edad||'');if(!internal&&(!/^\d{2}$/.test(age)||Number(age)<18||Number(age)>99))throw Error('Indica una edad de 18 a 99 años.');
 const request=required_(d.solicitudId,'identificador de envío',80);if(!/^[a-zA-Z0-9-]{16,80}$/.test(request))throw Error('Identificador inválido.');
 let linked='';if(d.idPostulacion){const c=rows_('Candidatos').find(c=>c.idPostulacion===d.idPostulacion);if(!c||c.correo.toLowerCase()!==email)throw Error('El correo no coincide con el candidato.');linked=c.idPostulacion;}
 const s=psicoHeaders_(),rows=s.getDataRange().getValues();let i=rows.findIndex((r,index)=>index>0&&r[12]===request);
 if(i>=0){const r=rows[i];if(r[1]!==name||r[2]!==email||r[9]!==u.correo)throw Error('El identificador de envío ya fue utilizado.');if(r[10]==='Enviado')return {id:r[0],correo:email,expiraEn:new Date(r[8]).toISOString(),enviado:true};if(Date.parse(r[8])<=Date.now())throw Error('Esta invitación venció. Crea una nueva.');}
 if(i<0){const id=(internal?'WPI_':'WPS_')+Utilities.getUuid().replace(/-/g,''),created=new Date(),expires=new Date(created.getTime()+24*3600000),url='https://worketers.github.io/psicometricos/?id='+encodeURIComponent(id);
   s.appendRow([id,cell_(name),cell_(email),age,'Pendiente',url,'',created.toISOString(),expires.toISOString(),u.correo,'Pendiente','',request,linked]);i=s.getLastRow()-1;
 }
 // Un reintento de correo fallido también recibe 24 horas completas desde el envío.
 s.getRange(i+1,9).setValue(new Date(Date.now()+24*3600000).toISOString());
 const r=s.getRange(i+1,1,1,14).getValues()[0],expiresText=Utilities.formatDate(new Date(r[8]),'America/Mexico_City',"dd/MM/yyyy HH:mm");
 const html='<div style="background:#f3f7f7;padding:30px;font-family:Arial,sans-serif;color:#173239"><div style="max-width:580px;background:white;border:1px solid #dbe6e7;border-radius:16px;padding:30px;margin:auto"><h1 style="color:#007a84;margin:0">Worketers.</h1><p style="color:#60747b">Talento · Psicométricos</p><h2>Tu evaluación está lista</h2><p>Hola '+psicoEscape_(name)+',</p><p>El equipo te invita a responder tu evaluación psicométrica. Busca un lugar tranquilo y una conexión estable.</p><p><a style="display:inline-block;background:#007a84;color:white;padding:14px 24px;border-radius:10px;text-decoration:none" href="'+psicoEscape_(r[5])+'">Responder evaluación →</a></p><p><b>Vigencia: 24 horas.</b><br>Debes completar y enviar tu evaluación antes del <b>'+expiresText+'</b> (hora de Ciudad de México).</p><p>Consta de diez series. Cada una tiene sus instrucciones y tiempo de respuesta. Tu enlace es personal y permite completar una evaluación.</p><p style="font-size:12px;color:#60747b">Si el enlace no abre, copia esta dirección:<br>'+psicoEscape_(r[5])+'</p><hr style="border:0;border-top:1px solid #dbe6e7"><small>Worketers · Personas, habilidades y posibilidades.</small></div></div>';
 try{MailApp.sendEmail({to:email,subject:'Tu evaluación · Worketers | Vigencia de 24 horas',name:'Worketers',body:'Hola '+name+'. Completa tu evaluación antes del '+expiresText+' (Ciudad de México). Enlace personal: '+r[5],htmlBody:html});}
 catch(err){s.getRange(i+1,11).setValue('Envío fallido');throw Error('No se pudo enviar el correo. Reintenta: no se generará otra invitación.');}
 s.getRange(i+1,11,1,2).setValues([['Enviado',new Date().toISOString()]]);
 audit_(u.correo,'enviar_invitacion_24h','Psicométricos',r[0],{},{correo:email,expiraEn:new Date(r[8]).toISOString(),idPostulacion:linked});
 return {id:r[0],correo:email,expiraEn:new Date(r[8]).toISOString(),enviado:true};
}

function psicoCandidates_() {
  const ss = psicoDb_();
  const dataC = ss.getSheetByName('Candidatos').getDataRange().getValues();
  
  const sheetEmpleados = ss.getSheetByName('Empleados');
  let dataE = []; if (sheetEmpleados) dataE = sheetEmpleados.getDataRange().getValues();
  
  let dataR = []; const sheetResultados = ss.getSheetByName('Resultados'); if(sheetResultados) dataR = sheetResultados.getDataRange().getValues();
  let dataResp = []; const sheetRespuestas = ss.getSheetByName('Respuestas_Crudas'); if(sheetRespuestas) dataResp = sheetRespuestas.getDataRange().getValues();
  
  let lista = [];
  for (let i = 1; i < dataC.length; i++) {
    if (!dataC[i][0]) continue; 

    let id = String(dataC[i][0]).trim(); 
    let nombre = (dataC[i][1] || "").toString();
    let edad = (dataC[i][3] || "").toString();
    let status = (dataC[i][4] || "").toString();
    
    let rawFecha = dataC[i][6];
    let fecha = "Sin registrar";
    if (rawFecha) { 
      if (rawFecha instanceof Date) { 
        fecha = Utilities.formatDate(rawFecha, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss"); 
      } else { 
        fecha = rawFecha.toString(); 
      } 
    }
    
    let tipo = psicoExterno_(id) ? 'Candidato' : 'Empleado';
    
    let depto = tipo === 'Empleado' ? "No Encontrado en Base" : "Reclutamiento";
    let puesto = tipo === 'Empleado' ? "No Encontrado en Base" : "Candidato Externo";
    let categoria = tipo === 'Empleado' ? "Empleado General" : "Candidato"; 

    if (tipo === 'Empleado' && dataE.length > 0) {
      for (let e = 1; e < dataE.length; e++) {
        if (dataE[e][0] && String(dataE[e][0]).trim() === id) {
          depto = (dataE[e][2] || "Sin Depto").toString().trim();
          puesto = (dataE[e][3] || "Sin Puesto").toString().trim();
          
          let p = puesto.toUpperCase();
          if (p.includes('COORDINADOR')) categoria = "Coordinador";
          else if (p.includes('LIDER') || p.includes('LÍDER')) categoria = "Líder";
          else categoria = "Empleado General";
          
          break;
        }
      }
    }

    let ci = "-"; let rango = "-"; let score = "-"; let eficiencia = "-"; 
    let completas = {}; let rangosClinicos = {};
    
    if (status === 'Completado') {
      for (let j = 1; j < dataR.length; j++) {
        if (dataR[j][0] && String(dataR[j][0]).trim() === id) {
          score = (dataR[j][1] == null || dataR[j][1] === "" ? "-" : dataR[j][1]).toString();
          ci = (dataR[j][3] || "-").toString(); 
          rango = (dataR[j][4] || "-").toString(); 
          eficiencia = (dataR[j][5] || "-").toString();
          rangosClinicos = { 
            S1: (dataR[j][6] || "").toString(), S2: (dataR[j][7] || "").toString(), S3: (dataR[j][8] || "").toString(), 
            S4: (dataR[j][9] || "").toString(), S5: (dataR[j][10] || "").toString(), S6: (dataR[j][11] || "").toString(), 
            S7: (dataR[j][12] || "").toString(), S8: (dataR[j][13] || "").toString(), S9: (dataR[j][14] || "").toString(), 
            S10: (dataR[j][15] || "").toString() 
          }; 
          break;
        }
      }
      for (let k = 1; k < dataResp.length; k++) {
        if (dataResp[k][0] && String(dataResp[k][0]).trim() === id) {
          completas = { 
            S1: (dataResp[k][1] || "").toString(), S2: (dataResp[k][2] || "").toString(), S3: (dataResp[k][3] || "").toString(), 
            S4: (dataResp[k][4] || "").toString(), S5: (dataResp[k][5] || "").toString(), S6: (dataResp[k][6] || "").toString(), 
            S7: (dataResp[k][7] || "").toString(), S8: (dataResp[k][8] || "").toString(), S9: (dataResp[k][9] || "").toString(), 
            S10: (dataResp[k][10] || "").toString() 
          }; 
          break;
        }
      }
    }
    lista.push({ id, nombre, edad, status, fecha, ci, rango, score, eficiencia, respuestas: completas, rangos: rangosClinicos, tipo, depto, puesto, categoria });
  }
  return lista.reverse();
}


function psicoPdf_(id){
 const c=psicoCandidates_().find(c=>String(c.id)===String(id));if(!c||c.status!=='Completado')throw Error('Aún no hay resultados para este expediente.');
 const names=['Información','Juicio','Vocabulario','Síntesis','Concentración','Análisis','Abstracción','Planeación','Organización','Atención'];
 const maxima=[16,22,30,18,24,20,20,17,18,22];
 let rows='';names.forEach((name,i)=>{const pair=String(c.rangos['S'+(i+1)]||'').split('|');const n=Number(pair[0])||0;rows+='<tr><td>'+(i+1)+'. '+name+'</td><td>'+psicoEscape_(pair[0]||'—')+' / '+maxima[i]+'</td><td><div style="width:130px;background:#edf3f3;height:8px"><div style="width:'+Math.max(0,Math.min(100,n/maxima[i]*100))+'%;height:8px;background:#0096a3"></div></div></td><td>'+psicoEscape_(pair[1]||'Sin datos')+'</td></tr>';});
 const html='<html><head><style>@page{size:A4;margin:20mm}body{font-family:Arial;color:#173239;font-size:11px}h1{color:#007a84;font-size:27px;margin:0}header{border-bottom:3px solid #0096a3;padding-bottom:16px}small{color:#60747b}h2{font-size:19px}table{width:100%;border-collapse:collapse}td,th{padding:10px 7px;border-bottom:1px solid #dbe6e7;text-align:left}th{background:#edf6f6} .metric{background:#edf6f6;padding:16px;margin:20px 0}footer{font-size:9px;color:#60747b;margin-top:24px;line-height:1.5}</style></head><body><header><h1>Worketers.</h1><p>Evalúa · Psicométricos</p><small>REPORTE CONFIDENCIAL · Terman-Merrill</small></header><h2>'+psicoEscape_(c.nombre)+'</h2><p>Folio: '+psicoEscape_(c.id)+'<br>Perfil: '+psicoEscape_(c.tipo)+' · Fecha de inicio: '+psicoEscape_(c.fecha)+'</p><div class="metric"><b>Puntuación: '+psicoEscape_(c.score)+' puntos</b> &nbsp; | &nbsp; CI de referencia: '+psicoEscape_(c.ci)+' &nbsp; | &nbsp; Eficiencia: '+psicoEscape_(c.eficiencia)+'</div><h2>Perfil por áreas</h2><table><thead><tr><th>Área</th><th>Puntos</th><th>Avance sobre máximo</th><th>Rango del baremo</th></tr></thead><tbody>'+rows+'</tbody></table><footer>Resultados calculados con las claves y baremos del proyecto original. Los puntos y rangos son referencias de esa metodología; no son porcentiles ni un diagnóstico clínico. Su interpretación corresponde al profesional responsable y debe integrarse con otras fuentes de evaluación. Este reporte no determina por sí solo una decisión de contratación.<br><br>Worketers · Evalúa | Uso interno y confidencial</footer></body></html>';
 const blob=Utilities.newBlob(html,MimeType.HTML,'reporte.html').getAs(MimeType.PDF);
 return {filename:'Worketers_Reporte_'+String(id).replace(/[^a-z0-9_-]/ig,'')+'.pdf',base64:Utilities.base64Encode(blob.getBytes())};
}
