import { sendGuildLog } from '../../services/logger.js';

export async function onMessageDelete(message) {
  if (!message.guild || message.author?.bot) return;

  const authorTag = message.author?.tag || 'Unknown user';
  const content = message.content?.trim() || '[No cached content or attachment-only message]';

  await sendGuildLog({
    guild: message.guild,
    eventType: 'message_delete',
    title: 'Message Deleted',
    description: `A message from **${authorTag}** was deleted in <#${message.channelId}>.`,
    color: '#E67E22',
    fields: [{ name: 'Content', value: content.slice(0, 1024) }]
  });
}
