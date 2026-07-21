# App móvil — Mythic Perfumería

App nativa (iOS/Android) con Expo SDK 57 + expo-router. Consume `@mythic/core`.

## Configuración

Copia `.env.example` a `.env` y completa las credenciales de Supabase:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

> Si usas Supabase local y vas a probar en un **teléfono físico**, la URL debe ser la
> **IP de red** de tu PC (ej. `http://192.168.1.20:54321`), no `127.0.0.1`.

## Ejecutar

```bash
pnpm start      # servidor de desarrollo (QR para Expo Go)
pnpm android    # abre en emulador o dispositivo Android conectado
pnpm ios        # abre en simulador iOS (requiere macOS)
pnpm web        # vista previa en navegador (solo desarrollo, no es el producto)
```

## Emulador de Android sin Android Studio

Instalación con las herramientas de línea de comandos (probado en Windows):

1. **Java 17** (lo requiere `sdkmanager`):
   ```powershell
   winget install --id Microsoft.OpenJDK.17
   ```
2. **cmdline-tools**: descarga `commandlinetools-win-*.zip` de
   https://developer.android.com/studio#command-line-tools-only y extrae de modo que quede
   `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat`.
3. **Variables de entorno**: `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk` y `JAVA_HOME` al JDK 17.
4. **Componentes y licencias**:
   ```powershell
   sdkmanager --licenses
   sdkmanager "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis;x86_64"
   ```
5. **Crear y arrancar el dispositivo virtual**:
   ```powershell
   avdmanager create avd -n mythic_pixel -k "system-images;android-35;google_apis;x86_64" -d pixel_7
   emulator -avd mythic_pixel
   ```
6. Con el emulador abierto, `pnpm android` instala Expo Go y lanza la app.

Requiere virtualización activa (Hyper-V / WHPX).

## Estructura

```
app/              rutas (expo-router)
  _layout.tsx     providers: React Query, Auth, SafeArea
  index.tsx       redirección según sesión
  login.tsx       inicio de sesión
  (app)/          zona autenticada
    _layout.tsx   pestañas: Venta, Stock, Reportes
    pos.tsx       punto de venta (carrito + cobro)
    inventory.tsx inventario con estado de stock
    reports.tsx   KPIs del día
src/
  lib/            cliente Supabase, contexto de auth, React Query
  components/     UI reutilizable
  theme.ts        tokens de diseño
```
