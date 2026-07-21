/**
 * Controla que el panel de módulos se abra solo una vez por sesión.
 * Es estado de módulo (vive mientras la app esté abierta) y se reinicia al cerrar sesión.
 */
let alreadyShown = false;

/** Devuelve true la primera vez que se consulta tras iniciar sesión. */
export function claimLauncherAutoOpen(): boolean {
  if (alreadyShown) return false;
  alreadyShown = true;
  return true;
}

export function resetLauncherAutoOpen(): void {
  alreadyShown = false;
}
