import { api } from "./api";

export type Capsule = {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  dresses_count?: number;
};

export async function fetchCapsules(): Promise<Capsule[]> {
  const response = await api.get<Capsule[]>("/capsules");
  return response.data;
}
