export async function handleTicketButton() {
  return false;
}

export function getTicketButtonIds() {
  return { OPEN_ID: 'tickets:open', CLAIM_ID: 'tickets:claim', CLOSE_ID: 'tickets:close' };
}
