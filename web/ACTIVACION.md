# LÚMINA web independiente · estado de preparación

Esta versión usa correo y contraseña propios. No contiene autenticación de ChatGPT ni rutas de inicio de sesión de Sites. No está publicada ni conectada a un servicio de cuentas. Los botones de registro y acceso están desactivados mientras config.js no tenga los valores públicos del proyecto.

## Activación necesaria

1. Conectar Supabase y elegir/crear un proyecto destinado a LÚMINA. No activar planes de pago sin decisión del titular.
2. Aplicar supabase/migrations/202611180001_private_accounts.sql en el proyecto seleccionado. No repetir la migración si ya está aplicada.
3. En un proyecto de pruebas, ejecutar supabase/tests/isolation.sql: cuenta A, cuenta B, anónimo y conflicto de versión. Verificar también mediante dos sesiones reales que una no puede leer ni firmar URLs de las fotografías de la otra.
4. Configurar confirmación por correo, contraseña mínima de 12 caracteres, límites de intentos y el proveedor de envío de correo. Configurar Site URL y redirect URLs del alojamiento elegido. Verificar recuperación y cambio de contraseña antes de aceptar usuarios.
5. Completar web/config.js con supabaseUrl y publishableKey públicos. Nunca usar service_role ni claves secretas en archivos web.
6. Publicar web/ en un alojamiento HTTPS independiente, con URL propia del proveedor o dominio adquirido. No activar GitHub Pages ni otro hosting hasta comprobar registro, aislamiento y guardado real. Ningún paciente debe existir en el repositorio público.

## Funciones conservadas

Agenda, expediente por paciente, áreas y precios personalizados, paquetes, pagos, comprobantes internos, sesiones, fotografías de antes/después y respaldo de registros. Cada usuario tiene una fila privada con su expediente y una carpeta privada de fotografías.

El servidor obtiene la identidad del token de sesión. El cliente no decide de quién es la cuenta. El guardado usa revisión para rechazar cambios que sobrescribirían otra sesión. No se importan automáticamente los datos locales de la APK. Para migrarlos, el usuario exporta un respaldo y lo importa en su propia cuenta. Los respaldos con fotos antiguas incrustadas tienen un límite; la migración masiva a Storage queda pendiente de implementar y validar.

## Límites antes del lanzamiento

- Registro, sesiones, correo y base de datos: código preparado, aún sin prueba real por falta de conexión del servicio.
- No se guardan expedientes ni fotos en localStorage. La sesión se conserva en sessionStorage de esta pestaña; salir limpia memoria e invalida la sesión del dispositivo.
- Requiere internet para consultar y guardar expedientes. Los cambios sin conexión quedan pendientes en memoria, con aviso visible; no se afirma que estén guardados.
- Las fotos nuevas se guardan en bucket privado. Los enlaces de visualización duran dos minutos; no existe galería pública. Retirar una imagen del expediente no purga todavía el archivo del bucket; se necesita una gestión de eliminación y retención antes de producción.
- El respaldo JSON conserva rutas privadas de fotografías, no sus bytes. Sirve para restaurar registros en la misma cuenta; no es una copia completa e independiente de las fotos. La exportación completa de fotografías queda pendiente.
- Notificaciones web con app cerrada: pendientes de integración y prueba en iPhone/Android. sw.js admite recibir Push, pero todavía no hay suscripción ni emisor programado. No presentar este apartado como terminado. El calendario .ics sí incluye alarmas a 48h, 24h, 1h e inicio; su entrega depende del calendario al importarlo.
- service worker no cachea respuestas de cuentas ni expedientes; falta probar instalación, iconos y experiencia real en iPhone. Se incluyen iconos PNG y apple-touch-icon.

Mantener la APK instalada hasta verificar la migración y el respaldo.
