# HiTalent · Worketers

Portal de reclutamiento con Apps Script, Google Sheets, Drive y entradas en GitHub Pages.

## Entradas

- Inicio: https://worketers.github.io/Recruitment/
- Candidatos: https://worketers.github.io/Recruitment/candidatos.html
- Empresas: https://worketers.github.io/Recruitment/cliente.html
- Reclutadores: https://worketers.github.io/Recruitment/admin.html
- Superadmin: https://worketers.github.io/Recruitment/superadmin.html

Las entradas llevan al portal servido por Apps Script. La interfaz vive en `App.html` y usa `google.script.run`, por lo que confirma el resultado real del servidor y evita los falsos éxitos de `fetch` con `no-cors`. GitHub conserva el código de ambas capas.

## Puesta en marcha

1. En las propiedades privadas del proyecto de Apps Script, configurar `SPREADSHEET_ID` con el ID de la hoja y `OWNER_EMAIL` con el correo del propietario. Ejecutar `inicializarProyecto` con esa cuenta y autorizar Sheets, Drive y envío de correo. La función comprueba la identidad activa; no funciona como ruta anónima de inicialización.
2. Se preparan `Requisiciones`, `Candidatos`, `Usuarios`, `Bitacora`, `Sesiones` y `Solicitudes` en la hoja configurada. La pestaña vacía original se conserva. La inicialización es repetible y rechaza encabezados incompatibles en lugar de sobrescribir datos.
3. Se crea la carpeta privada `HiTalent · CV privados`. Su ID queda en las propiedades del script; no se publica en GitHub.
4. Publicar como aplicación web ejecutada por el propietario y con acceso para cualquier usuario. Este acceso permite abrir la bolsa y enviar formularios; los datos del equipo requieren código y sesión. Si la organización restringe aplicaciones anónimas, resolver la política con su administrador.
5. Revisar el ID de implementación en `portal.js` y las entradas HTML si se crea una implementación distinta. Usar una nueva versión de la misma implementación para conservar enlaces.
6. GitHub Pages ya usa `main` / raíz. Los cambios se publican mediante el flujo de Pages existente; el flujo `Verificar portal` ejecuta las pruebas sin cambiar esa configuración.

## Operación

- **Candidatos:** registro general o por vacante activa; CV opcional PDF/DOC/DOCX hasta 5 MB; confirmación con folio y consentimiento registrado.
- **Empresas:** formulario de requisición. Se recibe como `Pausada` hasta que el equipo revise y cambie a `Activa`. `Cerrada` y `Pausada` no aparecen en la bolsa pública.
- **Reclutadores:** acceso individual por código de un uso enviado al correo autorizado. Ven los mismos candidatos y requisiciones; cambian estados, dejan notas y descargan CV desde el panel. Pueden editar su nombre visible.
- **Superadmin:** lo anterior, alta y edición de integrantes, suspensión/reactivación, roles y últimos 500 eventos de bitácora con antes/después. El propietario no se puede suspender ni degradar.
- Cambiar permisos revoca las sesiones del integrante. No se envían invitaciones al crear un perfil: cada integrante solicita su código desde el portal.
- Los códigos vencen en 10 minutos y se invalidan al usarlos o tras cinco intentos fallidos. Las sesiones vencen en ocho horas. Solo se guardan hashes de códigos y tokens; no se administran contraseñas.
- El servidor comprueba usuario activo y permisos en cada operación, independientemente de qué botones muestre el navegador.
- La descarga de CV se registra en bitácora y no requiere compartir públicamente los archivos de Drive.
- Versiones por registro evitan que una edición antigua sobrescriba un cambio más reciente.
- Los formularios conservan su identificador al reintentar para no duplicar registros. Las entradas se guardan como texto cuando pudieran interpretarse como fórmulas de Sheets.

## Mantenimiento y límites

Apps Script y MailApp tienen cuotas de cuenta. Hay un límite global de 20 envíos públicos por minuto y 80 solicitudes de código por hora, además de un minuto entre códigos por correo. El límite público es una protección básica; para campañas masivas o abuso sostenido conviene añadir verificación contra bots o migrar la recepción a un servicio con límites por visitante.

Las cuotas de correo, almacenamiento y ejecución dependen de Google y de la cuenta. No compartir la hoja ni la carpeta con los reclutadores: el portal ya controla el acceso. Compartirlas directamente permitiría saltarse la suspensión del portal. La bitácora registra las operaciones del portal; quien tenga edición directa de Sheets puede alterar la hoja, por lo que no es un registro inmutable.

Los formularios públicos no devuelven candidatos, notas ni contactos de las empresas. El POST anterior se deshabilitó. Ningún dato real, CV, código o sesión debe añadirse al repositorio público.

## Desarrollo

Requiere Node.js para pruebas y `@google/clasp` autenticado para sincronizar Apps Script. El archivo local `.clasp.json` (ignorado) debe tener `rootDir: "."` y el ID del proyecto autorizado.

```text
node test-backend.mjs
clasp push --force
clasp deploy --deploymentId ID_IMPLEMENTACION --description "Descripción de la versión"
```

Las pruebas usan servicios de Google simulados en memoria: verifican inicialización repetible, autenticación, roles, código de un uso, privacidad pública, CV, idempotencia, concurrencia, bitácora y revocación. No envían correos ni modifican hojas reales. La comprobación visual y la prueba real de los servicios requieren completar la autorización de Google.

Referencia: [comunicación de HTML Service](https://developers.google.com/apps-script/guides/html/communication).


