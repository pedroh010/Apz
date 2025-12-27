// ============================================================================
// 📁 src/utils/webhookManager.js
// Gerenciamento de webhooks para visual customizado (opcional)
// ============================================================================

import { CONFIG } from "./constants.js";

// ============================================================================
// CACHE DE WEBHOOKS
// ============================================================================

const webhookCache = new Map(); // Map<channelId, Webhook>

// ============================================================================
// FUNÇÕES PRINCIPAIS
// ============================================================================

/**
 * Busca ou cria um webhook para um canal
 * @param {Channel} channel - Canal do Discord
 * @param {Object} options - Opções do webhook
 * @param {string} options.name - Nome do webhook
 * @param {string} options.avatar - URL do avatar (opcional)
 * @returns {Promise<Webhook|null>} - Webhook ou null se falhar
 */
export async function getWebhook(channel, options = {}) {
  try {
    // Verificar se já existe no cache
    if (webhookCache.has(channel.id)) {
      const cachedWebhook = webhookCache.get(channel.id);
      
      // Verificar se webhook ainda existe (pode ter sido deletado)
      try {
        await cachedWebhook.fetch();
        return cachedWebhook;
      } catch {
        // Webhook foi deletado, remove do cache
        webhookCache.delete(channel.id);
      }
    }

    // Buscar webhooks existentes no canal
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(w => w.owner.id === channel.client.user.id);

    // Se não encontrou, criar novo
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: options.name || "Sistema de Filas",
        avatar: options.avatar || null,
        reason: "Criado pelo sistema de filas"
      });
      console.log(`[WebhookManager] Webhook criado no canal ${channel.name}`);
    }

    // Cachear webhook
    webhookCache.set(channel.id, webhook);
    return webhook;

  } catch (err) {
    console.error("[WebhookManager] Erro ao obter webhook:", err.message);
    return null;
  }
}

/**
 * Envia mensagem via webhook com customização
 * @param {Channel} channel - Canal do Discord
 * @param {Object} messageOptions - Opções da mensagem (embeds, components, etc)
 * @param {Object} webhookOptions - Opções de customização do webhook
 * @param {string} webhookOptions.username - Nome customizado
 * @param {string} webhookOptions.avatarURL - Avatar customizado
 * @param {string} webhookOptions.name - Nome do webhook (fallback)
 * @param {string} webhookOptions.avatar - Avatar do webhook (fallback)
 * @returns {Promise<Message>} - Mensagem enviada
 */
export async function sendViaWebhook(channel, messageOptions, webhookOptions = {}) {
  try {
    // Verificar se webhooks estão habilitados (configuração opcional)
    const modalidade = webhookOptions.modalidade || "default";
    const webhookConfig = CONFIG.WEBHOOKS[modalidade];
    
    // Se webhooks estão desabilitados, enviar mensagem normal
    if (webhookConfig && !webhookConfig.enabled) {
      return await channel.send(messageOptions);
    }

    // Obter webhook
    const webhook = await getWebhook(channel, {
      name: webhookOptions.name || webhookConfig?.name || "Sistema de Filas",
      avatar: webhookOptions.avatar || webhookConfig?.avatar || null
    });

    // Se falhou ao obter webhook, enviar mensagem normal (fallback)
    if (!webhook) {
      console.warn("[WebhookManager] Fallback: enviando mensagem normal");
      return await channel.send(messageOptions);
    }

    // Enviar via webhook com customização
    const sentMessage = await webhook.send({
      ...messageOptions,
      username: webhookOptions.username || webhookOptions.name || webhookConfig?.name || "Sistema de Filas",
      avatarURL: webhookOptions.avatarURL || webhookOptions.avatar || webhookConfig?.avatar || null,
      wait: true // Importante: retorna a mensagem enviada
    });

    return sentMessage;

  } catch (err) {
    console.error("[WebhookManager] Erro ao enviar via webhook:", err.message);
    
    // Fallback: tenta enviar mensagem normal
    try {
      console.warn("[WebhookManager] Fallback: enviando mensagem normal");
      return await channel.send(messageOptions);
    } catch (fallbackErr) {
      console.error("[WebhookManager] Erro no fallback:", fallbackErr.message);
      throw fallbackErr;
    }
  }
}

/**
 * Envia mensagem com escolha automática (webhook ou normal)
 * Decide baseado na configuração da modalidade
 * @param {Channel} channel - Canal do Discord
 * @param {Object} messageOptions - Opções da mensagem
 * @param {string} modalidade - Modalidade (1x1mob, 2x2mob, etc)
 * @returns {Promise<Message>} - Mensagem enviada
 */
export async function sendMessage(channel, messageOptions, modalidade = null) {
  const webhookConfig = modalidade ? CONFIG.WEBHOOKS[modalidade] : null;
  
  // Se não tem config ou webhooks desabilitados, envia normal
  if (!webhookConfig || !webhookConfig.enabled) {
    return await channel.send(messageOptions);
  }

  // Envia via webhook
  return await sendViaWebhook(channel, messageOptions, {
    modalidade,
    username: webhookConfig.name,
    avatarURL: webhookConfig.avatar
  });
}

