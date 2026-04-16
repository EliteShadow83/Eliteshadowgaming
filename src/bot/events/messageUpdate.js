import { sendGuildLog } from '../../services/logger.js';

export async function onMessageUpdate(oldMessage, newMessage) {
  const guild = newMessage.guild || oldMessage.guild;
  if (!guild || newMessage.author?.bot) return;

  const before = oldMessage.content?.trim() || '[No cached content]';
  const after = newMessage.content?.trim() || '[No cached content]';
  if (before === after) return;

  await sendGuildLog({
    guild,
    eventType: 'message_edit',
    title: 'Message Edited',
    description: `A message from **${newMessage.author?.tag || 'Unknown user'}** was edited in <#${newMessage.channelId || oldMessage.channelId}>.`,
    color: '#3498DB',
    fields: [
      { name: 'Before', value: before.slice(0, 1024) },
      { name: 'After', value: after.slice(0, 1024) }
    ]
  });
}
