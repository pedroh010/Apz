// ============================================================================
// 📁 src/utils/mediatorManager.js
// Gerenciamento de mediadores com cache otimizado
// ============================================================================

import fs from "fs";
import { CONFIG } from "./constants.js";

// ============================================================================
// CACHE
// ============================================================================

let mediatorsCache = null;
let cacheTimestamp = 0;
let mediadorIndex = 0; // Para round-robin

// ============================================================================
// FUNÇÕES DE LEITURA
// ============================================================================

/**
 * Carrega mediadores do arquivo JSON com cache
 * @returns {Array} - Array de mediadores
 */
function loadMediators() {
  try {
    const now = Date.now();
    
    // Se cache existe e ainda é válido, retorna do cache
    if (mediatorsCache && (now - cacheTimestamp) < CONFIG.CACHE_DURATION) {
      return mediatorsCache;
    }

    // Lê arquivo e atualiza cache
    const data = fs.readFileSync(CONFIG.ARQUIVOS.MEDIADORES, "utf8");
    mediatorsCache = JSON.parse(data);
    cacheTimestamp = now;
    
    return mediatorsCache;
  } catch (err) {
    console.error("[MediatorManager] Erro ao carregar mediadores:", err.message);
    return [];
  }
}

/**
 * Busca dados completos de um mediador pelo ID
 * @param {string} id - ID do Discord do mediador
 * @returns {Object|null} - Dados do mediador ou null
 */
export function getMediatorById(id) {
  try {
    const mediadores = loadMediators();
    return mediadores.find(m => m.id === id) || null;
  } catch (err) {
    console.error("[MediatorManager] Erro ao buscar mediador:", err.message);
    return null;
  }
}

/**
 * Busca todos os mediadores cadastrados
 * @returns {Array} - Array de mediadores
 */
export function getAllMediators() {
  return loadMediators();
}

/**
 * Verifica se um usuário é mediador
 * @param {string} userId - ID do usuário
 * @returns {boolean} - true se é mediador
 */
export function isMediator(userId) {
  const mediadores = loadMediators();
  return mediadores.some(m => m.id === userId);
}

// ============================================================================
// SELEÇÃO DE MEDIADORES (ROUND-ROBIN)
// ============================================================================

/**
 * Seleciona o próximo mediador disponível (round-robin)
 * @param {Array} mediadores - Lista de mediadores disponíveis
 * @returns {Object|null} - Mediador selecionado ou null
 */
export function selectNextMediator(mediadores) {
  if (!mediadores || mediadores.length === 0) {
    console.warn("[MediatorManager] Nenhum mediador disponível");
    return null;
  }

  // Se só tem 1, retorna ele
  if (mediadores.length === 1) {
    return mediadores[0];
  }

  // Round-robin: pega o próximo da fila
  const mediador = mediadores[mediadorIndex];
  mediadorIndex = (mediadorIndex + 1) % mediadores.length;

  return mediador;
}

/**
 * Reseta o índice do round-robin (útil quando a lista de mediadores muda)
 */
export function resetRoundRobin() {
  mediadorIndex = 0;
  console.log("[MediatorManager] Round-robin resetado");
}

// ============================================================================
// PREPARAÇÃO DE DADOS
// ============================================================================

/**
 * Prepara dados completos de um mediador com fallbacks
 * @param {Object} mediador - Objeto básico do mediador (pode ter dados incompletos)
 * @returns {Object} - Dados completos do mediador
 */
export function prepareMediatorData(mediador) {
  if (!mediador || !mediador.id) {
    console.error("[MediatorManager] Mediador inválido fornecido");
    return {
      id: null,
      nome: "Mediador Desconhecido",
      pix: "Sem chave cadastrada",
      qrcode: null
    };
  }

  // Busca dados atualizados do arquivo
  const mediadorData = getMediatorById(mediador.id);

  return {
    id: mediador.id,
    nome: mediadorData?.nome || mediador.nome || "Sem nome",
    pix: mediadorData?.pix || mediador.pix || "Sem chave",
    qrcode: mediadorData?.qrcode || mediador.qrcode || null
  };
}

