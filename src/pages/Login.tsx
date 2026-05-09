import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Mail, Lock, Eye, EyeOff, Instagram } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<"cliente" | "pessoa">("cliente");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passVisible, setPassVisible] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, senha, tipo);
      navigate("/dashboard");
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : "Erro ao fazer login";
      const message =
        tipo === "pessoa" && rawMessage.toLowerCase().includes("invalid")
          ? "Credenciais de admin inválidas."
          : rawMessage;

      setError(message);
      console.error("[Login] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page bg-[#0a0a0a] min-h-screen text-white font-['Rajdhani']">
      <div id="particles" className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Partículas seriam renderizadas aqui se tivéssemos o script, 
            mas no React podemos simular ou usar CSS puro */}
      </div>

      <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-5 md:px-10 py-4 bg-gradient-to-b from-black/95 to-transparent backdrop-blur-[4px]">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="PIX Machine" className="w-10 h-10 object-contain drop-shadow-[0_0_6px_rgba(245,166,35,0.5)]" />
          <span className="hidden md:block font-['Orbitron'] text-lg font-bold text-[#f5a623] tracking-[2px] uppercase">PIX Machine</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <a href="https://www.instagram.com/pix.machine" target="_blank" rel="noreferrer" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-[#2a2a2a] hover:border-[#e1306c] hover:text-[#e1306c] hover:bg-[#e1306c1a] transition-all">
              <Instagram size={16} />
            </a>
            <a href="https://wa.me/5562992388625" target="_blank" rel="noreferrer" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-[#2a2a2a] hover:border-[#25d366] hover:text-[#25d366] hover:bg-[#25d3661a] transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </a>
          </div>
          <button onClick={() => navigate("/")} className="px-5 py-2 border-[1.5px] border-[#f5a623] text-[#f5a623] rounded-md font-bold text-sm tracking-widest uppercase hover:bg-[#f5a623] hover:text-black transition-all shadow-[0_0_20px_rgba(245,166,35,0.4)]">
            Voltar
          </button>
        </div>
      </nav>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-28 text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(245,166,35,0.11)_0%,transparent_70%)] pointer-events-none"></div>
        
        <div className="relative mb-6 animate-fade-in-down">
          <img src="/logo.png" alt="PIX Machine Logo" className="w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(245,166,35,0.7)] animate-pulse" />
        </div>
        
        <h1 className="font-['Orbitron'] text-3xl md:text-5xl font-black text-[#f5a623] tracking-[6px] uppercase mb-8 drop-shadow-[0_0_40px_rgba(245,166,35,0.35)] animate-fade-in-down">
          PIX MACHINE
        </h1>

        <div className="bg-[#161616] border border-[#2a2a2a] rounded-[18px] p-8 w-full max-w-[430px] shadow-[0_0_60px_rgba(245,166,35,0.07),0_20px_60px_rgba(0,0,0,0.6)] relative overflow-hidden animate-fade-in-up">
          <div className="absolute top-0 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-transparent via-[#f5a623] to-transparent"></div>
          
          <div className="grid grid-cols-2 bg-[#111] rounded-xl p-1 mb-6 border border-[#2a2a2a]">
            <button 
              onClick={() => setTipo("cliente")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm tracking-widest transition-all ${tipo === "cliente" ? "bg-[#f5a623] text-black shadow-[0_0_16px_rgba(245,166,35,0.4)]" : "text-[#888]"}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
              Cliente
            </button>
            <button 
              onClick={() => setTipo("pessoa")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm tracking-widest transition-all ${tipo === "pessoa" ? "bg-[#f5a623] text-black shadow-[0_0_16px_rgba(245,166,35,0.4)]" : "text-[#888]"}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
              Admin
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/35 rounded-lg p-3 mb-4 text-[#ff6b6b] text-sm font-semibold text-left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-left">
              <label className="block text-[10px] font-bold tracking-[2px] text-[#888] uppercase mb-2">E-mail</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 text-[#888]" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com" 
                  required
                  className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-[#f5a623] focus:shadow-[0_0_12px_rgba(245,166,35,0.2)] transition-all"
                />
              </div>
            </div>

            <div className="text-left">
              <label className="block text-[10px] font-bold tracking-[2px] text-[#888] uppercase mb-2">Senha</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 text-[#888]" size={18} />
                <input 
                  type={passVisible ? "text" : "password"} 
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••" 
                  required
                  className="w-full bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl py-3 pl-11 pr-11 text-white outline-none focus:border-[#f5a623] focus:shadow-[0_0_12px_rgba(245,166,35,0.2)] transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setPassVisible(!passVisible)}
                  className="absolute right-3.5 text-[#888] hover:text-[#f5a623] transition-colors"
                >
                  {passVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-br from-[#b87a00] via-[#f5a623] to-[#ffd166] border-none rounded-xl text-black font-['Orbitron'] text-xs font-bold tracking-[2px] uppercase mt-2 hover:shadow-[0_0_30px_rgba(245,166,35,0.6)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  Entrando...
                </div>
              ) : (
                `Entrar como ${tipo === "cliente" ? "Cliente" : "Admin"}`
              )}
            </button>
          </form>

          <p className="mt-4 text-[13px] text-[#888]">
            Esqueceu a senha? <a href="#" className="text-[#f5a623] hover:underline">Recuperar acesso</a>
          </p>
        </div>

        <div className="mt-9 animate-fade-in-up">
          <p className="text-[11px] tracking-[3px] text-[#888] uppercase mb-4">Contate o suporte</p>
          <div className="flex items-center justify-center gap-4">
            <a href="https://www.instagram.com/pix.machine" target="_blank" rel="noreferrer" className="w-12 h-12 flex items-center justify-center rounded-full border-[1.5px] border-[#e1306c] text-[#e1306c] bg-[#e1306c0f] hover:bg-[#e1306c2e] hover:shadow-[0_0_18px_rgba(225,48,108,0.4)] hover:-translate-y-1 hover:scale-[1.08] transition-all">
              <Instagram size={22} />
            </a>
            <a href="https://wa.me/5562992388625" target="_blank" rel="noreferrer" className="w-12 h-12 flex items-center justify-center rounded-full border-[1.5px] border-[#25d366] text-[#25d366] bg-[#25d3660f] hover:bg-[#25d3662e] hover:shadow-[0_0_18px_rgba(37,211,102,0.4)] hover:-translate-y-1 hover:scale-[1.08] transition-all">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </a>
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center py-6 border-t border-[#2a2a2a] text-[#444] text-[11px] tracking-[1px] mt-5">
        &copy; 2026 <span className="text-[#f5a623]">PIX Machine</span>. Todos os direitos reservados.
      </footer>
    </div>
  );
}
