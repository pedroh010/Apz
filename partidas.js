import fs from "fs";

const FILE = "partidas.json";

// Carrega as partidas do arquivo JSON
function carregarPartidas() {
  try {
    return JSON.parse(fs.readFileSync(FILE));
  } catch {
    return [];
  }
}

// Salva as partidas no arquivo JSON
function salvarPartidas(partidas) {
  fs.writeFileSync(FILE, JSON.stringify(partidas, null, 2));
}

// Criar uma nova partida
export function criarPartida(partida) {
  const partidas = carregarPartidas();
  partidas.push({
    idThread: partida.idThread,
    modalidade: partida.modalidade,
    valor: partida.valor,
    jogadores: partida.jogadores,
    mediador: partida.mediador,
    status: "pendente"
  });
  salvarPartidas(partidas);
}

// Cancelar uma partida
export function cancelarPartida(idThread) {
  const partidas = carregarPartidas();
  const partida = partidas.find(p => p.idThread === idThread);
  if (partida) partida.status = "cancelada";
  salvarPartidas(partidas);
}

// Registrar vencedor
export function registrarVencedor(idThread, vencedorId) {
  const partidas = carregarPartidas();
  const partida = partidas.find(p => p.idThread === idThread);
  if (partida) {
    partida.vencedor = vencedorId;
    partida.status = "aguardando_finalizacao";
  }
  salvarPartidas(partidas);
}

// Finalizar partida
export function finalizarPartida(idThread) {
  const partidas = carregarPartidas();
  const partida = partidas.find(p => p.idThread === idThread);
  if (partida) partida.status = "finalizada";
  salvarPartidas(partidas);
}