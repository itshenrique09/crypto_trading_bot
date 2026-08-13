import { Link } from "wouter";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Compass className="h-8 w-8 text-muted-foreground/40" />
      <h1 className="text-lg font-semibold">Página não encontrada</h1>
      <p className="text-xs text-muted-foreground">O endereço que abriste não existe.</p>
      <Link
        href="/paper"
        className="mt-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground hover:opacity-90"
      >
        Voltar ao Paper
      </Link>
    </div>
  );
}
