import { EmbedBuilder } from 'discord.js';

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

export const pollCommand = {
  data: {
    name: 'poll',
    description: 'Create a quick reaction poll',
    options: [
      { name: 'question', description: 'Poll question', type: 3, required: true },
      { name: 'option_1', description: 'First option', type: 3, required: true },
      { name: 'option_2', description: 'Second option', type: 3, required: true },
      { name: 'option_3', description: 'Third option', type: 3, required: false },
      { name: 'option_4', description: 'Fourth option', type: 3, required: false },
      { name: 'option_5', description: 'Fifth option', type: 3, required: false }
    ]
  },
  async execute(interaction) {
    if (!interaction.memberPermissions?.has('ManageGuild')) {
      await interaction.reply({ content: 'You need Manage Server permission.', ephemeral: true });
      return;
    }

    const question = interaction.options.getString('question', true);
    const options = [1, 2, 3, 4, 5]
      .map((index) => interaction.options.getString(`option_${index}`))
      .filter(Boolean);

    if (options.length < 2) {
      await interaction.reply({ content: 'A poll needs at least 2 options.', ephemeral: true });
      return;
    }

    const description = options.map((option, index) => `${NUMBER_EMOJIS[index]} ${option}`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 New Poll')
      .setDescription(`**${question}**\n\n${description}`)
      .setFooter({ text: `Started by ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], fetchReply: true });
    const pollMessage = await interaction.fetchReply();

    for (let i = 0; i < options.length; i += 1) {
      await pollMessage.react(NUMBER_EMOJIS[i]).catch(() => null);
    }
  }
};
