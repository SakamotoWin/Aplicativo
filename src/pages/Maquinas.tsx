import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, isAdmin } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Cpu, MapPin, Wifi, WifiOff, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";

interface Maquina {
  id: string;
  nome?: string;
  descricao?: string;
  localizacao?: string;
  ultimoPagamentoRecebido?: string | null;
  ultimaRequisicao?: string | null;
  maquininha_serial?: string;
  store_id?: string;
  estabelecimentoNome?: string;
}

interface ClienteResponse {
  id: string;
  nome: string;
  Maquina: Maquina[];
}

export default function Maquinas() {
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newLocal, setNewLocal] = useState("");
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  const loadMaquinas = async () => {
    try {
      if (isAdmin()) {
        const clientes = await apiFetch<ClienteResponse[]>("/clientes");
        setMaquinas(clientes.flatMap((c) => 
          (c.Maquina || []).map(m => ({ ...m, estabelecimentoNome: c.nome }))
        ));
      } else {
        // O servidor usa /maquina no singular conforme maquinaRoutes
        const list = await apiFetch<Maquina[]>("/maquina");
        setMaquinas(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar máquinas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadMaquinas(); }, []);

  const handleAdd = async () => {
    if (!newNome.trim()) return;
    setAdding(true);
    try {
      await apiFetch("/maquina-adm", {
        method: "POST",
        body: JSON.stringify({ nome: newNome, local: newLocal, status: "ativo" }),
      });
      setShowAdd(false);
      setNewNome("");
      setNewLocal("");
      await loadMaquinas();
    } catch (err) {
      console.error("[Maquinas] Erro ao adicionar:", err);
    } finally {
      setAdding(false);
    }
  };

  // Check if machine is online (had activity in the last 5 minutes)
  const isOnline = (m: Maquina): boolean => {
    if (!m.ultimaRequisicao && !m.ultimoPagamentoRecebido) return false;
    const lastActivity = m.ultimaRequisicao || m.ultimoPagamentoRecebido;
    if (!lastActivity) return false;
    const diff = Date.now() - new Date(lastActivity).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  if (loading) return <LoadingSpinner text="Carregando máquinas..." />;
  if (error) return <div className="rounded-2xl bg-destructive/10 p-6 text-center text-sm text-destructive">{error}</div>;

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-wider text-primary">Máquinas</h2>
        {isAdmin() && (
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1 text-xs shadow-gold">
                <Plus className="h-3.5 w-3.5" /> Nova
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-primary/20">
              <DialogHeader>
                <DialogTitle className="text-primary font-display tracking-wider">Nova Máquina</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Nome</label>
                  <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} placeholder="Ex: Dreams 11" className="bg-secondary border-primary/20" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Local</label>
                  <Input value={newLocal} onChange={(e) => setNewLocal(e.target.value)} placeholder="Ex: Bar do João" className="bg-secondary border-primary/20" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost" size="sm">Cancelar</Button>
                </DialogClose>
                <Button size="sm" onClick={handleAdd} disabled={adding || !newNome.trim()} className="shadow-gold">
                  {adding ? "Salvando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {maquinas.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Cpu className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma máquina encontrada</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {maquinas.map((m, i) => {
            const online = isOnline(m);
            return (
              <button
                key={m.id || i}
                onClick={() => navigate(`/maquina/${m.id}`)}
                className="group w-full rounded-2xl border border-primary/10 bg-card p-4 shadow-card text-left transition-all active:scale-[0.98] hover:border-primary/30 hover:shadow-gold"
              >
                <div className="flex items-start gap-3">
                  {/* Machine icon */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                    <span className="text-2xl">🧸</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-sm font-bold tracking-wide text-foreground truncate">
                      {m.estabelecimentoNome || m.nome || `Máquina ${i + 1}`}
                    </h3>

                    {(m.descricao || m.localizacao) && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 text-primary/60" />
                        {m.descricao || m.localizacao}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-3">
                      {m.maquininha_serial && (
                        <span className="text-[10px] text-muted-foreground">
                          MP: {m.maquininha_serial}
                        </span>
                      )}
                      {m.store_id && (
                        <span className="text-[10px] text-muted-foreground">
                          PAG: {m.store_id}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status + wifi */}
                  <div className="flex flex-col items-end gap-1.5">
                    {online ? (
                      <div className="flex items-center gap-1.5">
                        <Wifi className="h-4 w-4 text-success drop-shadow-[0_0_4px_hsl(140,60%,45%,0.6)]" />
                        <span className="text-[10px] font-bold uppercase text-success">Online</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <WifiOff className="h-4 w-4 text-destructive" />
                        <span className="text-[10px] font-bold uppercase text-destructive">Offline</span>
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
