// ============================================================================
// 📁 src/utils/threadHelper.js
// Funções auxiliares para manipulação de threads e mensagens
// ============================================================================

import { formatMoney } from "./constants.js";

// ============================================================================
// FILA DE EDIÇÕES (previne conflitos)
// ============================================================================

let editQueue = Promise.resolve();

/**
 * Edita mensagem de forma segura (sem conflitos)
 * @param {Message} targetMessage - Mensagem a ser editada
 * @param {Object} payload - Novo conteúdo da mensagem
 * @returns {Promise} - Promise da edição
 */
export async function safeEdit(targetMessage, payload) {
  editQueue = editQueue.then(async () => {
    try {
      await targetMessage.edit(payload);
    } catch (err) {
      console.error("[ThreadHelper] Erro ao editar mensagem:", err.message);
    }
  });
  return editQueue;
}

// ============================================================================
// DELETAR MENSAGENS RAPIDAMENTE
// ============================================================================

/**
 * Deleta mensagens de forma otimizada (bulk delete quando possível)
 * @param {ThreadChannel} thread - Thread do Discord
 * @param {number} limit - Quantidade máxima de mensagens (padrão: 100)
 * @returns {Promise<number>} - Quantidade de mensagens deletadas
 */
export async function fastDeleteMessages(thread, limit = 100) {
  try {
    // Tenta bulk delete (até 100 mensagens, máximo 14 dias)
    const deleted = await thread.bulkDelete(limit, true); // true = filtra mensagens antigas
    console.log(`[ThreadHelper] ${deleted.size} mensagens deletadas (bulk)`);
    return deleted.size;
    
  } catch (err) {
    console.log("[ThreadHelper] Bulk delete falhou, usando método lento");
    
    // Fallback: deletar uma por uma
    try {
      const msgs = await thread.messages.fetch({ limit: Math.min(limit, 50) });
      let deletedCount = 0;
      
      for (const msg of msgs.values()) {
        try {
          await msg.delete();
          deletedCount++;
        } catch (deleteErr) {
          // Ignora erros de mensagens já deletadas
        }
      }
      
      console.log(`[ThreadHelper] ${deletedCount} mensagens deletadas (manual)`);
      return deletedCount;
      
    } catch (err2) {
      console.error("[ThreadHelper] Erro ao deletar mensagens:", err2.message);
      return 0;
    }
  }
}

/**
 * Deleta mensagens específicas por ID
 * @param {ThreadChannel} thread - Thread do Discord
 * @param {Array<string>} messageIds - Array de IDs das mensagens
 * @returns {Promise<number>} - Quantidade deletada
 */
export async function deleteMessagesByIds(thread, messageIds) {
  let deletedCount = 0;
  
  for (const id of messageIds) {
    try {
      const msg = await thread.messages.fetch(id);
      await msg.delete();
      deletedCount++;
    } catch (err) {
      // Ignora mensagens já deletadas ou não encontradas
    }
  }
  
  console.log(`[ThreadHelper] ${deletedCount}/${messageIds.length} mensagens deletadas`);
  return deletedCount;
}

// ============================================================================
// GERAÇÃO DE IDS E NOMES
// ============================================================================

/**
 * Gera ID aleatório para thread (4 dígitos)
 * @returns {string} - ID entre 1000 e 9999
 */
export function generateThreadId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Cria nome de thread baseado no valor
 * @param {number} valor - Valor da fila
 * @param {string} prefix - Prefixo (padrão: "pagar")
 * @returns {string} - Nome formatado (ex: "pagar-20,00")
 */
export function createThreadName(valor, prefix = "pagar") {
  const valorTotal = valor * 2; // Valor total da aposta (2 jogadores)
  return `${prefix}-${formatMoney(valorTotal)}`;
}

/**
 * Cria nome de thread com ID aleatório
 * @param {string} prefix - Prefixo (padrão: "fila")
 * @returns {string} - Nome com ID (ex: "fila-1234")
 */
export function createThreadNameWithId(prefix = "fila") {
  return `${prefix}-${generateThreadId()}`;
}

// ============================================================================
// CLEANUP DE COLLECTORS
// ============================================================================

/**
 * Configura cleanup automático de collector quando thread é deletada
 * @param {MessageComponentCollector} collector - Collector a ser limpo
 * @param {ThreadChannel} thread - Thread associada
 */
export function setupCollectorCleanup(collector, thread) {
  // Listener para deletar thread
  const deleteListener = (deleted) => {
    if (deleted.id === thread.id) {
      try {
        collector.stop("thread_deletada");
      } catch (err) {
        console.error("[ThreadHelper] Erro ao parar collector:", err.message);
      }
      
      // Remove o listener após uso
      thread.client.removeListener("threadDelete", deleteListener);
    }
  };

  // Registra listener (once para auto-remover)
  thread.client.once("threadDelete", deleteListener);
  
  // Cleanup ao parar collector
  collector.once("end", (collected, reason) => {
    // Remove listener se ainda existir
    thread.client.removeListener("threadDelete", deleteListener);
    console.log(`[ThreadHelper] Collector encerrado: ${reason}`);
  });
}

