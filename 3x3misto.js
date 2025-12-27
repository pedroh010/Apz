// ============================================================================
// commands/3x3misto.js - COM WEBHOOKS AUTOMÁTICOS
// ============================================================================

import fs from "fs";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import operario from "../../systems/operario.js";
import { registrarFilaMediada } from "../../utils/faturamentoSystem.js";
import { 
  saveFila1x1mob, 
  saveThreadConfirmacao, 
  saveThreadSala,
  deleteCollector 
} from "../../utils/collectorManager.js";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const CONFIG = {
  VALORES: [100, 50, 20, 10, 5, 3, 2, 1],
  CORES: {
    FILA: 0xFFFFFF,
    CONFIRMACAO: 0xFFFFFF,
    SALA: 0xFFFFFF
  }
};

function formatMoney(val) {
  return val.toFixed(2).replace(".", ",");
}

// ============================================================================
// ESTADO GLOBAL
// ============================================================================

const filasPorJogador = new Map();
const cancelamentos = new Map();
const castigados = new Map();

let mediadorIndex = 0;

// Contador persistente de threads
function loadThreadCounter() {
  try {
    const data = fs.readFileSync("thread_counter.json", "utf8");
    return JSON.parse(data).counter || 0;
  } catch {
    return 0;
  }
}

function saveThreadCounter(counter) {
  try {
    fs.writeFileSync("thread_counter.json", JSON.stringify({ counter }, null, 2));
  } catch (err) {
    console.error("[3x3misto] Erro ao salvar contador:", err.message);
  }
}

let threadCounter = loadThreadCounter();

// Cache de mediadores
let mediadorCache = null;
let cacheTime = 0;
const CACHE_DURATION = 30000;

// Fila de edições
let editQueue = Promise.resolve();

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function isPlayerPunished(userId) {
  const tempo = castigados.get(userId);
  if (!tempo) return false;
  if (Date.now() > tempo) {
    castigados.delete(userId);
    return false;
  }
  return true;
}

function canJoinQueue(userId) {
  const filas = filasPorJogador.get(userId) || new Set();
  return filas.size < 3;
}

function registerThread(threadId, players) {
  for (const p of players) {
    if (!filasPorJogador.has(p)) filasPorJogador.set(p, new Set());
    filasPorJogador.get(p).add(threadId);
  }
}

function clearThread(threadId, players) {
  for (const p of players) {
    const filas = filasPorJogador.get(p);
    if (filas) {
      filas.delete(threadId);
      if (filas.size === 0) filasPorJogador.delete(p);
    }
  }
}

function registerCancel(userId) {
  const now = Date.now();
  const registros = cancelamentos.get(userId) || [];
  const recentes = registros.filter(t => now - t < 50000);
  recentes.push(now);
  cancelamentos.set(userId, recentes);
  
  if (recentes.length >= 3) {
    castigados.set(userId, now + 600000);
    return { punished: true, warning: false };
  }
  return { punished: false, warning: recentes.length === 2 };
}

function escolherMediador(mediadores) {
  if (!mediadores || mediadores.length === 0) return null;
  if (mediadores.length === 1) return mediadores[0];
  const mediador = mediadores[mediadorIndex];
  mediadorIndex = (mediadorIndex + 1) % mediadores.length;
  return mediador;
}

function getMediatorDataById(id) {
  try {
    const now = Date.now();
    if (mediadorCache && (now - cacheTime < CACHE_DURATION)) {
      return mediadorCache.find(m => m.id === id) || null;
    }
    const data = JSON.parse(fs.readFileSync("mediadores.json"));
    mediadorCache = data;
    cacheTime = now;
    return data.find(m => m.id === id) || null;
  } catch { 
    return null; 
  }
}

function safeEdit(message, payload) {
  editQueue = editQueue.then(() => 
    message.edit(payload).catch(() => {})
  );
  return editQueue;
}

// ============================================================================
// CRIAR WEBHOOK
// ============================================================================

