// ============================================================================
// 📁 src/utils/constants.js
// Configurações globais - Fácil de ajustar tudo num lugar só
// ============================================================================

export const CONFIG = {
  // ⏱️ Timeouts e limites de tempo
  TEMPO_JANELA_CANCELAMENTO: 50000,      // 50 segundos
  LIMITE_CANCELAMENTOS: 3,                // 3 cancelamentos = castigo
  TEMPO_CASTIGO: 10 * 60 * 1000,         // 10 minutos de bloqueio
  COLLECTOR_TIMEOUT: 120000,              // 2 minutos para collectors
  COLLECTOR_TIMEOUT_CONFIRMACAO: 300000,  // 5 minutos para confirmação
  
  // 🎮 Limites de filas
  LIMITE_FILAS_SIMULTANEAS: 3,            // Máximo 3 filas por jogador
  
  // 💰 Valores de apostas
  TAXA_ADICIONAL: 0.50,                   // Taxa do mediador
  VALOR_SALA_PADRAO: "1,00",              // Valor padrão da sala
  VALORES_FILAS_1X1: [100, 50, 20, 10, 5, 3, 2, 1],  // Valores disponíveis
  
  // 🏆 Sistema de ranking (SEM PONTOS - SÓ VITÓRIAS)
  // REMOVIDO: PONTOS_POR_VITORIA
  
  // 💾 Cache
  CACHE_DURATION: 30000,                  // 30 segundos de cache
  
  // 🎨 Cores das embeds (hexadecimal)
  CORES: {
    FILA_NORMAL: 0xFFFFFF,        // branco (15727347)
    CONFIRMACAO: 0xFFFFFF,         // branco (16250871)
    SALA_CRIADA: 0xFFFFFF,         // branco (16447479)
    VITORIA: 0xFFFFFF,             // branco claro (16513786)
    QR_CODE: 0xFFFFFF,             // branco (QR Code)
    ERRO: 0xFFFFFF,                // branco erro
    SUCESSO: 0xFFFFFF,             // branco sucesso
    INFO: 0xFFFFFF                 // branco info
  },
  
  // 📝 Regex para validações
  REGEX: {
    // PIX: CPF (11), CNPJ (14), Chave Aleatória (UUID), Email
    PIX: /^(\d{11}|\d{14}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,})$/i,
    
    // ID de sala Free Fire (4-10 dígitos)
    ID_SALA: /^\d{4,10}$/,
    
    // Senha de sala (1-4 dígitos)
    SENHA_SALA: /^\d{1,4}$/,
    
    // URL válida
    URL: /^https?:\/\/.+/i
  },
  
  // 📂 Arquivos JSON
  ARQUIVOS: {
    MEDIADORES: "mediadores.json",
    RANKING: "ranking.json",
    PARTIDAS: "partidas.json",
    MESSAGES_CONFIG: "messages_config.json",
    APOSTAS_CONFIG: "apostas_config.json",
    MEDIADOR_CONFIG: "mediador_config.json",
    THUMBNAIL_CONFIG: "thumbnail_config.json"
  },
  
  // 🔗 Links úteis
  LINKS: {
    REGRAS: "https://discord.com/channels/1449885105517629452/1449887845568348200"
  },
  
  // 🎭 Webhooks (opcional - configuração por modalidade)
  WEBHOOKS: {
    "1x1mob": {
      enabled: false,  // true = usa webhook, false = bot normal
      name: "Colombia 1x1",
      avatar: null  // URL da imagem ou null
    },
    "2x2mob": {
      enabled: false,
      name: "Brasil 2x2",
      avatar: null
    }
  }
};

// ============================================================================
// FUNÇÕES HELPER DE FORMATAÇÃO
// ============================================================================

/**
 * Formata valor monetário brasileiro
 * @param {number} value - Valor numérico
 * @returns {string} - Valor formatado (ex: "10,50")
 */
export function formatMoney(value) {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Formata mensagens de erro de forma consistente
 * @param {string} message - Mensagem de erro
 * @returns {string} - Erro formatado
 */
export function formatError(message) {
  return `❌ ${message}`;
}

/**
 * Formata mensagens de sucesso
 * @param {string} message - Mensagem de sucesso
 * @returns {string} - Sucesso formatado
 */
export function formatSuccess(message) {
  return `✅ ${message}`;
}

/**
 * Formata avisos
 * @param {string} message - Mensagem de aviso
 * @returns {string} - Aviso formatado
 */
export function formatWarning(message) {
  return `⚠️ ${message}`;
}

// ============================================================================
// EXPORTAÇÃO DEFAULT (compatibilidade)
// ============================================================================
export default CONFIG;