export function yawPitchToPosition(
  yaw: number,
  pitch: number,
  radius: number = 5
): [number, number, number] {
  const x = radius * Math.cos(pitch) * Math.sin(-yaw);
  const y = radius * Math.sin(pitch);
  const z = -(radius * Math.cos(pitch) * Math.cos(yaw));
  return [x, y, z];
}
