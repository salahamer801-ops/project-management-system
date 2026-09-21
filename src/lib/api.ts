const TOKEN_KEY = "pms_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ success: boolean; message: string; data: T; pagination?: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.", null);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { success: false, message: "استجابة غير صالحة من الخادم." };
  }

  if (!res.ok || data.success === false) {
    throw new ApiError(res.status, data.message || "حدث خطأ غير متوقع.", data);
  }
  return data;
}
