

export const WP_API_BASE = "https://cenfolic.com/wordpress/wp-json/wp/v2";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${WP_API_BASE}${path}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}


export { fetchJSON }
