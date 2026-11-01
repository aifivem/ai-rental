/** Share of the deposit a returned vehicle earns back: its engine and body health (1 = whole, 0 = wrecked). */
export function condition(vehicle: number): number {
  const engine = Math.max(0, Math.min(1000, GetVehicleEngineHealth(vehicle)));
  const body = Math.max(0, Math.min(1000, GetVehicleBodyHealth(vehicle)));
  return (engine + body) / 2000;
}
