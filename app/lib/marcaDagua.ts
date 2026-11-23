// Padrão de marca d'água que cobre a foto inteira (texto repetido em diagonal),
// usado só para clientes com acesso temporário.
function escaparXml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
}

export function padraoMarcaDagua(texto: string): string {
  const t = escaparXml(texto)
  // Duas camadas (clara e escura) para aparecer tanto em foto clara quanto escura
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150" viewBox="0 0 240 150">` +
    `<g transform="rotate(-28 120 75)" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="600" text-anchor="middle">` +
    `<text x="120" y="70" fill="#000" fill-opacity="0.13">${t}</text>` +
    `<text x="121" y="71" fill="#fff" fill-opacity="0.16">${t}</text>` +
    `<text x="0" y="145" fill="#000" fill-opacity="0.13">${t}</text>` +
    `<text x="240" y="145" fill="#000" fill-opacity="0.13">${t}</text>` +
    `</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