async function createWebhookForQueue(channel, valor) {
  try {
    const webhook = await channel.createWebhook({
      name: `Apostado E-sports`,
      reason: `Webhook para fila de R$ ${formatMoney(valor)}`
    });
    return webhook;
  } catch (err) {
    console.error(`[3x3misto] Erro ao criar webhook para R$ ${formatMoney(valor)}:`, err.message);
    return null;
  }
}

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "3x3misto",
  description: "Fila 3x3 Misto",

  async execute(message) {
    for (const valor of CONFIG.VALORES) {
      const webhook = await createWebhookForQueue(message.channel, valor);
      
      if (!webhook) {
        await message.channel.send(`Erro ao criar webhook para R$ ${formatMoney(valor)}`);
        continue;
      }

      const embed = new EmbedBuilder()
        .setTitle(`3x3 Misto | R$ ${formatMoney(valor)}`)
        .setColor(CONFIG.CORES.FILA)
        .addFields(
          { name: "1 Emulador:", value: "Nenhum jogador na fila." },
          { name: "2 Emuladores:", value: "Nenhum jogador na fila." }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`1emu_${valor}`)
          .setLabel("1 Emulador")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`2emu_${valor}`)
          .setLabel("2 Emuladores")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`sair_${valor}`)
          .setLabel("Sair")
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await webhook.send({ 
        embeds: [embed], 
        components: [row],
        wait: true
      });
      
      saveFila1x1mob(msg.channel.id, msg.id, valor);
      
      this.startCollector(msg, message.client, valor, webhook);
    }
  },

  startCollector(msg, client, valor, webhook) {
    const fila = { 
      jogadores1emu: [],
      jogadores2emu: []
    };
    const collector = msg.createMessageComponentCollector({ time: 0, dispose: true });

    const cleanupListener = (deletedMsg) => {
      if (deletedMsg.id === msg.id) {
        collector.stop('message_deleted');
        deleteCollector(msg.id);
        client.removeListener('messageDelete', cleanupListener);
      }
    };
    client.on('messageDelete', cleanupListener);

    collector.on("collect", async interaction => {
      const userId = interaction.user.id;
      const id = interaction.customId;
      
      const lockKey = `${msg.id}_${id}_${userId}`;
      if (fila[`_lock_${lockKey}`]) return;
      fila[`_lock_${lockKey}`] = true;
      setTimeout(() => delete fila[`_lock_${lockKey}`], 2000);

      await interaction.deferUpdate().catch(() => {});

      if (id === `1emu_${valor}`) {
        if (isPlayerPunished(userId)) {
          delete fila[`_lock_${lockKey}`];
          return interaction.followUp({
            content: "Você está bloqueado por 10 minutos.",
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (fila.jogadores1emu.includes(userId)) {
          delete fila[`_lock_${lockKey}`];
          return interaction.followUp({
            content: "Você já está na fila de 1 Emulador!",
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        const mediadores = client.mediatorQueue || [];
        if (mediadores.length === 0) {
          delete fila[`_lock_${lockKey}`];
          return interaction.followUp({
            content: "Não há Nenhum mediador Disponível.",
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (fila.jogadores1emu.length < 2) {
          if (!canJoinQueue(userId)) {
            delete fila[`_lock_${lockKey}`];
            return interaction.followUp({
              content: "Você já está em três filas simultâneas.",
              flags: MessageFlags.Ephemeral
            }).catch(() => {});
          }
          fila.jogadores1emu.push(userId);
        }

        if (fila.jogadores1emu.length === 2) {
          const jogadores = [...fila.jogadores1emu];
          fila.jogadores1emu = [];

          const mediador = escolherMediador(mediadores);
          await criarThread(msg, jogadores, mediador, valor, client, "1emu");
        }
      }

      if (id === `2emu_${valor}`) {
        if (isPlayerPunished(userId)) {
          delete fila[`_lock_${lockKey}`];
          return interaction.followUp({
            content: "Você está bloqueado por 10 minutos.",
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (fila.jogadores2emu.includes(userId)) {
          delete fila[`_lock_${lockKey}`];
          return interaction.followUp({
            content: "Você já está na fila de 2 Emulador!",
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        const mediadores = client.mediatorQueue || [];
        if (mediadores.length === 0) {
          delete fila[`_lock_${lockKey}`];
          return interaction.followUp({
            content: "Não há Nenhum mediador Disponível.",
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }

        if (fila.jogadores2emu.length < 2) {
          if (!canJoinQueue(userId)) {
            delete fila[`_lock_${lockKey}`];
            return interaction.followUp({
              content: "Você já está em três filas simultâneas.",
              flags: MessageFlags.Ephemeral
            }).catch(() => {});
          }
          fila.jogadores2emu.push(userId);
        }

        if (fila.jogadores2emu.length === 2) {
          const jogadores = [...fila.jogadores2emu];
          fila.jogadores2emu = [];

          const mediador = escolherMediador(mediadores);
          await criarThread(msg, jogadores, mediador, valor, client, "2emu");
        }
      }

      if (id === `sair_${valor}`) {
        const index1 = fila.jogadores1emu.indexOf(userId);
        const index2 = fila.jogadores2emu.indexOf(userId);
        
        if (index1 === -1 && index2 === -1) {
          delete fila[`_lock_${lockKey}`];
          return interaction.followUp({
            content: "Você não está registrado nessa fila!",
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
        }
        
        if (index1 !== -1) fila.jogadores1emu.splice(index1, 1);
        if (index2 !== -1) fila.jogadores2emu.splice(index2, 1);
      }

      const vJogadores1emu = fila.jogadores1emu.length === 0 
        ? "Nenhum jogador na fila." 
        : fila.jogadores1emu.map(id => `<@${id}>`).join("\n");

      const vJogadores2emu = fila.jogadores2emu.length === 0 
        ? "Nenhum jogador na fila." 
        : fila.jogadores2emu.map(id => `<@${id}>`).join("\n");

      const newEmbed = new EmbedBuilder()
        .setTitle(`3x3 Misto | R$ ${formatMoney(valor)}`)
        .setColor(CONFIG.CORES.FILA)
        .addFields(
          { name: "1 Emulador:", value: vJogadores1emu },
          { name: "2 Emuladores:", value: vJogadores2emu }
        );

      await webhook.editMessage(msg.id, { embeds: [newEmbed], components: msg.components }).catch(() => {});
      delete fila[`_lock_${lockKey}`];
    });

    collector.on('end', () => {
      client.removeListener('messageDelete', cleanupListener);
    });
  }
};

// ============================================================================
// CRIAR THREAD
// ============================================================================

async function criarThread(msg, jogadores, mediador, valor, client, tipoFila) {
  let apostasId;
  try {
    const data = fs.readFileSync("apostas_config.json", "utf8");
    apostasId = JSON.parse(data).apostasChannel;
  } catch {}

  const canal = client.channels.cache.get(apostasId) || msg.channel;
  
  threadCounter++;
  saveThreadCounter(threadCounter);
  const idSequencial = String(threadCounter).padStart(2, '0');
  
  const thread = await canal.threads.create({
    name: `fila-${idSequencial}`,
    autoArchiveDuration: 60,
    type: ChannelType.PrivateThread
  });

  registerThread(thread.id, jogadores);
  thread.jogadores = jogadores;

  const mediadorData = getMediatorDataById(mediador.id);
  const mediadorFinal = {
    id: mediador.id,
    nome: mediadorData?.nome || mediador.nome || "Sem nome",
    pix: mediadorData?.pix || mediador.pix || "Sem chave",
    qrcode: mediadorData?.qrcode || mediador.qrcode || null
  };
  
  thread.mediadorId = mediadorFinal.id;
  thread.mediadorNome = mediadorFinal.nome;

  await thread.send(jogadores.map(id => `<@${id}>`).join(" "));

  const tipoTexto = tipoFila === "1emu" ? "1 Emulador" : "2 Emulador";
  
  const embed = new EmbedBuilder()
    .setTitle(`3x3 Misto - ${tipoTexto} | R$ ${formatMoney(valor)}`)
    .setColor(CONFIG.CORES.CONFIRMACAO)
    .addFields({ name: "Confirmados:", value: "Nenhum jogador confirmou ainda." });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("confirmar").setLabel("Confirmar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("cancelar").setLabel("Cancelar").setStyle(ButtonStyle.Danger)
  );

  const confirmMsg = await thread.send({ embeds: [embed], components: [row] });
  
  saveThreadConfirmacao(thread.id, confirmMsg.id, thread.id, jogadores[0], jogadores[1], mediadorFinal, "3x3misto", valor, jogadores);
  
  const confirmados = new Set();

  const collector = confirmMsg.createMessageComponentCollector({ time: 300000, dispose: true });

  const threadCleanup = (deletedThread) => {
    if (deletedThread.id === thread.id) {
      collector.stop('thread_deleted');
      deleteCollector(confirmMsg.id);
      client.removeListener('threadDelete', threadCleanup);
    }
  };
  client.on('threadDelete', threadCleanup);

  collector.on("collect", async i => {
    await i.deferUpdate().catch(() => {});

    if (i.customId === "cancelar") {
      const result = registerCancel(i.user.id);
      if (result.warning) {
        await i.followUp({
          content: "Mais um cancelamento e você será bloqueado!",
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
      clearThread(thread.id, jogadores);
      collector.stop('cancelled');
      deleteCollector(confirmMsg.id);
      await thread.delete().catch(() => {});
      return;
    }

    if (i.customId === "confirmar") {
      confirmados.add(i.user.id);

      const val = confirmados.size === 0 
        ? "Nenhum jogador confirmou ainda." 
        : [...confirmados].map(id => `<@${id}>`).join("\n");

      const upEmbed = new EmbedBuilder()
        .setTitle(`3x3 Misto - ${tipoTexto} | R$ ${formatMoney(valor)}`)
        .setColor(CONFIG.CORES.CONFIRMACAO)
        .addFields({ name: "Confirmados:", value: val });

      await safeEdit(confirmMsg, { embeds: [upEmbed], components: [row] });

      if (jogadores.every(j => confirmados.has(j))) {
        collector.stop('confirmed');
        deleteCollector(confirmMsg.id);
        await aguardarSala(thread, jogadores, mediadorFinal, valor, tipoTexto);
      }
    }
  });

  collector.on("end", (c, reason) => {
    client.removeListener('threadDelete', threadCleanup);
    
    if (reason === "time") {
      clearThread(thread.id, jogadores);
      deleteCollector(confirmMsg.id);
      thread.delete().catch(() => {});
    }
  });
}

// ============================================================================
// AGUARDAR SALA
// ============================================================================

export async function aguardarSala(thread, jogadores, mediador, valor, tipoTexto) {
  await thread.bulkDelete(100, true).catch(() => {});

  const valorComTaxa = valor + 0.5;

  const embed = new EmbedBuilder()
    .setTitle(`3x3 Misto - ${tipoTexto} | R$ ${formatMoney(valor)}`)
    .setColor(CONFIG.CORES.SALA)
    .addFields(
      { name: "Jogadores:", value: jogadores.map(id => `<@${id}>`).join(" vs ") },
      { name: "Mediador:", value: `<@${mediador.id}>` },
      { name: "Formato", value: `3x3 Misto` },
      { name: "Taxa de Inscrição:", value: `R$ 1,00` }
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Regras")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/channels/1449885105517629452/1449887845568348200"),
    new ButtonBuilder()
      .setCustomId("mostrarQr")
      .setLabel("QR Code")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("cancelarThread")
      .setLabel("Cancelar")
      .setStyle(ButtonStyle.Danger)
  );

  const finalMsg = await thread.send({ 
    content: `${jogadores.map(id => `<@${id}>`).join(" ")} <@${mediador.id}>`,
    embeds: [embed], 
    components: [row] 
  });

  saveThreadSala(thread.id, finalMsg.id, thread.id, mediador);

  await thread.send(`**Valor:**\n⤷ R$ ${formatMoney(valorComTaxa)}`);
  await thread.send("**CHAVE PIX:**");
  await thread.send(mediador.pix);

  const collector = finalMsg.createMessageComponentCollector({ time: 0, dispose: true });

  const threadCleanup = (deletedThread) => {
    if (deletedThread.id === thread.id) {
      collector.stop('thread_deleted');
      deleteCollector(finalMsg.id);
      thread.client.removeListener('threadDelete', threadCleanup);
    }
  };
  thread.client.on('threadDelete', threadCleanup);

  collector.on("collect", async i => {
    await i.deferUpdate().catch(() => {});

    if (i.customId === "mostrarQr") {
      if (!mediador.qrcode || mediador.qrcode === "Não Definido") {
        return i.followUp({
          content: "Nenhum QR Code cadastrado.",
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }

      const qrEmbed = new EmbedBuilder()
       .setTitle("QR Code:")
       .setColor(0xFFFFFF)
       .setImage(mediador.qrcode);

      await i.followUp({ 
        embeds: [qrEmbed], 
        flags: MessageFlags.Ephemeral 
      }).catch(() => {});
    }

    if (i.customId === "cancelarThread" && i.user.id === mediador.id) {
      clearThread(thread.id, jogadores);
      collector.stop('cancelled_by_mediator');
      deleteCollector(finalMsg.id);
      await thread.delete().catch(() => {});
    }
  });

  collector.on('end', () => {
    thread.client.removeListener('threadDelete', threadCleanup);
  });

  const msgCollector = thread.createMessageCollector({
    filter: m => m.author.id === mediador.id,
    time: 0
  });

  const msgThreadCleanup = (deletedThread) => {
    if (deletedThread.id === thread.id) {
      msgCollector.stop('thread_deleted');
      thread.client.removeListener('threadDelete', msgThreadCleanup);
    }
  };
  thread.client.on('threadDelete', msgThreadCleanup);

  msgCollector.on("collect", async m => {
    const parts = m.content.trim().split(/\s+/);
    if (parts.length < 2) return;

    const [idSala, senha] = parts;
    if (!/^\d{4,10}$/.test(idSala) || !/^\d{1,4}$/.test(senha)) return;

    registrarFilaMediada(mediador.id, mediador.nome, "3x3misto", thread.id);
    console.log(`[Faturamento] ${mediador.nome} mediou fila ${thread.name} - R$ 1,00`);

    const salaEmbed = new EmbedBuilder()
      .setTitle("Sala Criada")
      .setDescription(
        `Formato: 3x3 Misto - ${tipoTexto}\n` +
        `ID: ${idSala}\n` +
        `Senha: ${senha}\n` +
        `Pagar: R$ ${formatMoney(valor * 2)}\n` +
        `-# Apos vencer a partida, envie o historico do seu jogo!`
      )
      .setColor(CONFIG.CORES.SALA);

    const salaRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("copiar_id")
        .setLabel("Copiar ID")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("alterar_valor")
        .setLabel("Alterar Valor")
        .setStyle(ButtonStyle.Secondary)
    );

    const salaMsg = await thread.send({ 
      content: jogadores.map(id => `<@${id}>`).join(" "), 
      embeds: [salaEmbed],
      components: [salaRow]
    });

    await thread.setName(`pagar-${formatMoney(valor * 2)}`).catch(() => {});

    await operario.monitorarThread(thread, jogadores);

    const salaCollector = salaMsg.createMessageComponentCollector({ time: 0, dispose: true });

    const salaThreadCleanup = (deletedThread) => {
      if (deletedThread.id === thread.id) {
        salaCollector.stop('thread_deleted');
        thread.client.removeListener('threadDelete', salaThreadCleanup);
      }
    };
    thread.client.on('threadDelete', salaThreadCleanup);
    
    salaCollector.on("collect", async interaction => {
      if (interaction.customId === "copiar_id") {
        await interaction.reply({ content: idSala, ephemeral: true });
      }

      if (interaction.customId === "alterar_valor") {
        if (interaction.user.id !== mediador.id) {
          return interaction.reply({ 
            content: "Somente o mediador pode alterar o valor.", 
            ephemeral: true 
          });
        }

        const modal = new ModalBuilder()
          .setCustomId("modal_alterar_valor")
          .setTitle("Alterar Valor da Fila");

        const input = new TextInputBuilder()
          .setCustomId("novo_valor")
          .setLabel("Escreva abaixo o valor total da fila")
          .setStyle(TextInputStyle.Short);

        const modalRow = new ActionRowBuilder().addComponents(input);
        modal.addComponents(modalRow);

        await interaction.showModal(modal);
      }
    });

    salaCollector.on('end', () => {
      thread.client.removeListener('threadDelete', salaThreadCleanup);
    });

    const modalHandler = async (interaction) => {
      if (!interaction.isModalSubmit()) return;
      if (interaction.customId !== "modal_alterar_valor") return;
      if (interaction.channel?.id !== thread.id) return;

      let novoValor = interaction.fields.getTextInputValue("novo_valor").replace(".", ",");

      if (!novoValor.includes(",")) {
        novoValor = `${novoValor},00`;
      }

      const novoEmbed = EmbedBuilder.from(salaEmbed)
        .setDescription(
          `Formato: 3x3 Misto - ${tipoTexto}\n` +
          `ID: ${idSala}\n` +
          `Senha: ${senha}\n` +
          `Pagar: R$ ${novoValor}\n` +
          `-# Apos vencer a partida, envie o historico do seu jogo!`
        );

      await safeEdit(salaMsg, { embeds: [novoEmbed], components: [salaRow] });
      await interaction.reply({ 
        content: `Valor atualizado para R$ ${novoValor}`, 
        ephemeral: true 
      });

      await thread.setName(`pagar-${novoValor}`).catch(() => {});
    };

    thread.client.on("interactionCreate", modalHandler);

    const modalCleanup = (deletedThread) => {
      if (deletedThread.id === thread.id) {
        thread.client.removeListener('interactionCreate', modalHandler);
        thread.client.removeListener('threadDelete', modalCleanup);
      }
    };
    thread.client.on('threadDelete', modalCleanup);

    msgCollector.stop('room_created');
  });

  msgCollector.on('end', () => {
    thread.client.removeListener('threadDelete', msgThreadCleanup);
  });
}