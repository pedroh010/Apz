// ============================================================================
// 📁 src/utils/queueState.js
// Gerenciamento de estado das filas (TODAS as modalidades usam isso)
// ============================================================================

import { CONFIG } from "./constants.js";

// ============================================================================
// ESTADO GLOBAL (compartilhado entre todas as modalidades)
// ============================================================================

const filaAtivaPorJogador = new Map();      // Map<userId, Set<threadId>>
const cancelamentosPorJogador = new Map();  // Map<userId, Array<timestamp>>
const jogadoresCastigados = new Map();      // Map<userId, timestamp>
const filasEmProcessamento = new Set();     // Set<queueKey>

// ============================================================================
// FUNÇÕES DE VERIFICAÇÃO
// ============================================================================

/**
 * Verifica se jogador está castigado por cancelamentos excessivos
 * @param {string} userId - ID do usuário
 * @returns {boolean} - true se está castigado
 */
export function isPlayerPunished(userId) {
  const castigo = jogadoresCastigados.get(userId);
  if (!castigo) return false;
  
  // Se o tempo de castigo passou, remove automaticamente
  if (Date.now() > castigo) {
    jogadoresCastigados.delete(userId);
    return false;
  }
  
  return true;
}

/**
 * Retorna quanto tempo falta para o castigo acabar (em milissegundos)
 * @param {string} userId - ID do usuário
 * @returns {number} - Tempo restante em ms (0 se não está castigado)
 */
export function getTimeLeftPunishment(userId) {
  const castigo = jogadoresCastigados.get(userId);
  if (!castigo) return 0;
  
  const timeLeft = castigo - Date.now();
  return timeLeft > 0 ? timeLeft : 0;
}

/**
 * Verifica se jogador pode entrar em mais filas
 * @param {string} userId - ID do usuário
 * @returns {boolean} - true se pode entrar
 */
export function canJoinQueue(userId) {
  const ativo = filaAtivaPorJogador.get(userId) || new Set();
  return ativo.size < CONFIG.LIMITE_FILAS_SIMULTANEAS;
}

/**
 * Retorna quantidade de filas ativas do jogador
 * @param {string} userId - ID do usuário
 * @returns {number} - Quantidade de filas
 */
export function getActiveQueuesCount(userId) {
  const ativo = filaAtivaPorJogador.get(userId) || new Set();
  return ativo.size;
}

/**
 * Retorna lista de IDs das threads ativas do jogador
 * @param {string} userId - ID do usuário
 * @returns {Array<string>} - Array de thread IDs
 */
export function getActiveQueues(userId) {
  const ativo = filaAtivaPorJogador.get(userId) || new Set();
  return [...ativo];
}

// ============================================================================
// FUNÇÕES DE REGISTRO
// ============================================================================

/**
 * Registra cancelamento e aplica castigo se necessário
 * @param {string} userId - ID do usuário
 * @returns {Object} - { punished: boolean, count: number, warning: boolean }
 */
export function registerCancellation(userId) {
  const agora = Date.now();
  const registros = cancelamentosPorJogador.get(userId) || [];
  
  // Filtrar apenas cancelamentos recentes (dentro da janela de tempo)
  const recentes = registros.filter(t => agora - t < CONFIG.TEMPO_JANELA_CANCELAMENTO);
  
  // Adicionar novo cancelamento
  recentes.push(agora);
  cancelamentosPorJogador.set(userId, recentes);

  // Verificar se deve aplicar castigo
  if (recentes.length >= CONFIG.LIMITE_CANCELAMENTOS) {
    jogadoresCastigados.set(userId, agora + CONFIG.TEMPO_CASTIGO);
    return { 
      punished: true, 
      count: recentes.length,
      warning: false 
    };
  }

  // Verificar se deve avisar (1 cancelamento antes do limite)
  const warning = recentes.length === CONFIG.LIMITE_CANCELAMENTOS - 1;

  return { 
    punished: false, 
    count: recentes.length,
    warning 
  };
}

/**
 * Registra jogadores em uma thread (adiciona às filas ativas)
 * @param {string} threadId - ID da thread
 * @param {Array<string>} playerIds - Array de IDs dos jogadores
 */
