export interface SimulatorForm {
  phenomenon: string;
  inputSource: "local" | "hub";
  hubInput: string;
  longitude: number;
  latitude: number;
  radiusKm: number;
  amplitudeCm: number;
  influenceDepthM: number;
}
