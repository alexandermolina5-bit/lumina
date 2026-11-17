# LÚMINA · Agenda local para navegador

Abrir desde Safari o Chrome mediante un enlace HTTPS. No requiere ChatGPT, Supabase ni cuenta de LÚMINA.

Cada navegador guarda su propio expediente en IndexedDB. Los pacientes no se envían a un servidor ni se comparten con otros teléfonos. Dos personas que usen el mismo navegador del mismo teléfono verán la misma agenda: esta versión no tiene cuentas ni contraseña.

## Conservar los datos

Usar siempre el mismo navegador, fuera del modo privado. En «Respaldo y acceso», descargar un respaldo completo con pacientes, fotos, firmas, citas y pagos. Guardar el archivo fuera del navegador. El respaldo puede importarse para trasladar los registros a otro dispositivo. Borrar los datos del navegador puede borrar la agenda; instalar la web no evita esa posibilidad.

La APK mantiene su almacenamiento por separado. Para trasladar sus pacientes a esta web, exportar el respaldo de la APK e importarlo aquí. No desinstalar la APK hasta verificar la restauración.

## Recordatorios

Esta versión local no programa notificaciones web con la página cerrada. Desde cada cita se descarga un archivo .ics con avisos a 48 horas, 24 horas, una hora y al inicio. Al importarlo, verificar los avisos conservados por el calendario del teléfono. Si se reprograma o cancela una cita en LÚMINA, actualizarla también en el calendario externo.

## Publicación por enlace

Carpeta preparada para GitHub Pages. En el repositorio lumina, Settings → Pages → Deploy from a branch → main → /docs → Save. Esperar a que termine el despliegue y usar la URL confirmada por GitHub. No se publican expedientes: el código de la aplicación se distribuye sin pacientes incluidos.

En iPhone se puede añadir a inicio desde Safari. La primera carga y la instalación de la copia sin conexión necesitan internet. Falta comprobar en un iPhone y un Android reales el almacenamiento, las descargas, la instalación y la restauración completa de fotografías.
