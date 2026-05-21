// Tentando o servidor novo novamente, pois o Heroku deu Failed to Fetch.
const API_BASE = "https://server.pixmachineapp.com.br";

// ID Master do Administrador no Servidor
const ADMIN_MASTER_ID = "dcfe1380-80d2-4652-aca0-e0accdf05f90";

export type LoginTipo = "cliente" | "pessoa";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("auth_tipo");
  localStorage.removeItem("userType");
  localStorage.removeItem("userId");
  localStorage.removeItem("auth_tipo_original");
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
  id?: string;
  key?: string;
  type?: string;
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

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(err => {
    console.error("[AUTH] Erro de rede:", err);
    throw new Error("Não foi possível conectar ao servidor. Verifique sua internet ou a URL da API.");
  });

  const data = (await parseResponse(res)) as LoginResponse;
  
  if (!res.ok) {
    throw new Error(data?.error || data?.message || "Erro ao fazer login");
  }

  if (!data?.token || typeof data.token !== "string") {
    throw new Error("Token JWT inválido ou ausente na resposta do login.");
  }

  // Salvar informações importantes
  if (data.id) {
    localStorage.setItem("userId", String(data.id));
  }
  
  // O servidor retorna 'key' como 'ADMIN' ou 'CLIENT'.
  if (data.key) {
    localStorage.setItem("userType", String(data.key));
  } else if (path === "/login-pessoa") {
    localStorage.setItem("userType", "ADMIN");
  } else {
    localStorage.setItem("userType", "CLIENT");
  }

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

export function isAdmin(): boolean {
  const type = getUserType();
  const authTipo = getAuthTipo();
  // Se o login foi via /login-pessoa ou a key retornada foi ADMIN
  return type === "ADMIN" || authTipo === "pessoa";
}

export function getUserId(): string | null {
  const localId = localStorage.getItem("userId");
  // Se for admin, priorizamos o ADMIN_MASTER_ID para estatísticas globais,
  // mas se ele não existir, usamos o ID do usuário logado.
  if (isAdmin()) {
    return ADMIN_MASTER_ID || localId;
  }
  return localId;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE}${path}`;
  console.log(`[API] Chamando: ${url}`);

  if (!token || token.trim().length === 0) {
    console.error("[API] Erro: Token não encontrado.");
    throw new Error("Token não encontrado. Faça login novamente.");
  }

  // Se o usuário é admin (pessoa), o servidor valida o token com JWT_SECRET_PESSOA.
  // Se é cliente, usa JWT_SECRET. 
  // O aplicativo envia o token no header x-access-token e Authorization.
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
  
  if (!res.ok) {
    const errorMessage =
      typeof rawData === "object" && rawData !== null
        ? ((rawData as { error?: string; message?: string }).error ||
           (rawData as { error?: string; message?: string }).message)
        : undefined;

    if (res.status === 401) {
      // Se der 401, tentamos limpar os dados para forçar novo login, mas apenas se for erro de token mesmo
      if (errorMessage?.toLowerCase().includes("token")) {
         // clearToken(); // Descomentar se quiser forçar logout em erro de token
      }
      throw new Error(errorMessage || "Sessão expirada ou sem permissão. Por favor, faça login novamente.");
    }

    throw new Error(errorMessage || `Erro ${res.status} em ${path}`);
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
