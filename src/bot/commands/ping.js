export const pingCommand = {
  data: {
    name: 'ping',
    description: 'Check bot latency'
  },
  async execute(interaction) {
    await interaction.reply(`Pong! API latency: ${interaction.client.ws.ping}ms`);
  }
};
