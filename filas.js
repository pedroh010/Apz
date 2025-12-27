// ============================================================================
// commands/player/filas.js
// Mostra todas as filas ativas de um usuário
// ============================================================================

import { EmbedBuilder } from "discord.js";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const COR_EMBED = 0xFFFFFF; // Branco

// ============================================================================
// FUNÇÃO PARA BUSCAR FILAS ATIVAS
// ============================================================================

function buscarFilasDoUsuario(client, userId) {
  const filasEncontradas = [];
  
  // Percorrer todos os canais do servidor
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.forEach(channel => {
      // Verificar threads no canal
      if (channel.threads) {
        channel.threads.cache.forEach(thread => {
          // Verificar se o usuário está nos jogadores da thread
          if (thread.jogadores && thread.jogadores.includes(userId)) {
            filasEncontradas.push({
              id: thread.id,
              nome: thread.name,
              url: thread.url,
              canal: channel.name,
              guildId: guild.id
            });
          }
        });
      }
    });
  });

  return filasEncontradas;
}

// ============================================================================
// FORMATAR INFORMAÇÕES DAS FILAS
// ============================================================================

function formatarFilas(filas) {
  if (filas.length === 0) {
    return "Nenhuma fila ativa no momento.";
  }

  let lista = "";
  
  filas.forEach((fila, index) => {
    const numero = `${index + 1}`.padStart(2, '0');
    // Extrair valor do nome da thread (ex: "pagar-10,00" ou "fila-31764")
    const nome = fila.nome;
    
    lista += `**${numero}.** [${nome}](${fila.url})\n`;
  });

  return lista;
}

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "filas",
  description: "Mostra todas as filas ativas de um usuário",

  async execute(message, args) {
    // Verificar se foi mencionado um usuário
    let targetUser = message.mentions.users.first();
    
    // Se não mencionou ninguém, usar o autor do comando
    if (!targetUser) {
      targetUser = message.author;
    }

    // Buscar filas do usuário
    const filas = buscarFilasDoUsuario(message.client, targetUser.id);

    // Contar total de filas
    const totalFilas = filas.length;

    // Criar embed
    const embed = new EmbedBuilder()
      .setTitle(`Filas de @${targetUser.username}`)
      .setDescription(
        `Abaixo encontram-se as filas que o ${totalFilas === 0 ? "usuário" : "usuário"} está gerenciando.\n\n` +
        `**${totalFilas} fila${totalFilas !== 1 ? 's' : ''} aberta${totalFilas !== 1 ? 's' : ''} no momento**\n` +
        formatarFilas(filas) +
        `\n\`\`\`Data: ${new Date().toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}\`\`\``
      )
      .setColor(COR_EMBED)
      .setThumbnail(targetUser.displayAvatarURL({ extension: 'png', size: 256 }))
      .setFooter({ 
        text: `Solicitado por ${message.author.username}`,
        iconURL: message.author.displayAvatarURL({ extension: 'png' })
      });

    await message.reply({ embeds: [embed] });
  }
};