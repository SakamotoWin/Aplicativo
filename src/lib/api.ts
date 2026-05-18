// Tentando o servidor novo novamente, pois o Heroku deu Failed to Fetch.
const API_BASE = "https://server.pixmachineapp.com.br";

export type LoginTipo = "cliente" | "pessoa";

export function getToken(): string | null {
  const token = localStorage.getItem("token");
  console.log("[TOKEN] Recuperado do localStorage:", token ? `${token.slice(0, 24)}...` : "NULO/VAZIO");
  return token;
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
  console.log("[TOKEN] Salvo no localStorage:", token ? `${token.slice(0, 24)}...` : "VAZIO");
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_tipo");
  localStorage.removeItem("userType");
  localStorage.removeItem("userId");
}

export function getAuthTipo(): LoginTipo | null {
  const tipo = localStorage.getItem("auth_tipo");
  if (tipo === "cliente" || tipo === "pessoa") return tipo;
  return null;
}

export function setAuthTipo(tipo: LoginTipo) {
  localStorage.setItem("auth_tipo", tipo);
}

export function getUser(): { email: string; name: string; tipo?: LoginTipo } | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user: { email: string; name: string; tipo?: LoginTipo }) {
  localStorage.setItem("user", JSON.stringify(user));
}

interface LoginPayload {
  email: string;
  senha: string;
}

interface LoginResponse {
  token?: string;
  email?: string;
  name?: string;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

async function parseResponse(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

async function doLogin(path: "/login-cliente" | "/login-pessoa", payload: LoginPayload) {
  const url = `${API_BASE}${path}`;
  console.log("[AUTH] POST", url);
  console.log("[AUTH] Body:", { email: payload.email, senha: "***" });

  console.log("[AUTH] Tentando login em:", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(err => {
    console.error("[AUTH] Erro de rede:", err);
    throw new Error("Não foi possível conectar ao servidor. Verifique sua internet ou a URL da API.");
  });

  const data = (await parseResponse(res)) as LoginResponse;
  console.log("[AUTH] Response status:", res.status);
  console.log("[AUTH] Response body:", data);

  if (!res.ok) {
    throw new Error(data?.error || data?.message || "Erro ao fazer login");
  }

  if (!data?.token || typeof data.token !== "string") {
    throw new Error("Token JWT inválido ou ausente na resposta do login.");
  }

  // Salvar informações importantes do retorno do novo servidor
  if (data.id) localStorage.setItem("userId", String(data.id));
  // O servidor retorna 'key' como 'ADMIN' ou 'CLIENT'. O app usa 'userType' para controle.
  if (data.key) localStorage.setItem("userType", String(data.key));
  // Também salvar o tipo original
  if (data.type) localStorage.setItem("auth_tipo_original", String(data.type));

  return data;
}

export async function loginCliente(payload: LoginPayload) {
  return doLogin("/login-cliente", payload);
}

export async function loginPessoa(payload: LoginPayload) {
  return doLogin("/login-pessoa", payload);
}

export function getUserType(): string | null {
  return localStorage.getItem("userType");
}

export function getUserId(): string | null {
  return localStorage.getItem("userId");
}

export function isAdmin(): boolean {
  return getUserType() === "ADMIN";
}



export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE}${path}`;

  console.log("[API] URL:", url);
  console.log("[API] Token:", token ? `${token.slice(0, 24)}...` : "MISSING");
  console.log("[API] User Type:", getUserType());
  console.log("[API] User ID:", getUserId());

  if (!token || token.trim().length === 0) {
    throw new Error("Token não encontrado. Faça login novamente.");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-access-token": token,
    "Authorization": `Bearer ${token}`,
    ...options.headers,
  };

  let res = await fetch(url, {
    ...options,
    headers,
  });

  let rawData = await parseResponse(res);
  console.log("[API] Status:", res.status);
  console.log("[API] Response:", rawData);
  
  // Log detalhado da resposta para debug
  if (!res.ok) {
    console.error("[API] Erro completo:", {
      status: res.status,
      statusText: res.statusText,
      responseBody: rawData,
      url: url,
      headers: Object.fromEntries(res.headers.entries()),
    });
  }

  if (!res.ok) {
    const errorMessage =
      typeof rawData === "object" && rawData !== null
        ? ((rawData as { error?: string; message?: string }).error ||
           (rawData as { error?: string; message?: string }).message)
        : undefined;

    if (res.status === 401) {
      console.error("[401 ERROR] Token inválido!", {
        token: token ? `${token.slice(0, 24)}...` : "NULO",
        url,
        errorMessage,
      });
      // Limpa o token para forçar re-login se for erro de autenticação real
      if (errorMessage?.toLowerCase().includes("token") || errorMessage?.toLowerCase().includes("expirado")) {
        clearToken();
      }
      throw new Error(errorMessage || "Sessão expirada ou sem permissão. Por favor, faça login novamente.");
    }

    const fullUrl = `${API_BASE}${path}`;
    throw new Error(errorMessage || `Erro ${res.status} em ${path} (URL: ${fullUrl})`);
  }

  return rawData as T;
}

export async function apiFetchFirst<T = unknown>(paths: string[], options: RequestInit = {}): Promise<T> {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      return await apiFetch<T>(path, options);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Erro desconhecido");
      lastError = err;
      console.warn(`[API] Falha em ${path}:`, err.message);
    }
  }

  throw lastError ?? new Error("Nenhuma rota disponível para esta requisição.");
}
