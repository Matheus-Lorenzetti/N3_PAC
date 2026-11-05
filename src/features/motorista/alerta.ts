// Som, vibração e tela ligada para o alerta de nova coleta.
// O navegador só libera áudio depois de um toque do usuário: por isso
// prepararAlertas() é chamado no botão "Iniciar rota".

let audio: AudioContext | null = null
let repeticao: number | null = null

// Chamada no toque em "Iniciar": libera o som e mantém a tela ligada
// Depois de uma atualização automática não houve toque: tenta liberar assim
// mesmo e, se o navegador não deixar, libera no primeiro toque na tela
export async function prepararAlertas() {
  audio ??= new AudioContext()
  if (audio.state === "suspended") {
    audio.resume().catch(() => {})
    window.addEventListener("pointerdown", () => audio?.resume(), {
      once: true,
    })
  }
  await manterTelaLigada()
}

// Duas notas curtas e agudas, parecidas com o aviso de corrida
function tocarUmaVez() {
  if (!audio) return
  const inicio = audio.currentTime
  ;[880, 1320].forEach((frequencia, i) => {
    const oscilador = audio!.createOscillator()
    const volume = audio!.createGain()
    oscilador.type = "sine"
    oscilador.frequency.value = frequencia
    const t = inicio + i * 0.18
    volume.gain.setValueAtTime(0.0001, t)
    volume.gain.exponentialRampToValueAtTime(0.6, t + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    oscilador.connect(volume).connect(audio!.destination)
    oscilador.start(t)
    oscilador.stop(t + 0.17)
  })
  navigator.vibrate?.([200, 100, 200])
}

// Repete até o motorista responder (no máximo 30 s)
export function iniciarAlerta() {
  pararAlerta()
  tocarUmaVez()
  let vezes = 0
  repeticao = window.setInterval(() => {
    vezes += 1
    if (vezes >= 20) pararAlerta()
    else tocarUmaVez()
  }, 1500)
}

// Para o som e a vibração
export function pararAlerta() {
  if (repeticao !== null) window.clearInterval(repeticao)
  repeticao = null
  navigator.vibrate?.(0)
}

// Wake Lock: a tela não apaga enquanto o app estiver aberto
let travaTela: WakeLockSentinel | null = null

// Pede ao navegador para não apagar a tela
async function manterTelaLigada() {
  if (!("wakeLock" in navigator) || travaTela) return
  try {
    travaTela = await navigator.wakeLock.request("screen")
    travaTela.addEventListener("release", () => {
      travaTela = null
    })
  } catch {
    // Sem suporte ou bateria fraca: segue sem a trava
  }
}

// O navegador solta a trava quando a aba some; pega de novo ao voltar
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && audio) manterTelaLigada()
})
