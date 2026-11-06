# Worketers · Talento

Portal de reclutamiento con pantallas alojadas en GitHub Pages y servidor en Google Apps Script, Google Sheets y Drive.

## Enlaces

- Inicio y candidatos: https://worketers.github.io/Recruitment/
- Equipo: https://worketers.github.io/Recruitment/admin.html
- Superadmin: https://worketers.github.io/Recruitment/superadmin.html
- Checklist para empresas: https://worketers.github.io/Recruitment/cliente.html

Las pantallas permanecen en la dirección de GitHub. No se incrusta ni se redirige al portal de Google. Las solicitudes usan POST de texto con respuesta JSON comprobada; no usan `no-cors`, JSONP ni tokens en la URL. La URL pública de Apps Script es únicamente el servicio de datos.

## Accesos del equipo

El superadmin crea integrantes desde **Equipo y accesos** con nombre, correo, usuario único, rol y contraseña inicial. El usuario puede ser un alias o el correo. La contraseña inicial debe tener de 12 a 64 caracteres y hasta 72 bytes en UTF-8; el integrante debe sustituirla antes de consultar información.

Las contraseñas se guardan con bcryptjs 3.0.3, coste 12 y sal aleatoria independiente. No se muestran ni se guardan en la bitácora. Cambiar o restablecer una contraseña revoca las sesiones anteriores. Los hashes solo se leen en el servidor y nunca forman parte de la respuesta del panel.

- **Reclutador:** candidatos y requisiciones del equipo, seguimiento, notas y CV privados.
- **Admin:** lo anterior y el botón **Compartir checklist** para copiar el enlace y enviarlo a la empresa.
- **Superadmin:** lo anterior, alta/edición/suspensión de usuarios, restablecimiento de contraseña inicial y bitácora.

El propietario no puede ser suspendido ni degradado. Los integrantes existentes conservan su correo como usuario inicial. El superadmin debe asignarles una contraseña desde el panel.

Solo el propietario puede usar **Configurar o recuperar acceso del propietario**: verifica su correo mediante un código y define una contraseña. La sesión de recuperación únicamente permite cambiar la contraseña; no da acceso al panel antes de hacerlo. Los colaboradores ingresan con usuario y contraseña y deben solicitar cualquier restablecimiento al superadmin.

Hay cinco intentos fallidos por cuenta antes de una espera de 15 minutos y un límite global de intentos por minuto. Las sesiones duran ocho horas y el servidor comprueba el estado y los permisos en cada solicitud.

## Candidatos y checklist

El inicio solo muestra oportunidades y registro de candidatos, además del acceso del equipo. No contiene botones de empresa ni de solicitud de personal.

El checklist se abre con su enlace directo, que el admin o superadmin puede copiar desde su panel. No exige cuenta de colaborador. Ocultarlo del inicio no convierte el enlace en privado: cualquier persona que lo reciba puede abrirlo. Las requisiciones llegan como `Pausada` hasta que el equipo las revise y active.

Los candidatos pueden registrarse con o sin CV. Los archivos PDF, DOC o DOCX de hasta 5 MB se guardan en una carpeta privada de Drive; la descarga requiere sesión de equipo. Se mantienen el registro de consentimiento, folio, reintentos sin duplicados, control de versiones y bitácora.

## Configuración privada y actualización

En las propiedades de Apps Script deben permanecer `SPREADSHEET_ID`, `OWNER_EMAIL`, `CV_FOLDER_ID` e `INITIALIZED`. No publicar sus valores, datos reales, CV, códigos, contraseñas ni sesiones en este repositorio.

La primera llamada de la nueva versión añade las columnas de credenciales y de sesiones necesarias sin borrar los registros existentes. La migración comprueba los encabezados anteriores y se detiene si no son compatibles.

Sincronizar primero el servidor de Apps Script y actualizar la misma implementación para conservar la URL. Después publicar las pantallas en `main`, que GitHub Pages toma de la raíz. El archivo local `.clasp.json` está ignorado y apunta al proyecto autorizado con `rootDir: "."`; `.claspignore` solo permite los archivos del servidor.

```text
node build.mjs
node test-backend.mjs
clasp push --force
clasp deploy --deploymentId ID_IMPLEMENTACION --description "Descripción de la versión"
```

`App.template.html` es la fuente común; `build.mjs` genera inicio, candidatos, checklist y accesos con su vista inicial. El flujo de GitHub ejecuta pruebas y comprueba que las pantallas generadas estén actualizadas.

Las pruebas usan Google simulado en memoria y bcrypt real: verifican autenticación, migración, roles, cambio obligatorio, contraseñas débiles, usuario duplicado, revocación, limitación de intentos, privacidad, CV, idempotencia y concurrencia. No envían correos ni escriben datos reales.

La bitácora registra operaciones del portal y no es inmutable frente a quien tenga edición directa de la hoja. No es necesario compartir la hoja ni la carpeta de CV con los colaboradores. Apps Script, correo y Drive mantienen las cuotas de la cuenta de Google.

Biblioteca: [bcrypt.js](https://github.com/dcodeIO/bcrypt.js), licencia en `BCRYPT-LICENSE.txt`. El adaptador de Apps Script usa exclusivamente las funciones síncronas y deshabilita los temporizadores, que ese runtime no proporciona.

## Identidad reusable Worketers

La marca común es **Worketers**; el módulo actual es **Talento** y su función es **Reclutamiento**. El encabezado presenta estos tres niveles sin marcas secundarias ni el prefijo POR.

- `brand.json`: nombres, descripción, pie y colores.
- `worketers.css`: componentes comunes, estados, espaciado y reglas para móvil.
- `App.template.html`: contenido y comportamiento del portal, separado del estilo.
- `build.mjs`: genera las cinco entradas públicas, `App.html` para Apps Script y `Brand.js` para sus títulos y mensajes.
- `worketers-demo.html`: ejemplos de Talento/Reclutamiento, Equipos/Inventario y Gestión/Operaciones.

Para otro proyecto, cambia `product` y `function` en `brand.json`, conserva la marca Worketers y ejecuta `node build.mjs`. Los estilos también se pueden copiar solos a una página HTML con una etiqueta link. No edites a mano los archivos generados. Para sincronizar Apps Script se incluye `Brand.js` en `.claspignore`; no contiene datos de la hoja ni de usuarios.

## Psicométricos integrados

La pestaña Psicométricos usa la misma sesión del equipo (reclutador, admin o superadmin). Desde ella, o desde un candidato, se envía una invitación personal por correo válida durante 24 horas para completar y entregar. El servidor de candidatos también verifica el vencimiento. Los enlaces pendientes sin fecha de vigencia requieren una nueva invitación.

`Psico.js` contiene consultas, envío y reportes; usa `PSICO_SPREADSHEET_ID` en propiedades privadas del servidor. `PsicoConfigPrivate.js` es configuración local excluida del repositorio. Las columnas H:N de la hoja de evaluaciones contienen creación, vencimiento, actor, estado de correo, envío, idempotencia y vínculo a postulación. Las columnas originales se conservan.

Comprobación adicional: `node test-psico.mjs`. Las invitaciones y consultas PDF se registran en la bitácora. La administración independiente de Evalúa está cerrada.