/**
 * Configura múltiplos collectors com cleanup
 * @param {Array<MessageComponentCollector>} collectors - Array de collectors
 * @param {ThreadChannel} thread - Thread associada
 */
export function setupMultipleCollectorCleanup(collectors, thread) {
  const deleteListener = (deleted) => {
    if (deleted.id === thread.id) {
      for (const collector of collectors) {
        try {
          collector.stop("thread_deletada");
        } catch {}
      }
      thread.client.removeListener("threadDelete", deleteListener);
    }
  };

  thread.client.once("threadDelete", deleteListener);
  
  // Cleanup quando todos pararem
  Promise.all(collectors.map(c => new Promise(resolve => c.once("end", resolve))))
    .then(() => {
      thread.client.removeListener("threadDelete", deleteListener);
    });
}

// ============================================================================
// VALIDAÇÃO DE DADOS
// ============================================================================

/**
 * Valida ID de sala Free Fire
 * @param {string} idSala - ID da sala
 * @returns {boolean} - true se válido
 */
export function validateRoomId(idSala) {
  return /^\d{4,10}$/.test(idSala);
}

/**
 * Valida senha de sala
 * @param {string} senha - Senha da sala
 * @returns {boolean} - true se válido
 */
export function validateRoomPassword(senha) {
  return /^\d{1,4}$/.test(senha);
}

/**
 * Valida e extrai ID e senha de uma mensagem
 * @param {string} content - Conteúdo da mensagem
 * @returns {Object|null} - { idSala, senha } ou null se inválido
 */
export function parseRoomCredentials(content) {
  const parts = content.trim().split(/\s+/);
  
  if (parts.length < 2) return null;
  
  const idSala = parts[0];
  const senha = parts[1];
  
  if (!validateRoomId(idSala) || !validateRoomPassword(senha)) {
    return null;
  }
  
  return { idSala, senha };
}

// ============================================================================
// MANIPULAÇÃO DE THREADS
// ============================================================================

/**
 * Tenta deletar thread com retry
 * @param {ThreadChannel} thread - Thread a ser deletada
 * @param {number} maxRetries - Tentativas máximas (padrão: 3)
 * @returns {Promise<boolean>} - true se deletou com sucesso
 */
export async function safeDeleteThread(thread, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await thread.delete();
      console.log(`[ThreadHelper] Thread ${thread.name} deletada`);
      return true;
    } catch (err) {
      console.error(`[ThreadHelper] Tentativa ${i + 1}/${maxRetries} falhou:`, err.message);
      
      if (i < maxRetries - 1) {
        // Aguarda antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  console.error(`[ThreadHelper] Falha ao deletar thread após ${maxRetries} tentativas`);
  return false;
}

/**
 * Arquiva thread em vez de deletar
 * @param {ThreadChannel} thread - Thread a ser arquivada
 * @returns {Promise<boolean>} - true se arquivou com sucesso
 */
export async function archiveThread(thread) {
  try {
    await thread.setArchived(true);
    console.log(`[ThreadHelper] Thread ${thread.name} arquivada`);
    return true;
  } catch (err) {
    console.error("[ThreadHelper] Erro ao arquivar thread:", err.message);
    return false;
  }
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Aguarda um tempo determinado (async sleep)
 * @param {number} ms - Milissegundos
 * @returns {Promise} - Promise que resolve após o tempo
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Tenta executar função com retry automático
 * @param {Function} fn - Função assíncrona a executar
 * @param {number} maxRetries - Tentativas máximas
 * @param {number} delay - Delay entre tentativas (ms)
 * @returns {Promise} - Resultado da função
 */
export async function retry(fn, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      console.warn(`[ThreadHelper] Retry ${i + 1}/${maxRetries}:`, err.message);
      await sleep(delay * (i + 1));
    }
  }
}

/**
 * Extrai menções de usuários de uma string
 * @param {string} content - Conteúdo com menções
 * @returns {Array<string>} - Array de IDs de usuários
 */
export function extractUserMentions(content) {
  const matches = content.match(/<@!?(\d+)>/g);
  if (!matches) return [];
  
  return matches.map(m => m.replace(/<@!?(\d+)>/, "$1"));
}

/**
 * Verifica se thread ainda existe e está acessível
 * @param {ThreadChannel} thread - Thread a verificar
 * @returns {Promise<boolean>} - true se existe
 */
export async function threadExists(thread) {
  try {
    await thread.fetch();
    return true;
  } catch {
    return false;
  }
}