// ============================================================================
// GERENCIAMENTO DE CACHE
// ============================================================================

/**
 * Limpa webhook do cache
 * @param {string} channelId - ID do canal (opcional, se não fornecido limpa tudo)
 */
export function clearWebhookCache(channelId = null) {
  if (channelId) {
    webhookCache.delete(channelId);
    console.log(`[WebhookManager] Cache limpo para canal ${channelId}`);
  } else {
    webhookCache.clear();
    console.log("[WebhookManager] Todo cache de webhooks limpo");
  }
}

/**
 * Retorna informações sobre o cache
 * @returns {Object} - Estatísticas do cache
 */
export function getCacheInfo() {
  return {
    size: webhookCache.size,
    channels: [...webhookCache.keys()]
  };
}

// ============================================================================
// FUNÇÕES DE LIMPEZA
// ============================================================================

/**
 * Deleta webhook de um canal
 * @param {Channel} channel - Canal do Discord
 * @returns {Promise<boolean>} - true se deletou com sucesso
 */
export async function deleteWebhook(channel) {
  try {
    const webhook = webhookCache.get(channel.id);
    
    if (webhook) {
      await webhook.delete("Limpeza de webhooks");
      webhookCache.delete(channel.id);
      console.log(`[WebhookManager] Webhook deletado do canal ${channel.name}`);
      return true;
    }

    // Buscar e deletar webhooks do bot no canal
    const webhooks = await channel.fetchWebhooks();
    const botWebhooks = webhooks.filter(w => w.owner.id === channel.client.user.id);

    for (const wh of botWebhooks.values()) {
      await wh.delete("Limpeza de webhooks");
      console.log(`[WebhookManager] Webhook ${wh.name} deletado`);
    }

    return botWebhooks.size > 0;

  } catch (err) {
    console.error("[WebhookManager] Erro ao deletar webhook:", err.message);
    return false;
  }
}

/**
 * Deleta todos os webhooks do bot em um servidor
 * @param {Guild} guild - Servidor do Discord
 * @returns {Promise<number>} - Quantidade de webhooks deletados
 */
export async function deleteAllWebhooks(guild) {
  try {
    let deletedCount = 0;
    const channels = guild.channels.cache.filter(ch => ch.isTextBased());

    for (const channel of channels.values()) {
      const webhooks = await channel.fetchWebhooks();
      const botWebhooks = webhooks.filter(w => w.owner.id === guild.client.user.id);

      for (const webhook of botWebhooks.values()) {
        await webhook.delete("Limpeza em massa");
        deletedCount++;
      }
    }

    // Limpar cache
    clearWebhookCache();

    console.log(`[WebhookManager] ${deletedCount} webhooks deletados no servidor ${guild.name}`);
    return deletedCount;

  } catch (err) {
    console.error("[WebhookManager] Erro ao deletar webhooks:", err.message);
    return 0;
  }
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Verifica se um canal suporta webhooks
 * @param {Channel} channel - Canal do Discord
 * @returns {boolean} - true se suporta webhooks
 */
export function supportsWebhooks(channel) {
  return channel.isTextBased() && !channel.isThread() && !channel.isDMBased();
}

/**
 * Valida opções de webhook
 * @param {Object} options - Opções do webhook
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
export function validateWebhookOptions(options) {
  const errors = [];

  if (options.name && options.name.length > 80) {
    errors.push("Nome do webhook deve ter no máximo 80 caracteres");
  }

  if (options.avatar && !CONFIG.REGEX.URL.test(options.avatar)) {
    errors.push("Avatar deve ser uma URL válida");
  }

  if (options.avatarURL && !CONFIG.REGEX.URL.test(options.avatarURL)) {
    errors.push("Avatar URL deve ser uma URL válida");
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
 * Retorna estatísticas de webhooks
 * @param {Guild} guild - Servidor do Discord (opcional)
 * @returns {Promise<Object>} - Estatísticas
 */
export async function getStats(guild = null) {
  try {
    if (!guild) {
      return {
        cached: webhookCache.size,
        channels: [...webhookCache.keys()]
      };
    }

    let totalWebhooks = 0;
    let botWebhooks = 0;
    const channels = guild.channels.cache.filter(ch => ch.isTextBased() && !ch.isThread());

    for (const channel of channels.values()) {
      try {
        const webhooks = await channel.fetchWebhooks();
        totalWebhooks += webhooks.size;
        botWebhooks += webhooks.filter(w => w.owner.id === guild.client.user.id).size;
      } catch {
        // Ignora canais sem permissão
      }
    }

    return {
      cached: webhookCache.size,
      totalWebhooks,
      botWebhooks,
      guildName: guild.name
    };

  } catch (err) {
    console.error("[WebhookManager] Erro ao obter estatísticas:", err.message);
    return null;
  }
}