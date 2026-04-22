const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function getConfiguredChannelIds() {
  return String(process.env.BIRD_ID_CHANNEL_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getModelName() {
  return process.env.BIRD_ID_MODEL || 'chriamue/bird-species-classifier';
}

function getScoreThreshold() {
  const parsed = Number(process.env.BIRD_ID_MIN_SCORE || 0.4);
  return Number.isFinite(parsed) ? parsed : 0.4;
}

export function isBirdIdEnabledForChannel(channelId) {
  if (!channelId) return false;
  const configured = getConfiguredChannelIds();
  return configured.length > 0 && configured.includes(channelId);
}

export function findImageAttachment(message) {
  if (!message?.attachments?.size) return null;

  return (
    message.attachments.find((attachment) => {
      if (SUPPORTED_IMAGE_TYPES.has(attachment.contentType)) return true;
      return /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(attachment.name || '');
    }) || null
  );
}

async function fetchImageBuffer(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function identifyBirdFromImage(imageUrl) {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    return {
      ok: false,
      reason: 'missing_token',
      message: 'Set HUGGINGFACE_API_TOKEN to enable bird identification.'
    };
  }

  const model = getModelName();
  const imageData = await fetchImageBuffer(imageUrl);

  const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream'
    },
    body: imageData
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      ok: false,
      reason: 'api_error',
      message: `Bird classifier request failed (HTTP ${response.status}). ${details.slice(0, 200)}`
    };
  }

  const predictions = await response.json();
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return {
      ok: false,
      reason: 'no_prediction',
      message: 'No predictions were returned for this image.'
    };
  }

  const topPrediction = predictions[0];
  if (!topPrediction?.label || typeof topPrediction?.score !== 'number') {
    return {
      ok: false,
      reason: 'unexpected_shape',
      message: 'Classifier response had an unexpected format.'
    };
  }

  const threshold = getScoreThreshold();
  if (topPrediction.score < threshold) {
    return {
      ok: false,
      reason: 'low_confidence',
      message: `I am not confident this is a bird species match (confidence ${(topPrediction.score * 100).toFixed(1)}%).`
    };
  }

  return {
    ok: true,
    species: topPrediction.label,
    confidence: topPrediction.score
  };
}