export function registerThreadForPlayers(threadId, playerIds) {
  for (const playerId of playerIds) {
    if (!filaAtivaPorJogador.has(playerId)) {
      filaAtivaPorJogador.set(playerId, new Set());
    }
    filaAtivaPorJogador.get(playerId).add(threadId);
  }
}

/**
 * Remove jogadores de uma thread (limpa das filas ativas)
 * @param {string} threadId - ID da thread
 * @param {Array<string>} playerIds - Array de IDs dos jogadores
 */
export function clearPlayersFromThread(threadId, playerIds) {
  for (const playerId of playerIds) {
    const filas = filaAtivaPorJogador.get(playerId);
    if (filas) {
      filas.delete(threadId);
      // Se não tem mais filas ativas, remove do Map
      if (filas.size === 0) {
        filaAtivaPorJogador.delete(playerId);
      }
    }
  }
}

// ============================================================================
// RACE CONDITION PROTECTION
// ============================================================================

/**
 * Tenta bloquear uma fila para prevenir race conditions
 * @param {string} queueKey - Chave única da fila (ex: "1x1mob_10_gelNormal")
 * @returns {boolean} - true se conseguiu bloquear, false se já estava bloqueada
 */
export function lockQueue(queueKey) {
  if (filasEmProcessamento.has(queueKey)) {
    return false; // Já está processando
  }
  filasEmProcessamento.add(queueKey);
  return true; // Bloqueou com sucesso
}

/**
 * Desbloqueia uma fila após processamento
 * @param {string} queueKey - Chave única da fila
 */
export function unlockQueue(queueKey) {
  filasEmProcessamento.delete(queueKey);
}

// ============================================================================
// LIMPEZA E MANUTENÇÃO
// ============================================================================

/**
 * Limpa dados antigos da memória (executar periodicamente)
 * Remove castigos expirados e cancelamentos antigos
 */
export function cleanupOldData() {
  const agora = Date.now();
  let cleanedCount = 0;
  
  // Limpar castigos expirados
  for (const [userId, tempo] of jogadoresCastigados.entries()) {
    if (agora > tempo) {
      jogadoresCastigados.delete(userId);
      cleanedCount++;
    }
  }
  
  // Limpar cancelamentos antigos
  for (const [userId, registros] of cancelamentosPorJogador.entries()) {
    const recentes = registros.filter(t => agora - t < CONFIG.TEMPO_JANELA_CANCELAMENTO);
    
    if (recentes.length === 0) {
      cancelamentosPorJogador.delete(userId);
      cleanedCount++;
    } else if (recentes.length < registros.length) {
      cancelamentosPorJogador.set(userId, recentes);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 [QueueState] Limpeza: ${cleanedCount} registros removidos`);
  }
  
  return cleanedCount;
}

/**
 * Retorna estatísticas do estado atual
 * @returns {Object} - Estatísticas
 */
export function getStats() {
  return {
    jogadoresAtivos: filaAtivaPorJogador.size,
    totalFilasAbertas: [...filaAtivaPorJogador.values()].reduce((acc, set) => acc + set.size, 0),
    jogadoresCastigados: jogadoresCastigados.size,
    filasEmProcessamento: filasEmProcessamento.size,
    cancelamentosPendentes: cancelamentosPorJogador.size
  };
}

/**
 * Limpa TODO o estado (útil para testes ou reinicialização)
 * ⚠️ USE COM CUIDADO!
 */
export function clearAllState() {
  filaAtivaPorJogador.clear();
  cancelamentosPorJogador.clear();
  jogadoresCastigados.clear();
  filasEmProcessamento.clear();
  console.log("🗑️ [QueueState] Todo o estado foi limpo");
}

// ============================================================================
// INICIALIZAÇÃO E MANUTENÇÃO AUTOMÁTICA
// ============================================================================

// Executar limpeza a cada 5 minutos
setInterval(() => {
  cleanupOldData();
}, 5 * 60 * 1000);

// Log de estatísticas a cada 30 minutos (opcional)
setInterval(() => {
  const stats = getStats();
  if (stats.jogadoresAtivos > 0) {
    console.log("📊 [QueueState]", stats);
  }
}, 30 * 60 * 1000);