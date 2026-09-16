import { FormEvent, useEffect, useState } from "react";

interface SearchBarProps {
  onSearch: (identificacion: string) => void;
  loading: boolean;
  value?: string;
}

export function SearchBar({ onSearch, loading, value }: SearchBarProps) {
  const [input, setInput] = useState(value ?? "");

  useEffect(() => {
    if (value !== undefined) setInput(value);
  }, [value]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSearch(trimmed);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Cédula, RUC, nombre, correo, teléfono o placa"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="Cédula, RUC, nombre, correo, teléfono o placa a consultar"
        autoFocus
      />
      <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
        {loading ? "Buscando…" : "Buscar"}
      </button>
    </form>
  );
}
