# Publicar el sitio (esquivasoretes.com.ar)

El sitio tiene dos partes:

- **La portada** (carpeta `sitio/`): el logo animado y "Próximamente". Es pública.
- **La demo** (`/demo/`): el juego completo, con usuario y contraseña, para mostrarlo. No se
  indexa en buscadores (`robots.txt` y una etiqueta `noindex`).

## Armarlo

```bash
npm run sitio
```

Genera `dist-sitio/` (no se sube al repositorio): la portada en la raíz y el juego compilado en
`demo/`. Incluye un `.htaccess` que comprime el código del juego (de 1,6 MB a 0,5 MB) y ordena
la caché del navegador.

## Subirlo (Plesk)

1. El dominio es una suscripción propia en Plesk (alojamiento Linux con Apache).
2. Se reemplaza el contenido de `httpdocs/` del dominio por el de `dist-sitio/`. Antes conviene
   borrar `httpdocs/demo/`, para que no queden archivos de la versión anterior. Los archivos
   quedan a nombre del usuario del sistema del dominio, con el grupo `psacln`.
3. La contraseña de `/demo` es un **directorio protegido** de Plesk, no un archivo del sitio:
   por eso no se pierde al volver a subir. Se cambia en Plesk (el dominio → *Directorios
   protegidos con contraseña*) o por consola:
   `plesk bin protdir --update demo -domain esquivasoretes.com.ar -update_user demo -passwd <nueva>`.
4. El certificado es gratuito, de Let's Encrypt (extensión SSL It! de Plesk), con redirección
   permanente a `https`. Se renueva solo.

Si el plan de hosting instala WordPress en los dominios nuevos, hay que quitarlo (WordPress
Toolkit → quitar): el sitio es estático y no lo usa.

## Para mostrar la demo

- `https://esquivasoretes.com.ar/demo/?unlockall`: destraba todos los barrios y personajes en
  ese navegador.
- `https://esquivasoretes.com.ar/demo/?level=versalles-1`: abre directo Versalles
  (`?level=monserrat-1`, el centro con gente).
