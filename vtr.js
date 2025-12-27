// ============================================================================
// 📁 src/commands/mediator/vtr.js
// Remover vitória de um jogador (SEM PONTOS)
// ============================================================================

import fs from "fs";
import operario from "../../systems/operario.js";
import { CONFIG } from "../../utils/constants.js";

function getMediatorRole(client) {
  if (client.mediatorRole) return client.mediatorRole;
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG.ARQUIVOS.MEDIADOR_CONFIG, "utf8"));
    return data.mediatorRole;
  } catch {
    return null;
  }
}

export default {
  name: "vtr",
  description: "Remover vitória de um jogador (SEM PONTOS - SÓ VITÓRIAS)",

  async execute(message, args) {
    const mediatorRole = getMediatorRole(message.client);
    
    if (!mediatorRole || !message.member.roles.cache.has(mediatorRole)) {
      return message.reply("❌ Apenas mediadores podem usar este comando.");
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply("❌ Você precisa mencionar um jogador.\n**Exemplo:** `!vtr @jogador`");
    }

    // Carregar ranking
    const ranking = operario.carregarRanking();
    
    if (!ranking[user.id] || ranking[user.id].vitorias <= 0) {
      return message.reply(`⚠️ <@${user.id}> não possui vitórias para remover.`);
    }

    // Remover 1 vitória (SEM MEXER EM PONTOS)
    ranking[user.id].vitorias--;
    
    // Se tinha pontos no JSON antigo, remove também (limpeza)
    if (ranking[user.id].pontos !== undefined) {
      delete ranking[user.id].pontos;
    }
    
    await operario.salvarRanking(ranking);

    const vitoriasRestantes = ranking[user.id].vitorias;

    const reply = await message.reply(
      `✅ Vitória removida com sucesso!\n` +
      `<@${user.id}> agora tem **${vitoriasRestantes} vitórias**.`
    );

    // Auto-delete após 5 segundos
    setTimeout(async () => {
      try { 
        await reply.delete(); 
      } catch {}
      try { 
        await message.delete(); 
      } catch {}
    }, 5000);
  }
};