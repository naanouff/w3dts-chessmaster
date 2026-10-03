type ChessBusHandler = (data: unknown) => void;

/** Renderer event bus. Passed to the engine and used by the chess HUD. */
class ChessBus {
  private readonly listeners = new Map<string, Set<ChessBusHandler>>();

  public on(event: string, listener: ChessBusHandler): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
  }

  public off(event: string, listener: ChessBusHandler): void {
    this.listeners.get(event)?.delete(listener);
  }

  public emit(event: string, data?: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) listener(data);
  }
}

export const chessBus = new ChessBus();
