import { api } from "./axios";
export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category: "MAKANAN" | "MINUMAN" | "SNACK" | "DESSERT" | "PAKET";
  imageUrl?: string | null;
  isAvailable: boolean;
  stockQty?: number;
}
interface MenuResponse {
  data: MenuItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
export const getCustomerMenus = async (): Promise<MenuItem[]> => {
  const response = await api.get<MenuResponse>("/menu", {
    params: { limit: 50 },
  });
  return (response.data.data || []).filter((menu) => menu.isAvailable);
};