// ============================================================================
// ESCRITA E ATUALIZAÇÃO
// ============================================================================

/**
 * Salva lista de mediadores no arquivo
 * @param {Array} mediadores - Lista de mediadores
 * @returns {boolean} - true se salvou com sucesso
 */
export function saveMediators(mediadores) {
  try {
    fs.writeFileSync(
      CONFIG.ARQUIVOS.MEDIADORES, 
      JSON.stringify(mediadores, null, 2),
      "utf8"
    );
    
    // Invalida cache após salvar
    invalidateCache();
    
    console.log("[MediatorManager] Mediadores salvos com sucesso");
    return true;
  } catch (err) {
    console.error("[MediatorManager] Erro ao salvar mediadores:", err.message);
    return false;
  }
}

/**
 * Atualiza dados de um mediador específico
 * @param {string} userId - ID do usuário
 * @param {Object} newData - Novos dados (pix, nome, qrcode)
 * @returns {boolean} - true se atualizou com sucesso
 */
export function updateMediator(userId, newData) {
  try {
    const mediadores = loadMediators();
    const index = mediadores.findIndex(m => m.id === userId);

    if (index !== -1) {
      // Atualiza mediador existente
      mediadores[index] = {
        ...mediadores[index],
        ...newData,
        id: userId // Garante que ID não muda
      };
    } else {
      // Adiciona novo mediador
      mediadores.push({
        id: userId,
        ...newData
      });
    }

    return saveMediators(mediadores);
  } catch (err) {
    console.error("[MediatorManager] Erro ao atualizar mediador:", err.message);
    return false;
  }
}

/**
 * Remove um mediador
 * @param {string} userId - ID do usuário
 * @returns {boolean} - true se removeu com sucesso
 */
export function removeMediator(userId) {
  try {
    const mediadores = loadMediators();
    const filtered = mediadores.filter(m => m.id !== userId);

    if (filtered.length === mediadores.length) {
      console.warn("[MediatorManager] Mediador não encontrado para remoção:", userId);
      return false;
    }

    return saveMediators(filtered);
  } catch (err) {
    console.error("[MediatorManager] Erro ao remover mediador:", err.message);
    return false;
  }
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

/**
 * Invalida o cache (força reload na próxima leitura)
 */
export function invalidateCache() {
  mediatorsCache = null;
  cacheTimestamp = 0;
  console.log("[MediatorManager] Cache invalidado");
}

/**
 * Retorna informações sobre o cache
 * @returns {Object} - { cached: boolean, age: number, count: number }
 */
export function getCacheInfo() {
  const now = Date.now();
  return {
    cached: mediatorsCache !== null,
    age: mediatorsCache ? now - cacheTimestamp : 0,
    count: mediatorsCache ? mediatorsCache.length : 0,
    valid: mediatorsCache && (now - cacheTimestamp) < CONFIG.CACHE_DURATION
  };
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Valida dados de um mediador
 * @param {Object} data - Dados do mediador
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
export function validateMediatorData(data) {
  const errors = [];

  if (!data.id) {
    errors.push("ID do mediador é obrigatório");
  }

  if (!data.pix || !CONFIG.REGEX.PIX.test(data.pix)) {
    errors.push("Chave PIX inválida");
  }

  if (!data.nome || data.nome.length < 2) {
    errors.push("Nome deve ter pelo menos 2 caracteres");
  }

  if (data.qrcode && !CONFIG.REGEX.URL.test(data.qrcode)) {
    errors.push("QR Code deve ser uma URL válida");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Retorna estatísticas dos mediadores
 * @returns {Object} - Estatísticas
 */
export function getStats() {
  const mediadores = loadMediators();
  
  return {
    total: mediadores.length,
    comPix: mediadores.filter(m => m.pix).length,
    comQrCode: mediadores.filter(m => m.qrcode).length,
    completos: mediadores.filter(m => m.pix && m.nome && m.qrcode).length
  };
}