# LÚMINA Android · versión de prueba

Proyecto preparado; APK todavía no compilada ni probada en Android.

## Compilar sin Android Studio

1. Crear un repositorio privado LUMINA en GitHub.
2. Subir el contenido de esta carpeta a la raíz del repositorio, incluida .github/workflows/android.yml.
3. En Actions ejecutar «Compilar LUMINA APK».
4. Descargar el artefacto LUMINA-APK-Prueba y extraer app-debug.apk.

El proceso genera una APK de prueba firmada con clave de depuración; no publica una web ni una app en Google Play. Las compilaciones futuras necesitarán una clave estable para actualizar una instalación sin desinstalarla. Exportar siempre respaldo antes de reinstalar.

## Funciones

Interfaz adaptable a vertical y horizontal, expedientes, áreas y tarifas por paciente, citas, paquetes, seguimiento, pagos, comprobantes internos, reportes, consentimiento local, fotografías de antes y después, exportación/restauración JSON y selector de archivos Android.

No se incluyen pacientes reales. La imagen original del logotipo se selecciona desde la portada; por ahora aparece una composición tipográfica inspirada en la referencia.

## Límites pendientes

Datos locales del WebView, sin cuentas, permisos por profesional ni sincronización. No usar con expedientes reales hasta incorporar protección de acceso. Recordatorios con app cerrada pendientes; la API de notificaciones de navegador puede no estar disponible en Android WebView. Los comprobantes internos no sustituyen factura electrónica. El registro de firma no es firma digital certificada.

Al vincular una sesión a paquete, el área cubierta pasa a costo cero en la cita y el cobro se controla en el paquete. No se vincula si hay un abono que provocaría sobrepago.

Compatible con Android 8 o superior, sujeto a pruebas con WebView actualizado. Java 17, Gradle 8.9 y Android Gradle Plugin 8.7.3; SDK de compilación 35. Referencia de compatibilidad: https://developer.android.com/build/releases/agp-8-7-0-release-notes
