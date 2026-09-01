export const WP_API_BASE = "https://cenfolic.com/wordpress/wp-json/wp/v2";

const FETCH_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface JSONResponse<T> {
  data: T;
  headers: Headers;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getRetryDelay(response: Response | undefined, attempt: number): number {
  const retryAfter = response?.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;

  if (Number.isFinite(retryAfterSeconds)) {
    return Math.min(retryAfterSeconds * 1_000, 15_000);
  }

  const exponentialDelay = 1_000 * 2 ** (attempt - 1);
  return exponentialDelay + Math.floor(Math.random() * 250);
}

async function fetchJSONResponse<T>(path: string): Promise<JSONResponse<T>> {
  const url = `${WP_API_BASE}${path}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response | undefined;

    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (response.ok) {
        return {
          data: (await response.json()) as T,
          headers: response.headers,
        };
      }

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === MAX_ATTEMPTS) {
        throw new Error(
          `Failed to fetch ${path}: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      const isRetryableResponse =
        response !== undefined && RETRYABLE_STATUS_CODES.has(response.status);
      // A 2xx response can still fail while its JSON body is being streamed.
      const isNetworkError = response === undefined || response.ok;

      if (isLastAttempt || (!isRetryableResponse && !isNetworkError)) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to fetch ${path} after ${attempt} attempt(s): ${message}`,
          { cause: error },
        );
      }
    } finally {
      clearTimeout(timeout);
    }

    const delay = getRetryDelay(response, attempt);
    console.warn(
      `[WordPress] Request failed for ${path} (attempt ${attempt}/${MAX_ATTEMPTS}); retrying in ${delay}ms`,
    );
    await response?.body?.cancel().catch(() => undefined);
    await sleep(delay);
  }

  throw new Error(`Failed to fetch ${path}`);
}

async function fetchJSON<T>(path: string): Promise<T> {
  return (await fetchJSONResponse<T>(path)).data;
}

export { fetchJSON, fetchJSONResponse };
