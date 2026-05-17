async function parseJson(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? `AI request failed: ${response.status}`);
  }

  return payload;
}

export async function getAIStatus() {
  const response = await fetch("/api/ai/status");
  return parseJson(response);
}

export async function requestAIMove(state, difficulty) {
  const response = await fetch("/api/ai/move", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state,
      difficulty,
    }),
  });

  return parseJson(response);
}
