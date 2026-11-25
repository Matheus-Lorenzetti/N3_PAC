import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Som e vibração de mentira: o teste conta quantas notas foram tocadas
const audios: AudioFalso[] = []

class AudioFalso {
  state = "running"
  currentTime = 0
  destination = {}
  resume = vi.fn(() => Promise.resolve())
  createOscillator = vi.fn(() => ({
    type: "",
    frequency: { value: 0 },
    connect: vi.fn((no: unknown) => no),
    start: vi.fn(),
    stop: vi.fn(),
  }))
  createGain = vi.fn(() => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn((no: unknown) => no),
  }))
  constructor() {
    audios.push(this)
  }
}

const vibrar = vi.fn()
const pedirTela = vi.fn()
let soltarTela = () => {}

// Cada toque são duas notas
const toques = () => audios[0].createOscillator.mock.calls.length / 2

// O módulo guarda o áudio e a trava da tela: cada teste carrega um novo.
// O que ele pendura no document é tirado no fim, para um teste não ouvir o outro
const ouvintes: [string, EventListenerOrEventListenerObject][] = []

async function carregar() {
  vi.resetModules()
  const espiao = vi.spyOn(document, "addEventListener")
  const modulo = await import("@/features/motorista/alerta")
  for (const [tipo, ouvinte] of espiao.mock.calls) {
    if (ouvinte) ouvintes.push([tipo, ouvinte])
  }
  espiao.mockRestore()
  return modulo
}

beforeEach(() => {
  vi.useFakeTimers()
  audios.length = 0
  vibrar.mockReset()
  pedirTela.mockReset().mockImplementation(async () => ({
    addEventListener: (_evento: string, aoSoltar: () => void) => {
      soltarTela = aoSoltar
    },
  }))
  vi.stubGlobal("AudioContext", AudioFalso)
  Object.defineProperty(navigator, "vibrate", {
    value: vibrar,
    configurable: true,
  })
  Object.defineProperty(navigator, "wakeLock", {
    value: { request: pedirTela },
    configurable: true,
  })
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  for (const [tipo, ouvinte] of ouvintes.splice(0)) {
    document.removeEventListener(tipo, ouvinte)
  }
})

describe("prepararAlertas", () => {
  it("libera o som e pede para a tela não apagar", async () => {
    const { prepararAlertas } = await carregar()
    await prepararAlertas()
    expect(audios).toHaveLength(1)
    expect(pedirTela).toHaveBeenCalledWith("screen")
  })

  it("com o som bloqueado pelo navegador, libera no primeiro toque na tela", async () => {
    const { prepararAlertas } = await carregar()
    // O navegador entrega o áudio suspenso quando não houve toque
    vi.stubGlobal(
      "AudioContext",
      class extends AudioFalso {
        state = "suspended"
      }
    )
    await prepararAlertas()
    expect(audios[0].resume).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event("pointerdown"))
    expect(audios[0].resume).toHaveBeenCalledTimes(2)
    // Só o primeiro toque: os seguintes não repetem
    window.dispatchEvent(new Event("pointerdown"))
    expect(audios[0].resume).toHaveBeenCalledTimes(2)
  })

  it("segue sem a trava da tela se o aparelho recusar", async () => {
    pedirTela.mockRejectedValue(new Error("bateria fraca"))
    const { prepararAlertas } = await carregar()
    await expect(prepararAlertas()).resolves.toBeUndefined()
  })

  it("pega a trava de novo quando o motorista volta para o app", async () => {
    const { prepararAlertas } = await carregar()
    await prepararAlertas()
    expect(pedirTela).toHaveBeenCalledTimes(1)

    // O navegador solta a trava quando a aba some
    soltarTela()
    document.dispatchEvent(new Event("visibilitychange"))
    expect(pedirTela).toHaveBeenCalledTimes(2)
  })
})

describe("iniciarAlerta", () => {
  it("toca duas notas e vibra na hora", async () => {
    const { prepararAlertas, iniciarAlerta } = await carregar()
    await prepararAlertas()
    iniciarAlerta()
    expect(toques()).toBe(1)
    expect(vibrar).toHaveBeenCalledWith([200, 100, 200])
  })

  it("repete a cada 1,5 s enquanto o motorista não responde", async () => {
    const { prepararAlertas, iniciarAlerta } = await carregar()
    await prepararAlertas()
    iniciarAlerta()
    vi.advanceTimersByTime(1500)
    expect(toques()).toBe(2)
    vi.advanceTimersByTime(3000)
    expect(toques()).toBe(4)
  })

  it("para sozinho depois de 30 s", async () => {
    const { prepararAlertas, iniciarAlerta } = await carregar()
    await prepararAlertas()
    iniciarAlerta()
    vi.advanceTimersByTime(30_000)
    expect(toques()).toBe(20)
    vi.advanceTimersByTime(60_000)
    expect(toques()).toBe(20)
    expect(vibrar).toHaveBeenLastCalledWith(0)
  })

  it("sem o toque em 'Iniciar rota' não tem som para tocar", async () => {
    const { iniciarAlerta } = await carregar()
    iniciarAlerta()
    expect(audios).toHaveLength(0)
    expect(vibrar).not.toHaveBeenCalledWith([200, 100, 200])
  })
})

describe("pararAlerta", () => {
  it("corta a repetição e a vibração quando o motorista responde", async () => {
    const { prepararAlertas, iniciarAlerta, pararAlerta } = await carregar()
    await prepararAlertas()
    iniciarAlerta()
    vi.advanceTimersByTime(1500)
    pararAlerta()
    expect(vibrar).toHaveBeenLastCalledWith(0)
    vi.advanceTimersByTime(30_000)
    expect(toques()).toBe(2)
  })
})
