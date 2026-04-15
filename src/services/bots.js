export function getBotVariants() {
  const raw = process.env.BOT_VARIANTS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed
          .filter((b) => b.slug && b.clientId)
          .map((b) => ({
            slug: String(b.slug),
            name: String(b.name || b.slug),
            clientId: String(b.clientId),
            permissions: String(b.permissions || process.env.DISCORD_BOT_INVITE_PERMISSIONS || '8')
          }));
      }
    } catch {
      // fallback below
    }
  }

  return [{
    slug: 'default',
    name: process.env.BOT_DISPLAY_NAME || 'Elite Discord Suite',
    clientId: process.env.DISCORD_CLIENT_ID,
    permissions: process.env.DISCORD_BOT_INVITE_PERMISSIONS || '8'
  }];
}

export function getBotVariantBySlug(slug) {
  return getBotVariants().find((b) => b.slug === slug) || getBotVariants()[0];
}
