// One Euro Filter（Casiez ほか 2012）。ゆっくりの動きは強くならし、速い動きには遅れず付いていく。
class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  last(): number | null {
    return this.y;
  }
  reset() {
    this.y = null;
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private lastT: number | null = null;

  constructor(
    private minCutoff = 0.6,
    private beta = 0.004,
    private dCutoff = 1.0,
  ) {}

  /** t は秒 */
  filter(value: number, t: number): number {
    const prev = this.x.last();
    const dt = this.lastT === null ? 1 / 30 : Math.max(1e-3, t - this.lastT);
    this.lastT = t;
    const deriv = prev === null ? 0 : (value - prev) / dt;
    const edx = this.dx.filter(deriv, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alpha(cutoff, dt));
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastT = null;
  }
}
