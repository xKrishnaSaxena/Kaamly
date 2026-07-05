const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
      if (Array.isArray(detail)) detail = detail.map((d) => d.msg).join(', ')
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  health: () => req('/health'),

  // worker
  goOnline: (body) => req('/api/workers', { method: 'POST', body: JSON.stringify(body) }),
  setAvailability: (userId, body) =>
    req(`/api/workers/${userId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),
  jobsNearby: (lat, lng, radius = 5000, category) =>
    req(
      `/api/jobs/nearby?lat=${lat}&lng=${lng}&radius_m=${radius}` +
        (category ? `&category=${category}` : '')
    ),
  acceptJob: (jobId, workerPhone) =>
    req(`/api/jobs/${jobId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ worker_phone: workerPhone })
    }),

  // consumer
  postJob: (body) => req('/api/jobs', { method: 'POST', body: JSON.stringify(body) }),
  jobMatches: (jobId, radius = 3000) =>
    req(`/api/jobs/${jobId}/matches?radius_m=${radius}`),

  // voice
  voiceConfig: () => req('/api/voice/config'),
  parseTranscript: (transcript, roleHint) =>
    req('/api/voice/parse', {
      method: 'POST',
      body: JSON.stringify({ transcript, role_hint: roleHint })
    }),
  transcribe: async (blob) => {
    const fd = new FormData()
    fd.append('file', blob, 'audio.webm')
    const res = await fetch(BASE + '/api/voice/transcribe', { method: 'POST', body: fd })
    if (!res.ok) {
      let detail = res.statusText
      try {
        detail = (await res.json()).detail || detail
      } catch {
        /* ignore */
      }
      throw new Error(detail)
    }
    return res.json()
  }
}
